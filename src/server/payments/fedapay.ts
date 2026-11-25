import crypto from 'node:crypto';

export type FedaPayEnvironment = 'sandbox' | 'live';

export interface FedaPayConfig {
  configured: boolean;
  webhookConfigured: boolean;
  environment: FedaPayEnvironment;
  baseUrl: string;
  publicKeyPresent: boolean;
}

export function getFedaPayConfig(): FedaPayConfig {
  const env: FedaPayEnvironment =
    process.env.FEDAPAY_ENVIRONMENT === 'live' ? 'live' : 'sandbox';
  const secretKey = process.env.FEDAPAY_SECRET_KEY?.trim() || '';
  const publicKey = process.env.FEDAPAY_PUBLIC_KEY?.trim() || '';
  const webhookSecret = process.env.FEDAPAY_WEBHOOK_SECRET?.trim() || '';

  return {
    configured: secretKey.length > 0,
    webhookConfigured: webhookSecret.length > 0,
    environment: env,
    baseUrl: env === 'live' ? 'https://api.fedapay.com/v1' : 'https://sandbox-api.fedapay.com/v1',
    publicKeyPresent: publicKey.length > 0,
  };
}

export interface CreateFedaPayTransactionInput {
  amountInt: number;
  currency: string;
  description: string;
  callbackUrl: string;
  customer: {
    firstName: string;
    lastName: string;
    email: string;
    phone?: string | null;
  };
  customMetadata: Record<string, string | number>;
}

export interface FedaPayTransactionResponse {
  providerTxId: string;
  paymentUrl: string;
  token: string;
  status: string;
  raw: unknown;
}

export async function createFedaPayTransaction(
  input: CreateFedaPayTransactionInput
): Promise<FedaPayTransactionResponse> {
  const cfg = getFedaPayConfig();
  const secretKey = process.env.FEDAPAY_SECRET_KEY?.trim();
  if (!cfg.configured || !secretKey) {
    throw new Error('FEDAPAY_NOT_CONFIGURED');
  }

  // 1. Create Transaction in FedaPay v1 API
  const createRes = await fetch(`${cfg.baseUrl}/transactions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${secretKey}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({
      description: input.description,
      amount: input.amountInt,
      currency: { iso: input.currency },
      callback_url: input.callbackUrl,
      customer: {
        firstname: input.customer.firstName,
        lastname: input.customer.lastName,
        email: input.customer.email,
        ...(input.customer.phone ? { phone_number: { number: input.customer.phone, country: 'bj' } } : {}),
      },
      custom_metadata: input.customMetadata,
    }),
  });

  if (!createRes.ok) {
    const errText = await createRes.text();
    throw new Error(`FedaPay transaction creation failed (${createRes.status}): ${errText.slice(0, 300)}`);
  }

  const createdJson = (await createRes.json()) as Record<string, any>;
  const txObj = createdJson['v1/transaction'] || createdJson.transaction || createdJson;
  const txId = String(txObj.id);

  // 2. Generate checkout token & URL
  const tokenRes = await fetch(`${cfg.baseUrl}/transactions/${encodeURIComponent(txId)}/token`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${secretKey}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
  });

  if (!tokenRes.ok) {
    const errText = await tokenRes.text();
    throw new Error(`FedaPay token generation failed (${tokenRes.status}): ${errText.slice(0, 300)}`);
  }

  const tokenJson = (await tokenRes.json()) as { token: string; url: string };
  return {
    providerTxId: txId,
    token: tokenJson.token,
    paymentUrl: tokenJson.url,
    status: String(txObj.status || 'pending'),
    raw: createdJson,
  };
}

export async function fetchFedaPayTransactionStatus(providerTxId: string): Promise<{
  id: string;
  status: string;
  amount: number;
  currencyIso: string;
  mode?: string;
  raw: unknown;
}> {
  const cfg = getFedaPayConfig();
  const secretKey = process.env.FEDAPAY_SECRET_KEY?.trim();
  if (!cfg.configured || !secretKey) {
    throw new Error('FEDAPAY_NOT_CONFIGURED');
  }

  const res = await fetch(`${cfg.baseUrl}/transactions/${encodeURIComponent(providerTxId)}`, {
    headers: {
      Authorization: `Bearer ${secretKey}`,
      Accept: 'application/json',
    },
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`FedaPay verify failed (${res.status}): ${errText.slice(0, 300)}`);
  }

  const json = (await res.json()) as Record<string, any>;
  const txObj = json['v1/transaction'] || json.transaction || json;
  return {
    id: String(txObj.id),
    status: String(txObj.status || 'pending').toLowerCase(),
    amount: Number(txObj.amount || 0),
    currencyIso: String(txObj.currency?.iso || 'XOF').toUpperCase(),
    mode: txObj.mode ? String(txObj.mode) : undefined,
    raw: json,
  };
}

/**
 * Verifies X-FEDAPAY-SIGNATURE header (`t=<unix_ts>,s=<hmac_sha256_hex>`).
 * Uses timing-safe comparison and rejects stale timestamps (> 5 min).
 */
export function verifyFedaPayWebhookSignature(
  rawBody: string | Buffer,
  signatureHeader: string | undefined,
  webhookSecret: string | undefined,
  toleranceSeconds = 300
): boolean {
  if (!signatureHeader || !webhookSecret || webhookSecret.trim().length === 0) {
    return false;
  }

  const parts = new Map<string, string>();
  for (const segment of signatureHeader.split(',')) {
    const [k, v] = segment.split('=').map((s) => s.trim());
    if (k && v) parts.set(k, v);
  }

  const timestampStr = parts.get('t');
  const sigHex = parts.get('s');
  if (!timestampStr || !sigHex) return false;

  const ts = Number(timestampStr);
  if (!Number.isFinite(ts)) return false;

  const nowSec = Math.floor(Date.now() / 1000);
  if (Math.abs(nowSec - ts) > toleranceSeconds) {
    return false;
  }

  const payload = `${timestampStr}.${Buffer.isBuffer(rawBody) ? rawBody.toString('utf8') : rawBody}`;
  const expectedHex = crypto
    .createHmac('sha256', webhookSecret.trim())
    .update(payload)
    .digest('hex');

  const sigBuf = Buffer.from(sigHex, 'hex');
  const expBuf = Buffer.from(expectedHex, 'hex');
  if (sigBuf.length === 0 || sigBuf.length !== expBuf.length) {
    return false;
  }

  return crypto.timingSafeEqual(sigBuf, expBuf);
}
