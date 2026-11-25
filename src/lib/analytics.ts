declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
  }
}

const CONSENT_KEY = 'kpata_analytics_consent';
const SESSION_KEY = 'kpata_visit_session';
const VISITOR_KEY = 'kpata_visit_anon';

export type ConsentState = 'unset' | 'granted' | 'denied';

export function getAnalyticsConsent(): ConsentState {
  try {
    const val = localStorage.getItem(CONSENT_KEY);
    if (val === 'granted' || val === 'denied') return val;
  } catch {
    // ignore
  }
  return 'unset';
}

export function setAnalyticsConsent(state: 'granted' | 'denied'): void {
  try {
    localStorage.setItem(CONSENT_KEY, state);
  } catch {
    // ignore
  }
  if (window.gtag) {
    window.gtag('consent', 'update', {
      analytics_storage: state,
      ad_storage: 'denied',
      ad_user_data: 'denied',
      ad_personalization: 'denied',
    });
  }
  if (state === 'granted') {
    initGa4IfConfigured();
  }
}

let ga4Loaded = false;

export function getGa4MeasurementId(): string | null {
  const id = (import.meta as any).env?.VITE_GA_MEASUREMENT_ID;
  return typeof id === 'string' && id.trim().length > 0 ? id.trim() : null;
}

export function initGa4IfConfigured(): void {
  const measurementId = getGa4MeasurementId();
  if (!measurementId || ga4Loaded) return;
  if (getAnalyticsConsent() !== 'granted') return;

  window.dataLayer = window.dataLayer || [];
  window.gtag = function gtag(...args: unknown[]) {
    window.dataLayer!.push(args);
  };

  window.gtag('consent', 'default', {
    analytics_storage: 'granted',
    ad_storage: 'denied',
    ad_user_data: 'denied',
    ad_personalization: 'denied',
  });
  window.gtag('js', new Date());
  window.gtag('config', measurementId, {
    anonymize_ip: true,
    send_page_view: false,
  });

  const script = document.createElement('script');
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(measurementId)}`;
  document.head.appendChild(script);
  ga4Loaded = true;
}

function getOrCreateSessionId(): string {
  try {
    let s = sessionStorage.getItem(SESSION_KEY);
    if (!s) {
      s = crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      sessionStorage.setItem(SESSION_KEY, s);
    }
    return s;
  } catch {
    return `mem-${Date.now()}`;
  }
}

function getOrCreateVisitorToken(): string {
  try {
    let v = localStorage.getItem(VISITOR_KEY);
    if (!v) {
      v = crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      localStorage.setItem(VISITOR_KEY, v);
    }
    return v;
  } catch {
    return 'anon';
  }
}

let sessionStartMs = Date.now();

export function trackPageView(pathname: string, title?: string): void {
  const cleanPath = pathname.split('?')[0] || '/';
  const isPrivate =
    cleanPath.startsWith('/app') ||
    cleanPath.startsWith('/admin');

  // Never send private group URLs or financial IDs to third-party GA4
  const ga4Id = getGa4MeasurementId();
  if (ga4Id && getAnalyticsConsent() === 'granted' && window.gtag && !isPrivate) {
    window.gtag('event', 'page_view', {
      page_path: cleanPath,
      page_title: title || document.title,
    });
  }

  // First-party privacy-safe site telemetry (never sends PII, respects consent for non-essential visitor token)
  const consent = getAnalyticsConsent();
  const payload = {
    sessionId: getOrCreateSessionId(),
    visitorToken: consent === 'granted' ? getOrCreateVisitorToken() : undefined,
    path: isPrivate ? (cleanPath.startsWith('/admin') ? '/admin' : '/app') : cleanPath,
    title: isPrivate ? 'Espace connecté' : title || document.title,
    referrer: document.referrer || undefined,
  };

  fetch('/api/analytics/track', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    keepalive: true,
  }).catch(() => {});
}

export function trackEngagementHeartbeat(pathname: string): void {
  const durationSec = Math.round((Date.now() - sessionStartMs) / 1000);
  if (durationSec < 5) return;
  const cleanPath = pathname.split('?')[0] || '/';
  fetch('/api/analytics/track', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      sessionId: getOrCreateSessionId(),
      path: cleanPath.startsWith('/app') ? '/app' : cleanPath,
      durationSec,
    }),
    keepalive: true,
  }).catch(() => {});
}
