import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
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
import {
  calculateShares,
  computeGroupBalances,
  evaluateBudgetAlert,
  optimizeSettlements,
  validatePayers,
} from '../../shared/finance';

export const financeRouter = Router();
financeRouter.use(requireAuth);

function getUploadDir(): string {
  const dir = path.resolve(process.cwd(), 'data', 'uploads');
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return dir;
}

function notifyGroupUsers(params: {
  groupId: string;
  excludeUserId?: string;
  type: string;
  title: string;
  body: string;
}) {
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT DISTINCT user_id FROM group_members
       WHERE group_id = ? AND status = 'ACTIVE' AND user_id IS NOT NULL`
    )
    .all(params.groupId) as { user_id: string }[];

  const ins = db.prepare(
    `INSERT INTO notifications (id, user_id, group_id, type, title, body, link, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  );
  const nowIso = new Date().toISOString();
  for (const r of rows) {
    if (r.user_id === params.excludeUserId) continue;
    ins.run(
      crypto.randomUUID(),
      r.user_id,
      params.groupId,
      params.type,
      params.title,
      params.body,
      `/app/groups/${params.groupId}`,
      nowIso
    );
  }
}

// ============================================================================
// EXPENSES (Single/Multi-Payers, 6 Split Methods, Revisions, Comments)
// ============================================================================

financeRouter.get('/groups/:id/expenses', (req: AuthedRequest, res) => {
  const ctx = getGroupMembership(req.user!.id, req.params.id);
  if (!ctx) {
    res.status(403).json({ error: 'Accès refusé à ce groupe.' });
    return;
  }

  const db = getDb();
  const expenses = db
    .prepare(
      `SELECT e.id, e.group_id as groupId, e.title, e.description, e.amount_int as amountInt, e.currency,
              e.expense_date as expenseDate, e.category_id as categoryId, ec.name as categoryName,
              e.scope, e.split_method as splitMethod, e.payment_status as paymentStatus, e.status,
              e.is_recurring as isRecurring, e.recurrence_freq as recurrenceFreq, e.next_occurrence as nextOccurrence,
              e.created_by_member_id as createdByMemberId, e.created_at as createdAt, e.updated_at as updatedAt
       FROM expenses e
       LEFT JOIN expense_categories ec ON ec.id = e.category_id
       WHERE e.group_id = ?
       ORDER BY e.expense_date DESC, e.created_at DESC`
    )
    .all(req.params.id) as any[];

  const enriched = expenses.map((exp) => {
    const payers = db
      .prepare(
        `SELECT ep.id, ep.member_id as memberId, ep.amount_paid_int as amountPaidInt,
                gm.first_name || ' ' || gm.last_name as memberName
         FROM expense_payers ep
         JOIN group_members gm ON gm.id = ep.member_id
         WHERE ep.expense_id = ?`
      )
      .all(exp.id);
    const shares = db
      .prepare(
        `SELECT es.id, es.member_id as memberId, es.share_amount_int as shareAmountInt, es.weight_or_pct_num as weightOrPctNum,
                gm.first_name || ' ' || gm.last_name as memberName
         FROM expense_shares es
         JOIN group_members gm ON gm.id = es.member_id
         WHERE es.expense_id = ?`
      )
      .all(exp.id);
    const comments = db
      .prepare(
        `SELECT c.id, c.member_id as memberId, c.content, c.is_dispute as isDispute, c.created_at as createdAt,
                gm.first_name || ' ' || gm.last_name as memberName
         FROM expense_comments c
         JOIN group_members gm ON gm.id = c.member_id
         WHERE c.expense_id = ? ORDER BY c.created_at ASC`
      )
      .all(exp.id);
    const documents = db
      .prepare(
        `SELECT id, filename, mime_type as mimeType, size_bytes as sizeBytes, created_at as createdAt
         FROM documents WHERE entity_type = 'EXPENSE' AND entity_id = ?`
      )
      .all(exp.id);

    return { ...exp, payers, shares, comments, documents };
  });

  res.json({ expenses: enriched });
});

const expensePayloadSchema = z.object({
  title: z.string().trim().min(2, 'Intitulé requis.').max(140),
  description: z.string().trim().max(600).optional().nullable(),
  amountInt: z.number().int().positive('Le montant doit être strictement positif.'),
  expenseDate: z.string().min(8),
  categoryId: z.string().optional().nullable(),
  scope: z.enum(['COLLECTIVE', 'PARTIAL', 'PERSONAL']).default('COLLECTIVE'),
  splitMethod: z
    .enum(['EQUAL', 'CUSTOM', 'PERCENTAGE', 'WEIGHT', 'PARTICIPATION', 'FIXED'])
    .default('EQUAL'),
  allowPartialPayment: z.boolean().default(false),
  isRecurring: z.boolean().default(false),
  recurrenceFreq: z.enum(['DAILY', 'WEEKLY', 'MONTHLY', 'QUARTERLY', 'YEARLY']).optional().nullable(),
  payers: z
    .array(
      z.object({
        memberId: z.string(),
        amountPaidInt: z.number().int().min(0),
      })
    )
    .min(1, 'Au moins un payeur doit être renseigné.'),
  participants: z
    .array(
      z.object({
        memberId: z.string(),
        included: z.boolean().optional(),
        amountInt: z.number().int().min(0).optional(),
        percentage: z.number().min(0).max(100).optional(),
        weight: z.number().min(0).optional(),
      })
    )
    .min(1, 'Au moins un participant est requis.'),
});

financeRouter.post('/groups/:id/expenses', (req: AuthedRequest, res) => {
  const ctx = getGroupMembership(req.user!.id, req.params.id);
  if (!ctx || !ctx.permissions.canCreateExpense) {
    res.status(403).json({ error: 'Permission insuffisante pour enregistrer une dépense.' });
    return;
  }

  const parsed = expensePayloadSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message || 'Données de dépense invalides.' });
    return;
  }

  const db = getDb();
  const group = db.prepare('SELECT id, currency FROM groups WHERE id = ?').get(req.params.id) as any;
  if (!group) {
    res.status(404).json({ error: 'Groupe introuvable.' });
    return;
  }

  const entitlements = getGroupEntitlements(req.params.id);
  if (!entitlements.allowedSplitMethods.includes(parsed.data.splitMethod)) {
    res.status(402).json({
      code: 'PLAN_UPGRADE_REQUIRED',
      error: `La méthode « ${parsed.data.splitMethod} » nécessite l’offre Premium Famille & Coloc ou Association (Gratuit inclut Équitable et Participation).`,
      requiredPlans: ['PREMIUM', 'ORG'],
    });
    return;
  }
  if (parsed.data.isRecurring && !entitlements.allowRecurringExpenses) {
    res.status(402).json({
      code: 'PLAN_UPGRADE_REQUIRED',
      error: 'Les dépenses récurrentes sont disponibles à partir de l’offre Premium Famille & Coloc.',
      requiredPlans: ['PREMIUM', 'ORG'],
    });
    return;
  }

  // Verify every payer & participant belongs strictly to THIS group
  const groupMemberRows = db
    .prepare('SELECT id FROM group_members WHERE group_id = ?')
    .all(req.params.id) as { id: string }[];
  const validMemberIds = new Set(groupMemberRows.map((m) => m.id));

  for (const p of parsed.data.payers) {
    if (!validMemberIds.has(p.memberId)) {
      res.status(400).json({ error: 'Un payeur sélectionné n’appartient pas à ce groupe.' });
      return;
    }
  }
  for (const part of parsed.data.participants) {
    if (!validMemberIds.has(part.memberId)) {
      res.status(400).json({ error: 'Un participant sélectionné n’appartient pas à ce groupe.' });
      return;
    }
  }

  let calculatedShares;
  let payerValidation;
  try {
    payerValidation = validatePayers(
      parsed.data.amountInt,
      parsed.data.payers,
      parsed.data.allowPartialPayment
    );
    calculatedShares = calculateShares(
      parsed.data.amountInt,
      parsed.data.splitMethod,
      parsed.data.participants
    );
  } catch (err: any) {
    res.status(400).json({ error: err?.message || 'Erreur de calcul de répartition.' });
    return;
  }

  const expenseId = crypto.randomUUID();
  const nowIso = new Date().toISOString();

  db.transaction(() => {
    db.prepare(
      `INSERT INTO expenses
        (id, group_id, title, description, amount_int, currency, expense_date, category_id, scope, split_method, payment_status, status, is_recurring, recurrence_freq, created_by_member_id, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'ACTIVE', ?, ?, ?, ?, ?)`
    ).run(
      expenseId,
      req.params.id,
      parsed.data.title,
      parsed.data.description || null,
      parsed.data.amountInt,
      group.currency,
      parsed.data.expenseDate,
      parsed.data.categoryId || null,
      parsed.data.scope,
      parsed.data.splitMethod,
      payerValidation.paymentStatus,
      parsed.data.isRecurring ? 1 : 0,
      parsed.data.isRecurring ? parsed.data.recurrenceFreq || 'MONTHLY' : null,
      ctx.memberId,
      nowIso,
      nowIso
    );

    const insPayer = db.prepare(
      'INSERT INTO expense_payers (id, expense_id, member_id, amount_paid_int) VALUES (?, ?, ?, ?)'
    );
    for (const p of parsed.data.payers) {
      if (p.amountPaidInt > 0) {
        insPayer.run(crypto.randomUUID(), expenseId, p.memberId, p.amountPaidInt);
      }
    }

    const insShare = db.prepare(
      'INSERT INTO expense_shares (id, expense_id, member_id, share_amount_int, weight_or_pct_num) VALUES (?, ?, ?, ?, ?)'
    );
    for (const s of calculatedShares) {
      insShare.run(crypto.randomUUID(), expenseId, s.memberId, s.shareAmountInt, s.weightOrPctNum);
    }

    db.prepare(
      `INSERT INTO expense_revisions (id, expense_id, changed_by_user_id, action, snapshot_json, note, created_at)
       VALUES (?, ?, ?, 'CREATED', ?, 'Création initiale', ?)`
    ).run(crypto.randomUUID(), expenseId, req.user!.id, JSON.stringify(parsed.data), nowIso);
  })();

  // Check budget thresholds and notify if exceeded
  if (parsed.data.categoryId) {
    const budgets = db
      .prepare(
        `SELECT id, name, limit_amount_int as limitAmountInt, start_date as startDate, end_date as endDate
         FROM budgets WHERE group_id = ? AND category_id = ?`
      )
      .all(req.params.id, parsed.data.categoryId) as any[];

    for (const b of budgets) {
      const spent = (
        db
          .prepare(
            `SELECT COALESCE(SUM(amount_int), 0) as s FROM expenses
             WHERE group_id = ? AND category_id = ? AND status = 'ACTIVE' AND expense_date >= ? AND expense_date <= ?`
          )
          .get(req.params.id, parsed.data.categoryId, b.startDate, b.endDate) as { s: number }
      ).s;
      const evalRes = evaluateBudgetAlert(spent, b.limitAmountInt);
      if (evalRes.level === '90' || evalRes.level === 'EXCEEDED') {
        notifyGroupUsers({
          groupId: req.params.id,
          type: 'BUDGET_ALERT',
          title: evalRes.level === 'EXCEEDED' ? 'Budget dépassé' : 'Alerte budget (90 %)',
          body: `Le budget « ${b.name} » est consommé à ${evalRes.percent} %.`,
        });
      }
    }
  }

  notifyGroupUsers({
    groupId: req.params.id,
    excludeUserId: req.user!.id,
    type: 'NEW_EXPENSE',
    title: 'Nouvelle dépense enregistrée',
    body: `${req.user!.firstName} a ajouté « ${parsed.data.title} » (${parsed.data.amountInt} ${group.currency}).`,
  });

  recordAudit({
    actorUserId: req.user!.id,
    groupId: req.params.id,
    action: 'EXPENSE_CREATED',
    targetType: 'expense',
    targetId: expenseId,
    details: { amountInt: parsed.data.amountInt, splitMethod: parsed.data.splitMethod },
    ip: req.ip,
  });

  res.status(201).json({ id: expenseId, shares: calculatedShares });
});

financeRouter.post('/expenses/:expenseId/cancel', (req: AuthedRequest, res) => {
  const db = getDb();
  const expense = db.prepare('SELECT * FROM expenses WHERE id = ?').get(req.params.expenseId) as any;
  if (!expense) {
    res.status(404).json({ error: 'Dépense introuvable.' });
    return;
  }

  const ctx = getGroupMembership(req.user!.id, expense.group_id);
  if (!ctx || (!ctx.permissions.canCancelExpense && expense.created_by_member_id !== ctx.memberId)) {
    res.status(403).json({ error: 'Permission insuffisante pour annuler cette dépense.' });
    return;
  }

  if (expense.status === 'CANCELLED') {
    res.status(400).json({ error: 'Cette dépense est déjà annulée.' });
    return;
  }

  const reason = String(req.body?.reason || 'Annulation contrôlée').trim();
  const nowIso = new Date().toISOString();

  db.transaction(() => {
    db.prepare("UPDATE expenses SET status = 'CANCELLED', updated_at = ? WHERE id = ?").run(
      nowIso,
      expense.id
    );
    db.prepare(
      `INSERT INTO expense_revisions (id, expense_id, changed_by_user_id, action, snapshot_json, note, created_at)
       VALUES (?, ?, ?, 'CANCELLED', ?, ?, ?)`
    ).run(crypto.randomUUID(), expense.id, req.user!.id, JSON.stringify(expense), reason, nowIso);
  })();

  recordAudit({
    actorUserId: req.user!.id,
    groupId: expense.group_id,
    action: 'EXPENSE_CANCELLED',
    targetType: 'expense',
    targetId: expense.id,
    details: { reason },
  });

  res.json({ ok: true });
});

financeRouter.post('/expenses/:expenseId/comments', (req: AuthedRequest, res) => {
  const content = String(req.body?.content || '').trim();
  const isDispute = Boolean(req.body?.isDispute);
  if (!content || content.length > 500) {
    res.status(400).json({ error: 'Commentaire invalide.' });
    return;
  }

  const db = getDb();
  const expense = db.prepare('SELECT id, group_id, title FROM expenses WHERE id = ?').get(req.params.expenseId) as any;
  if (!expense) {
    res.status(404).json({ error: 'Dépense introuvable.' });
    return;
  }

  const ctx = getGroupMembership(req.user!.id, expense.group_id);
  if (!ctx) {
    res.status(403).json({ error: 'Accès refusé.' });
    return;
  }

  const id = crypto.randomUUID();
  db.prepare(
    `INSERT INTO expense_comments (id, expense_id, member_id, user_id, content, is_dispute, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run(id, expense.id, ctx.memberId, req.user!.id, content, isDispute ? 1 : 0, new Date().toISOString());

  if (isDispute) {
    notifyGroupUsers({
      groupId: expense.group_id,
      excludeUserId: req.user!.id,
      type: 'EXPENSE_DISPUTED',
      title: 'Signalement sur une dépense',
      body: `${req.user!.firstName} a signalé une remarque sur « ${expense.title} ».`,
    });
  }

  res.status(201).json({ id });
});

// ============================================================================
// BALANCES & SETTLEMENTS
// ============================================================================

financeRouter.get('/groups/:id/balances', (req: AuthedRequest, res) => {
  const ctx = getGroupMembership(req.user!.id, req.params.id);
  if (!ctx) {
    res.status(403).json({ error: 'Accès refusé.' });
    return;
  }

  const db = getDb();
  const members = db
    .prepare('SELECT id, first_name, last_name, is_external, status FROM group_members WHERE group_id = ?')
    .all(req.params.id) as any[];

  const expenses = db
    .prepare('SELECT id, status FROM expenses WHERE group_id = ?')
    .all(req.params.id) as any[];

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
      `SELECT id, from_member_id as fromMemberId, to_member_id as toMemberId, amount_int as amountInt, status
       FROM settlements WHERE group_id = ?`
    )
    .all(req.params.id) as any[];

  const balances = computeGroupBalances(
    members.map((m) => ({
      id: m.id,
      displayName: `${m.first_name} ${m.last_name}`,
      isExternal: Boolean(m.is_external),
      status: m.status,
    })),
    expInputs,
    settlements
  );

  const suggestions = optimizeSettlements(balances);

  res.json({ balances, suggestions });
});

financeRouter.get('/groups/:id/settlements', (req: AuthedRequest, res) => {
  const ctx = getGroupMembership(req.user!.id, req.params.id);
  if (!ctx) {
    res.status(403).json({ error: 'Accès refusé.' });
    return;
  }

  const db = getDb();
  const rows = db
    .prepare(
      `SELECT s.id, s.group_id as groupId, s.from_member_id as fromMemberId, s.to_member_id as toMemberId,
              mf.first_name || ' ' || mf.last_name as fromName,
              mt.first_name || ' ' || mt.last_name as toName,
              s.amount_int as amountInt, s.currency, s.settlement_date as settlementDate,
              s.payment_method as paymentMethod, s.reference, s.note, s.status, s.dispute_reason as disputeReason,
              s.created_at as createdAt, s.confirmed_at as confirmedAt
       FROM settlements s
       JOIN group_members mf ON mf.id = s.from_member_id
       JOIN group_members mt ON mt.id = s.to_member_id
       WHERE s.group_id = ?
       ORDER BY s.created_at DESC`
    )
    .all(req.params.id);

  res.json({ settlements: rows });
});

financeRouter.post('/groups/:id/settlements', (req: AuthedRequest, res) => {
  const ctx = getGroupMembership(req.user!.id, req.params.id);
  if (!ctx || ctx.role === 'OBSERVER') {
    res.status(403).json({ error: 'Permission insuffisante.' });
    return;
  }

  const schema = z.object({
    fromMemberId: z.string(),
    toMemberId: z.string(),
    amountInt: z.number().int().positive('Montant strictement positif requis.'),
    settlementDate: z.string().min(8),
    paymentMethod: z.enum(['ESPECES', 'MTN_MOMO', 'MOOV_MONEY', 'CELTIIS', 'VIREMENT', 'AUTRE']),
    reference: z.string().trim().max(80).optional().nullable(),
    note: z.string().trim().max(300).optional().nullable(),
  });

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message || 'Données invalides.' });
    return;
  }
  if (parsed.data.fromMemberId === parsed.data.toMemberId) {
    res.status(400).json({ error: 'Le débiteur et le créancier doivent être distincts.' });
    return;
  }

  const db = getDb();
  const group = db.prepare('SELECT id, currency FROM groups WHERE id = ?').get(req.params.id) as any;
  const fromM = db
    .prepare('SELECT id, user_id FROM group_members WHERE id = ? AND group_id = ?')
    .get(parsed.data.fromMemberId, req.params.id) as any;
  const toM = db
    .prepare('SELECT id, user_id FROM group_members WHERE id = ? AND group_id = ?')
    .get(parsed.data.toMemberId, req.params.id) as any;

  if (!group || !fromM || !toM) {
    res.status(400).json({ error: 'Membres invalides pour ce groupe.' });
    return;
  }

  const id = crypto.randomUUID();
  const nowIso = new Date().toISOString();
  // A declared settlement ALWAYS starts as PENDING — never CONFIRMED automatically (§6.3)
  db.prepare(
    `INSERT INTO settlements
      (id, group_id, from_member_id, to_member_id, amount_int, currency, settlement_date, payment_method, reference, note, status, declared_by_user_id, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'PENDING', ?, ?)`
  ).run(
    id,
    req.params.id,
    parsed.data.fromMemberId,
    parsed.data.toMemberId,
    parsed.data.amountInt,
    group.currency,
    parsed.data.settlementDate,
    parsed.data.paymentMethod,
    parsed.data.reference || null,
    parsed.data.note || null,
    req.user!.id,
    nowIso
  );

  if (toM.user_id) {
    db.prepare(
      `INSERT INTO notifications (id, user_id, group_id, type, title, body, link, created_at)
       VALUES (?, ?, ?, 'SETTLEMENT_PENDING', 'Remboursement déclaré', ?, ?, ?)`
    ).run(
      crypto.randomUUID(),
      toM.user_id,
      req.params.id,
      `Un remboursement de ${parsed.data.amountInt} ${group.currency} a été déclaré en votre faveur et attend votre confirmation.`,
      `/app/groups/${req.params.id}`,
      nowIso
    );
  }

  recordAudit({
    actorUserId: req.user!.id,
    groupId: req.params.id,
    action: 'SETTLEMENT_DECLARED',
    targetType: 'settlement',
    targetId: id,
    details: { amountInt: parsed.data.amountInt, method: parsed.data.paymentMethod },
  });

  res.status(201).json({ id, status: 'PENDING' });
});

financeRouter.post('/settlements/:id/confirm', (req: AuthedRequest, res) => {
  const db = getDb();
  const stl = db.prepare('SELECT * FROM settlements WHERE id = ?').get(req.params.id) as any;
  if (!stl) {
    res.status(404).json({ error: 'Remboursement introuvable.' });
    return;
  }

  const ctx = getGroupMembership(req.user!.id, stl.group_id);
  if (!ctx) {
    res.status(403).json({ error: 'Accès refusé.' });
    return;
  }

  const isCreditor = stl.to_member_id === ctx.memberId;
  if (!isCreditor && !ctx.permissions.canConfirmPayments) {
    res.status(403).json({
      error: 'Seul le bénéficiaire créancier ou un responsable autorisé peut confirmer ce remboursement.',
    });
    return;
  }

  if (stl.status !== 'PENDING' && stl.status !== 'DISPUTED') {
    res.status(400).json({ error: 'Ce remboursement ne peut plus être confirmé.' });
    return;
  }

  const nowIso = new Date().toISOString();
  db.prepare(
    "UPDATE settlements SET status = 'CONFIRMED', confirmed_by_user_id = ?, confirmed_at = ? WHERE id = ?"
  ).run(req.user!.id, nowIso, stl.id);

  recordAudit({
    actorUserId: req.user!.id,
    groupId: stl.group_id,
    action: 'SETTLEMENT_CONFIRMED',
    targetType: 'settlement',
    targetId: stl.id,
  });

  res.json({ ok: true, status: 'CONFIRMED' });
});

financeRouter.post('/settlements/:id/dispute', (req: AuthedRequest, res) => {
  const reason = String(req.body?.reason || '').trim();
  if (!reason) {
    res.status(400).json({ error: 'Veuillez indiquer un motif de contestation.' });
    return;
  }
  const db = getDb();
  const stl = db.prepare('SELECT * FROM settlements WHERE id = ?').get(req.params.id) as any;
  if (!stl) {
    res.status(404).json({ error: 'Remboursement introuvable.' });
    return;
  }
  const ctx = getGroupMembership(req.user!.id, stl.group_id);
  if (!ctx || (stl.to_member_id !== ctx.memberId && !ctx.permissions.canConfirmPayments)) {
    res.status(403).json({ error: 'Permission insuffisante pour contester.' });
    return;
  }

  db.prepare("UPDATE settlements SET status = 'DISPUTED', dispute_reason = ? WHERE id = ?").run(
    reason,
    stl.id
  );
  recordAudit({
    actorUserId: req.user!.id,
    groupId: stl.group_id,
    action: 'SETTLEMENT_DISPUTED',
    targetType: 'settlement',
    targetId: stl.id,
    details: { reason },
  });
  res.json({ ok: true, status: 'DISPUTED' });
});

financeRouter.post('/settlements/:id/cancel', (req: AuthedRequest, res) => {
  const db = getDb();
  const stl = db.prepare('SELECT * FROM settlements WHERE id = ?').get(req.params.id) as any;
  if (!stl) {
    res.status(404).json({ error: 'Remboursement introuvable.' });
    return;
  }
  const ctx = getGroupMembership(req.user!.id, stl.group_id);
  if (!ctx || (stl.declared_by_user_id !== req.user!.id && !ctx.permissions.canManageGroup)) {
    res.status(403).json({ error: 'Permission insuffisante.' });
    return;
  }
  if (stl.status === 'CONFIRMED') {
    res.status(400).json({ error: 'Un remboursement déjà confirmé ne peut pas être annulé directement.' });
    return;
  }
  db.prepare("UPDATE settlements SET status = 'CANCELLED' WHERE id = ?").run(stl.id);
  recordAudit({
    actorUserId: req.user!.id,
    groupId: stl.group_id,
    action: 'SETTLEMENT_CANCELLED',
    targetType: 'settlement',
    targetId: stl.id,
  });
  res.json({ ok: true, status: 'CANCELLED' });
});

// ============================================================================
// CONTRIBUTIONS & COTISATIONS (Expected vs Declared vs Confirmed vs Remaining)
// ============================================================================

financeRouter.get('/groups/:id/contributions', (req: AuthedRequest, res) => {
  const ctx = getGroupMembership(req.user!.id, req.params.id);
  if (!ctx) {
    res.status(403).json({ error: 'Accès refusé.' });
    return;
  }

  const db = getDb();
  const plans = db
    .prepare(
      `SELECT id, name, objective, target_amount_int as targetAmountInt, amount_per_member_int as amountPerMemberInt,
              frequency, start_date as startDate, due_date as dueDate, currency, status, created_at as createdAt
       FROM contribution_plans WHERE group_id = ? ORDER BY created_at DESC`
    )
    .all(req.params.id) as any[];

  const enriched = plans.map((plan) => {
    const items = db
      .prepare(
        `SELECT c.id, c.member_id as memberId, c.expected_amount_int as expectedAmountInt, c.status,
                gm.first_name || ' ' || gm.last_name as memberName, gm.is_external as isExternal
         FROM contributions c
         JOIN group_members gm ON gm.id = c.member_id
         WHERE c.plan_id = ?`
      )
      .all(plan.id) as any[];

    const itemsWithPayments = items.map((item) => {
      const payments = db
        .prepare(
          `SELECT id, amount_int as amountInt, payment_method as paymentMethod, reference, note, status,
                  dispute_reason as disputeReason, created_at as createdAt, confirmed_at as confirmedAt
           FROM contribution_payments WHERE contribution_id = ? ORDER BY created_at DESC`
        )
        .all(item.id) as any[];

      const declaredInt = payments
        .filter((p) => p.status === 'DECLARED')
        .reduce((a, b) => a + b.amountInt, 0);
      const confirmedInt = payments
        .filter((p) => p.status === 'CONFIRMED')
        .reduce((a, b) => a + b.amountInt, 0);
      const remainingInt = Math.max(0, item.expectedAmountInt - confirmedInt);

      return {
        ...item,
        declaredInt,
        confirmedInt,
        remainingInt,
        payments,
      };
    });

    return { ...plan, items: itemsWithPayments };
  });

  res.json({ plans: enriched });
});

financeRouter.post('/groups/:id/contributions', (req: AuthedRequest, res) => {
  const ctx = getGroupMembership(req.user!.id, req.params.id);
  if (!ctx || !ctx.permissions.canManageContributions) {
    res.status(403).json({ error: 'Seul le propriétaire, l’administrateur ou le trésorier peut créer une cotisation.' });
    return;
  }

  const schema = z.object({
    name: z.string().trim().min(2).max(140),
    objective: z.string().trim().max(400).optional().nullable(),
    amountPerMemberInt: z.number().int().positive(),
    frequency: z.enum(['ONCE', 'WEEKLY', 'MONTHLY', 'QUARTERLY', 'YEARLY']).default('ONCE'),
    startDate: z.string().min(8),
    dueDate: z.string().optional().nullable(),
    memberOverrides: z.array(z.object({ memberId: z.string(), expectedAmountInt: z.number().int().positive() })).optional(),
  });

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Données de cotisation invalides.' });
    return;
  }

  const db = getDb();
  const entitlements = getGroupEntitlements(req.params.id);
  if (parsed.data.frequency !== 'ONCE' && !entitlements.allowRecurringContributions) {
    res.status(402).json({
      code: 'PLAN_UPGRADE_REQUIRED',
      error: 'Les cotisations périodiques récurrentes nécessitent l’offre Premium Famille ou Association & Organisation.',
      requiredPlans: ['PREMIUM', 'ORG'],
    });
    return;
  }
  if (entitlements.maxContributionPlans !== null) {
    const activePlansCount = (
      db.prepare("SELECT COUNT(*) as c FROM contribution_plans WHERE group_id = ? AND status = 'ACTIVE'").get(req.params.id) as {
        c: number;
      }
    ).c;
    if (activePlansCount >= entitlements.maxContributionPlans) {
      res.status(402).json({
        code: 'PLAN_UPGRADE_REQUIRED',
        error: `Votre offre ${entitlements.label} est limitée à ${entitlements.maxContributionPlans} appel(s) de cotisation actif(s). Passez à Association & Organisation pour des cotisations illimitées.`,
        requiredPlans: ['ORG'],
      });
      return;
    }
  }

  const group = db.prepare('SELECT id, currency FROM groups WHERE id = ?').get(req.params.id) as any;
  const activeMembers = db
    .prepare("SELECT id FROM group_members WHERE group_id = ? AND status = 'ACTIVE'")
    .all(req.params.id) as { id: string }[];

  const overrideMap = new Map(
    (parsed.data.memberOverrides || []).map((o) => [o.memberId, o.expectedAmountInt])
  );

  const memberTargets = activeMembers.map((m) => ({
    memberId: m.id,
    expectedAmountInt: overrideMap.get(m.id) ?? parsed.data.amountPerMemberInt,
  }));
  const targetAmountInt = memberTargets.reduce((acc, m) => acc + m.expectedAmountInt, 0);

  const planId = crypto.randomUUID();
  const nowIso = new Date().toISOString();

  db.transaction(() => {
    db.prepare(
      `INSERT INTO contribution_plans
        (id, group_id, name, objective, target_amount_int, amount_per_member_int, frequency, start_date, due_date, currency, status, created_by, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'ACTIVE', ?, ?)`
    ).run(
      planId,
      req.params.id,
      parsed.data.name,
      parsed.data.objective || null,
      targetAmountInt,
      parsed.data.amountPerMemberInt,
      parsed.data.frequency,
      parsed.data.startDate,
      parsed.data.dueDate || null,
      group.currency,
      req.user!.id,
      nowIso
    );

    const insCtr = db.prepare(
      "INSERT INTO contributions (id, plan_id, group_id, member_id, expected_amount_int, status) VALUES (?, ?, ?, ?, ?, 'EXPECTED')"
    );
    for (const mt of memberTargets) {
      insCtr.run(crypto.randomUUID(), planId, req.params.id, mt.memberId, mt.expectedAmountInt);
    }
  })();

  notifyGroupUsers({
    groupId: req.params.id,
    excludeUserId: req.user!.id,
    type: 'NEW_CONTRIBUTION',
    title: 'Nouvelle cotisation ouverte',
    body: `Cotisation « ${parsed.data.name} » (${parsed.data.amountPerMemberInt} ${group.currency} / membre).`,
  });

  res.status(201).json({ id: planId });
});

financeRouter.post('/contributions/:contributionId/payments', (req: AuthedRequest, res) => {
  const schema = z.object({
    amountInt: z.number().int().positive(),
    paymentMethod: z.enum(['ESPECES', 'MTN_MOMO', 'MOOV_MONEY', 'CELTIIS', 'VIREMENT', 'AUTRE']),
    reference: z.string().trim().max(80).optional().nullable(),
    note: z.string().trim().max(300).optional().nullable(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Données de versement invalides.' });
    return;
  }

  const db = getDb();
  const ctr = db.prepare('SELECT * FROM contributions WHERE id = ?').get(req.params.contributionId) as any;
  if (!ctr) {
    res.status(404).json({ error: 'Cotisation membre introuvable.' });
    return;
  }

  const ctx = getGroupMembership(req.user!.id, ctr.group_id);
  if (!ctx || ctx.role === 'OBSERVER') {
    res.status(403).json({ error: 'Permission insuffisante.' });
    return;
  }

  const paymentId = crypto.randomUUID();
  const nowIso = new Date().toISOString();
  // Declared payment MUST NOT be marked CONFIRMED automatically (§5.3)
  db.prepare(
    `INSERT INTO contribution_payments
      (id, contribution_id, amount_int, payment_method, reference, note, status, declared_by_user_id, created_at)
     VALUES (?, ?, ?, ?, ?, ?, 'DECLARED', ?, ?)`
  ).run(
    paymentId,
    ctr.id,
    parsed.data.amountInt,
    parsed.data.paymentMethod,
    parsed.data.reference || null,
    parsed.data.note || null,
    req.user!.id,
    nowIso
  );

  res.status(201).json({ id: paymentId, status: 'DECLARED' });
});

financeRouter.post('/contributions/payments/:paymentId/confirm', (req: AuthedRequest, res) => {
  const db = getDb();
  const pmt = db
    .prepare(
      `SELECT cp.*, c.group_id, c.expected_amount_int
       FROM contribution_payments cp
       JOIN contributions c ON c.id = cp.contribution_id
       WHERE cp.id = ?`
    )
    .get(req.params.paymentId) as any;

  if (!pmt) {
    res.status(404).json({ error: 'Versement introuvable.' });
    return;
  }

  const ctx = getGroupMembership(req.user!.id, pmt.group_id);
  if (!ctx || !ctx.permissions.canConfirmPayments) {
    res.status(403).json({ error: 'Seul un trésorier ou administrateur peut confirmer une cotisation.' });
    return;
  }

  const nowIso = new Date().toISOString();
  db.transaction(() => {
    db.prepare(
      "UPDATE contribution_payments SET status = 'CONFIRMED', confirmed_by_user_id = ?, confirmed_at = ? WHERE id = ?"
    ).run(req.user!.id, nowIso, pmt.id);

    const confirmedSum = (
      db
        .prepare(
          "SELECT COALESCE(SUM(amount_int), 0) as s FROM contribution_payments WHERE contribution_id = ? AND status = 'CONFIRMED'"
        )
        .get(pmt.contribution_id) as { s: number }
    ).s;

    const newStatus = confirmedSum >= pmt.expected_amount_int ? 'CONFIRMED' : confirmedSum > 0 ? 'PARTIAL' : 'EXPECTED';
    db.prepare('UPDATE contributions SET status = ? WHERE id = ?').run(newStatus, pmt.contribution_id);
  })();

  recordAudit({
    actorUserId: req.user!.id,
    groupId: pmt.group_id,
    action: 'CONTRIBUTION_PAYMENT_CONFIRMED',
    targetType: 'contribution_payment',
    targetId: pmt.id,
  });

  res.json({ ok: true, status: 'CONFIRMED' });
});

financeRouter.post('/contributions/payments/:paymentId/dispute', (req: AuthedRequest, res) => {
  const reason = String(req.body?.reason || '').trim();
  if (!reason) {
    res.status(400).json({ error: 'Motif requis.' });
    return;
  }
  const db = getDb();
  const pmt = db
    .prepare(
      `SELECT cp.*, c.group_id FROM contribution_payments cp
       JOIN contributions c ON c.id = cp.contribution_id WHERE cp.id = ?`
    )
    .get(req.params.paymentId) as any;
  if (!pmt) {
    res.status(404).json({ error: 'Versement introuvable.' });
    return;
  }
  const ctx = getGroupMembership(req.user!.id, pmt.group_id);
  if (!ctx || !ctx.permissions.canConfirmPayments) {
    res.status(403).json({ error: 'Permission insuffisante.' });
    return;
  }
  db.prepare("UPDATE contribution_payments SET status = 'DISPUTED', dispute_reason = ? WHERE id = ?").run(
    reason,
    pmt.id
  );
  res.json({ ok: true, status: 'DISPUTED' });
});

// ============================================================================
// BUDGETS & SAVINGS GOALS
// ============================================================================

financeRouter.get('/groups/:id/budgets', (req: AuthedRequest, res) => {
  const ctx = getGroupMembership(req.user!.id, req.params.id);
  if (!ctx) {
    res.status(403).json({ error: 'Accès refusé.' });
    return;
  }
  const db = getDb();
  const budgets = db
    .prepare(
      `SELECT b.id, b.name, b.category_id as categoryId, ec.name as categoryName,
              b.period_type as periodType, b.start_date as startDate, b.end_date as endDate,
              b.limit_amount_int as limitAmountInt, b.created_at as createdAt
       FROM budgets b
       LEFT JOIN expense_categories ec ON ec.id = b.category_id
       WHERE b.group_id = ? ORDER BY b.created_at DESC`
    )
    .all(req.params.id) as any[];

  const enriched = budgets.map((b) => {
    const query = b.categoryId
      ? `SELECT COALESCE(SUM(amount_int), 0) as s FROM expenses
         WHERE group_id = ? AND category_id = ? AND status = 'ACTIVE' AND expense_date >= ? AND expense_date <= ?`
      : `SELECT COALESCE(SUM(amount_int), 0) as s FROM expenses
         WHERE group_id = ? AND status = 'ACTIVE' AND expense_date >= ? AND expense_date <= ?`;
    const spentInt = (
      b.categoryId
        ? db.prepare(query).get(req.params.id, b.categoryId, b.startDate, b.endDate)
        : db.prepare(query).get(req.params.id, b.startDate, b.endDate)
    ) as { s: number };

    const alert = evaluateBudgetAlert(spentInt.s, b.limitAmountInt);
    return {
      ...b,
      spentInt: spentInt.s,
      remainingInt: Math.max(0, b.limitAmountInt - spentInt.s),
      percent: alert.percent,
      alertLevel: alert.level,
    };
  });

  res.json({ budgets: enriched });
});

financeRouter.post('/groups/:id/budgets', (req: AuthedRequest, res) => {
  const ctx = getGroupMembership(req.user!.id, req.params.id);
  if (!ctx || !ctx.permissions.canManageBudgets) {
    res.status(403).json({ error: 'Permission insuffisante.' });
    return;
  }

  const schema = z.object({
    name: z.string().trim().min(2).max(120),
    categoryId: z.string().optional().nullable(),
    periodType: z.enum(['MONTHLY', 'QUARTERLY', 'ANNUAL', 'CUSTOM']).default('MONTHLY'),
    startDate: z.string().min(8),
    endDate: z.string().min(8),
    limitAmountInt: z.number().int().positive(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Données budgétaires invalides.' });
    return;
  }

  const db = getDb();
  const entitlements = getGroupEntitlements(req.params.id);
  if (entitlements.maxBudgets !== null) {
    const budgetCount = (
      db.prepare('SELECT COUNT(*) as c FROM budgets WHERE group_id = ?').get(req.params.id) as { c: number }
    ).c;
    if (budgetCount >= entitlements.maxBudgets) {
      res.status(402).json({
        code: 'PLAN_UPGRADE_REQUIRED',
        error: `Votre offre ${entitlements.label} est limitée à ${entitlements.maxBudgets} budget(s). Passez à Premium Famille & Coloc pour suivre plusieurs catégories.`,
        requiredPlans: ['PREMIUM', 'ORG'],
      });
      return;
    }
  }
  const id = crypto.randomUUID();
  db.prepare(
    `INSERT INTO budgets (id, group_id, category_id, name, period_type, start_date, end_date, limit_amount_int, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    id,
    req.params.id,
    parsed.data.categoryId || null,
    parsed.data.name,
    parsed.data.periodType,
    parsed.data.startDate,
    parsed.data.endDate,
    parsed.data.limitAmountInt,
    new Date().toISOString()
  );

  res.status(201).json({ id });
});

financeRouter.delete('/budgets/:budgetId', (req: AuthedRequest, res) => {
  const db = getDb();
  const b = db.prepare('SELECT group_id FROM budgets WHERE id = ?').get(req.params.budgetId) as any;
  if (!b) {
    res.status(404).json({ error: 'Budget introuvable.' });
    return;
  }
  const ctx = getGroupMembership(req.user!.id, b.group_id);
  if (!ctx || !ctx.permissions.canManageBudgets) {
    res.status(403).json({ error: 'Permission insuffisante.' });
    return;
  }
  db.prepare('DELETE FROM budgets WHERE id = ?').run(req.params.budgetId);
  res.json({ ok: true });
});

financeRouter.get('/groups/:id/savings-goals', (req: AuthedRequest, res) => {
  const ctx = getGroupMembership(req.user!.id, req.params.id);
  if (!ctx) {
    res.status(403).json({ error: 'Accès refusé.' });
    return;
  }
  const db = getDb();
  const goals = db
    .prepare(
      `SELECT id, title, description, target_amount_int as targetAmountInt, deadline, status, created_at as createdAt
       FROM savings_goals WHERE group_id = ? ORDER BY created_at DESC`
    )
    .all(req.params.id) as any[];

  const enriched = goals.map((g) => {
    const contributions = db
      .prepare(
        `SELECT sc.id, sc.member_id as memberId, gm.first_name || ' ' || gm.last_name as memberName,
                sc.amount_int as amountInt, sc.status, sc.note, sc.created_at as createdAt
         FROM savings_contributions sc
         JOIN group_members gm ON gm.id = sc.member_id
         WHERE sc.goal_id = ? ORDER BY sc.created_at DESC`
      )
      .all(g.id) as any[];

    const confirmedInt = contributions
      .filter((c) => c.status === 'CONFIRMED')
      .reduce((a, b) => a + b.amountInt, 0);
    return {
      ...g,
      confirmedInt,
      remainingInt: Math.max(0, g.targetAmountInt - confirmedInt),
      percent: g.targetAmountInt > 0 ? Math.min(100, Math.round((confirmedInt * 100) / g.targetAmountInt)) : 0,
      contributions,
    };
  });

  res.json({ goals: enriched });
});

financeRouter.post('/groups/:id/savings-goals', (req: AuthedRequest, res) => {
  const ctx = getGroupMembership(req.user!.id, req.params.id);
  if (!ctx || !ctx.permissions.canManageBudgets) {
    res.status(403).json({ error: 'Permission insuffisante.' });
    return;
  }
  const schema = z.object({
    title: z.string().trim().min(2).max(140),
    description: z.string().trim().max(400).optional().nullable(),
    targetAmountInt: z.number().int().positive(),
    deadline: z.string().optional().nullable(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Données invalides.' });
    return;
  }
  const db = getDb();
  const entitlements = getGroupEntitlements(req.params.id);
  if (!entitlements.allowSavingsGoals) {
    res.status(402).json({
      code: 'PLAN_UPGRADE_REQUIRED',
      error: 'Les objectifs d’épargne collectifs sont débloqués à partir de l’offre Premium Famille & Coloc.',
      requiredPlans: ['PREMIUM', 'ORG'],
    });
    return;
  }
  const id = crypto.randomUUID();
  db.prepare(
    `INSERT INTO savings_goals (id, group_id, title, description, target_amount_int, deadline, status, created_at)
     VALUES (?, ?, ?, ?, ?, ?, 'ACTIVE', ?)`
  ).run(
    id,
    req.params.id,
    parsed.data.title,
    parsed.data.description || null,
    parsed.data.targetAmountInt,
    parsed.data.deadline || null,
    new Date().toISOString()
  );
  res.status(201).json({ id });
});

financeRouter.post('/savings-goals/:goalId/contributions', (req: AuthedRequest, res) => {
  const schema = z.object({
    amountInt: z.number().int().positive(),
    note: z.string().trim().max(240).optional().nullable(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Montant invalide.' });
    return;
  }
  const db = getDb();
  const goal = db.prepare('SELECT id, group_id FROM savings_goals WHERE id = ?').get(req.params.goalId) as any;
  if (!goal) {
    res.status(404).json({ error: 'Objectif introuvable.' });
    return;
  }
  const ctx = getGroupMembership(req.user!.id, goal.group_id);
  if (!ctx || ctx.role === 'OBSERVER') {
    res.status(403).json({ error: 'Permission insuffisante.' });
    return;
  }
  const id = crypto.randomUUID();
  db.prepare(
    `INSERT INTO savings_contributions (id, goal_id, member_id, amount_int, status, note, created_at)
     VALUES (?, ?, ?, ?, 'DECLARED', ?, ?)`
  ).run(id, goal.id, ctx.memberId, parsed.data.amountInt, parsed.data.note || null, new Date().toISOString());
  res.status(201).json({ id, status: 'DECLARED' });
});

financeRouter.post('/savings-contributions/:scId/confirm', (req: AuthedRequest, res) => {
  const db = getDb();
  const sc = db
    .prepare(
      `SELECT sc.id, sg.group_id FROM savings_contributions sc
       JOIN savings_goals sg ON sg.id = sc.goal_id WHERE sc.id = ?`
    )
    .get(req.params.scId) as any;
  if (!sc) {
    res.status(404).json({ error: 'Contribution introuvable.' });
    return;
  }
  const ctx = getGroupMembership(req.user!.id, sc.group_id);
  if (!ctx || !ctx.permissions.canConfirmPayments) {
    res.status(403).json({ error: 'Permission insuffisante.' });
    return;
  }
  db.prepare("UPDATE savings_contributions SET status = 'CONFIRMED', confirmed_at = ? WHERE id = ?").run(
    new Date().toISOString(),
    sc.id
  );
  res.json({ ok: true });
});

// ============================================================================
// PROTECTED DOCUMENT VAULT (Path-confined & Auth-checked)
// ============================================================================

const ALLOWED_MIME = new Set(['image/jpeg', 'image/png', 'image/webp', 'application/pdf']);

financeRouter.post('/groups/:id/documents', (req: AuthedRequest, res) => {
  const ctx = getGroupMembership(req.user!.id, req.params.id);
  if (!ctx || ctx.role === 'OBSERVER') {
    res.status(403).json({ error: 'Permission insuffisante.' });
    return;
  }

  const schema = z.object({
    entityType: z.enum(['EXPENSE', 'CONTRIBUTION_PAYMENT', 'SETTLEMENT']),
    entityId: z.string().min(1),
    filename: z.string().min(1).max(160),
    mimeType: z.string(),
    base64Data: z.string().min(1),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Fichier ou métadonnées invalides.' });
    return;
  }
  if (!ALLOWED_MIME.has(parsed.data.mimeType)) {
    res.status(400).json({ error: 'Format non autorisé. Utilisez JPG, PNG, WebP ou PDF.' });
    return;
  }

  const cleanBase64 = parsed.data.base64Data.replace(/^data:[^;]+;base64,/, '');
  const buffer = Buffer.from(cleanBase64, 'base64');
  if (buffer.byteLength === 0 || buffer.byteLength > 5 * 1024 * 1024) {
    res.status(400).json({ error: 'Taille de fichier invalide (5 Mo maximum).' });
    return;
  }

  const dbCheck = getDb();
  const entitlements = getGroupEntitlements(req.params.id);
  if (entitlements.maxDocuments !== null) {
    const docCount = (
      dbCheck.prepare('SELECT COUNT(*) as c FROM documents WHERE group_id = ?').get(req.params.id) as { c: number }
    ).c;
    if (docCount >= entitlements.maxDocuments) {
      res.status(402).json({
        code: 'PLAN_UPGRADE_REQUIRED',
        error: `Votre offre ${entitlements.label} est limitée à ${entitlements.maxDocuments} justificatif(s). Passez à une offre supérieure pour étendre votre coffre-fort.`,
        requiredPlans: ['PREMIUM', 'ORG'],
      });
      return;
    }
  }

  const uploadDir = getUploadDir();
  const safeExt =
    parsed.data.mimeType === 'application/pdf'
      ? 'pdf'
      : parsed.data.mimeType === 'image/png'
      ? 'png'
      : parsed.data.mimeType === 'image/webp'
      ? 'webp'
      : 'jpg';
  const storageKey = `${crypto.randomUUID()}.${safeExt}`;
  const targetPath = path.resolve(uploadDir, storageKey);
  if (!targetPath.startsWith(uploadDir + path.sep)) {
    res.status(400).json({ error: 'Chemin de stockage invalide.' });
    return;
  }

  fs.writeFileSync(targetPath, buffer);

  const docId = crypto.randomUUID();
  const safeFilename = path.basename(parsed.data.filename).replace(/[^a-zA-Z0-9._-]/g, '_');
  const db = getDb();
  db.prepare(
    `INSERT INTO documents (id, group_id, entity_type, entity_id, filename, mime_type, size_bytes, storage_key, uploaded_by_user_id, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    docId,
    req.params.id,
    parsed.data.entityType,
    parsed.data.entityId,
    safeFilename,
    parsed.data.mimeType,
    buffer.byteLength,
    storageKey,
    req.user!.id,
    new Date().toISOString()
  );

  res.status(201).json({
    id: docId,
    filename: safeFilename,
    mimeType: parsed.data.mimeType,
    sizeBytes: buffer.byteLength,
  });
});

financeRouter.get('/documents/:docId', (req: AuthedRequest, res) => {
  const db = getDb();
  const doc = db.prepare('SELECT * FROM documents WHERE id = ?').get(req.params.docId) as any;
  if (!doc) {
    res.status(404).json({ error: 'Document introuvable.' });
    return;
  }

  const ctx = getGroupMembership(req.user!.id, doc.group_id);
  if (!ctx) {
    res.status(403).json({ error: 'Accès non autorisé à ce justificatif privé.' });
    return;
  }

  const uploadDir = getUploadDir();
  const targetPath = path.resolve(uploadDir, doc.storage_key);
  if (!targetPath.startsWith(uploadDir + path.sep) || !fs.existsSync(targetPath)) {
    res.status(404).json({ error: 'Fichier physique introuvable.' });
    return;
  }

  res.setHeader('Content-Type', doc.mime_type);
  res.setHeader('Content-Disposition', `inline; filename="${doc.filename}"`);
  res.sendFile(targetPath);
});

// ============================================================================
// GROUP STATISTICS & AUDIT LOGS
// ============================================================================

financeRouter.get('/groups/:id/statistics', (req: AuthedRequest, res) => {
  const ctx = getGroupMembership(req.user!.id, req.params.id);
  if (!ctx) {
    res.status(403).json({ error: 'Accès refusé.' });
    return;
  }

  const db = getDb();
  const nowMonth = new Date().toISOString().slice(0, 7);

  const totals = db
    .prepare(
      `SELECT
         COALESCE(SUM(CASE WHEN status = 'ACTIVE' THEN amount_int ELSE 0 END), 0) as totalExpensesInt,
         COALESCE(SUM(CASE WHEN status = 'ACTIVE' AND substr(expense_date, 1, 7) = ? THEN amount_int ELSE 0 END), 0) as monthExpensesInt,
         COUNT(CASE WHEN status = 'ACTIVE' THEN 1 END) as activeExpensesCount
       FROM expenses WHERE group_id = ?`
    )
    .get(nowMonth, req.params.id) as any;

  const byCategory = db
    .prepare(
      `SELECT COALESCE(ec.name, 'Non catégorisé') as category, SUM(e.amount_int) as totalInt
       FROM expenses e
       LEFT JOIN expense_categories ec ON ec.id = e.category_id
       WHERE e.group_id = ? AND e.status = 'ACTIVE'
       GROUP BY category ORDER BY totalInt DESC`
    )
    .all(req.params.id);

  const byPayer = db
    .prepare(
      `SELECT gm.first_name || ' ' || gm.last_name as memberName, SUM(ep.amount_paid_int) as totalAdvancedInt
       FROM expense_payers ep
       JOIN expenses e ON e.id = ep.expense_id
       JOIN group_members gm ON gm.id = ep.member_id
       WHERE e.group_id = ? AND e.status = 'ACTIVE'
       GROUP BY ep.member_id ORDER BY totalAdvancedInt DESC`
    )
    .all(req.params.id);

  const monthlySeries = db
    .prepare(
      `SELECT substr(expense_date, 1, 7) as month, SUM(amount_int) as totalInt
       FROM expenses WHERE group_id = ? AND status = 'ACTIVE'
       GROUP BY month ORDER BY month ASC`
    )
    .all(req.params.id);

  const settlementStats = db
    .prepare(
      `SELECT
         COALESCE(SUM(CASE WHEN status = 'CONFIRMED' THEN amount_int ELSE 0 END), 0) as confirmedInt,
         COALESCE(SUM(CASE WHEN status = 'PENDING' THEN amount_int ELSE 0 END), 0) as pendingInt
       FROM settlements WHERE group_id = ?`
    )
    .get(req.params.id) as any;

  const contribStats = db
    .prepare(
      `SELECT
         COALESCE(SUM(c.expected_amount_int), 0) as expectedInt,
         COALESCE((SELECT SUM(cp.amount_int) FROM contribution_payments cp JOIN contributions c2 ON c2.id = cp.contribution_id WHERE c2.group_id = ? AND cp.status = 'CONFIRMED'), 0) as confirmedInt
       FROM contributions c WHERE c.group_id = ?`
    )
    .get(req.params.id, req.params.id) as any;

  const auditLogs = db
    .prepare(
      `SELECT a.id, a.action, a.target_type as targetType, a.details_json as detailsJson, a.created_at as createdAt,
              COALESCE(u.first_name || ' ' || u.last_name, 'Système') as actorName
       FROM audit_logs a
       LEFT JOIN users u ON u.id = a.actor_user_id
       WHERE a.group_id = ?
       ORDER BY a.created_at DESC LIMIT 30`
    )
    .all(req.params.id);

  res.json({
    ...totals,
    settlementConfirmedInt: settlementStats.confirmedInt,
    settlementPendingInt: settlementStats.pendingInt,
    contributionExpectedInt: contribStats.expectedInt,
    contributionConfirmedInt: contribStats.confirmedInt,
    contributionRemainingInt: Math.max(0, contribStats.expectedInt - contribStats.confirmedInt),
    byCategory,
    byPayer,
    monthlySeries,
    auditLogs,
  });
});
