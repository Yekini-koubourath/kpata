import crypto from 'node:crypto';
import { Router } from 'express';
import { z } from 'zod';
import { getDb } from '../db';
import {
  clearSessionCookie,
  createSession,
  hashPassword,
  hashToken,
  rateLimit,
  recordAudit,
  requireAuth,
  setSessionCookie,
  verifyPassword,
  type AuthedRequest,
} from '../auth';
import { computeGroupBalances } from '../../shared/finance';

export const authRouter = Router();

const registerSchema = z.object({
  email: z.string().email('Adresse e-mail invalide.').max(160),
  password: z.string().min(8, 'Le mot de passe doit contenir au moins 8 caractères.').max(128),
  firstName: z.string().trim().min(1, 'Le prénom est requis.').max(80),
  lastName: z.string().trim().min(1, 'Le nom est requis.').max(80),
  phone: z.string().trim().max(40).optional().nullable(),
});

authRouter.post('/register', rateLimit('register', 15, 60_000), (req, res) => {
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message || 'Données invalides.' });
    return;
  }

  const db = getDb();
  const email = parsed.data.email.trim().toLowerCase();
  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
  if (existing) {
    res.status(409).json({ error: 'Un compte existe déjà avec cette adresse e-mail.' });
    return;
  }

  const userId = crypto.randomUUID();
  const nowIso = new Date().toISOString();
  const passwordHash = hashPassword(parsed.data.password);
  const verifyToken = crypto.randomBytes(24).toString('hex');

  db.transaction(() => {
    db.prepare(
      `INSERT INTO users (id, email, first_name, last_name, phone, password_hash, role, email_verified, preferred_lang, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, 'USER', 0, 'fr', ?, ?)`
    ).run(
      userId,
      email,
      parsed.data.firstName,
      parsed.data.lastName,
      parsed.data.phone || null,
      passwordHash,
      nowIso,
      nowIso
    );

    db.prepare('INSERT INTO notification_preferences (user_id) VALUES (?)').run(userId);

    db.prepare(
      `INSERT INTO verification_tokens (id, user_id, type, token_hash, expires_at)
       VALUES (?, ?, 'EMAIL_VERIFY', ?, ?)`
    ).run(
      crypto.randomUUID(),
      userId,
      hashToken(verifyToken),
      new Date(Date.now() + 24 * 3600 * 1000).toISOString()
    );
  })();

  const session = createSession(userId, req);
  setSessionCookie(res, session.token, session.expiresAt);
  recordAudit({
    actorUserId: userId,
    action: 'USER_REGISTERED',
    targetType: 'user',
    targetId: userId,
    ip: req.ip,
  });

  res.status(201).json({
    token: session.token,
    user: {
      id: userId,
      email,
      firstName: parsed.data.firstName,
      lastName: parsed.data.lastName,
      phone: parsed.data.phone || null,
      role: 'USER',
      emailVerified: false,
      preferredLang: 'fr',
      createdAt: nowIso,
    },
    verificationTokenPreview: process.env.NODE_ENV !== 'production' ? verifyToken : undefined,
  });
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

authRouter.post('/login', rateLimit('login', 25, 60_000), (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'E-mail ou mot de passe invalide.' });
    return;
  }

  const db = getDb();
  const email = parsed.data.email.trim().toLowerCase();
  const user = db
    .prepare(
      `SELECT id, email, first_name, last_name, phone, password_hash, role, email_verified, preferred_lang, created_at
       FROM users WHERE email = ?`
    )
    .get(email) as any;

  if (!user || !verifyPassword(parsed.data.password, user.password_hash)) {
    res.status(401).json({ error: 'Identifiants incorrects.' });
    return;
  }

  const session = createSession(user.id, req);
  setSessionCookie(res, session.token, session.expiresAt);
  recordAudit({
    actorUserId: user.id,
    action: 'USER_LOGIN',
    targetType: 'user',
    targetId: user.id,
    ip: req.ip,
  });

  res.json({
    token: session.token,
    user: {
      id: user.id,
      email: user.email,
      firstName: user.first_name,
      lastName: user.last_name,
      phone: user.phone,
      role: user.role,
      emailVerified: Boolean(user.email_verified),
      preferredLang: user.preferred_lang,
      createdAt: user.created_at,
    },
  });
});

authRouter.post('/logout', (req: AuthedRequest, res) => {
  const db = getDb();
  if (req.sessionId) {
    db.prepare('DELETE FROM sessions WHERE id = ?').run(req.sessionId);
  }
  clearSessionCookie(res);
  res.json({ ok: true });
});

authRouter.get('/me', (req: AuthedRequest, res) => {
  if (!req.user) {
    res.json({ user: null });
    return;
  }
  const db = getDb();
  const unreadNotifications = (
    db
      .prepare('SELECT COUNT(*) as c FROM notifications WHERE user_id = ? AND is_read = 0')
      .get(req.user.id) as { c: number }
  ).c;

  const pendingInvitations = (
    db
      .prepare(
        `SELECT COUNT(*) as c FROM group_invitations
         WHERE email = ? AND status = 'PENDING' AND expires_at > ?`
      )
      .get(req.user.email, new Date().toISOString()) as { c: number }
  ).c;

  res.json({
    user: req.user,
    unreadNotifications,
    pendingInvitations,
  });
});

authRouter.put('/profile', requireAuth, (req: AuthedRequest, res) => {
  const schema = z.object({
    firstName: z.string().trim().min(1).max(80),
    lastName: z.string().trim().min(1).max(80),
    phone: z.string().trim().max(40).optional().nullable(),
    preferredLang: z.enum(['fr', 'en']).optional(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Données de profil invalides.' });
    return;
  }

  const db = getDb();
  const nowIso = new Date().toISOString();
  db.prepare(
    `UPDATE users SET first_name = ?, last_name = ?, phone = ?, preferred_lang = COALESCE(?, preferred_lang), updated_at = ?
     WHERE id = ?`
  ).run(
    parsed.data.firstName,
    parsed.data.lastName,
    parsed.data.phone || null,
    parsed.data.preferredLang || null,
    nowIso,
    req.user!.id
  );

  // Sync name inside active memberships linked to this user without altering financial figures
  db.prepare(
    `UPDATE group_members SET first_name = ?, last_name = ?, phone = COALESCE(?, phone)
     WHERE user_id = ?`
  ).run(parsed.data.firstName, parsed.data.lastName, parsed.data.phone || null, req.user!.id);

  res.json({ ok: true });
});

authRouter.post('/change-password', requireAuth, (req: AuthedRequest, res) => {
  const schema = z.object({
    currentPassword: z.string().min(1),
    newPassword: z.string().min(8).max(128),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Mot de passe invalide (8 caractères minimum).' });
    return;
  }

  const db = getDb();
  const row = db
    .prepare('SELECT password_hash FROM users WHERE id = ?')
    .get(req.user!.id) as { password_hash: string };

  if (!verifyPassword(parsed.data.currentPassword, row.password_hash)) {
    res.status(400).json({ error: 'Le mot de passe actuel est incorrect.' });
    return;
  }

  db.prepare('UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?').run(
    hashPassword(parsed.data.newPassword),
    new Date().toISOString(),
    req.user!.id
  );
  recordAudit({
    actorUserId: req.user!.id,
    action: 'PASSWORD_CHANGED',
    targetType: 'user',
    targetId: req.user!.id,
  });

  res.json({ ok: true });
});

authRouter.post('/forgot-password', rateLimit('forgot', 10, 60_000), (req, res) => {
  const email = String(req.body?.email || '').trim().toLowerCase();
  const db = getDb();
  const user = db.prepare('SELECT id FROM users WHERE email = ?').get(email) as { id: string } | undefined;

  let previewToken: string | undefined;
  if (user) {
    const rawToken = crypto.randomBytes(24).toString('hex');
    db.prepare(
      `INSERT INTO verification_tokens (id, user_id, type, token_hash, expires_at)
       VALUES (?, ?, 'PASSWORD_RESET', ?, ?)`
    ).run(
      crypto.randomUUID(),
      user.id,
      hashToken(rawToken),
      new Date(Date.now() + 3600 * 1000).toISOString()
    );
    if (process.env.NODE_ENV !== 'production') {
      previewToken = rawToken;
    }
  }

  res.json({
    ok: true,
    message:
      'Si un compte correspond à cette adresse e-mail, les instructions de réinitialisation ont été générées.',
    resetTokenPreview: previewToken,
  });
});

authRouter.post('/reset-password', (req, res) => {
  const schema = z.object({
    token: z.string().min(10),
    newPassword: z.string().min(8).max(128),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Jeton ou mot de passe invalide.' });
    return;
  }

  const db = getDb();
  const row = db
    .prepare(
      `SELECT id, user_id, expires_at, used_at FROM verification_tokens
       WHERE token_hash = ? AND type = 'PASSWORD_RESET'`
    )
    .get(hashToken(parsed.data.token)) as any;

  if (!row || row.used_at || new Date(row.expires_at).getTime() < Date.now()) {
    res.status(400).json({ error: 'Jeton expiré ou invalide.' });
    return;
  }

  const nowIso = new Date().toISOString();
  db.transaction(() => {
    db.prepare('UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?').run(
      hashPassword(parsed.data.newPassword),
      nowIso,
      row.user_id
    );
    db.prepare('UPDATE verification_tokens SET used_at = ? WHERE id = ?').run(nowIso, row.id);
    db.prepare('DELETE FROM sessions WHERE user_id = ?').run(row.user_id);
  })();

  res.json({ ok: true });
});

authRouter.post('/verify-email', (req, res) => {
  const token = String(req.body?.token || '').trim();
  if (!token) {
    res.status(400).json({ error: 'Jeton manquant.' });
    return;
  }
  const db = getDb();
  const row = db
    .prepare(
      `SELECT id, user_id, expires_at, used_at FROM verification_tokens
       WHERE token_hash = ? AND type = 'EMAIL_VERIFY'`
    )
    .get(hashToken(token)) as any;

  if (!row || row.used_at || new Date(row.expires_at).getTime() < Date.now()) {
    res.status(400).json({ error: 'Jeton de vérification invalide ou expiré.' });
    return;
  }

  const nowIso = new Date().toISOString();
  db.transaction(() => {
    db.prepare('UPDATE users SET email_verified = 1, updated_at = ? WHERE id = ?').run(nowIso, row.user_id);
    db.prepare('UPDATE verification_tokens SET used_at = ? WHERE id = ?').run(nowIso, row.id);
  })();

  res.json({ ok: true });
});

authRouter.get('/sessions', requireAuth, (req: AuthedRequest, res) => {
  const db = getDb();
  const sessions = db
    .prepare(
      `SELECT id, user_agent as userAgent, expires_at as expiresAt, created_at as createdAt
       FROM sessions WHERE user_id = ? ORDER BY created_at DESC`
    )
    .all(req.user!.id) as any[];

  res.json({
    sessions: sessions.map((s) => ({ ...s, current: s.id === req.sessionId })),
  });
});

authRouter.delete('/sessions/:id', requireAuth, (req: AuthedRequest, res) => {
  const db = getDb();
  db.prepare('DELETE FROM sessions WHERE id = ? AND user_id = ?').run(req.params.id, req.user!.id);
  res.json({ ok: true });
});

// Notifications & Personal Dashboard
export const userRouter = Router();

userRouter.get('/notifications', requireAuth, (req: AuthedRequest, res) => {
  const db = getDb();
  const notifications = db
    .prepare(
      `SELECT id, group_id as groupId, type, title, body, is_read as isRead, link, created_at as createdAt
       FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 50`
    )
    .all(req.user!.id);
  const prefs = db
    .prepare('SELECT in_app as inApp, email, push_web as pushWeb, sms, whatsapp FROM notification_preferences WHERE user_id = ?')
    .get(req.user!.id);
  res.json({ notifications, preferences: prefs });
});

userRouter.post('/notifications/:id/read', requireAuth, (req: AuthedRequest, res) => {
  const db = getDb();
  db.prepare('UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?').run(
    req.params.id,
    req.user!.id
  );
  res.json({ ok: true });
});

userRouter.post('/notifications/read-all', requireAuth, (req: AuthedRequest, res) => {
  const db = getDb();
  db.prepare('UPDATE notifications SET is_read = 1 WHERE user_id = ?').run(req.user!.id);
  res.json({ ok: true });
});

userRouter.put('/notifications/preferences', requireAuth, (req: AuthedRequest, res) => {
  const schema = z.object({
    inApp: z.boolean(),
    email: z.boolean(),
    pushWeb: z.boolean(),
    sms: z.boolean(),
    whatsapp: z.boolean(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Préférences invalides.' });
    return;
  }
  const db = getDb();
  db.prepare(
    `INSERT INTO notification_preferences (user_id, in_app, email, push_web, sms, whatsapp)
     VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT(user_id) DO UPDATE SET
       in_app = excluded.in_app, email = excluded.email, push_web = excluded.push_web,
       sms = excluded.sms, whatsapp = excluded.whatsapp`
  ).run(
    req.user!.id,
    parsed.data.inApp ? 1 : 0,
    parsed.data.email ? 1 : 0,
    parsed.data.pushWeb ? 1 : 0,
    parsed.data.sms ? 1 : 0,
    parsed.data.whatsapp ? 1 : 0
  );
  res.json({ ok: true });
});

userRouter.get('/me/dashboard', requireAuth, (req: AuthedRequest, res) => {
  const db = getDb();
  const groupFilter = req.query.groupId ? String(req.query.groupId) : null;
  const userId = req.user!.id;

  const memberships = db
    .prepare(
      `SELECT gm.id as memberId, gm.group_id as groupId, gm.role, g.name as groupName, g.type as groupType, g.currency, g.status as groupStatus
       FROM group_members gm
       JOIN groups g ON g.id = gm.group_id
       WHERE gm.user_id = ? AND gm.status = 'ACTIVE' AND g.status != 'CLOSED'`
    )
    .all(userId) as any[];

  const filteredMemberships = groupFilter
    ? memberships.filter((m) => m.groupId === groupFilter)
    : memberships;

  let totalAdvancesInt = 0;
  let totalPersonalExpensesInt = 0;
  let totalToPayInt = 0;
  let totalToReceiveInt = 0;
  let expectedContributionsInt = 0;
  let confirmedContributionsInt = 0;
  let pendingSettlementsCount = 0;

  const groupSummaries: any[] = [];

  for (const m of filteredMemberships) {
    const members = db
      .prepare('SELECT id, first_name, last_name, is_external, status FROM group_members WHERE group_id = ?')
      .all(m.groupId) as any[];
    const expenses = db
      .prepare('SELECT id, status, scope FROM expenses WHERE group_id = ?')
      .all(m.groupId) as any[];

    const expInputs = expenses.map((e) => ({
      id: e.id,
      status: e.status,
      payers: db
        .prepare('SELECT member_id as memberId, amount_paid_int as amountPaidInt FROM expense_payers WHERE expense_id = ?')
        .all(e.id) as any[],
      shares: db
        .prepare('SELECT member_id as memberId, share_amount_int as shareAmountInt FROM expense_shares WHERE expense_id = ?')
        .all(e.id) as any[],
    }));

    const settlements = db
      .prepare(
        'SELECT id, from_member_id as fromMemberId, to_member_id as toMemberId, amount_int as amountInt, status FROM settlements WHERE group_id = ?'
      )
      .all(m.groupId) as any[];

    const balances = computeGroupBalances(
      members.map((mb) => ({
        id: mb.id,
        displayName: `${mb.first_name} ${mb.last_name}`,
        isExternal: Boolean(mb.is_external),
        status: mb.status,
      })),
      expInputs,
      settlements
    );

    const myBalance = balances.find((b) => b.memberId === m.memberId);
    if (myBalance) {
      totalAdvancesInt += myBalance.totalAdvancedInt;
      if (myBalance.netBalanceInt < 0) totalToPayInt += -myBalance.netBalanceInt;
      if (myBalance.netBalanceInt > 0) totalToReceiveInt += myBalance.netBalanceInt;
    }

    // Personal expenses in this group
    const personalSum = (
      db
        .prepare(
          `SELECT COALESCE(SUM(ep.amount_paid_int), 0) as s
           FROM expense_payers ep
           JOIN expenses e ON e.id = ep.expense_id
           WHERE e.group_id = ? AND e.status = 'ACTIVE' AND e.scope = 'PERSONAL' AND ep.member_id = ?`
        )
        .get(m.groupId, m.memberId) as { s: number }
    ).s;
    totalPersonalExpensesInt += personalSum;

    // Contributions
    const ctrRows = db
      .prepare('SELECT id, expected_amount_int as expectedAmountInt FROM contributions WHERE group_id = ? AND member_id = ?')
      .all(m.groupId, m.memberId) as any[];
    for (const c of ctrRows) {
      expectedContributionsInt += c.expectedAmountInt;
      const confSum = (
        db
          .prepare(
            `SELECT COALESCE(SUM(amount_int), 0) as s FROM contribution_payments
             WHERE contribution_id = ? AND status = 'CONFIRMED'`
          )
          .get(c.id) as { s: number }
      ).s;
      confirmedContributionsInt += confSum;
    }

    const pendingInGroup = settlements.filter(
      (s) => s.status === 'PENDING' && (s.toMemberId === m.memberId || s.fromMemberId === m.memberId)
    ).length;
    pendingSettlementsCount += pendingInGroup;

    groupSummaries.push({
      groupId: m.groupId,
      groupName: m.groupName,
      groupType: m.groupType,
      currency: m.currency,
      role: m.role,
      myNetBalanceInt: myBalance?.netBalanceInt || 0,
      myAdvancesInt: myBalance?.totalAdvancedInt || 0,
      mySharesInt: myBalance?.totalShareInt || 0,
      membersCount: members.filter((mb) => mb.status === 'ACTIVE').length,
    });
  }

  const memberIds = filteredMemberships.map((m) => m.memberId);
  const groupIds = filteredMemberships.map((m) => m.groupId);

  let recentExpenses: any[] = [];
  let upcomingRecurring: any[] = [];
  if (groupIds.length > 0) {
    const placeholders = groupIds.map(() => '?').join(',');
    recentExpenses = db
      .prepare(
        `SELECT e.id, e.group_id as groupId, g.name as groupName, e.title, e.amount_int as amountInt, e.currency, e.expense_date as expenseDate, e.payment_status as paymentStatus, e.status
         FROM expenses e
         JOIN groups g ON g.id = e.group_id
         WHERE e.group_id IN (${placeholders})
         ORDER BY e.created_at DESC LIMIT 10`
      )
      .all(...groupIds);

    upcomingRecurring = db
      .prepare(
        `SELECT e.id, e.group_id as groupId, g.name as groupName, e.title, e.amount_int as amountInt, e.currency, e.recurrence_freq as recurrenceFreq, e.next_occurrence as nextOccurrence
         FROM expenses e
         JOIN groups g ON g.id = e.group_id
         WHERE e.group_id IN (${placeholders}) AND e.is_recurring = 1 AND e.status = 'ACTIVE'
         ORDER BY e.expense_date DESC LIMIT 8`
      )
      .all(...groupIds);
  }

  const notifications = db
    .prepare(
      `SELECT id, group_id as groupId, type, title, body, is_read as isRead, link, created_at as createdAt
       FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 8`
    )
    .all(userId);

  res.json({
    groupsCount: memberships.length,
    totalPersonalExpensesInt,
    totalAdvancesInt,
    totalToPayInt,
    totalToReceiveInt,
    expectedContributionsInt,
    confirmedContributionsInt,
    pendingSettlementsCount,
    groupSummaries,
    recentExpenses,
    upcomingRecurring,
    notifications,
    memberIdsCount: memberIds.length,
  });
});
