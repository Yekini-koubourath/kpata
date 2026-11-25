import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  calculateShares,
  computeGroupBalances,
  evaluateBudgetAlert,
  optimizeSettlements,
  validatePayers,
} from '../src/shared/finance';
import { createApiApp } from '../src/server/app';
import { getDb, resetDbForTests } from '../src/server/db';

describe('Moteur financier KPATA (calculs entiers FCFA)', () => {
  it('répartit équitablement avec reste déterministe sans perte ni centime flottant (EQUAL)', () => {
    const shares = calculateShares(1000, 'EQUAL', [
      { memberId: 'm1' },
      { memberId: 'm2' },
      { memberId: 'm3' },
    ]);
    const total = shares.reduce((a, b) => a + b.shareAmountInt, 0);
    expect(total).toBe(1000);
    expect(shares.map((s) => s.shareAmountInt)).toEqual([334, 333, 333]);
  });

  it('supporte les 6 méthodes de répartition : CUSTOM, PERCENTAGE, WEIGHT, PARTICIPATION, FIXED', () => {
    const custom = calculateShares(15000, 'CUSTOM', [
      { memberId: 'm1', amountInt: 5000 },
      { memberId: 'm2', amountInt: 10000 },
    ]);
    expect(custom.map((s) => s.shareAmountInt)).toEqual([5000, 10000]);

    const pct = calculateShares(10000, 'PERCENTAGE', [
      { memberId: 'm1', percentage: 60 },
      { memberId: 'm2', percentage: 40 },
    ]);
    expect(pct.map((s) => s.shareAmountInt)).toEqual([6000, 4000]);

    const weight = calculateShares(12000, 'WEIGHT', [
      { memberId: 'm1', weight: 2 },
      { memberId: 'm2', weight: 1 },
    ]);
    expect(weight.map((s) => s.shareAmountInt)).toEqual([8000, 4000]);

    const participation = calculateShares(9000, 'PARTICIPATION', [
      { memberId: 'm1', included: true },
      { memberId: 'm2', included: false },
      { memberId: 'm3', included: true },
    ]);
    expect(participation.map((s) => s.shareAmountInt)).toEqual([4500, 4500]);

    const fixed = calculateShares(12000, 'FIXED', [
      { memberId: 'm1', amountInt: 2000 },
      { memberId: 'm2', amountInt: 5000 },
      { memberId: 'm3', amountInt: 5000 },
    ]);
    expect(fixed.map((s) => s.shareAmountInt)).toEqual([2000, 5000, 5000]);
  });

  it('valide les dépenses multi-payeurs (5 000 + 10 000 = 15 000 FCFA) et rejette les sommes incohérentes', () => {
    const ok = validatePayers(15000, [
      { memberId: 'jean', amountPaidInt: 5000 },
      { memberId: 'mariam', amountPaidInt: 10000 },
    ]);
    expect(ok.totalPaidInt).toBe(15000);
    expect(ok.paymentStatus).toBe('PAID');

    expect(() =>
      validatePayers(15000, [
        { memberId: 'jean', amountPaidInt: 5000 },
        { memberId: 'mariam', amountPaidInt: 9000 },
      ])
    ).toThrow();
  });

  it('calcule les soldes nets et optimise les remboursements minimaux', () => {
    const members = [
      { id: 'jean', displayName: 'Jean', isExternal: false, status: 'ACTIVE' },
      { id: 'mariam', displayName: 'Mariam', isExternal: false, status: 'ACTIVE' },
      { id: 'kossi', displayName: 'Kossi', isExternal: true, status: 'ACTIVE' },
    ];
    const expenses: {
      id: string;
      status: 'ACTIVE' | 'CANCELLED';
      payers: { memberId: string; amountPaidInt: number }[];
      shares: { memberId: string; shareAmountInt: number }[];
    }[] = [
      {
        id: 'e1',
        status: 'ACTIVE',
        payers: [
          { memberId: 'jean', amountPaidInt: 5000 },
          { memberId: 'mariam', amountPaidInt: 10000 },
        ],
        shares: [
          { memberId: 'jean', shareAmountInt: 5000 },
          { memberId: 'mariam', shareAmountInt: 5000 },
          { memberId: 'kossi', shareAmountInt: 5000 },
        ],
      },
      {
        id: 'e_cancelled',
        status: 'CANCELLED',
        payers: [{ memberId: 'kossi', amountPaidInt: 9000 }],
        shares: [{ memberId: 'jean', shareAmountInt: 9000 }],
      },
    ];
    const balances = computeGroupBalances(members, expenses, []);
    const byId = Object.fromEntries(balances.map((b) => [b.memberId, b.netBalanceInt]));
    expect(byId.jean).toBe(0);
    expect(byId.mariam).toBe(5000);
    expect(byId.kossi).toBe(-5000);

    const suggestions = optimizeSettlements(balances);
    expect(suggestions).toEqual([
      {
        fromMemberId: 'kossi',
        fromName: 'Kossi',
        toMemberId: 'mariam',
        toName: 'Mariam',
        amountInt: 5000,
      },
    ]);
  });

  it('évalue correctement les seuils d’alerte budget (50/75/90/100 %)', () => {
    expect(evaluateBudgetAlert(4000, 10000).level).toBe('OK');
    expect(evaluateBudgetAlert(5500, 10000).level).toBe('50');
    expect(evaluateBudgetAlert(8000, 10000).level).toBe('75');
    expect(evaluateBudgetAlert(9200, 10000).level).toBe('90');
    expect(evaluateBudgetAlert(12000, 10000).level).toBe('EXCEEDED');
  });
});

describe('API Express KPATA — Isolation, Finances, Cotisations, Paiements, SEO & Analytics', () => {
  let server: Server;
  let baseUrl: string;
  let tmpDir: string;

  beforeAll(async () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'kpata-test-'));
    const dbPath = path.join(tmpDir, 'test.db');
    process.env.SESSION_SECRET = 'test-session-secret-32-chars-minimum';
    process.env.FEDAPAY_WEBHOOK_SECRET = 'test-webhook-secret';
    process.env.ADMIN_BOOTSTRAP_PASSCODE = 'AdminTestPass2026!';
    resetDbForTests(dbPath);

    const app = createApiApp();
    await new Promise<void>((resolve) => {
      server = app.listen(0, '127.0.0.1', () => {
        const addr = server.address() as AddressInfo;
        baseUrl = `http://127.0.0.1:${addr.port}`;
        resolve();
      });
    });
  });

  afterAll(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  async function reqJson(
    urlPath: string,
    options: { method?: string; token?: string; body?: unknown; headers?: Record<string, string> } = {}
  ) {
    const res = await fetch(`${baseUrl}${urlPath}`, {
      method: options.method || 'GET',
      headers: {
        'Content-Type': 'application/json',
        'X-Requested-With': 'kpata-web',
        ...(options.token ? { Authorization: `Bearer ${options.token}` } : {}),
        ...(options.headers || {}),
      },
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
    });
    const text = await res.text();
    let json: any = null;
    try {
      json = JSON.parse(text);
    } catch {
      json = text;
    }
    return { status: res.status, headers: res.headers, data: json };
  }

  it('exécute le cycle complet auth, isolation de groupes, membre externe + rattachement, dépenses multi-payeurs, cotisations, remboursements et coffre justificatifs', async () => {
    // 1. Register two distinct users
    const regA = await reqJson('/api/auth/register', {
      method: 'POST',
      body: {
        email: 'alice@test.bj',
        password: 'Password123!',
        firstName: 'Alice',
        lastName: 'Togbe',
      },
    });
    expect(regA.status).toBe(201);
    const tokenA = regA.data.token;

    const regB = await reqJson('/api/auth/register', {
      method: 'POST',
      body: {
        email: 'bob@test.bj',
        password: 'Password123!',
        firstName: 'Bob',
        lastName: 'Sossa',
      },
    });
    expect(regB.status).toBe(201);
    const tokenB = regB.data.token;

    // 2. Alice creates Group A; Bob creates Group B
    const grpA = await reqJson('/api/groups', {
      method: 'POST',
      token: tokenA,
      body: { name: 'Famille Togbe', type: 'FAMILLE', country: 'BJ', currency: 'XOF' },
    });
    expect(grpA.status).toBe(201);
    const groupIdA = grpA.data.id;
    const aliceMemberId = grpA.data.memberId;

    const grpB = await reqJson('/api/groups', {
      method: 'POST',
      token: tokenB,
      body: { name: 'Coloc Bob', type: 'COLOCATION', country: 'BJ', currency: 'XOF' },
    });
    expect(grpB.status).toBe(201);
    const groupIdB = grpB.data.id;

    // 3. Strict group isolation: Bob gets 403 on Group A
    const forbiddenDetail = await reqJson(`/api/groups/${groupIdA}`, { token: tokenB });
    expect(forbiddenDetail.status).toBe(403);
    const forbiddenExpenses = await reqJson(`/api/groups/${groupIdA}/expenses`, { token: tokenB });
    expect(forbiddenExpenses.status).toBe(403);

    // 4. Alice adds Bob as an external member (without account link yet) in Group A
    const extRes = await reqJson(`/api/groups/${groupIdA}/members`, {
      method: 'POST',
      token: tokenA,
      body: { firstName: 'Bob', lastName: 'Sossa', familyRelation: 'Cousin', role: 'MEMBER' },
    });
    expect(extRes.status).toBe(201);
    const bobMemberId = extRes.data.id;

    // 5. Multi-payer expense in Group A involving Alice & external Bob
    const expRes = await reqJson(`/api/groups/${groupIdA}/expenses`, {
      method: 'POST',
      token: tokenA,
      body: {
        title: 'Achat vivres marché Dantokpa',
        amountInt: 15000,
        expenseDate: '2026-11-20',
        scope: 'COLLECTIVE',
        splitMethod: 'EQUAL',
        payers: [
          { memberId: aliceMemberId, amountPaidInt: 10000 },
          { memberId: bobMemberId, amountPaidInt: 5000 },
        ],
        participants: [{ memberId: aliceMemberId }, { memberId: bobMemberId }],
      },
    });
    expect(expRes.status).toBe(201);
    const expenseId = expRes.data.id;

    // Upload receipt document for Group A expense & ensure Bob (before linking) gets 403
    const fakePngBase64 = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3]).toString('base64');
    const docUpload = await reqJson(`/api/groups/${groupIdA}/documents`, {
      method: 'POST',
      token: tokenA,
      body: {
        entityType: 'EXPENSE',
        entityId: expenseId,
        filename: 'recu.png',
        mimeType: 'image/png',
        base64Data: fakePngBase64,
      },
    });
    expect(docUpload.status).toBe(201);
    const docDenied = await fetch(`${baseUrl}/api/documents/${docUpload.data.id}`, {
      headers: { Authorization: `Bearer ${tokenB}` },
    });
    expect(docDenied.status).toBe(403);

    // 6. Account linking workflow preserving Bob's historical expense & balance!
    const linkReq = await reqJson(`/api/groups/${groupIdA}/members/${bobMemberId}/link-account`, {
      method: 'POST',
      token: tokenB,
      body: { verificationContact: 'bob@test.bj' },
    });
    expect(linkReq.status).toBe(201);

    const reviewRes = await reqJson(`/api/groups/${groupIdA}/link-requests/${linkReq.data.id}/review`, {
      method: 'POST',
      token: tokenA,
      body: { decision: 'APPROVE' },
    });
    expect(reviewRes.status).toBe(200);

    // Now Bob can access Group A and download the receipt
    const docAllowed = await fetch(`${baseUrl}/api/documents/${docUpload.data.id}`, {
      headers: { Authorization: `Bearer ${tokenB}` },
    });
    expect(docAllowed.status).toBe(200);

    // Balances before settlement: Alice +2500, Bob -2500
    const bal1 = await reqJson(`/api/groups/${groupIdA}/balances`, { token: tokenB });
    expect(bal1.status).toBe(200);
    const bobBal1 = bal1.data.balances.find((b: any) => b.memberId === bobMemberId);
    expect(bobBal1.netBalanceInt).toBe(-2500);

    // 7. Settlement declared as PENDING (doesn't alter balance until Alice confirms)
    const stlRes = await reqJson(`/api/groups/${groupIdA}/settlements`, {
      method: 'POST',
      token: tokenB,
      body: {
        fromMemberId: bobMemberId,
        toMemberId: aliceMemberId,
        amountInt: 2500,
        settlementDate: '2026-11-21',
        paymentMethod: 'MTN_MOMO',
        reference: 'MOMO-9988',
      },
    });
    expect(stlRes.status).toBe(201);
    expect(stlRes.data.status).toBe('PENDING');

    // Bob cannot confirm his own outgoing payment to Alice
    const selfConfirm = await reqJson(`/api/settlements/${stlRes.data.id}/confirm`, {
      method: 'POST',
      token: tokenB,
    });
    expect(selfConfirm.status).toBe(403);

    // Alice confirms -> balance becomes 0!
    const aliceConfirm = await reqJson(`/api/settlements/${stlRes.data.id}/confirm`, {
      method: 'POST',
      token: tokenA,
    });
    expect(aliceConfirm.status).toBe(200);

    const bal2 = await reqJson(`/api/groups/${groupIdA}/balances`, { token: tokenA });
    const bobBal2 = bal2.data.balances.find((b: any) => b.memberId === bobMemberId);
    expect(bobBal2.netBalanceInt).toBe(0);

    // 8. Partial Contributions: 15 000 expected -> 4 000 declared + 6 000 declared -> confirm 4 000
    const ctrPlan = await reqJson(`/api/groups/${groupIdA}/contributions`, {
      method: 'POST',
      token: tokenA,
      body: {
        name: 'Cotisation Fête',
        amountPerMemberInt: 15000,
        frequency: 'ONCE',
        startDate: '2026-11-01',
      },
    });
    expect(ctrPlan.status).toBe(201);

    const ctrs = await reqJson(`/api/groups/${groupIdA}/contributions`, { token: tokenA });
    const bobCtr = ctrs.data.plans[0].items.find((i: any) => i.memberId === bobMemberId);
    expect(bobCtr.expectedAmountInt).toBe(15000);

    const pay1 = await reqJson(`/api/contributions/${bobCtr.id}/payments`, {
      method: 'POST',
      token: tokenB,
      body: { amountInt: 4000, paymentMethod: 'ESPECES' },
    });
    expect(pay1.data.status).toBe('DECLARED');

    const pay2 = await reqJson(`/api/contributions/${bobCtr.id}/payments`, {
      method: 'POST',
      token: tokenB,
      body: { amountInt: 6000, paymentMethod: 'MOOV_MONEY' },
    });
    expect(pay2.data.status).toBe('DECLARED');

    // Confirm only first payment (4 000 FCFA)
    await reqJson(`/api/contributions/payments/${pay1.data.id}/confirm`, {
      method: 'POST',
      token: tokenA,
    });

    const ctrsAfter = await reqJson(`/api/groups/${groupIdA}/contributions`, { token: tokenA });
    const bobCtrAfter = ctrsAfter.data.plans[0].items.find((i: any) => i.memberId === bobMemberId);
    expect(bobCtrAfter.confirmedInt).toBe(4000);
    expect(bobCtrAfter.declaredInt).toBe(6000);
    expect(bobCtrAfter.remainingInt).toBe(11000);

    // 9. Expense cancellation preserves revision log
    const cancelExp = await reqJson(`/api/expenses/${expenseId}/cancel`, {
      method: 'POST',
      token: tokenA,
      body: { reason: 'Erreur de saisie doublon' },
    });
    expect(cancelExp.status).toBe(200);

    // Bob cannot read Group A after logout when token revoked
    const logoutRes = await reqJson('/api/auth/logout', { method: 'POST', token: tokenB });
    expect(logoutRes.status).toBe(200);
    const postLogout = await reqJson(`/api/groups/${groupIdB}`, { token: tokenB });
    expect(postLogout.status).toBe(401);
  });

  it('protège FedaPay (signature HMAC, anti-tampering montant, idempotence) et validation manuelle admin', async () => {
    // Login seeded Jean Dossou
    const login = await reqJson('/api/auth/login', {
      method: 'POST',
      body: { email: 'jean.dossou@kpata.bj', password: 'KpataDemo2026!' },
    });
    expect(login.status).toBe(200);
    const jeanToken = login.data.token;

    const grp = await reqJson('/api/groups', {
      method: 'POST',
      token: jeanToken,
      body: { name: 'Test Paiement Groupe', type: 'ASSOCIATION', country: 'BJ', currency: 'XOF' },
    });
    const groupId = grp.data.id;

    // 1. Insert pending FedaPay transaction in DB (as checkout would)
    const db = getDb();
    const txId = crypto.randomUUID();
    const providerTxId = '99001122';
    db.prepare(
      `INSERT INTO payment_transactions (id, group_id, plan_code, months, provider, provider_tx_id, idempotency_key, amount_int, currency, status, created_at)
       VALUES (?, ?, 'PREMIUM', 1, 'FEDAPAY', ?, ?, 500, 'XOF', 'PENDING', ?)`
    ).run(txId, groupId, providerTxId, crypto.randomUUID(), new Date().toISOString());

    const signPayload = (bodyStr: string) => {
      const t = String(Math.floor(Date.now() / 1000));
      const sig = crypto
        .createHmac('sha256', process.env.FEDAPAY_WEBHOOK_SECRET!)
        .update(`${t}.${bodyStr}`)
        .digest('hex');
      return `t=${t},s=${sig}`;
    };

    // 2. Reject invalid webhook signature
    const badWebhook = await reqJson('/api/webhooks/fedapay', {
      method: 'POST',
      headers: { 'x-fedapay-signature': `t=${Math.floor(Date.now() / 1000)},s=deadbeef` },
      body: { entity: { id: providerTxId, status: 'approved', amount: 500, currency: { iso: 'XOF' } } },
    });
    expect(badWebhook.status).toBe(401);

    // 3. Reject tampered amount (100 FCFA instead of 500 FCFA)
    const tamperTxId = '99001199';
    db.prepare(
      `INSERT INTO payment_transactions (id, group_id, plan_code, months, provider, provider_tx_id, idempotency_key, amount_int, currency, status, created_at)
       VALUES (?, ?, 'PREMIUM', 1, 'FEDAPAY', ?, ?, 500, 'XOF', 'PENDING', ?)`
    ).run(crypto.randomUUID(), groupId, tamperTxId, crypto.randomUUID(), new Date().toISOString());

    const tamperBody = JSON.stringify({
      entity: { id: tamperTxId, status: 'approved', amount: 100, currency: { iso: 'XOF' } },
    });
    const tamperRes = await fetch(`${baseUrl}/api/webhooks/fedapay`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-fedapay-signature': signPayload(tamperBody),
      },
      body: tamperBody,
    });
    const tamperJson = await tamperRes.json();
    expect(tamperJson.status).toBe('AMOUNT_MISMATCH');

    // 4. Valid webhook activates PREMIUM & is idempotent on replay
    const validBody = JSON.stringify({
      entity: {
        id: providerTxId,
        status: 'approved',
        amount: 500,
        currency: { iso: 'XOF' },
        mode: 'mtn_open',
      },
    });
    const validSig = signPayload(validBody);

    const ok1 = await fetch(`${baseUrl}/api/webhooks/fedapay`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-fedapay-signature': validSig },
      body: validBody,
    });
    const ok1Json = await ok1.json();
    expect(ok1Json.status).toBe('APPROVED');

    // Replay must be idempotent
    const ok2 = await fetch(`${baseUrl}/api/webhooks/fedapay`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-fedapay-signature': validSig },
      body: validBody,
    });
    const ok2Json = await ok2.json();
    expect(ok2Json.alreadyProcessed).toBe(true);

    const subAfter = await reqJson(`/api/groups/${groupId}/subscription`, { token: jeanToken });
    expect(subAfter.data.subscription.planCode).toBe('PREMIUM');
    expect(subAfter.data.subscription.status).toBe('ACTIVE');

    // 5. Manual subscription request does NOT activate until admin approves
    const manualReq = await reqJson(`/api/groups/${groupId}/subscription/request`, {
      method: 'POST',
      token: jeanToken,
      body: { planCode: 'ORG', months: 2, reference: 'MOMO-PILOT-777' },
    });
    expect(manualReq.status).toBe(201);
    expect(manualReq.data.status).toBe('PENDING');

    const subStillPremium = await reqJson(`/api/groups/${groupId}/subscription`, { token: jeanToken });
    expect(subStillPremium.data.subscription.planCode).toBe('PREMIUM');

    // Bootstrap Admin & approve manual request
    const adminBoot = await reqJson('/api/admin/bootstrap', {
      method: 'POST',
      body: { passcode: process.env.ADMIN_BOOTSTRAP_PASSCODE!, email: 'admin@kpata.bj' },
    });
    expect(adminBoot.status).toBe(200);
    const adminToken = adminBoot.data.token;

    const approve = await reqJson(`/api/admin/subscription-requests/${manualReq.data.id}/approve`, {
      method: 'POST',
      token: adminToken,
      body: { comment: 'Reçu MTN vérifié' },
    });
    expect(approve.status).toBe(200);

    const subNowOrg = await reqJson(`/api/groups/${groupId}/subscription`, { token: jeanToken });
    expect(subNowOrg.data.subscription.planCode).toBe('ORG');
  });

  it('génère sitemap.xml, robots.txt, en-têtes noindex et filtre les bots dans les statistiques du site', async () => {
    const robots = await fetch(`${baseUrl}/robots.txt`);
    expect(robots.status).toBe(200);
    const robotsText = await robots.text();
    expect(robotsText).toContain('Disallow: /app');
    expect(robotsText).toContain('Disallow: /admin');
    expect(robotsText).toContain('Disallow: /connexion');
    expect(robotsText).toContain('Sitemap:');

    const sitemap = await fetch(`${baseUrl}/sitemap.xml`);
    expect(sitemap.status).toBe(200);
    const sitemapXml = await sitemap.text();
    expect(sitemapXml).toContain('/fonctionnalites');
    expect(sitemapXml).toContain('/tarifs');
    expect(sitemapXml).not.toContain('/app');
    expect(sitemapXml).not.toContain('/admin');

    // X-Robots-Tag noindex on private/admin/auth paths
    const privateCheck = await fetch(`${baseUrl}/app/groups`);
    expect(privateCheck.headers.get('x-robots-tag')).toBe('noindex, nofollow');

    // Bot visit must be ignored
    const botTrack = await reqJson('/api/analytics/track', {
      method: 'POST',
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
      },
      body: { sessionId: 'bot-session-1234', path: '/' },
    });
    expect(botTrack.data.ignoredBot).toBe(true);

    // Human visit must be counted
    const humanTrack = await reqJson('/api/analytics/track', {
      method: 'POST',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 Chrome/126.0 Mobile Safari/537.36',
      },
      body: {
        sessionId: 'human-sess-1',
        visitorToken: 'vis-abc',
        path: '/fonctionnalites',
        referrer: 'https://www.google.com/',
      },
    });
    expect(humanTrack.data.ignoredBot).toBe(false);
    expect(humanTrack.data.recorded).toBe(true);

    // Non-admin blocked from admin analytics
    const unauthStats = await reqJson('/api/admin/site-analytics?period=month');
    expect(unauthStats.status).toBe(401);

    // Admin sees human visit in stats
    const adminBoot = await reqJson('/api/admin/bootstrap', {
      method: 'POST',
      body: { passcode: process.env.ADMIN_BOOTSTRAP_PASSCODE!, email: 'admin@kpata.bj' },
    });
    const adminStats = await reqJson('/api/admin/site-analytics?period=month', {
      token: adminBoot.data.token,
    });
    expect(adminStats.status).toBe(200);
    expect(adminStats.data.metrics.totalSessions).toBeGreaterThanOrEqual(1);
    expect(adminStats.data.metrics.uniqueVisitors).toBeGreaterThanOrEqual(1);
    expect(adminStats.data.sources.some((s: any) => s.source === 'Google & Moteurs')).toBe(true);
  });

  it('diversifie les 3 offres (FREE/PREMIUM/ORG) et bloque les fonctions payantes (402) tant que le paiement n’est pas validé', async () => {
    // 1. Verify GET /api/plans returns the 3 differentiated plans with entitlements
    const plansRes = await reqJson('/api/plans');
    expect(plansRes.status).toBe(200);
    const planCodes = plansRes.data.plans.map((p: any) => p.code);
    expect(planCodes).toEqual(['FREE', 'PREMIUM', 'ORG']);
    const orgPlan = plansRes.data.plans.find((p: any) => p.code === 'ORG');
    expect(orgPlan.monthlyPriceInt).toBe(1000);
    expect(orgPlan.entitlements.allowTreasurerRole).toBe(true);
    expect(orgPlan.entitlements.allowExports).toBe(true);
    expect(orgPlan.entitlements.maxMembers).toBeNull();

    // 2. Register a user and create a group requesting desiredPlanCode: 'ORG'
    const reg = await reqJson('/api/auth/register', {
      method: 'POST',
      body: {
        email: 'asso-gate@test.bj',
        password: 'Password123!',
        firstName: 'Koffi',
        lastName: 'Agbo',
      },
    });
    expect(reg.status).toBe(201);
    const token = reg.data.token;

    const grpCreate = await reqJson('/api/groups', {
      method: 'POST',
      token,
      body: {
        name: 'Association Quartier',
        type: 'ASSOCIATION',
        country: 'BJ',
        currency: 'XOF',
        desiredPlanCode: 'ORG',
      },
    });
    expect(grpCreate.status).toBe(201);
    expect(grpCreate.data.requiresPayment).toBe(true);
    expect(grpCreate.data.desiredPlanCode).toBe('ORG');
    const groupId = grpCreate.data.id;
    const ownerMemberId = grpCreate.data.memberId;

    // Group must still be on FREE entitlements until payment is verified
    const grpDetail = await reqJson(`/api/groups/${groupId}`, { token });
    expect(grpDetail.status).toBe(200);
    expect(grpDetail.data.entitlements.code).toBe('FREE');
    expect(grpDetail.data.group.planCode).toBe('FREE');

    // 3. Verify FREE plan gating returns 402 PLAN_UPGRADE_REQUIRED
    const blockedSplit = await reqJson(`/api/groups/${groupId}/expenses`, {
      method: 'POST',
      token,
      body: {
        title: 'Dépense pourcentage bloquée',
        amountInt: 10000,
        expenseDate: '2026-11-22',
        scope: 'COLLECTIVE',
        splitMethod: 'PERCENTAGE',
        payers: [{ memberId: ownerMemberId, amountPaidInt: 10000 }],
        participants: [{ memberId: ownerMemberId, percentage: 100 }],
      },
    });
    expect(blockedSplit.status).toBe(402);
    expect(blockedSplit.data.code).toBe('PLAN_UPGRADE_REQUIRED');

    const blockedRecurring = await reqJson(`/api/groups/${groupId}/expenses`, {
      method: 'POST',
      token,
      body: {
        title: 'Loyer mensuel récurrent',
        amountInt: 50000,
        expenseDate: '2026-11-22',
        scope: 'COLLECTIVE',
        splitMethod: 'EQUAL',
        isRecurring: true,
        recurrenceRule: 'MONTHLY',
        payers: [{ memberId: ownerMemberId, amountPaidInt: 50000 }],
        participants: [{ memberId: ownerMemberId }],
      },
    });
    expect(blockedRecurring.status).toBe(402);
    expect(blockedRecurring.data.code).toBe('PLAN_UPGRADE_REQUIRED');

    // 1st budget allowed on FREE, 2nd budget blocked with 402
    const b1 = await reqJson(`/api/groups/${groupId}/budgets`, {
      method: 'POST',
      token,
      body: {
        name: 'Budget Principal',
        limitAmountInt: 100000,
        periodType: 'MONTHLY',
        startDate: '2026-11-01',
        endDate: '2026-11-30',
      },
    });
    expect(b1.status).toBe(201);
    const b2 = await reqJson(`/api/groups/${groupId}/budgets`, {
      method: 'POST',
      token,
      body: {
        name: 'Budget Secondaire',
        limitAmountInt: 50000,
        periodType: 'MONTHLY',
        startDate: '2026-11-01',
        endDate: '2026-11-30',
      },
    });
    expect(b2.status).toBe(402);

    // Savings goal blocked on FREE
    const sgBlocked = await reqJson(`/api/groups/${groupId}/savings-goals`, {
      method: 'POST',
      token,
      body: { title: 'Caisse Urgence', targetAmountInt: 200000 },
    });
    expect(sgBlocked.status).toBe(402);

    // TREASURER role blocked on FREE
    const trBlocked = await reqJson(`/api/groups/${groupId}/members`, {
      method: 'POST',
      token,
      body: { firstName: 'Sèna', lastName: 'Hounnou', role: 'TREASURER' },
    });
    expect(trBlocked.status).toBe(402);

    // 4 more members allowed (total 5), 6th member blocked with 402
    for (let i = 1; i <= 4; i++) {
      const mRes = await reqJson(`/api/groups/${groupId}/members`, {
        method: 'POST',
        token,
        body: { firstName: `Membre${i}`, lastName: 'Test', role: 'MEMBER' },
      });
      expect(mRes.status).toBe(201);
    }
    const m6Blocked = await reqJson(`/api/groups/${groupId}/members`, {
      method: 'POST',
      token,
      body: { firstName: 'Membre6', lastName: 'Test', role: 'MEMBER' },
    });
    expect(m6Blocked.status).toBe(402);

    // 4. Submit manual request for ORG -> still PENDING & blocked until admin approves
    const manualOrg = await reqJson(`/api/groups/${groupId}/subscription/request`, {
      method: 'POST',
      token,
      body: { planCode: 'ORG', months: 1, reference: 'MTN-ASSO-001' },
    });
    expect(manualOrg.status).toBe(201);
    const stillFree = await reqJson(`/api/groups/${groupId}`, { token });
    expect(stillFree.data.entitlements.code).toBe('FREE');

    // 5. Simulate verified FedaPay webhook for PREMIUM -> unlocks splits/recurring/budgets/savings, keeps TREASURER locked
    const db = getDb();
    const providerTxId = '88776655';
    db.prepare(
      `INSERT INTO payment_transactions (id, group_id, plan_code, months, provider, provider_tx_id, idempotency_key, amount_int, currency, status, created_at)
       VALUES (?, ?, 'PREMIUM', 1, 'FEDAPAY', ?, ?, 500, 'XOF', 'PENDING', ?)`
    ).run(crypto.randomUUID(), groupId, providerTxId, crypto.randomUUID(), new Date().toISOString());

    const webhookBody = JSON.stringify({
      entity: { id: providerTxId, status: 'approved', amount: 500, currency: { iso: 'XOF' } },
    });
    const t = String(Math.floor(Date.now() / 1000));
    const sig = crypto
      .createHmac('sha256', process.env.FEDAPAY_WEBHOOK_SECRET!)
      .update(`${t}.${webhookBody}`)
      .digest('hex');

    const whRes = await fetch(`${baseUrl}/api/webhooks/fedapay`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-fedapay-signature': `t=${t},s=${sig}` },
      body: webhookBody,
    });
    expect((await whRes.json()).status).toBe('APPROVED');

    // Now PREMIUM features unlock!
    const unlockedSplit = await reqJson(`/api/groups/${groupId}/expenses`, {
      method: 'POST',
      token,
      body: {
        title: 'Dépense pourcentage débloquée',
        amountInt: 10000,
        expenseDate: '2026-11-22',
        scope: 'COLLECTIVE',
        splitMethod: 'PERCENTAGE',
        payers: [{ memberId: ownerMemberId, amountPaidInt: 10000 }],
        participants: [{ memberId: ownerMemberId, percentage: 100 }],
      },
    });
    expect(unlockedSplit.status).toBe(201);

    const unlockedBudget = await reqJson(`/api/groups/${groupId}/budgets`, {
      method: 'POST',
      token,
      body: {
        name: 'Budget Secondaire',
        limitAmountInt: 50000,
        periodType: 'MONTHLY',
        startDate: '2026-11-01',
        endDate: '2026-11-30',
      },
    });
    expect(unlockedBudget.status).toBe(201);

    const unlockedSavings = await reqJson(`/api/groups/${groupId}/savings-goals`, {
      method: 'POST',
      token,
      body: { title: 'Caisse Urgence', targetAmountInt: 200000 },
    });
    expect(unlockedSavings.status).toBe(201);

    // TREASURER still requires ORG/PRO
    const stillLockedTreasurer = await reqJson(`/api/groups/${groupId}/members`, {
      method: 'POST',
      token,
      body: { firstName: 'Sèna', lastName: 'Hounnou', role: 'TREASURER' },
    });
    expect(stillLockedTreasurer.status).toBe(402);

    // 6. Admin approves ORG request -> TREASURER now succeeds
    const adminBoot = await reqJson('/api/admin/bootstrap', {
      method: 'POST',
      body: { passcode: process.env.ADMIN_BOOTSTRAP_PASSCODE!, email: 'admin@kpata.bj' },
    });
    const approveOrg = await reqJson(`/api/admin/subscription-requests/${manualOrg.data.id}/approve`, {
      method: 'POST',
      token: adminBoot.data.token,
      body: { comment: 'Paiement ORG confirmé' },
    });
    expect(approveOrg.status).toBe(200);

    const unlockedTreasurer = await reqJson(`/api/groups/${groupId}/members`, {
      method: 'POST',
      token,
      body: { firstName: 'Sèna', lastName: 'Hounnou', role: 'TREASURER' },
    });
    expect(unlockedTreasurer.status).toBe(201);
  });
});
