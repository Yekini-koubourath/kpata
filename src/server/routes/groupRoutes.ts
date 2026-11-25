import crypto from 'node:crypto';
import { Router } from 'express';
import { z } from 'zod';
import { getDb } from '../db';
import {
  getGroupEntitlements,
  getGroupMembership,
  recordAudit,
  requireAuth,
  type AuthedRequest,
} from '../auth';

export const groupRouter = Router();

groupRouter.use(requireAuth);

groupRouter.get('/', (req: AuthedRequest, res) => {
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT g.id, g.name, g.type, g.description, g.country, g.currency, g.timezone, g.visibility, g.status, g.created_at as createdAt,
              gm.role as myRole, gm.id as myMemberId,
              COALESCE(s.plan_code, 'FREE') as planCode, COALESCE(s.status, 'ACTIVE') as subscriptionStatus,
              (SELECT COUNT(*) FROM group_members gm2 WHERE gm2.group_id = g.id AND gm2.status = 'ACTIVE') as membersCount,
              (SELECT COALESCE(SUM(e.amount_int), 0) FROM expenses e WHERE e.group_id = g.id AND e.status = 'ACTIVE') as totalExpensesInt
       FROM group_members gm
       JOIN groups g ON g.id = gm.group_id
       LEFT JOIN subscriptions s ON s.group_id = g.id
       WHERE gm.user_id = ? AND gm.status = 'ACTIVE'
       ORDER BY g.created_at DESC`
    )
    .all(req.user!.id);

  res.json({ groups: rows });
});

groupRouter.post('/', (req: AuthedRequest, res) => {
  const schema = z.object({
    name: z.string().trim().min(2, 'Nom de groupe requis (2 caractères min).').max(120),
    type: z.enum([
      'FAMILLE', 'FOYER', 'COUPLE', 'COLOCATION', 'AMIS', 'ASSOCIATION',
      'ORGANISATION', 'PROFESSIONNEL', 'VOYAGE', 'EVENEMENT', 'COMMUNAUTE', 'AUTRE',
    ]),
    description: z.string().trim().max(500).optional().nullable(),
    country: z.string().trim().min(2).max(5).default('BJ'),
    currency: z.string().trim().min(3).max(5).default('XOF'),
    timezone: z.string().trim().max(60).default('Africa/Porto-Novo'),
    visibility: z.enum(['PRIVATE', 'LINK', 'PUBLIC']).default('PRIVATE'),
    desiredPlanCode: z.enum(['FREE', 'PREMIUM', 'ORG']).default('FREE'),
  });

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message || 'Données du groupe invalides.' });
    return;
  }

  const db = getDb();
  const groupId = crypto.randomUUID();
  const memberId = crypto.randomUUID();
  const nowIso = new Date().toISOString();

  db.transaction(() => {
    db.prepare(
      `INSERT INTO groups (id, name, type, description, country, currency, timezone, visibility, status, created_by, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'ACTIVE', ?, ?, ?)`
    ).run(
      groupId,
      parsed.data.name,
      parsed.data.type,
      parsed.data.description || null,
      parsed.data.country,
      parsed.data.currency,
      parsed.data.timezone,
      parsed.data.visibility,
      req.user!.id,
      nowIso,
      nowIso
    );

    db.prepare(
      `INSERT INTO group_members (id, group_id, user_id, first_name, last_name, email, phone, role, status, is_external, joined_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'OWNER', 'ACTIVE', 0, ?)`
    ).run(
      memberId,
      groupId,
      req.user!.id,
      req.user!.firstName,
      req.user!.lastName,
      req.user!.email,
      req.user!.phone,
      nowIso
    );

    db.prepare(
      `INSERT INTO subscriptions (id, group_id, plan_code, status, start_date, auto_renew, updated_at)
       VALUES (?, ?, 'FREE', 'ACTIVE', ?, 0, ?)`
    ).run(crypto.randomUUID(), groupId, nowIso, nowIso);
  })();

  recordAudit({
    actorUserId: req.user!.id,
    groupId,
    action: 'GROUP_CREATED',
    targetType: 'group',
    targetId: groupId,
    details: { name: parsed.data.name, type: parsed.data.type, currency: parsed.data.currency },
    ip: req.ip,
  });

  // Paid plans NEVER activate at creation: group starts on FREE until checkout / payment verification succeeds
  res.status(201).json({
    id: groupId,
    memberId,
    requiresPayment: parsed.data.desiredPlanCode !== 'FREE',
    desiredPlanCode: parsed.data.desiredPlanCode,
  });
});

groupRouter.get('/:id', (req: AuthedRequest, res) => {
  const ctx = getGroupMembership(req.user!.id, req.params.id);
  if (!ctx) {
    res.status(403).json({ error: "Vous n'avez pas accès à ce groupe." });
    return;
  }

  const db = getDb();
  const group = db
    .prepare(
      `SELECT g.id, g.name, g.type, g.description, g.country, g.currency, g.timezone, g.visibility, g.status, g.created_by as createdBy, g.created_at as createdAt,
              COALESCE(s.plan_code, 'FREE') as planCode, COALESCE(s.status, 'ACTIVE') as subscriptionStatus, s.end_date as subscriptionEndDate
       FROM groups g
       LEFT JOIN subscriptions s ON s.group_id = g.id
       WHERE g.id = ?`
    )
    .get(req.params.id);

  if (!group) {
    res.status(404).json({ error: 'Groupe introuvable.' });
    return;
  }

  const members = db
    .prepare(
      `SELECT id, user_id as userId, first_name as firstName, last_name as lastName, email, phone, family_relation as familyRelation,
              role, status, is_external as isExternal, joined_at as joinedAt
       FROM group_members WHERE group_id = ? ORDER BY joined_at ASC`
    )
    .all(req.params.id);

  const invitations = ctx.permissions.canInvite
    ? db
        .prepare(
          `SELECT id, email, phone, code, token, role, status, expires_at as expiresAt, created_at as createdAt
           FROM group_invitations WHERE group_id = ? ORDER BY created_at DESC`
        )
        .all(req.params.id)
    : [];

  const linkRequests = ctx.permissions.canManageMembers
    ? db
        .prepare(
          `SELECT mlr.id, mlr.member_id as memberId, mlr.user_id as userId, mlr.verification_contact as verificationContact, mlr.status, mlr.created_at as createdAt,
                  u.first_name as userFirstName, u.last_name as userLastName, u.email as userEmail,
                  gm.first_name as memberFirstName, gm.last_name as memberLastName
           FROM member_link_requests mlr
           JOIN users u ON u.id = mlr.user_id
           JOIN group_members gm ON gm.id = mlr.member_id
           WHERE mlr.group_id = ? AND mlr.status = 'PENDING'`
        )
        .all(req.params.id)
    : [];

  res.json({
    group,
    entitlements: getGroupEntitlements(req.params.id),
    myMembership: ctx,
    members,
    invitations,
    linkRequests,
  });
});

groupRouter.put('/:id', (req: AuthedRequest, res) => {
  const ctx = getGroupMembership(req.user!.id, req.params.id);
  if (!ctx || !ctx.permissions.canManageGroup) {
    res.status(403).json({ error: 'Permission insuffisante pour modifier ce groupe.' });
    return;
  }

  const schema = z.object({
    name: z.string().trim().min(2).max(120),
    description: z.string().trim().max(500).optional().nullable(),
    country: z.string().trim().min(2).max(5).optional(),
    timezone: z.string().trim().max(60).optional(),
    visibility: z.enum(['PRIVATE', 'LINK', 'PUBLIC']).optional(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Paramètres invalides.' });
    return;
  }

  const db = getDb();
  const nowIso = new Date().toISOString();
  db.prepare(
    `UPDATE groups
     SET name = ?, description = ?, country = COALESCE(?, country), timezone = COALESCE(?, timezone), visibility = COALESCE(?, visibility), updated_at = ?
     WHERE id = ?`
  ).run(
    parsed.data.name,
    parsed.data.description || null,
    parsed.data.country || null,
    parsed.data.timezone || null,
    parsed.data.visibility || null,
    nowIso,
    req.params.id
  );

  recordAudit({
    actorUserId: req.user!.id,
    groupId: req.params.id,
    action: 'GROUP_UPDATED',
    targetType: 'group',
    targetId: req.params.id,
    details: parsed.data,
  });

  res.json({ ok: true });
});

groupRouter.post('/:id/status', (req: AuthedRequest, res) => {
  const ctx = getGroupMembership(req.user!.id, req.params.id);
  if (!ctx || ctx.role !== 'OWNER') {
    res.status(403).json({ error: 'Seul le propriétaire peut archiver ou fermer le groupe.' });
    return;
  }
  const status = String(req.body?.status || '');
  if (!['ACTIVE', 'ARCHIVED', 'CLOSED'].includes(status)) {
    res.status(400).json({ error: 'Statut invalide.' });
    return;
  }
  const db = getDb();
  db.prepare('UPDATE groups SET status = ?, updated_at = ? WHERE id = ?').run(
    status,
    new Date().toISOString(),
    req.params.id
  );
  recordAudit({
    actorUserId: req.user!.id,
    groupId: req.params.id,
    action: `GROUP_STATUS_${status}`,
    targetType: 'group',
    targetId: req.params.id,
  });
  res.json({ ok: true });
});

// Add external member without KPATA account (§3.3.2)
groupRouter.post('/:id/members', (req: AuthedRequest, res) => {
  const ctx = getGroupMembership(req.user!.id, req.params.id);
  if (!ctx || !ctx.permissions.canManageMembers) {
    res.status(403).json({ error: 'Permission insuffisante pour ajouter un membre.' });
    return;
  }

  const schema = z.object({
    firstName: z.string().trim().min(1, 'Prénom requis.').max(80),
    lastName: z.string().trim().min(1, 'Nom requis.').max(80),
    email: z.string().trim().email().optional().nullable().or(z.literal('')),
    phone: z.string().trim().max(40).optional().nullable(),
    familyRelation: z.string().trim().max(60).optional().nullable(),
    role: z.enum(['ADMIN', 'TREASURER', 'MEMBER', 'OBSERVER']).default('MEMBER'),
  });

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message || 'Données membre invalides.' });
    return;
  }

  const db = getDb();
  const entitlements = getGroupEntitlements(req.params.id);
  const activeCount = (
    db.prepare("SELECT COUNT(*) as c FROM group_members WHERE group_id = ? AND status = 'ACTIVE'").get(req.params.id) as {
      c: number;
    }
  ).c;
  if (entitlements.maxMembers !== null && activeCount >= entitlements.maxMembers) {
    res.status(402).json({
      code: 'PLAN_UPGRADE_REQUIRED',
      error: `Votre offre ${entitlements.label} est limitée à ${entitlements.maxMembers} membres. Passez à une offre supérieure pour ajouter plus de membres.`,
      requiredPlans: entitlements.code === 'FREE' ? ['PREMIUM', 'ORG'] : ['ORG'],
    });
    return;
  }
  if (parsed.data.role === 'TREASURER' && !entitlements.allowTreasurerRole) {
    res.status(402).json({
      code: 'PLAN_UPGRADE_REQUIRED',
      error: 'Le rôle Trésorier dédié est réservé à l’offre Association & Organisation.',
      requiredPlans: ['ORG'],
    });
    return;
  }

  const memberId = crypto.randomUUID();
  const nowIso = new Date().toISOString();

  db.prepare(
    `INSERT INTO group_members (id, group_id, user_id, first_name, last_name, email, phone, family_relation, role, status, is_external, joined_at)
     VALUES (?, ?, NULL, ?, ?, ?, ?, ?, ?, 'ACTIVE', 1, ?)`
  ).run(
    memberId,
    req.params.id,
    parsed.data.firstName,
    parsed.data.lastName,
    parsed.data.email || null,
    parsed.data.phone || null,
    parsed.data.familyRelation || null,
    parsed.data.role,
    nowIso
  );

  recordAudit({
    actorUserId: req.user!.id,
    groupId: req.params.id,
    action: 'EXTERNAL_MEMBER_ADDED',
    targetType: 'group_member',
    targetId: memberId,
    details: { name: `${parsed.data.firstName} ${parsed.data.lastName}`, isExternal: true },
  });

  res.status(201).json({ id: memberId, isExternal: true });
});

groupRouter.put('/:id/members/:memberId', (req: AuthedRequest, res) => {
  const ctx = getGroupMembership(req.user!.id, req.params.id);
  if (!ctx || !ctx.permissions.canManageMembers) {
    res.status(403).json({ error: 'Permission insuffisante.' });
    return;
  }

  const schema = z.object({
    role: z.enum(['OWNER', 'ADMIN', 'TREASURER', 'MEMBER', 'OBSERVER']).optional(),
    status: z.enum(['ACTIVE', 'SUSPENDED', 'LEFT']).optional(),
    familyRelation: z.string().trim().max(60).optional().nullable(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Données invalides.' });
    return;
  }

  if (parsed.data.role && !ctx.permissions.canAssignRoles && parsed.data.role === 'OWNER') {
    res.status(403).json({ error: 'Seul le propriétaire peut transférer la propriété du groupe.' });
    return;
  }
  if (parsed.data.role === 'TREASURER') {
    const entitlements = getGroupEntitlements(req.params.id);
    if (!entitlements.allowTreasurerRole) {
      res.status(402).json({
        code: 'PLAN_UPGRADE_REQUIRED',
        error: 'Le rôle Trésorier dédié nécessite l’offre Association & Organisation.',
        requiredPlans: ['ORG'],
      });
      return;
    }
  }

  const db = getDb();
  const target = db
    .prepare('SELECT id, role, user_id FROM group_members WHERE id = ? AND group_id = ?')
    .get(req.params.memberId, req.params.id) as any;

  if (!target) {
    res.status(404).json({ error: 'Membre introuvable dans ce groupe.' });
    return;
  }

  if (target.role === 'OWNER' && parsed.data.status && parsed.data.status !== 'ACTIVE') {
    res.status(400).json({ error: 'Transférez la propriété avant de retirer le propriétaire.' });
    return;
  }

  db.prepare(
    `UPDATE group_members
     SET role = COALESCE(?, role), status = COALESCE(?, status), family_relation = COALESCE(?, family_relation)
     WHERE id = ? AND group_id = ?`
  ).run(
    parsed.data.role || null,
    parsed.data.status || null,
    parsed.data.familyRelation ?? null,
    req.params.memberId,
    req.params.id
  );

  if (target.user_id && parsed.data.role) {
    db.prepare(
      `INSERT INTO notifications (id, user_id, group_id, type, title, body, link, created_at)
       VALUES (?, ?, ?, 'ROLE_CHANGED', 'Rôle mis à jour', ?, ?, ?)`
    ).run(
      crypto.randomUUID(),
      target.user_id,
      req.params.id,
      `Votre rôle dans le groupe a été mis à jour : ${parsed.data.role}.`,
      `/app/groups/${req.params.id}`,
      new Date().toISOString()
    );
  }

  recordAudit({
    actorUserId: req.user!.id,
    groupId: req.params.id,
    action: 'MEMBER_UPDATED',
    targetType: 'group_member',
    targetId: req.params.memberId,
    details: parsed.data,
  });

  res.json({ ok: true });
});

// Secure account linking for an external member (§3.3.3)
groupRouter.post('/:id/members/:memberId/link-account', (req: AuthedRequest, res) => {
  const db = getDb();
  const member = db
    .prepare('SELECT * FROM group_members WHERE id = ? AND group_id = ?')
    .get(req.params.memberId, req.params.id) as any;

  if (!member) {
    res.status(404).json({ error: 'Membre introuvable.' });
    return;
  }
  if (!member.is_external || member.user_id) {
    res.status(400).json({ error: 'Ce profil membre est déjà rattaché à un compte KPATA.' });
    return;
  }

  // Prevent duplicate user membership in the same group
  const alreadyInGroup = db
    .prepare("SELECT id FROM group_members WHERE group_id = ? AND user_id = ? AND status = 'ACTIVE'")
    .get(req.params.id, req.user!.id);
  if (alreadyInGroup) {
    res.status(409).json({ error: 'Votre compte est déjà associé à un profil membre actif dans ce groupe.' });
    return;
  }

  const verificationContact = String(req.body?.verificationContact || req.user!.email).trim();
  const reqId = crypto.randomUUID();
  const nowIso = new Date().toISOString();

  db.prepare(
    `INSERT INTO member_link_requests (id, group_id, member_id, user_id, verification_contact, status, created_at)
     VALUES (?, ?, ?, ?, ?, 'PENDING', ?)`
  ).run(reqId, req.params.id, member.id, req.user!.id, verificationContact, nowIso);

  res.status(201).json({ id: reqId, status: 'PENDING' });
});

groupRouter.post('/:id/link-requests/:reqId/review', (req: AuthedRequest, res) => {
  const ctx = getGroupMembership(req.user!.id, req.params.id);
  if (!ctx || !ctx.permissions.canManageMembers) {
    res.status(403).json({ error: 'Permission insuffisante.' });
    return;
  }

  const decision = req.body?.decision === 'APPROVE' ? 'APPROVED' : 'REJECTED';
  const db = getDb();
  const linkReq = db
    .prepare("SELECT * FROM member_link_requests WHERE id = ? AND group_id = ? AND status = 'PENDING'")
    .get(req.params.reqId, req.params.id) as any;

  if (!linkReq) {
    res.status(404).json({ error: 'Demande introuvable ou déjà traitée.' });
    return;
  }

  const nowIso = new Date().toISOString();
  db.transaction(() => {
    db.prepare(
      'UPDATE member_link_requests SET status = ?, reviewed_by = ?, reviewed_at = ? WHERE id = ?'
    ).run(decision, req.user!.id, nowIso, linkReq.id);

    if (decision === 'APPROVED') {
      const duplicate = db
        .prepare('SELECT id FROM group_members WHERE group_id = ? AND user_id = ?')
        .get(req.params.id, linkReq.user_id);
      if (duplicate) {
        throw new Error('Cet utilisateur est déjà membre du groupe.');
      }
      db.prepare(
        'UPDATE group_members SET user_id = ?, is_external = 0 WHERE id = ? AND group_id = ?'
      ).run(linkReq.user_id, linkReq.member_id, req.params.id);
    }
  })();

  recordAudit({
    actorUserId: req.user!.id,
    groupId: req.params.id,
    action: `MEMBER_LINK_${decision}`,
    targetType: 'group_member',
    targetId: linkReq.member_id,
    details: { userId: linkReq.user_id },
  });

  res.json({ ok: true, status: decision });
});

// Invitations (§3.2)
groupRouter.post('/:id/invitations', (req: AuthedRequest, res) => {
  const ctx = getGroupMembership(req.user!.id, req.params.id);
  if (!ctx || !ctx.permissions.canInvite) {
    res.status(403).json({ error: 'Permission insuffisante pour inviter des membres.' });
    return;
  }

  const schema = z.object({
    email: z.string().trim().email().optional().nullable().or(z.literal('')),
    phone: z.string().trim().max(40).optional().nullable(),
    role: z.enum(['ADMIN', 'TREASURER', 'MEMBER', 'OBSERVER']).default('MEMBER'),
    expiresInDays: z.number().int().min(1).max(30).default(7),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Données d’invitation invalides.' });
    return;
  }

  const db = getDb();
  const id = crypto.randomUUID();
  const token = crypto.randomBytes(16).toString('hex');
  const code = `KPT-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
  const now = new Date();
  const expiresAt = new Date(now.getTime() + parsed.data.expiresInDays * 86400000).toISOString();

  db.prepare(
    `INSERT INTO group_invitations (id, group_id, invited_by, email, phone, token, code, role, status, expires_at, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'PENDING', ?, ?)`
  ).run(
    id,
    req.params.id,
    req.user!.id,
    parsed.data.email ? parsed.data.email.toLowerCase() : null,
    parsed.data.phone || null,
    token,
    code,
    parsed.data.role,
    expiresAt,
    now.toISOString()
  );

  // If invited email matches an existing user, send internal notification
  if (parsed.data.email) {
    const invitedUser = db
      .prepare('SELECT id FROM users WHERE email = ?')
      .get(parsed.data.email.toLowerCase()) as { id: string } | undefined;
    if (invitedUser) {
      db.prepare(
        `INSERT INTO notifications (id, user_id, group_id, type, title, body, link, created_at)
         VALUES (?, ?, ?, 'INVITATION', 'Nouvelle invitation KPATA', ?, ?, ?)`
      ).run(
        crypto.randomUUID(),
        invitedUser.id,
        req.params.id,
        `${req.user!.firstName} vous a invité à rejoindre un groupe (Code : ${code}).`,
        `/app/invitations`,
        now.toISOString()
      );
    }
  }

  res.status(201).json({ id, token, code, expiresAt });
});

groupRouter.post('/:id/invitations/:invId/cancel', (req: AuthedRequest, res) => {
  const ctx = getGroupMembership(req.user!.id, req.params.id);
  if (!ctx || !ctx.permissions.canInvite) {
    res.status(403).json({ error: 'Permission insuffisante.' });
    return;
  }
  const db = getDb();
  db.prepare("UPDATE group_invitations SET status = 'CANCELLED' WHERE id = ? AND group_id = ?").run(
    req.params.invId,
    req.params.id
  );
  res.json({ ok: true });
});

groupRouter.get('/:id/categories', (req: AuthedRequest, res) => {
  const ctx = getGroupMembership(req.user!.id, req.params.id);
  if (!ctx) {
    res.status(403).json({ error: 'Accès refusé.' });
    return;
  }
  const db = getDb();
  const categories = db
    .prepare(
      `SELECT id, group_id as groupId, name, is_active as isActive
       FROM expense_categories
       WHERE (group_id IS NULL OR group_id = ?) AND is_active = 1
       ORDER BY name ASC`
    )
    .all(req.params.id);
  res.json({ categories });
});

groupRouter.post('/:id/categories', (req: AuthedRequest, res) => {
  const ctx = getGroupMembership(req.user!.id, req.params.id);
  if (!ctx || !ctx.permissions.canManageGroup) {
    res.status(403).json({ error: 'Permission insuffisante.' });
    return;
  }
  const name = String(req.body?.name || '').trim();
  if (name.length < 2 || name.length > 60) {
    res.status(400).json({ error: 'Nom de catégorie invalide.' });
    return;
  }
  const db = getDb();
  const entitlements = getGroupEntitlements(req.params.id);
  if (!entitlements.allowCustomCategories) {
    res.status(402).json({
      code: 'PLAN_UPGRADE_REQUIRED',
      error: 'Les catégories personnalisées sont incluses à partir de l’offre Premium Famille & Coloc.',
      requiredPlans: ['PREMIUM', 'ORG'],
    });
    return;
  }
  const id = crypto.randomUUID();
  db.prepare('INSERT INTO expense_categories (id, group_id, name, is_active) VALUES (?, ?, ?, 1)').run(
    id,
    req.params.id,
    name
  );
  res.status(201).json({ id, name });
});

// User-facing invitations router
export const invitationRouter = Router();
invitationRouter.use(requireAuth);

invitationRouter.get('/', (req: AuthedRequest, res) => {
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT i.id, i.group_id as groupId, g.name as groupName, g.type as groupType, i.token, i.code, i.role, i.status, i.expires_at as expiresAt, i.created_at as createdAt
       FROM group_invitations i
       JOIN groups g ON g.id = i.group_id
       WHERE i.email = ?
       ORDER BY i.created_at DESC`
    )
    .all(req.user!.email);
  res.json({ invitations: rows });
});

invitationRouter.post('/join-by-code', (req: AuthedRequest, res) => {
  const codeOrToken = String(req.body?.code || '').trim();
  if (!codeOrToken) {
    res.status(400).json({ error: 'Code ou jeton requis.' });
    return;
  }
  const db = getDb();
  const inv = db
    .prepare(
      `SELECT * FROM group_invitations
       WHERE (code = ? OR token = ?) AND status = 'PENDING'`
    )
    .get(codeOrToken.toUpperCase(), codeOrToken) as any;

  if (!inv) {
    res.status(404).json({ error: 'Invitation introuvable ou déjà utilisée.' });
    return;
  }
  if (new Date(inv.expires_at).getTime() < Date.now()) {
    db.prepare("UPDATE group_invitations SET status = 'EXPIRED' WHERE id = ?").run(inv.id);
    res.status(400).json({ error: 'Cette invitation a expiré.' });
    return;
  }

  const existingMember = db
    .prepare("SELECT id FROM group_members WHERE group_id = ? AND user_id = ? AND status = 'ACTIVE'")
    .get(inv.group_id, req.user!.id);
  if (existingMember) {
    res.status(409).json({ error: 'Vous êtes déjà membre actif de ce groupe.' });
    return;
  }

  const nowIso = new Date().toISOString();
  const memberId = crypto.randomUUID();
  db.transaction(() => {
    db.prepare(
      `INSERT INTO group_members (id, group_id, user_id, first_name, last_name, email, phone, role, status, is_external, joined_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'ACTIVE', 0, ?)`
    ).run(
      memberId,
      inv.group_id,
      req.user!.id,
      req.user!.firstName,
      req.user!.lastName,
      req.user!.email,
      req.user!.phone,
      inv.role,
      nowIso
    );
    db.prepare("UPDATE group_invitations SET status = 'ACCEPTED' WHERE id = ?").run(inv.id);
  })();

  res.json({ ok: true, groupId: inv.group_id, memberId });
});

invitationRouter.post('/:token/accept', (req: AuthedRequest, res) => {
  req.body = { code: req.params.token };
  const db = getDb();
  const inv = db
    .prepare("SELECT * FROM group_invitations WHERE token = ? AND status = 'PENDING'")
    .get(req.params.token) as any;

  if (!inv || new Date(inv.expires_at).getTime() < Date.now()) {
    res.status(400).json({ error: 'Invitation invalide ou expirée.' });
    return;
  }
  const existing = db
    .prepare("SELECT id FROM group_members WHERE group_id = ? AND user_id = ? AND status = 'ACTIVE'")
    .get(inv.group_id, req.user!.id);
  if (existing) {
    res.status(409).json({ error: 'Déjà membre du groupe.' });
    return;
  }
  const nowIso = new Date().toISOString();
  const memberId = crypto.randomUUID();
  db.transaction(() => {
    db.prepare(
      `INSERT INTO group_members (id, group_id, user_id, first_name, last_name, email, phone, role, status, is_external, joined_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'ACTIVE', 0, ?)`
    ).run(
      memberId,
      inv.group_id,
      req.user!.id,
      req.user!.firstName,
      req.user!.lastName,
      req.user!.email,
      req.user!.phone,
      inv.role,
      nowIso
    );
    db.prepare("UPDATE group_invitations SET status = 'ACCEPTED' WHERE id = ?").run(inv.id);
  })();
  res.json({ ok: true, groupId: inv.group_id });
});

invitationRouter.post('/:token/reject', (req: AuthedRequest, res) => {
  const db = getDb();
  db.prepare("UPDATE group_invitations SET status = 'REJECTED' WHERE token = ? AND status = 'PENDING'").run(
    req.params.token
  );
  res.json({ ok: true });
});
