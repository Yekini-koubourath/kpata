import crypto from 'node:crypto';
import type { Request } from 'express';
import { getDb } from './db';
import { getSessionSecret } from './auth';

const BOT_UA_REGEX =
  /(bot|crawler|spider|slurp|googlebot|bingbot|duckduckbot|baiduspider|yandexbot|facebookexternalhit|twitterbot|linkedinbot|whatsapp|applebot|semrush|ahrefs|mj12bot|headlesschrome|lighthouse|curl|wget|python-requests)/i;

export function isSearchBotOrCrawler(userAgent: string | undefined): boolean {
  if (!userAgent || userAgent.trim().length < 8) return true;
  return BOT_UA_REGEX.test(userAgent);
}

export function categorizeReferrer(referrer: string | undefined, appHost?: string): string {
  if (!referrer) return 'Direct';
  try {
    const url = new URL(referrer);
    const host = url.hostname.toLowerCase();
    if (appHost && host === appHost.toLowerCase()) return 'Direct';
    if (host.includes('google.') || host.includes('bing.') || host.includes('yahoo.') || host.includes('duckduckgo.') || host.includes('ecosia.')) {
      return 'Google & Moteurs';
    }
    if (
      host.includes('facebook.') ||
      host.includes('fb.') ||
      host.includes('instagram.') ||
      host.includes('twitter.') ||
      host.includes('x.com') ||
      host.includes('t.co') ||
      host.includes('linkedin.') ||
      host.includes('tiktok.') ||
      host.includes('wa.me') ||
      host.includes('whatsapp.')
    ) {
      return 'Réseaux sociaux';
    }
    return 'Autres sites';
  } catch {
    return 'Direct';
  }
}

export function detectDeviceAndBrowser(userAgent: string | undefined): {
  deviceType: string;
  browser: string;
} {
  const ua = userAgent || '';
  let deviceType = 'Desktop';
  if (/ipad|tablet/i.test(ua)) deviceType = 'Tablette';
  else if (/mobile|android|iphone/i.test(ua)) deviceType = 'Mobile';

  let browser = 'Autre';
  if (/edg\//i.test(ua)) browser = 'Edge';
  else if (/opr\//i.test(ua) || /opera/i.test(ua)) browser = 'Opera';
  else if (/chrome|crios/i.test(ua)) browser = 'Chrome';
  else if (/firefox|fxios/i.test(ua)) browser = 'Firefox';
  else if (/safari/i.test(ua)) browser = 'Safari';

  return { deviceType, browser };
}

export function computePrivacySafeVisitorHash(req: Request, clientVisitorToken?: string): string {
  // Rotates daily with HMAC so no persistent personal tracking identifier is stored
  const daySalt = new Date().toISOString().slice(0, 10);
  const raw = `${req.ip || '0.0.0.0'}|${req.headers['user-agent'] || ''}|${clientVisitorToken || ''}|${daySalt}`;
  return crypto.createHmac('sha256', getSessionSecret()).update(raw).digest('hex').slice(0, 24);
}

export function recordSitePageview(params: {
  req: Request;
  sessionId: string;
  visitorToken?: string;
  path: string;
  title?: string;
  referrer?: string;
  durationSec?: number;
}): { ignoredBot: boolean; recorded: boolean } {
  const ua = String(params.req.headers['user-agent'] || '');
  if (isSearchBotOrCrawler(ua)) {
    return { ignoredBot: true, recorded: false };
  }

  const db = getDb();
  const nowIso = new Date().toISOString();
  const safePath = params.path.split('?')[0].slice(0, 200) || '/';
  const visitorHash = computePrivacySafeVisitorHash(params.req, params.visitorToken);
  const { deviceType, browser } = detectDeviceAndBrowser(ua);
  const sourceCategory = categorizeReferrer(
    params.referrer,
    (params.req.headers.host || '').split(':')[0]
  );

  // Extract optional geo headers from Vercel / Cloud Run edge headers when available
  const countryHeader =
    (params.req.headers['x-vercel-ip-country'] as string) ||
    (params.req.headers['cf-ipcountry'] as string) ||
    'BJ';
  const cityHeader =
    (params.req.headers['x-vercel-ip-city'] as string) ||
    'Non disponible';

  const countryMap: Record<string, string> = {
    BJ: 'Bénin',
    TG: 'Togo',
    CI: "Côte d'Ivoire",
    SN: 'Sénégal',
    FR: 'France',
    NG: 'Nigéria',
    GH: 'Ghana',
    US: 'États-Unis',
  };
  const country = countryMap[countryHeader.toUpperCase()] || countryHeader;
  const city = decodeURIComponent(cityHeader);

  let referrerHost: string | null = null;
  if (params.referrer) {
    try {
      referrerHost = new URL(params.referrer).hostname;
    } catch {
      referrerHost = null;
    }
  }

  const existing = db
    .prepare('SELECT id, pageviews_count, duration_sec FROM site_sessions WHERE id = ?')
    .get(params.sessionId) as { id: string; pageviews_count: number; duration_sec: number } | undefined;

  const duration = Math.max(0, Math.min(3600, Math.round(params.durationSec || 0)));

  if (!existing) {
    db.prepare(
      `INSERT INTO site_sessions
        (id, visitor_hash, source_category, referrer_host, landing_path, country, city, device_type, browser, duration_sec, engaged, pageviews_count, started_at, last_seen_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`
    ).run(
      params.sessionId,
      visitorHash,
      sourceCategory,
      referrerHost,
      safePath,
      country,
      city,
      deviceType,
      browser,
      duration,
      duration >= 10 ? 1 : 0,
      nowIso,
      nowIso
    );
  } else {
    const newCount = existing.pageviews_count + (params.durationSec ? 0 : 1);
    const newDur = Math.max(existing.duration_sec, duration);
    const engaged = newCount >= 2 || newDur >= 10 ? 1 : 0;
    db.prepare(
      `UPDATE site_sessions
       SET pageviews_count = ?, duration_sec = ?, engaged = ?, last_seen_at = ?
       WHERE id = ?`
    ).run(newCount, newDur, engaged, nowIso, params.sessionId);
  }

  if (!params.durationSec) {
    db.prepare(
      `INSERT INTO site_pageviews (id, session_id, path, title, created_at)
       VALUES (?, ?, ?, ?, ?)`
    ).run(crypto.randomUUID(), params.sessionId, safePath, params.title?.slice(0, 140) || null, nowIso);
  }

  return { ignoredBot: false, recorded: true };
}

export type AnalyticsPeriod = 'day' | 'week' | 'month' | 'year';

export function querySiteAnalytics(period: AnalyticsPeriod) {
  const db = getDb();
  const now = new Date();
  const msMap: Record<AnalyticsPeriod, number> = {
    day: 24 * 3600 * 1000,
    week: 7 * 24 * 3600 * 1000,
    month: 30 * 24 * 3600 * 1000,
    year: 365 * 24 * 3600 * 1000,
  };
  const sinceIso = new Date(now.getTime() - msMap[period]).toISOString();
  const activeSinceIso = new Date(now.getTime() - 5 * 60 * 1000).toISOString();

  const summary = db
    .prepare(
      `SELECT
         COUNT(*) as totalSessions,
         COUNT(DISTINCT visitor_hash) as uniqueVisitors,
         COALESCE(SUM(pageviews_count), 0) as totalPageviews,
         COALESCE(AVG(duration_sec), 0) as avgDurationSec,
         COALESCE(AVG(engaged) * 100, 0) as engagementRatePct
       FROM site_sessions
       WHERE started_at >= ?`
    )
    .get(sinceIso) as {
    totalSessions: number;
    uniqueVisitors: number;
    totalPageviews: number;
    avgDurationSec: number;
    engagementRatePct: number;
  };

  const activeVisitors = (
    db
      .prepare('SELECT COUNT(DISTINCT visitor_hash) as c FROM site_sessions WHERE last_seen_at >= ?')
      .get(activeSinceIso) as { c: number }
  ).c;

  const topPages = db
    .prepare(
      `SELECT path, COUNT(*) as views
       FROM site_pageviews
       WHERE created_at >= ?
       GROUP BY path
       ORDER BY views DESC
       LIMIT 10`
    )
    .all(sinceIso) as { path: string; views: number }[];

  const sources = db
    .prepare(
      `SELECT source_category as source, COUNT(*) as sessions
       FROM site_sessions
       WHERE started_at >= ?
       GROUP BY source_category
       ORDER BY sessions DESC`
    )
    .all(sinceIso) as { source: string; sessions: number }[];

  const devices = db
    .prepare(
      `SELECT device_type as device, COUNT(*) as sessions
       FROM site_sessions
       WHERE started_at >= ?
       GROUP BY device_type
       ORDER BY sessions DESC`
    )
    .all(sinceIso) as { device: string; sessions: number }[];

  const browsers = db
    .prepare(
      `SELECT browser, COUNT(*) as sessions
       FROM site_sessions
       WHERE started_at >= ?
       GROUP BY browser
       ORDER BY sessions DESC`
    )
    .all(sinceIso) as { browser: string; sessions: number }[];

  const locations = db
    .prepare(
      `SELECT country, city, COUNT(*) as sessions
       FROM site_sessions
       WHERE started_at >= ?
       GROUP BY country, city
       ORDER BY sessions DESC
       LIMIT 10`
    )
    .all(sinceIso) as { country: string; city: string; sessions: number }[];

  const groupSlice = period === 'day' ? 13 : period === 'year' ? 7 : 10;
  const timeline = db
    .prepare(
      `SELECT
         substr(started_at, 1, ?) as bucket,
         COUNT(*) as sessions,
         COUNT(DISTINCT visitor_hash) as uniqueVisitors,
         COALESCE(SUM(pageviews_count), 0) as pageviews
       FROM site_sessions
       WHERE started_at >= ?
       GROUP BY bucket
       ORDER BY bucket ASC`
    )
    .all(groupSlice, sinceIso) as {
    bucket: string;
    sessions: number;
    uniqueVisitors: number;
    pageviews: number;
  }[];

  const gaMeasurementId = process.env.VITE_GA_MEASUREMENT_ID?.trim() || '';

  return {
    period,
    ga4: {
      configured: gaMeasurementId.length > 0,
      measurementIdMasked: gaMeasurementId
        ? `${gaMeasurementId.slice(0, 4)}***${gaMeasurementId.slice(-2)}`
        : null,
    },
    metrics: {
      totalVisitors: summary.uniqueVisitors,
      uniqueVisitors: summary.uniqueVisitors,
      totalSessions: summary.totalSessions,
      activeVisitors,
      totalPageviews: summary.totalPageviews,
      avgDurationSec: Math.round(summary.avgDurationSec),
      engagementRatePct: Math.round(summary.engagementRatePct),
    },
    topPages,
    sources,
    devices,
    browsers,
    locations,
    timeline,
  };
}
