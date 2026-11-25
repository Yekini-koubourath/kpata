import crypto from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';
import { getDb } from './db';
import {
  getEffectiveEntitlements,
  ROLE_PERMISSIONS,
  type GlobalRole,
  type GroupRole,
  type PlanEntitlements,
  type UserPublic,
} from '../shared/types';

// Ephemeral fallback secret per process when SESSION_SECRET env is unset
const EPHEMERAL_SECRET = crypto.randomBytes(32).toString('hex');

export function getSessionSecret(): string {
  return process.env.SESSION_SECRET && process.env.SESSION_SECRET.length >= 16
    ? process.env.SESSION_SECRET
    : EPHEMERAL_SECRET;
}

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${derived}`;
}

export function verifyPassword(password: string, storedHash: string): boolean {
  const parts = storedHash.split(':');
  if (parts.length !== 2) return false;
  const [salt, expectedHex] = parts;
  const derived = crypto.scryptSync(password, salt, 64);
  const expected = Buffer.from(expectedHex, 'hex');
  if (derived.length !== expected.length) return false;
  return crypto.timingSafeEqual(derived, expected);
}

export function hashToken(token: string): string {
  return crypto.createHmac('sha256', getSessionSecret()).update(token).digest('hex');
}

export function hashIp(ip: string | undefined): string {
  if (!ip) return 'unknown';
  return crypto.createHmac('sha256', getSessionSecret()).update(ip).digest('hex').slice(0, 16);
}

export const SESSION_COOKIE_NAME = 'kpata_session';

export function parseCookies(cookieHeader: string | undefined): Record<string, string> {
  if (!cookieHeader) return {};
  const result: Record<string, string> = {};
  for (const part of cookieHeader.split(';')) {
    const idx = part.indexOf('=');
    if (idx === -1) continue;
    const key = part.slice(0, idx).trim();
    const val = part.slice(idx + 1).trim();
    result[key] = decodeURIComponent(val);
  }
  return result;
}

export function createSession(userId: string, req: Request): { token: string; expiresAt: string } {
  const db = getDb();
  const token = crypto.randomBytes(32).toString('hex');
  const tokenHash = hashToken(token);
  const now = new Date();
  const expires = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  const id = crypto.randomUUID();

  db.prepare(
    `INSERT INTO sessions (id, user_id, token_hash, user_agent, ip_hash, expires_at, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run(
    id,
    userId,
    tokenHash,
    String(req.headers['user-agent'] || '').slice(0, 240),
    hashIp(req.ip),
    expires.toISOString(),
    now.toISOString()
  );

  return { token, expiresAt: expires.toISOString() };
}

export function setSessionCookie(res: Response, token: string, expiresAt: string): void {
  const maxAge = Math.max(0, Math.floor((new Date(expiresAt).getTime() - Date.now()) / 1000));
  // AI Studio preview runs inside an HTTPS iframe; SameSite=None; Secure; Partitioned works across iframe & localhost
  const isHttps = process.env.APP_URL?.startsWith('https://') || process.env.NODE_ENV === 'production';
  const parts = [
    `${SESSION_COOKIE_NAME}=${encodeURIComponent(token)}`,
    'Path=/',
    `Max-Age=${maxAge}`,
    'HttpOnly',
    isHttps ? 'SameSite=None' : 'SameSite=Lax',
  ];
  if (isHttps) {
    parts.push('Secure', 'Partitioned');
  }
  res.setHeader('Set-Cookie', parts.join('; '));
}

export function clearSessionCookie(res: Response): void {
  const isHttps = process.env.APP_URL?.startsWith('https://') || process.env.NODE_ENV === 'production';
  const parts = [
    `${SESSION_COOKIE_NAME}=`,
    'Path=/',
    'Max-Age=0',
    'HttpOnly',
    isHttps ? 'SameSite=None' : 'SameSite=Lax',
  ];
  if (isHttps) {
    parts.push('Secure', 'Partitioned');
  }
  res.setHeader('Set-Cookie', parts.join('; '));
}

export interface AuthedRequest extends Request {
  user?: UserPublic;
  sessionId?: string;
}

export function extractSessionToken(req: Request): { token: string | null; viaCookie: boolean } {
  const auth = req.headers.authorization;
  if (auth && auth.startsWith('Bearer ')) {
    const t = auth.slice(7).trim();
    if (t) return { token: t, viaCookie: false };
  }
  const cookies = parseCookies(req.headers.cookie);
  if (cookies[SESSION_COOKIE_NAME]) {
    return { token: cookies[SESSION_COOKIE_NAME], viaCookie: true };
  }
  return { token: null, viaCookie: false };
}

function isMutatingMethod(method: string): boolean {
  return ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method.toUpperCase());
}

function hasValidCsrfOrigin(req: Request): boolean {
  if (req.headers['x-requested-with'] === 'kpata-web') return true;
  const origin = req.headers.origin;
  const host = (req.headers['x-forwarded-host'] as string) || req.headers.host;
  if (!origin || !host) return false;
  try {
    const parsed = new URL(origin);
    return parsed.host === host;
  } catch {
    return false;
  }
}

export function attachAuth(req: AuthedRequest, res: Response, next: NextFunction): void {
  const { token, viaCookie } = extractSessionToken(req);
  if (!token) {
    return next();
  }

  // CSRF check for cookie-authenticated mutations
  if (viaCookie && isMutatingMethod(req.method) && !hasValidCsrfOrigin(req)) {
    res.status(403).json({ error: 'Vérification CSRF requise.' });
    return;
  }

  const db = getDb();
  const tokenHash = hashToken(token);
  const row = db
    .prepare(
      `SELECT s.id as session_id, s.expires_at, u.id, u.email, u.first_name, u.last_name, u.phone, u.role, u.email_verified, u.preferred_lang, u.created_at
       FROM sessions s
       JOIN users u ON u.id = s.user_id
       WHERE s.token_hash = ?`
    )
    .get(tokenHash) as
    | {
        session_id: string;
        expires_at: string;
        id: string;
        email: string;
        first_name: string;
        last_name: string;
        phone: string | null;
        role: GlobalRole;
        email_verified: number;
        preferred_lang: string;
        created_at: string;
      }
    | undefined;

  if (!row) return next();

  if (new Date(row.expires_at).getTime() < Date.now()) {
    db.prepare('DELETE FROM sessions WHERE id = ?').run(row.session_id);
    return next();
  }

  req.sessionId = row.session_id;
  req.user = {
    id: row.id,
    email: row.email,
    firstName: row.first_name,
    lastName: row.last_name,
    phone: row.phone,
    role: row.role,
    emailVerified: Boolean(row.email_verified),
    preferredLang: row.preferred_lang,
    createdAt: row.created_at,
  };
  next();
}

export function requireAuth(req: AuthedRequest, res: Response, next: NextFunction): void {
  if (!req.user) {
    res.status(401).json({ error: 'Authentification requise.' });
    return;
  }
  next();
}

export function requireAdmin(req: AuthedRequest, res: Response, next: NextFunction): void {
  if (!req.user) {
    res.status(401).json({ error: 'Authentification requise.' });
    return;
  }
  if (req.user.role !== 'ADMIN' && req.user.role !== 'SUPER_ADMIN') {
    res.status(403).json({ error: 'Accès réservé aux administrateurs autorisés de KPATA.' });
    return;
  }
  next();
}

export interface GroupMembershipContext {
  memberId: string;
  role: GroupRole;
  status: string;
  permissions: (typeof ROLE_PERMISSIONS)['OWNER'];
}

export function getGroupMembership(userId: string, groupId: string): GroupMembershipContext | null {
  const db = getDb();
  const member = db
    .prepare(
      `SELECT id, role, status FROM group_members
       WHERE group_id = ? AND user_id = ? AND status = 'ACTIVE'`
    )
    .get(groupId, userId) as { id: string; role: GroupRole; status: string } | undefined;

  if (!member) return null;
  const perms = ROLE_PERMISSIONS[member.role] || ROLE_PERMISSIONS.OBSERVER;
  return {
    memberId: member.id,
    role: member.role,
    status: member.status,
    permissions: perms,
  };
}

export function getGroupEntitlements(groupId: string): PlanEntitlements {
  const db = getDb();
  const sub = db
    .prepare('SELECT plan_code, status FROM subscriptions WHERE group_id = ?')
    .get(groupId) as { plan_code: string; status: string } | undefined;
  return getEffectiveEntitlements(sub?.plan_code, sub?.status);
}

export function recordAudit(params: {
  actorUserId: string | null;
  groupId?: string | null;
  action: string;
  targetType: string;
  targetId: string;
  details?: Record<string, unknown>;
  ip?: string;
}): void {
  const db = getDb();
  db.prepare(
    `INSERT INTO audit_logs (id, actor_user_id, group_id, action, target_type, target_id, details_json, ip_hash, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    crypto.randomUUID(),
    params.actorUserId,
    params.groupId ?? null,
    params.action,
    params.targetType,
    params.targetId,
    params.details ? JSON.stringify(params.details) : null,
    hashIp(params.ip),
    new Date().toISOString()
  );
}

// Simple in-memory rate limiter for auth & public endpoints
const rateBuckets = new Map<string, { count: number; resetAt: number }>();

export function rateLimit(keyPrefix: string, maxRequests: number, windowMs: number) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const key = `${keyPrefix}:${req.ip || 'unknown'}`;
    const now = Date.now();
    const bucket = rateBuckets.get(key);
    if (!bucket || bucket.resetAt < now) {
      rateBuckets.set(key, { count: 1, resetAt: now + windowMs });
      return next();
    }
    bucket.count += 1;
    if (bucket.count > maxRequests) {
      res.status(429).json({
        error: 'Trop de requêtes effectuées. Veuillez patienter quelques instants.',
      });
      return;
    }
    next();
  };
}
