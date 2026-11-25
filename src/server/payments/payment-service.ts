import crypto from 'node:crypto';
import { getDb } from '../db';
import { recordAudit } from '../auth';
import {
  createFedaPayTransaction,
  fetchFedaPayTransactionStatus,
  getFedaPayConfig,
} from './fedapay';
import type { SubscriptionPlanCode } from '../../shared/types';

export interface InitiateSubscriptionCheckoutInput {
  groupId: string;
  userId: string;
  planCode: SubscriptionPlanCode;
  months: number;
  callbackBaseUrl: string;
}

export async function initiateSubscriptionCheckout(input: InitiateSubscriptionCheckoutInput) {
  const db = getDb();
  if (input.planCode === 'FREE') {
    throw new Error('Le plan Gratuit ne nécessite pas de transaction de paiement.');
  }
  if (!Number.isInteger(input.months) || input.months < 1 || input.months > 24) {
    throw new Error('La durée d’abonnement doit être comprise entre 1 et 24 mois.');
  }

  const plan = db
    .prepare('SELECT code, name, monthly_price_int, currency, is_active FROM subscription_plans WHERE code = ?')
    .get(input.planCode) as
    | { code: string; name: string; monthly_price_int: number; currency: string; is_active: number }
    | undefined;

  if (!plan || !plan.is_active) {
    throw new Error('Offre tarifaire introuvable ou inactive.');
  }

  const group = db.prepare('SELECT id, name FROM groups WHERE id = ?').get(input.groupId) as
    | { id: string; name: string }
    | undefined;
  if (!group) throw new Error('Groupe introuvable.');

  const user = db
    .prepare('SELECT id, first_name, last_name, email, phone FROM users WHERE id = ?')
    .get(input.userId) as
    | { id: string; first_name: string; last_name: string; email: string; phone: string | null }
    | undefined;
  if (!user) throw new Error('Utilisateur introuvable.');

  const amountInt = plan.monthly_price_int * input.months;
  const idempotencyKey = crypto.randomUUID();
  const txRecordId = crypto.randomUUID();
  const nowIso = new Date().toISOString();

  const fedaCfg = getFedaPayConfig();
  if (!fedaCfg.configured) {
    return {
      configured: false,
      environment: fedaCfg.environment,
      amountInt,
      currency: plan.currency,
      message:
        'FedaPay n’est pas encore configuré (FEDAPAY_SECRET_KEY manquant). Vous pouvez soumettre une demande de validation manuelle ou configurer vos clés Sandbox.',
    };
  }

  const callbackUrl = `${input.callbackBaseUrl.replace(/\/$/, '')}/app/groups/${input.groupId}?payment_tx=${txRecordId}`;

  const fpRes = await createFedaPayTransaction({
    amountInt,
    currency: plan.currency,
    description: `Abonnement KPATA ${plan.name} (${input.months} mois) — ${group.name}`,
    callbackUrl,
    customer: {
      firstName: user.first_name,
      lastName: user.last_name,
      email: user.email,
      phone: user.phone,
    },
    customMetadata: {
      kpata_tx_id: txRecordId,
      group_id: input.groupId,
      plan_code: input.planCode,
      months: input.months,
    },
  });

  db.prepare(
    `INSERT INTO payment_transactions
      (id, group_id, plan_code, months, provider, provider_tx_id, idempotency_key, amount_int, currency, status, raw_payload_json, created_at)
     VALUES (?, ?, ?, ?, 'FEDAPAY', ?, ?, ?, ?, 'PENDING', ?, ?)`
  ).run(
    txRecordId,
    input.groupId,
    input.planCode,
    input.months,
    fpRes.providerTxId,
    idempotencyKey,
    amountInt,
    plan.currency,
    JSON.stringify(fpRes.raw),
    nowIso
  );

  recordAudit({
    actorUserId: input.userId,
    groupId: input.groupId,
    action: 'FEDAPAY_CHECKOUT_INITIATED',
    targetType: 'payment_transaction',
    targetId: txRecordId,
    details: { providerTxId: fpRes.providerTxId, amountInt, planCode: input.planCode, months: input.months },
  });

  return {
    configured: true,
    environment: fedaCfg.environment,
    transactionId: txRecordId,
    providerTxId: fpRes.providerTxId,
    paymentUrl: fpRes.paymentUrl,
    amountInt,
    currency: plan.currency,
  };
}

export interface ProcessVerifiedPaymentResult {
  processed: boolean;
  alreadyProcessed?: boolean;
  status: string;
  reason?: string;
}

/**
 * Idempotently verifies and applies a FedaPay transaction result.
 * Enforces exact amount & currency match before activating the group's subscription.
 */
export function applyVerifiedFedaPayResult(params: {
  providerTxId: string;
  reportedStatus: string;
  reportedAmount: number;
  reportedCurrency: string;
  paymentMethod?: string;
  rawPayload: unknown;
}): ProcessVerifiedPaymentResult {
  const db = getDb();
  const tx = db
    .prepare('SELECT * FROM payment_transactions WHERE provider_tx_id = ?')
    .get(params.providerTxId) as any;

  if (!tx) {
    return { processed: false, status: 'UNKNOWN_TRANSACTION', reason: 'Transaction introuvable.' };
  }

  // Idempotency guard: if already finalized as APPROVED, never double-activate
  if (tx.status === 'APPROVED') {
    return { processed: true, alreadyProcessed: true, status: 'APPROVED' };
  }

  const normalizedStatus = params.reportedStatus.toLowerCase();
  const nowIso = new Date().toISOString();

  // Amount & Currency tamper check
  if (Math.round(params.reportedAmount) !== tx.amount_int || params.reportedCurrency.toUpperCase() !== tx.currency) {
    db.prepare(
      `UPDATE payment_transactions
       SET status = 'DECLINED', raw_payload_json = ?, verified_at = ?
       WHERE id = ?`
    ).run(JSON.stringify(params.rawPayload), nowIso, tx.id);

    recordAudit({
      actorUserId: null,
      groupId: tx.group_id,
      action: 'FEDAPAY_AMOUNT_MISMATCH',
      targetType: 'payment_transaction',
      targetId: tx.id,
      details: {
        expectedAmount: tx.amount_int,
        reportedAmount: params.reportedAmount,
        expectedCurrency: tx.currency,
        reportedCurrency: params.reportedCurrency,
      },
    });

    return {
      processed: false,
      status: 'AMOUNT_MISMATCH',
      reason: 'Montant ou devise incohérent avec la transaction attendue.',
    };
  }

  if (normalizedStatus === 'approved' || normalizedStatus === 'transferred') {
    const activateTx = db.transaction(() => {
      db.prepare(
        `UPDATE payment_transactions
         SET status = 'APPROVED', payment_method = ?, raw_payload_json = ?, verified_at = ?
         WHERE id = ?`
      ).run(params.paymentMethod || 'FEDAPAY', JSON.stringify(params.rawPayload), nowIso, tx.id);

      const existingSub = db
        .prepare('SELECT * FROM subscriptions WHERE group_id = ?')
        .get(tx.group_id) as any;

      const baseStart =
        existingSub?.end_date && new Date(existingSub.end_date).getTime() > Date.now()
          ? new Date(existingSub.end_date)
          : new Date();
      const endDate = new Date(baseStart);
      endDate.setMonth(endDate.getMonth() + (tx.months || 1));

      if (existingSub) {
        db.prepare(
          `UPDATE subscriptions
           SET plan_code = ?, status = 'ACTIVE', start_date = ?, end_date = ?, updated_at = ?
           WHERE group_id = ?`
        ).run(tx.plan_code, nowIso, endDate.toISOString(), nowIso, tx.group_id);
      } else {
        db.prepare(
          `INSERT INTO subscriptions (id, group_id, plan_code, status, start_date, end_date, auto_renew, updated_at)
           VALUES (?, ?, ?, 'ACTIVE', ?, ?, 0, ?)`
        ).run(crypto.randomUUID(), tx.group_id, tx.plan_code, nowIso, endDate.toISOString(), nowIso);
      }
    });

    activateTx();

    recordAudit({
      actorUserId: null,
      groupId: tx.group_id,
      action: 'SUBSCRIPTION_ACTIVATED_FEDAPAY',
      targetType: 'subscription',
      targetId: tx.group_id,
      details: { planCode: tx.plan_code, months: tx.months, providerTxId: params.providerTxId },
    });

    return { processed: true, status: 'APPROVED' };
  }

  if (['declined', 'canceled', 'cancelled', 'expired'].includes(normalizedStatus)) {
    const mapped = normalizedStatus === 'declined' ? 'DECLINED' : 'CANCELLED';
    db.prepare(
      `UPDATE payment_transactions
       SET status = ?, payment_method = ?, raw_payload_json = ?, verified_at = ?
       WHERE id = ?`
    ).run(mapped, params.paymentMethod || null, JSON.stringify(params.rawPayload), nowIso, tx.id);

    return { processed: true, status: mapped };
  }

  return { processed: false, status: 'PENDING' };
}

export async function verifyFedaPayTransactionOnServer(txRecordId: string) {
  const db = getDb();
  const tx = db
    .prepare('SELECT * FROM payment_transactions WHERE id = ?')
    .get(txRecordId) as any;

  if (!tx) throw new Error('Transaction introuvable.');
  if (tx.status === 'APPROVED') {
    return { status: 'APPROVED', verified: true, alreadyProcessed: true };
  }
  if (!tx.provider_tx_id) {
    throw new Error('Identifiant de transaction FedaPay manquant.');
  }

  const remote = await fetchFedaPayTransactionStatus(tx.provider_tx_id);
  const res = applyVerifiedFedaPayResult({
    providerTxId: tx.provider_tx_id,
    reportedStatus: remote.status,
    reportedAmount: remote.amount,
    reportedCurrency: remote.currencyIso,
    paymentMethod: remote.mode,
    rawPayload: remote.raw,
  });

  return { ...res, verified: res.status === 'APPROVED' };
}
