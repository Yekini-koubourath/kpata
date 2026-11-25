import crypto from 'node:crypto';
import { Router } from 'express';
import { z } from 'zod';
import { getDb } from '../db';
import {
  createSession,
  getGroupMembership,
  hashPassword,
  rateLimit,
  recordAudit,
  requireAdmin,
  requireAuth,
  setSessionCookie,
  verifyPassword,
  type AuthedRequest,
} from '../auth';
import { getFedaPayConfig, verifyFedaPayWebhookSignature } from '../payments/fedapay';
import {
  applyVerifiedFedaPayResult,
  initiateSubscriptionCheckout,
  verifyFedaPayTransactionOnServer,
} from '../payments/payment-service';
import { querySiteAnalytics, recordSitePageview, type AnalyticsPeriod } from '../analytics';
import { getPublicOrigin } from '../seo';
import { PLAN_ENTITLEMENTS, type SubscriptionPlanCode } from '../../shared/types';

export const publicAndPaymentRouter = Router();

// Public configuration & plans
publicAndPaymentRouter.get('/config/public', (_req, res) => {
  const feda = getFedaPayConfig();
  const gaId = process.env.VITE_GA_MEASUREMENT_ID?.trim() || '';
  res.json({
    ga4Configured: gaId.length > 0,
    ga4MeasurementId: gaId || null,
    fedapayConfigured: feda.configured,
    fedapayEnvironment: feda.environment,
    searchConsoleConfigured: Boolean(process.env.GOOGLE_SITE_VERIFICATION?.trim()),
    bingConfigured: Boolean(process.env.BING_SITE_VERIFICATION?.trim()),
  });
});

publicAndPaymentRouter.get('/plans', (_req, res) => {
  const db = getDb();
  const plans = db
    .prepare(
      `SELECT code, name, description, monthly_price_int as monthlyPriceInt, currency, max_members as maxMembers, features_json as featuresJson, is_active as isActive
       FROM subscription_plans WHERE is_active = 1 ORDER BY monthly_price_int ASC`
    )
    .all() as any[];

  res.json({
    plans: plans.map((p) => ({
      ...p,
      features: JSON.parse(p.featuresJson || '[]'),
      entitlements: PLAN_ENTITLEMENTS[p.code as SubscriptionPlanCode] || PLAN_ENTITLEMENTS.FREE,
    })),
  });
});

publicAndPaymentRouter.get('/announcements', (_req, res) => {
  const db = getDb();
  const rows = db
    .prepare('SELECT id, title, body, level, created_at as createdAt FROM announcements WHERE is_active = 1 ORDER BY created_at DESC LIMIT 5')
    .all();
  res.json({ announcements: rows });
});

publicAndPaymentRouter.post('/contact', rateLimit('contact', 10, 60_000), (req, res) => {
  const schema = z.object({
    name: z.string().trim().min(2).max(100),
    email: z.string().trim().email(),
    subject: z.string().trim().min(2).max(140),
    message: z.string().trim().min(10).max(2000),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Veuillez remplir correctement tous les champs du formulaire.' });
    return;
  }

  const db = getDb();
  const id = crypto.randomUUID();
  db.prepare(
    `INSERT INTO contact_messages (id, name, email, subject, message, status, created_at)
     VALUES (?, ?, ?, ?, ?, 'NEW', ?)`
  ).run(id, parsed.data.name, parsed.data.email, parsed.data.subject, parsed.data.message, new Date().toISOString());

  res.status(201).json({ ok: true, id });
});

// Privacy-safe first-party analytics tracking endpoint (bot-filtered)
publicAndPaymentRouter.post('/analytics/track', rateLimit('track', 120, 60_000), (req, res) => {
  const schema = z.object({
    sessionId: z.string().min(8).max(80),
    visitorToken: z.string().max(80).optional(),
    path: z.string().max(240),
    title: z.string().max(160).optional(),
    referrer: z.string().max(400).optional(),
    durationSec: z.number().min(0).max(3600).optional(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ ok: false });
    return;
  }

  const result = recordSitePageview({
    req,
    sessionId: parsed.data.sessionId,
    visitorToken: parsed.data.visitorToken,
    path: parsed.data.path,
    title: parsed.data.title,
    referrer: parsed.data.referrer,
    durationSec: parsed.data.durationSec,
  });

  res.json(result);
});

// Group Subscriptions & FedaPay
publicAndPaymentRouter.get('/groups/:id/subscription', requireAuth, (req: AuthedRequest, res) => {
  const ctx = getGroupMembership(req.user!.id, req.params.id);
  if (!ctx) {
    res.status(403).json({ error: 'Accès refusé.' });
    return;
  }

  const db = getDb();
  const subscription = db
    .prepare(
      `SELECT s.id, s.plan_code as planCode, s.status, s.start_date as startDate, s.end_date as endDate, s.auto_renew as autoRenew,
              p.name as planName, p.monthly_price_int as monthlyPriceInt, p.currency
       FROM subscriptions s
       JOIN subscription_plans p ON p.code = s.plan_code
       WHERE s.group_id = ?`
    )
    .get(req.params.id);

  const requests = db
    .prepare(
      `SELECT id, plan_code as planCode, months, amount_int as amountInt, currency, payment_channel as paymentChannel,
              reference, proof_note as proofNote, status, admin_comment as adminComment, created_at as createdAt, reviewed_at as reviewedAt
       FROM subscription_requests WHERE group_id = ? ORDER BY created_at DESC`
    )
    .all(req.params.id);

  const transactions = db
    .prepare(
      `SELECT id, plan_code as planCode, months, provider, provider_tx_id as providerTxId, amount_int as amountInt,
              currency, payment_method as paymentMethod, status, created_at as createdAt, verified_at as verifiedAt
       FROM payment_transactions WHERE group_id = ? ORDER BY created_at DESC`
    )
    .all(req.params.id);

  res.json({
    subscription,
    requests,
    transactions,
    fedapay: getFedaPayConfig(),
  });
});

// Manual Mobile Money declaration during Benin pilot (§11.1) — never auto-approved!
publicAndPaymentRouter.post('/groups/:id/subscription/request', requireAuth, (req: AuthedRequest, res) => {
  const ctx = getGroupMembership(req.user!.id, req.params.id);
  if (!ctx || !ctx.permissions.canManageSubscription) {
    res.status(403).json({ error: 'Seul un administrateur ou propriétaire du groupe peut gérer l’abonnement.' });
    return;
  }

  const schema = z.object({
    planCode: z.enum(['PREMIUM', 'ORG']),
    months: z.number().int().min(1).max(24).default(1),
    reference: z.string().trim().min(3, 'Référence de transaction requise.').max(100),
    proofNote: z.string().trim().max(300).optional().nullable(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message || 'Données invalides.' });
    return;
  }

  const db = getDb();
  const plan = db
    .prepare('SELECT monthly_price_int, currency FROM subscription_plans WHERE code = ? AND is_active = 1')
    .get(parsed.data.planCode) as { monthly_price_int: number; currency: string } | undefined;
  if (!plan) {
    res.status(404).json({ error: 'Offre introuvable.' });
    return;
  }

  const id = crypto.randomUUID();
  const amountInt = plan.monthly_price_int * parsed.data.months;
  db.prepare(
    `INSERT INTO subscription_requests
      (id, group_id, requested_by_user_id, plan_code, months, amount_int, currency, payment_channel, reference, proof_note, status, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, 'MANUAL', ?, ?, 'PENDING', ?)`
  ).run(
    id,
    req.params.id,
    req.user!.id,
    parsed.data.planCode,
    parsed.data.months,
    amountInt,
    plan.currency,
    parsed.data.reference,
    parsed.data.proofNote || null,
    new Date().toISOString()
  );

  recordAudit({
    actorUserId: req.user!.id,
    groupId: req.params.id,
    action: 'MANUAL_SUBSCRIPTION_REQUESTED',
    targetType: 'subscription_request',
    targetId: id,
    details: { planCode: parsed.data.planCode, months: parsed.data.months, amountInt },
  });

  res.status(201).json({ id, status: 'PENDING', amountInt });
});

publicAndPaymentRouter.post('/payments/fedapay/checkout', requireAuth, async (req: AuthedRequest, res) => {
  const schema = z.object({
    groupId: z.string(),
    planCode: z.enum(['PREMIUM', 'ORG']),
    months: z.number().int().min(1).max(24).default(1),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Paramètres de paiement invalides.' });
    return;
  }

  const ctx = getGroupMembership(req.user!.id, parsed.data.groupId);
  if (!ctx || !ctx.permissions.canManageSubscription) {
    res.status(403).json({ error: 'Permission insuffisante pour souscrire pour ce groupe.' });
    return;
  }

  try {
    const result = await initiateSubscriptionCheckout({
      groupId: parsed.data.groupId,
      userId: req.user!.id,
      planCode: parsed.data.planCode,
      months: parsed.data.months,
      callbackBaseUrl: getPublicOrigin(req),
    });
    res.json(result);
  } catch (err: any) {
    res.status(502).json({ error: err?.message || 'Erreur lors de l’initialisation FedaPay.' });
  }
});

publicAndPaymentRouter.post('/payments/fedapay/verify', requireAuth, async (req: AuthedRequest, res) => {
  const txId = String(req.body?.transactionId || '').trim();
  if (!txId) {
    res.status(400).json({ error: 'Identifiant de transaction manquant.' });
    return;
  }

  const db = getDb();
  const tx = db.prepare('SELECT group_id FROM payment_transactions WHERE id = ?').get(txId) as
    | { group_id: string }
    | undefined;
  if (!tx) {
    res.status(404).json({ error: 'Transaction introuvable.' });
    return;
  }
  const ctx = getGroupMembership(req.user!.id, tx.group_id);
  if (!ctx) {
    res.status(403).json({ error: 'Accès refusé.' });
    return;
  }

  try {
    const out = await verifyFedaPayTransactionOnServer(txId);
    res.json(out);
  } catch (err: any) {
    res.status(502).json({ error: err?.message || 'Vérification FedaPay impossible.' });
  }
});

// FedaPay Webhook Handler (expects req.rawBody Buffer set by express.json verify hook)
publicAndPaymentRouter.post('/webhooks/fedapay', (req: any, res) => {
  const signature = req.headers['x-fedapay-signature'] as string | undefined;
  const webhookSecret = process.env.FEDAPAY_WEBHOOK_SECRET;
  const rawBody = req.rawBody || JSON.stringify(req.body || {});

  if (!verifyFedaPayWebhookSignature(rawBody, signature, webhookSecret)) {
    res.status(401).json({ error: 'Signature webhook FedaPay invalide.' });
    return;
  }

  const payload = req.body || {};
  const entity = payload.entity || payload.data || payload['v1/transaction'] || {};
  const providerTxId = String(entity.id || '');
  if (!providerTxId) {
    res.status(400).json({ error: 'Payload webhook incomplet.' });
    return;
  }

  const result = applyVerifiedFedaPayResult({
    providerTxId,
    reportedStatus: String(entity.status || payload.name || ''),
    reportedAmount: Number(entity.amount || 0),
    reportedCurrency: String(entity.currency?.iso || 'XOF'),
    paymentMethod: entity.mode ? String(entity.mode) : undefined,
    rawPayload: payload,
  });

  res.json({ received: true, ...result });
});

// ============================================================================
// CENTRAL ADMIN SPACE (Strictly separated from Group Roles)
// ============================================================================

export const adminRouter = Router();

function isAdminPasscodeConfigured(): boolean {
  if (process.env.ADMIN_BOOTSTRAP_PASSCODE && process.env.ADMIN_BOOTSTRAP_PASSCODE.trim().length > 0) {
    return true;
  }
  const db = getDb();
  const claimed = db.prepare("SELECT value FROM system_config WHERE key = 'admin_passcode_hash'").get();
  if (claimed) return true;
  const existingAdmin = db.prepare("SELECT id FROM users WHERE role IN ('ADMIN', 'SUPER_ADMIN')").get();
  return Boolean(existingAdmin);
}

adminRouter.get('/bootstrap-status', (req: AuthedRequest, res) => {
  const db = getDb();
  const hasEnvPasscode = Boolean(
    process.env.ADMIN_BOOTSTRAP_PASSCODE && process.env.ADMIN_BOOTSTRAP_PASSCODE.trim().length > 0
  );
  const hasClaimedHash = Boolean(
    db.prepare("SELECT value FROM system_config WHERE key = 'admin_passcode_hash'").get()
  );
  const hasAdminUser = Boolean(
    db.prepare("SELECT id FROM users WHERE role IN ('ADMIN', 'SUPER_ADMIN')").get()
  );

  res.json({
    needsInitialSetup: !hasEnvPasscode && !hasClaimedHash && !hasAdminUser,
    isAuthenticatedAdmin: Boolean(
      req.user && (req.user.role === 'ADMIN' || req.user.role === 'SUPER_ADMIN')
    ),
  });
});

adminRouter.post('/bootstrap', rateLimit('admin_boot', 15, 60_000), (req: AuthedRequest, res) => {
  const schema = z.object({
    passcode: z.string().min(8, 'Le code d’administration doit contenir au moins 8 caractères.').max(128),
    email: z.string().email().optional(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message || 'Données invalides.' });
    return;
  }

  const db = getDb();
  const envPasscode = process.env.ADMIN_BOOTSTRAP_PASSCODE?.trim();
  const storedHashRow = db
    .prepare("SELECT value FROM system_config WHERE key = 'admin_passcode_hash'")
    .get() as { value: string } | undefined;
  const nowIso = new Date().toISOString();

  // Case 1: env passcode is configured — verify against it
  if (envPasscode && envPasscode.length > 0) {
    if (parsed.data.passcode !== envPasscode) {
      res.status(401).json({ error: 'Code administrateur invalide.' });
      return;
    }
  } else if (storedHashRow) {
    // Case 2: claimed hash exists — verify against it
    if (!verifyPassword(parsed.data.passcode, storedHashRow.value)) {
      res.status(401).json({ error: 'Code administrateur invalide.' });
      return;
    }
  } else {
    // Case 3: first-run claim — atomically store hashed admin passcode
    const hasAdmin = db.prepare("SELECT id FROM users WHERE role IN ('ADMIN', 'SUPER_ADMIN')").get();
    if (hasAdmin) {
      res.status(403).json({ error: 'Un administrateur existe déjà. Connectez-vous avec ce compte.' });
      return;
    }
    db.prepare(
      `INSERT INTO system_config (key, value, updated_at) VALUES ('admin_passcode_hash', ?, ?)`
    ).run(hashPassword(parsed.data.passcode), nowIso);
  }

  // Promote current user OR create/elevate admin account
  let targetUserId = req.user?.id;
  if (targetUserId) {
    db.prepare("UPDATE users SET role = 'SUPER_ADMIN', updated_at = ? WHERE id = ?").run(
      nowIso,
      targetUserId
    );
  } else {
    const adminEmail = (parsed.data.email || 'admin@kpata.bj').trim().toLowerCase();
    const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(adminEmail) as
      | { id: string }
      | undefined;
    if (existing) {
      targetUserId = existing.id;
      db.prepare("UPDATE users SET role = 'SUPER_ADMIN', updated_at = ? WHERE id = ?").run(
        nowIso,
        targetUserId
      );
    } else {
      targetUserId = crypto.randomUUID();
      db.prepare(
        `INSERT INTO users (id, email, first_name, last_name, password_hash, role, email_verified, preferred_lang, created_at, updated_at)
         VALUES (?, ?, 'Admin', 'KPATA', ?, 'SUPER_ADMIN', 1, 'fr', ?, ?)`
      ).run(targetUserId, adminEmail, hashPassword(parsed.data.passcode), nowIso, nowIso);
      db.prepare('INSERT OR IGNORE INTO notification_preferences (user_id) VALUES (?)').run(targetUserId);
    }
  }

  const session = createSession(targetUserId, req);
  setSessionCookie(res, session.token, session.expiresAt);
  const userRow = db
    .prepare(
      'SELECT id, email, first_name as firstName, last_name as lastName, phone, role, email_verified as emailVerified, preferred_lang as preferredLang, created_at as createdAt FROM users WHERE id = ?'
    )
    .get(targetUserId) as any;

  recordAudit({
    actorUserId: targetUserId,
    action: 'ADMIN_ACCESS_VERIFIED',
    targetType: 'user',
    targetId: targetUserId,
    ip: req.ip,
  });

  res.json({
    token: session.token,
    user: { ...userRow, emailVerified: Boolean(userRow.emailVerified) },
  });
});

// Protected Admin endpoints
adminRouter.use(requireAdmin);

adminRouter.get('/overview', (_req, res) => {
  const db = getDb();
  const usersCount = (db.prepare('SELECT COUNT(*) as c FROM users').get() as { c: number }).c;
  const groupsCount = (db.prepare('SELECT COUNT(*) as c FROM groups').get() as { c: number }).c;
  const activeSubs = db
    .prepare(
      `SELECT plan_code as planCode, COUNT(*) as count FROM subscriptions WHERE status = 'ACTIVE' GROUP BY plan_code`
    )
    .all();
  const pendingRequests = (
    db.prepare("SELECT COUNT(*) as c FROM subscription_requests WHERE status = 'PENDING'").get() as {
      c: number;
    }
  ).c;
  const expensesVolumeInt = (
    db.prepare("SELECT COALESCE(SUM(amount_int), 0) as s FROM expenses WHERE status = 'ACTIVE'").get() as {
      s: number;
    }
  ).s;
  const totalTransactionsCount = (
    db.prepare('SELECT COUNT(*) as c FROM payment_transactions').get() as { c: number }
  ).c;

  // Non-sensitive group metadata only (never leaks private expense line items!)
  const groupsSummary = db
    .prepare(
      `SELECT g.id, g.name, g.type, g.country, g.currency, g.status, g.created_at as createdAt,
              COALESCE(s.plan_code, 'FREE') as planCode, COALESCE(s.status, 'ACTIVE') as subscriptionStatus,
              (SELECT COUNT(*) FROM group_members gm WHERE gm.group_id = g.id AND gm.status = 'ACTIVE') as membersCount
       FROM groups g
       LEFT JOIN subscriptions s ON s.group_id = g.id
       ORDER BY g.created_at DESC LIMIT 50`
    )
    .all();

  const mrrRow = db
    .prepare(
      `SELECT COALESCE(SUM(p.monthly_price_int), 0) as mrr
       FROM subscriptions s
       JOIN subscription_plans p ON p.code = s.plan_code
       WHERE s.status = 'ACTIVE'`
    )
    .get() as { mrr: number };

  res.json({
    usersCount,
    groupsCount,
    activeSubs,
    pendingRequests,
    expensesVolumeInt,
    totalTransactionsCount,
    estimatedMrrInt: mrrRow.mrr,
    groupsSummary,
    fedapay: getFedaPayConfig(),
  });
});

adminRouter.get('/site-analytics', (req, res) => {
  const rawPeriod = String(req.query.period || 'month');
  const period: AnalyticsPeriod =
    rawPeriod === 'day' || rawPeriod === 'week' || rawPeriod === 'year' ? rawPeriod : 'month';
  res.json(querySiteAnalytics(period));
});

adminRouter.get('/users', (_req, res) => {
  const db = getDb();
  const users = db
    .prepare(
      `SELECT id, email, first_name as firstName, last_name as lastName, phone, role, email_verified as emailVerified, created_at as createdAt
       FROM users ORDER BY created_at DESC LIMIT 100`
    )
    .all();
  res.json({ users });
});

adminRouter.put('/users/:id/role', (req: AuthedRequest, res) => {
  const role = String(req.body?.role || '');
  if (!['USER', 'ADMIN', 'SUPER_ADMIN'].includes(role)) {
    res.status(400).json({ error: 'Rôle invalide.' });
    return;
  }
  const db = getDb();
  db.prepare('UPDATE users SET role = ?, updated_at = ? WHERE id = ?').run(
    role,
    new Date().toISOString(),
    req.params.id
  );
  recordAudit({
    actorUserId: req.user!.id,
    action: 'ADMIN_USER_ROLE_UPDATED',
    targetType: 'user',
    targetId: req.params.id,
    details: { role },
  });
  res.json({ ok: true });
});

adminRouter.get('/subscription-requests', (_req, res) => {
  const db = getDb();
  const requests = db
    .prepare(
      `SELECT sr.id, sr.group_id as groupId, g.name as groupName, sr.plan_code as planCode, sr.months,
              sr.amount_int as amountInt, sr.currency, sr.payment_channel as paymentChannel, sr.reference,
              sr.proof_note as proofNote, sr.status, sr.admin_comment as adminComment, sr.created_at as createdAt,
              u.first_name || ' ' || u.last_name as requestedByName, u.email as requestedByEmail
       FROM subscription_requests sr
       JOIN groups g ON g.id = sr.group_id
       JOIN users u ON u.id = sr.requested_by_user_id
       ORDER BY sr.created_at DESC LIMIT 100`
    )
    .all();
  res.json({ requests });
});

adminRouter.post('/subscription-requests/:id/approve', (req: AuthedRequest, res) => {
  const comment = String(req.body?.comment || 'Paiement vérifié manuellement par l’administrateur.').trim();
  const db = getDb();
  const sr = db.prepare("SELECT * FROM subscription_requests WHERE id = ? AND status = 'PENDING'").get(req.params.id) as any;
  if (!sr) {
    res.status(404).json({ error: 'Demande introuvable ou déjà traitée.' });
    return;
  }

  const nowIso = new Date().toISOString();
  const existingSub = db.prepare('SELECT * FROM subscriptions WHERE group_id = ?').get(sr.group_id) as any;
  const baseStart =
    existingSub?.end_date && new Date(existingSub.end_date).getTime() > Date.now()
      ? new Date(existingSub.end_date)
      : new Date();
  const endDate = new Date(baseStart);
  endDate.setMonth(endDate.getMonth() + sr.months);

  db.transaction(() => {
    db.prepare(
      `UPDATE subscription_requests
       SET status = 'APPROVED', admin_comment = ?, reviewed_by = ?, reviewed_at = ?
       WHERE id = ?`
    ).run(comment, req.user!.id, nowIso, sr.id);

    if (existingSub) {
      db.prepare(
        `UPDATE subscriptions
         SET plan_code = ?, status = 'ACTIVE', start_date = ?, end_date = ?, updated_at = ?
         WHERE group_id = ?`
      ).run(sr.plan_code, nowIso, endDate.toISOString(), nowIso, sr.group_id);
    } else {
      db.prepare(
        `INSERT INTO subscriptions (id, group_id, plan_code, status, start_date, end_date, auto_renew, updated_at)
         VALUES (?, ?, ?, 'ACTIVE', ?, ?, 0, ?)`
      ).run(crypto.randomUUID(), sr.group_id, sr.plan_code, nowIso, endDate.toISOString(), nowIso);
    }
  })();

  recordAudit({
    actorUserId: req.user!.id,
    groupId: sr.group_id,
    action: 'ADMIN_SUBSCRIPTION_APPROVED',
    targetType: 'subscription_request',
    targetId: sr.id,
    details: { planCode: sr.plan_code, months: sr.months, comment },
  });

  res.json({ ok: true });
});

adminRouter.post('/subscription-requests/:id/reject', (req: AuthedRequest, res) => {
  const comment = String(req.body?.comment || 'Référence de paiement non vérifiable.').trim();
  const db = getDb();
  const sr = db.prepare("SELECT * FROM subscription_requests WHERE id = ? AND status = 'PENDING'").get(req.params.id) as any;
  if (!sr) {
    res.status(404).json({ error: 'Demande introuvable ou déjà traitée.' });
    return;
  }

  db.prepare(
    `UPDATE subscription_requests
     SET status = 'REJECTED', admin_comment = ?, reviewed_by = ?, reviewed_at = ?
     WHERE id = ?`
  ).run(comment, req.user!.id, new Date().toISOString(), sr.id);

  recordAudit({
    actorUserId: req.user!.id,
    groupId: sr.group_id,
    action: 'ADMIN_SUBSCRIPTION_REJECTED',
    targetType: 'subscription_request',
    targetId: sr.id,
    details: { comment },
  });

  res.json({ ok: true });
});

adminRouter.put('/plans/:code', (req: AuthedRequest, res) => {
  const schema = z.object({
    monthlyPriceInt: z.number().int().min(0).max(100000),
    description: z.string().trim().min(5).max(300).optional(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Tarif invalide.' });
    return;
  }

  const db = getDb();
  db.prepare(
    `UPDATE subscription_plans
     SET monthly_price_int = ?, description = COALESCE(?, description)
     WHERE code = ?`
  ).run(parsed.data.monthlyPriceInt, parsed.data.description || null, req.params.code);

  recordAudit({
    actorUserId: req.user!.id,
    action: 'ADMIN_PLAN_UPDATED',
    targetType: 'subscription_plan',
    targetId: req.params.code,
    details: parsed.data,
  });

  res.json({ ok: true });
});

adminRouter.post('/announcements', (req: AuthedRequest, res) => {
  const schema = z.object({
    title: z.string().trim().min(2).max(120),
    body: z.string().trim().min(5).max(500),
    level: z.enum(['INFO', 'WARNING', 'SUCCESS']).default('INFO'),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Annonce invalide.' });
    return;
  }
  const db = getDb();
  const id = crypto.randomUUID();
  db.prepare(
    'INSERT INTO announcements (id, title, body, level, is_active, created_at) VALUES (?, ?, ?, ?, 1, ?)'
  ).run(id, parsed.data.title, parsed.data.body, parsed.data.level, new Date().toISOString());
  res.status(201).json({ id });
});

adminRouter.delete('/announcements/:id', (req, res) => {
  const db = getDb();
  db.prepare('DELETE FROM announcements WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

adminRouter.get('/audit-logs', (_req, res) => {
  const db = getDb();
  const logs = db
    .prepare(
      `SELECT a.id, a.action, a.target_type as targetType, a.target_id as targetId, a.group_id as groupId,
              a.details_json as detailsJson, a.created_at as createdAt,
              COALESCE(u.email, 'Système') as actorEmail
       FROM audit_logs a
       LEFT JOIN users u ON u.id = a.actor_user_id
       ORDER BY a.created_at DESC LIMIT 80`
    )
    .all();
  res.json({ logs });
});

adminRouter.get('/contact-messages', (_req, res) => {
  const db = getDb();
  const messages = db
    .prepare('SELECT id, name, email, subject, message, status, created_at as createdAt FROM contact_messages ORDER BY created_at DESC LIMIT 50')
    .all();
  res.json({ messages });
});
