import React, { useCallback, useEffect, useState } from 'react';
import {
  Activity,
  BarChart3,
  CheckCircle2,
  CreditCard,
  Globe,
  LogOut,
  Megaphone,
  Monitor,
  RefreshCw,
  Search,
  ShieldCheck,
  Trash2,
  Users,
  XCircle,
} from 'lucide-react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { motion } from 'motion/react';
import { apiFetch } from '../lib/api';
import { Link, useRouter } from '../lib/router';
import { useAuth } from '../context/AuthContext';
import { formatMoney, GROUP_TYPES } from '../shared/types';

type AdminTab = 'analytics' | 'overview' | 'subscriptions' | 'users' | 'audit';
type Period = 'day' | 'week' | 'month' | 'year';

export function AdminDashboardPage() {
  const { user, setDirectSession, logout, refreshUser } = useAuth();
  const { navigate } = useRouter();

  const [bootStatus, setBootStatus] = useState<{
    needsInitialSetup: boolean;
    isAuthenticatedAdmin: boolean;
  } | null>(null);
  const [passcode, setPasscode] = useState('');
  const [adminEmail, setAdminEmail] = useState('admin@kpata.bj');
  const [authError, setAuthError] = useState('');
  const [authSubmitting, setAuthSubmitting] = useState(false);

  const [tab, setTab] = useState<AdminTab>('analytics');
  const [period, setPeriod] = useState<Period>('month');
  const [loadingData, setLoadingData] = useState(false);

  const [siteStats, setSiteStats] = useState<any>(null);
  const [publicConfig, setPublicConfig] = useState<any>(null);
  const [overview, setOverview] = useState<any>(null);
  const [requests, setRequests] = useState<any[]>([]);
  const [plans, setPlans] = useState<any[]>([]);
  const [usersList, setUsersList] = useState<any[]>([]);
  const [announcements, setAnnouncements] = useState<any[]>([]);
  const [contactMessages, setContactMessages] = useState<any[]>([]);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [actionMsg, setActionMsg] = useState('');

  // Plan edit states
  const [planPrices, setPlanPrices] = useState<Record<string, string>>({});
  const [commentByReq, setCommentByReq] = useState<Record<string, string>>({});

  // Announcement form
  const [annTitle, setAnnTitle] = useState('');
  const [annBody, setAnnBody] = useState('');
  const [annLevel, setAnnLevel] = useState<'INFO' | 'WARNING' | 'SUCCESS'>('INFO');

  const checkBootstrap = useCallback(async () => {
    try {
      const status = await apiFetch<{
        needsInitialSetup: boolean;
        isAuthenticatedAdmin: boolean;
      }>('/api/admin/bootstrap-status');
      setBootStatus(status);
    } catch {
      setBootStatus({ needsInitialSetup: false, isAuthenticatedAdmin: false });
    }
  }, []);

  useEffect(() => {
    checkBootstrap();
  }, [checkBootstrap, user?.id, user?.role]);

  const loadAnalytics = useCallback(async (selectedPeriod: Period) => {
    const [statsRes, cfgRes] = await Promise.all([
      apiFetch(`/api/admin/site-analytics?period=${selectedPeriod}`),
      apiFetch('/api/config/public'),
    ]);
    setSiteStats(statsRes);
    setPublicConfig(cfgRes);
  }, []);

  const loadAdminWorkspace = useCallback(async () => {
    setLoadingData(true);
    try {
      const [ov, reqs, pl, us, anns, msgs, logs] = await Promise.all([
        apiFetch('/api/admin/overview'),
        apiFetch<{ requests: any[] }>('/api/admin/subscription-requests'),
        apiFetch<{ plans: any[] }>('/api/plans'),
        apiFetch<{ users: any[] }>('/api/admin/users'),
        apiFetch<{ announcements: any[] }>('/api/announcements'),
        apiFetch<{ messages: any[] }>('/api/admin/contact-messages'),
        apiFetch<{ logs: any[] }>('/api/admin/audit-logs'),
      ]);
      setOverview(ov);
      setRequests(reqs.requests || []);
      setPlans(pl.plans || []);
      const priceMap: Record<string, string> = {};
      for (const p of pl.plans || []) {
        priceMap[p.code] = String(p.monthlyPriceInt);
      }
      setPlanPrices(priceMap);
      setUsersList(us.users || []);
      setAnnouncements(anns.announcements || []);
      setContactMessages(msgs.messages || []);
      setAuditLogs(logs.logs || []);
    } finally {
      setLoadingData(false);
    }
  }, []);

  const isAdmin = Boolean(
    bootStatus?.isAuthenticatedAdmin ||
      user?.role === 'ADMIN' ||
      user?.role === 'SUPER_ADMIN'
  );

  useEffect(() => {
    if (isAdmin) {
      loadAnalytics(period);
      loadAdminWorkspace();
    }
  }, [isAdmin, loadAnalytics, loadAdminWorkspace, period]);

  const handleBootstrapSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    setAuthSubmitting(true);
    try {
      const res = await apiFetch<{ token: string; user: any }>('/api/admin/bootstrap', {
        method: 'POST',
        body: JSON.stringify({
          passcode,
          email: user?.email || adminEmail,
        }),
      });
      setDirectSession(res.user, res.token);
      await refreshUser();
      await checkBootstrap();
    } catch (err: any) {
      setAuthError(err?.message || 'Vérification administrateur impossible.');
    } finally {
      setAuthSubmitting(false);
    }
  };

  const handleApproveRequest = async (id: string) => {
    setActionMsg('');
    await apiFetch(`/api/admin/subscription-requests/${id}/approve`, {
      method: 'POST',
      body: JSON.stringify({
        comment: commentByReq[id] || 'Paiement vérifié et activé par l’administrateur.',
      }),
    });
    setActionMsg('Abonnement validé et activé pour le groupe.');
    await loadAdminWorkspace();
  };

  const handleRejectRequest = async (id: string) => {
    setActionMsg('');
    await apiFetch(`/api/admin/subscription-requests/${id}/reject`, {
      method: 'POST',
      body: JSON.stringify({
        comment: commentByReq[id] || 'Référence introuvable ou montant inexact.',
      }),
    });
    setActionMsg('Demande rejetée.');
    await loadAdminWorkspace();
  };

  const handleUpdatePlanPrice = async (code: string) => {
    const val = Number(planPrices[code]);
    if (!Number.isFinite(val) || val < 0) return;
    await apiFetch(`/api/admin/plans/${code}`, {
      method: 'PUT',
      body: JSON.stringify({ monthlyPriceInt: Math.round(val) }),
    });
    setActionMsg(`Tarif du plan ${code} mis à jour.`);
    await loadAdminWorkspace();
  };

  const handleRoleChange = async (userId: string, role: string) => {
    await apiFetch(`/api/admin/users/${userId}/role`, {
      method: 'PUT',
      body: JSON.stringify({ role }),
    });
    setActionMsg('Rôle utilisateur mis à jour.');
    await loadAdminWorkspace();
  };

  const handleCreateAnnouncement = async (e: React.FormEvent) => {
    e.preventDefault();
    await apiFetch('/api/admin/announcements', {
      method: 'POST',
      body: JSON.stringify({ title: annTitle, body: annBody, level: annLevel }),
    });
    setAnnTitle('');
    setAnnBody('');
    setActionMsg('Annonce publiée.');
    await loadAdminWorkspace();
  };

  const handleDeleteAnnouncement = async (id: string) => {
    await apiFetch(`/api/admin/announcements/${id}`, { method: 'DELETE' });
    await loadAdminWorkspace();
  };

  if (!bootStatus) {
    return (
      <div className="min-h-screen bg-[#FAF9F6] flex items-center justify-center p-6">
        <div className="text-sm text-stone-600">Chargement de l’espace d’administration...</div>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-[#FAF9F6] flex flex-col justify-center items-center px-4 py-12">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
          className="w-full max-w-md bg-white border border-stone-200 rounded-2xl p-6 sm:p-8 space-y-6"
        >
          <div className="flex items-center justify-between">
            <Link to="/" className="font-display text-lg font-bold text-stone-900">
              KPATA
            </Link>
            <span className="text-xs font-semibold text-emerald-800">
              Espace Propriétaire · Admin
            </span>
          </div>

          <div className="space-y-2">
            <h1 className="font-display text-xl font-bold text-stone-900">
              {bootStatus.needsInitialSetup
                ? 'Initialiser votre accès propriétaire KPATA'
                : 'Espace Propriétaire & Administration'}
            </h1>
            <p className="text-sm text-stone-600 leading-relaxed">
              {bootStatus.needsInitialSetup
                ? 'Premier accès : saisissez votre adresse e-mail de propriétaire et choisissez un mot de passe (8 caractères min.). Ces identifiants créeront votre compte SUPER_ADMIN pour accéder à cet espace ainsi qu’à /connexion.'
                : 'Saisissez votre mot de passe administrateur (ou connectez-vous depuis /connexion avec votre compte propriétaire) pour piloter les offres, paiements et statistiques.'}
            </p>
          </div>

          {authError && (
            <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-sm text-red-800">
              {authError}
            </div>
          )}

          <form onSubmit={handleBootstrapSubmit} className="space-y-4">
            {!user && (
              <label className="block space-y-1.5 text-sm">
                <span className="font-medium text-stone-700">E-mail propriétaire</span>
                <input
                  type="email"
                  required
                  value={adminEmail}
                  onChange={(e) => setAdminEmail(e.target.value)}
                  className="w-full px-3.5 py-2 border border-stone-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-700"
                />
              </label>
            )}

            <label className="block space-y-1.5 text-sm">
              <span className="font-medium text-stone-700">
                {bootStatus.needsInitialSetup
                  ? 'Mot de passe propriétaire (8 caractères min.)'
                  : 'Mot de passe / code d’administration'}
              </span>
              <input
                type="password"
                required
                minLength={8}
                value={passcode}
                onChange={(e) => setPasscode(e.target.value)}
                placeholder="••••••••••••"
                className="w-full px-3.5 py-2 border border-stone-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-700"
              />
            </label>

            <button
              type="submit"
              disabled={authSubmitting}
              className="w-full py-2.5 px-4 text-sm font-semibold text-white bg-emerald-800 rounded-xl hover:bg-emerald-900 disabled:opacity-50 transition-colors"
            >
              {authSubmitting
                ? 'Vérification...'
                : bootStatus.needsInitialSetup
                ? 'Créer mon accès propriétaire'
                : 'Accéder à l’administration'}
            </button>
          </form>

          <div className="pt-3 border-t border-stone-200 flex items-center justify-between text-xs text-stone-500">
            <Link to="/app" className="hover:text-stone-900">
              Espace personnel
            </Link>
            <Link to="/" className="hover:text-stone-900">
              Retour à l’accueil
            </Link>
          </div>
        </motion.div>
      </div>
    );
  }

  const pendingCount = requests.filter((r) => r.status === 'PENDING').length;

  const tabs: { id: AdminTab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
    { id: 'analytics', label: 'Statistiques du site', icon: BarChart3 },
    { id: 'overview', label: 'Vue d’ensemble', icon: Activity },
    {
      id: 'subscriptions',
      label: pendingCount > 0 ? `Abonnements & Tarifs (${pendingCount})` : 'Abonnements & Tarifs',
      icon: CreditCard,
    },
    { id: 'users', label: 'Utilisateurs & Annonces', icon: Users },
    { id: 'audit', label: 'Messages & Journaux', icon: ShieldCheck },
  ];

  const metrics = siteStats?.metrics || {};
  const formatDuration = (sec: number) => {
    const s = Math.max(0, Math.round(sec || 0));
    const m = Math.floor(s / 60);
    const rem = s % 60;
    return m > 0 ? `${m}m ${rem}s` : `${rem}s`;
  };

  return (
    <div className="min-h-screen bg-[#FAF9F6] text-stone-900">
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-stone-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-4 min-w-0">
            <Link to="/" className="font-display text-lg font-bold text-stone-900 shrink-0">
              KPATA
            </Link>
            <span className="text-stone-300 hidden sm:inline">·</span>
            <span className="text-sm font-semibold text-emerald-800 truncate hidden sm:inline">
              Espace Propriétaire KPATA · Administration centrale
            </span>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <Link
              to="/app"
              className="px-3 py-1.5 text-xs font-medium text-stone-700 border border-stone-200 rounded-xl hover:bg-stone-50"
            >
              Espace utilisateur
            </Link>
            <button
              type="button"
              onClick={async () => {
                await logout();
                navigate('/connexion');
              }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-stone-700 border border-stone-200 rounded-xl hover:bg-stone-50"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Déconnexion</span>
            </button>
          </div>
        </div>

        {/* Sub-navigation tabs */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 flex items-center gap-1 overflow-x-auto border-t border-stone-100">
          {tabs.map((t) => {
            const Icon = t.icon;
            const active = tab === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                className={`inline-flex items-center gap-2 px-3.5 py-3 text-xs sm:text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${
                  active
                    ? 'border-emerald-800 text-emerald-900 font-semibold'
                    : 'border-transparent text-stone-600 hover:text-stone-950'
                }`}
              >
                <Icon className="w-4 h-4 shrink-0" />
                <span>{t.label}</span>
              </button>
            );
          })}
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-6">
        {actionMsg && (
          <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-sm text-emerald-900 flex items-center justify-between">
            <span>{actionMsg}</span>
            <button
              type="button"
              onClick={() => setActionMsg('')}
              className="text-xs font-semibold text-emerald-800 hover:underline"
            >
              Fermer
            </button>
          </div>
        )}

        {/* TAB 1: STATISTIQUES DU SITE (MANDATORY MODULE) */}
        {tab === 'analytics' && (
          <motion.div
            key="tab-analytics"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
            className="space-y-6"
          >
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <h1 className="font-display text-xl sm:text-2xl font-bold text-slate-900">
                  Statistiques du site & Visibilité SEO
                </h1>
                <p className="text-sm text-slate-600 mt-1">
                  Mesure de fréquentation humaine sans cookies publicitaires intrusifs · robots
                  d’indexation (Googlebot, Bingbot) filtrés automatiquement.
                </p>
              </div>

              <div className="flex items-center gap-2">
                {(
                  [
                    ['day', 'Jour (24h)'],
                    ['week', 'Semaine'],
                    ['month', 'Mois'],
                    ['year', 'Année'],
                  ] as [Period, string][]
                ).map(([p, label]) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setPeriod(p)}
                    className={`px-3 py-1.5 text-xs font-semibold rounded-lg border transition-colors ${
                      period === p
                        ? 'bg-emerald-700 text-white border-emerald-700'
                        : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    {label}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => loadAnalytics(period)}
                  className="p-2 bg-white border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50"
                  aria-label="Actualiser les statistiques"
                >
                  <RefreshCw className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* External SEO / GA4 Configuration Status */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-1">
                <div className="flex items-center justify-between text-xs font-semibold text-slate-500">
                  <span>GOOGLE ANALYTICS 4 (GA4)</span>
                  <span
                    className={
                      siteStats?.ga4?.configured ? 'text-emerald-700' : 'text-amber-700'
                    }
                  >
                    {siteStats?.ga4?.configured ? 'Configuré' : 'À configurer'}
                  </span>
                </div>
                <p className="text-sm font-medium text-slate-900">
                  {siteStats?.ga4?.configured
                    ? `ID de mesure : ${siteStats.ga4.measurementIdMasked}`
                    : 'Définir VITE_GA_MEASUREMENT_ID dans les variables Vercel'}
                </p>
                <p className="text-xs text-slate-500">
                  Collecte soumise au consentement visiteur (Consent Mode v2).
                </p>
              </div>

              <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-1">
                <div className="flex items-center justify-between text-xs font-semibold text-slate-500">
                  <span>GOOGLE SEARCH CONSOLE</span>
                  <span
                    className={
                      publicConfig?.searchConsoleConfigured ? 'text-emerald-700' : 'text-amber-700'
                    }
                  >
                    {publicConfig?.searchConsoleConfigured ? 'Balise présente' : 'À vérifier'}
                  </span>
                </div>
                <p className="text-sm font-medium text-slate-900">
                  Sitemap dynamique : <span className="font-mono text-xs">/sitemap.xml</span>
                </p>
                <p className="text-xs text-slate-500">
                  Renseigner GOOGLE_SITE_VERIFICATION ou DNS TXT dans Search Console.
                </p>
              </div>

              <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-1">
                <div className="flex items-center justify-between text-xs font-semibold text-slate-500">
                  <span>BING WEBMASTER & ROBOTS</span>
                  <span
                    className={
                      publicConfig?.bingConfigured ? 'text-emerald-700' : 'text-slate-600'
                    }
                  >
                    {publicConfig?.bingConfigured ? 'Balise présente' : 'Prêt (/robots.txt)'}
                  </span>
                </div>
                <p className="text-sm font-medium text-slate-900">
                  Routes privées protégées (noindex)
                </p>
                <p className="text-xs text-slate-500">
                  /app, /admin, /connexion et données financières bloqués à l’indexation.
                </p>
              </div>
            </div>

            {/* Primary Traffic KPIs */}
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-4">
              <div className="bg-white border border-slate-200 rounded-xl p-4">
                <p className="text-xs text-slate-500">Visiteurs totaux</p>
                <p className="font-mono text-2xl font-bold text-slate-900 mt-1 tabular-nums">
                  {metrics.totalVisitors ?? 0}
                </p>
              </div>
              <div className="bg-white border border-slate-200 rounded-xl p-4">
                <p className="text-xs text-slate-500">Visiteurs uniques</p>
                <p className="font-mono text-2xl font-bold text-emerald-700 mt-1 tabular-nums">
                  {metrics.uniqueVisitors ?? 0}
                </p>
              </div>
              <div className="bg-white border border-slate-200 rounded-xl p-4">
                <p className="text-xs text-slate-500">Visites (sessions)</p>
                <p className="font-mono text-2xl font-bold text-slate-900 mt-1 tabular-nums">
                  {metrics.totalSessions ?? 0}
                </p>
              </div>
              <div className="bg-white border border-slate-200 rounded-xl p-4">
                <p className="text-xs text-slate-500">Actifs (5 min)</p>
                <p className="font-mono text-2xl font-bold text-emerald-700 mt-1 tabular-nums">
                  {metrics.activeVisitors ?? 0}
                </p>
              </div>
              <div className="bg-white border border-slate-200 rounded-xl p-4">
                <p className="text-xs text-slate-500">Pages consultées</p>
                <p className="font-mono text-2xl font-bold text-slate-900 mt-1 tabular-nums">
                  {metrics.totalPageviews ?? 0}
                </p>
              </div>
              <div className="bg-white border border-slate-200 rounded-xl p-4">
                <p className="text-xs text-slate-500">Durée moyenne</p>
                <p className="font-mono text-2xl font-bold text-slate-900 mt-1 tabular-nums">
                  {formatDuration(metrics.avgDurationSec)}
                </p>
              </div>
              <div className="bg-white border border-slate-200 rounded-xl p-4">
                <p className="text-xs text-slate-500">Taux d’engagement</p>
                <p className="font-mono text-2xl font-bold text-slate-900 mt-1 tabular-nums">
                  {metrics.engagementRatePct ?? 0}%
                </p>
              </div>
            </div>

            {/* Timeline Chart */}
            <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="font-display text-base font-bold text-slate-900">
                  Évolution du trafic (Visites vs Visiteurs uniques)
                </h2>
                <span className="text-xs text-slate-500">
                  Les visiteurs uniques sont distingués des visites (sessions).
                </span>
              </div>

              {(siteStats?.timeline || []).length === 0 ? (
                <div className="h-56 flex items-center justify-center text-sm text-slate-500 border border-dashed border-slate-200 rounded-lg">
                  Aucune visite enregistrée sur cette période. Naviguez sur les pages publiques
                  pour observer la télémétrie en temps réel.
                </div>
              ) : (
                <div className="h-64 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={siteStats.timeline}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                      <XAxis dataKey="bucket" tick={{ fontSize: 11, fill: '#64748B' }} />
                      <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#64748B' }} />
                      <Tooltip />
                      <Area
                        type="monotone"
                        dataKey="sessions"
                        name="Visites (sessions)"
                        stroke="#0F172A"
                        fill="#CBD5E1"
                        fillOpacity={0.35}
                      />
                      <Area
                        type="monotone"
                        dataKey="uniqueVisitors"
                        name="Visiteurs uniques"
                        stroke="#047857"
                        fill="#10B981"
                        fillOpacity={0.25}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>

            {/* Breakdown Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Top pages */}
              <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-3">
                <h3 className="font-display text-base font-bold text-slate-900 flex items-center gap-2">
                  <Search className="w-4 h-4 text-emerald-700" />
                  <span>Pages les plus visitées</span>
                </h3>
                <div className="divide-y divide-slate-100">
                  {(siteStats?.topPages || []).length === 0 ? (
                    <p className="text-sm text-slate-500 py-4">Aucune page vue sur cette période.</p>
                  ) : (
                    siteStats.topPages.map((p: any) => (
                      <div key={p.path} className="py-2.5 flex items-center justify-between text-sm">
                        <span className="font-mono text-xs text-slate-800 truncate">{p.path}</span>
                        <span className="font-mono font-semibold text-slate-900 tabular-nums">
                          {p.views} vues
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Sources de trafic */}
              <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-3">
                <h3 className="font-display text-base font-bold text-slate-900 flex items-center gap-2">
                  <Globe className="w-4 h-4 text-emerald-700" />
                  <span>Sources de trafic</span>
                </h3>
                <div className="divide-y divide-slate-100">
                  {(siteStats?.sources || []).length === 0 ? (
                    <p className="text-sm text-slate-500 py-4">Aucune source enregistrée.</p>
                  ) : (
                    siteStats.sources.map((s: any) => (
                      <div key={s.source} className="py-2.5 flex items-center justify-between text-sm">
                        <span className="text-slate-700">{s.source}</span>
                        <span className="font-mono font-semibold text-slate-900 tabular-nums">
                          {s.sessions} sessions
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Appareils & Navigateurs */}
              <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
                <h3 className="font-display text-base font-bold text-slate-900 flex items-center gap-2">
                  <Monitor className="w-4 h-4 text-emerald-700" />
                  <span>Appareils & Navigateurs</span>
                </h3>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-xs font-semibold text-slate-500 mb-2">APPAREILS</p>
                    {(siteStats?.devices || []).map((d: any) => (
                      <div key={d.device} className="flex justify-between py-1">
                        <span className="text-slate-700">{d.device}</span>
                        <span className="font-mono font-semibold tabular-nums">{d.sessions}</span>
                      </div>
                    ))}
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-slate-500 mb-2">NAVIGATEURS</p>
                    {(siteStats?.browsers || []).map((b: any) => (
                      <div key={b.browser} className="flex justify-between py-1">
                        <span className="text-slate-700">{b.browser}</span>
                        <span className="font-mono font-semibold tabular-nums">{b.sessions}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Pays & Villes */}
              <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-3">
                <h3 className="font-display text-base font-bold text-slate-900">
                  Pays et villes des visiteurs
                </h3>
                <p className="text-xs text-slate-500">
                  Détection issue des en-têtes réseau géographiques (sans géolocalisation GPS).
                </p>
                <div className="divide-y divide-slate-100">
                  {(siteStats?.locations || []).length === 0 ? (
                    <p className="text-sm text-slate-500 py-4">Aucune donnée géographique.</p>
                  ) : (
                    siteStats.locations.map((loc: any, idx: number) => (
                      <div key={idx} className="py-2 flex items-center justify-between text-sm">
                        <span className="text-slate-700">
                          {loc.country} · {loc.city}
                        </span>
                        <span className="font-mono font-semibold text-slate-900 tabular-nums">
                          {loc.sessions}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {/* TAB 2: OVERVIEW */}
        {tab === 'overview' && (
          <motion.div
            key="tab-overview"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
            className="space-y-6"
          >
            <h1 className="font-display text-xl font-bold text-slate-900">
              Indicateurs plateforme KPATA
            </h1>

            {loadingData && !overview ? (
              <div className="h-32 bg-white border border-slate-200 rounded-xl animate-pulse" />
            ) : (
              <>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                  <div className="bg-white border border-slate-200 rounded-xl p-4">
                    <p className="text-xs text-slate-500">Utilisateurs inscrits</p>
                    <p className="font-mono text-2xl font-bold text-slate-900 mt-1 tabular-nums">
                      {overview?.usersCount ?? 0}
                    </p>
                  </div>
                  <div className="bg-white border border-slate-200 rounded-xl p-4">
                    <p className="text-xs text-slate-500">Groupes actifs</p>
                    <p className="font-mono text-2xl font-bold text-slate-900 mt-1 tabular-nums">
                      {overview?.groupsCount ?? 0}
                    </p>
                  </div>
                  <div className="bg-white border border-emerald-200 rounded-xl p-4">
                    <p className="text-xs text-emerald-700 font-medium">MRR abonnements</p>
                    <p className="font-mono text-xl font-bold text-emerald-700 mt-1 tabular-nums">
                      {formatMoney(overview?.estimatedMrrInt ?? 0, 'XOF')}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setTab('subscriptions')}
                    className="bg-white border border-slate-200 rounded-xl p-4 text-left hover:border-amber-300 transition-colors"
                  >
                    <p className="text-xs text-slate-500">Demandes en attente</p>
                    <p className="font-mono text-2xl font-bold text-amber-700 mt-1 tabular-nums">
                      {overview?.pendingRequests ?? 0}
                    </p>
                    {(overview?.pendingRequests ?? 0) > 0 && (
                      <p className="text-[11px] font-medium text-amber-800 mt-0.5">
                        Valider →
                      </p>
                    )}
                  </button>
                  <div className="bg-white border border-slate-200 rounded-xl p-4">
                    <p className="text-xs text-slate-500">Volume dépenses suivi</p>
                    <p className="font-mono text-xl font-bold text-slate-900 mt-1 tabular-nums">
                      {formatMoney(overview?.expensesVolumeInt ?? 0, 'XOF')}
                    </p>
                  </div>
                  <div className="bg-white border border-slate-200 rounded-xl p-4">
                    <p className="text-xs text-slate-500">Transactions paiement</p>
                    <p className="font-mono text-2xl font-bold text-slate-900 mt-1 tabular-nums">
                      {overview?.totalTransactionsCount ?? 0}
                    </p>
                  </div>
                </div>

                <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
                  <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
                    <h2 className="font-display text-base font-bold text-slate-900">
                      Métadonnées des groupes (données financières privées protégées)
                    </h2>
                    <span className="text-xs text-slate-500">
                      FedaPay :{' '}
                      {overview?.fedapay?.configured
                        ? `Actif (${overview.fedapay.environment})`
                        : 'Non configuré'}
                    </span>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                      <thead className="bg-slate-50 text-xs text-slate-500 uppercase">
                        <tr>
                          <th className="px-5 py-3">Groupe</th>
                          <th className="px-5 py-3">Type</th>
                          <th className="px-5 py-3">Membres</th>
                          <th className="px-5 py-3">Devise</th>
                          <th className="px-5 py-3">Abonnement</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {(overview?.groupsSummary || []).map((g: any) => (
                          <tr key={g.id}>
                            <td className="px-5 py-3 font-medium text-slate-900">{g.name}</td>
                            <td className="px-5 py-3 text-slate-600">
                              {GROUP_TYPES.find((t) => t.value === g.type)?.label || g.type}
                            </td>
                            <td className="px-5 py-3 font-mono tabular-nums">{g.membersCount}</td>
                            <td className="px-5 py-3 font-mono">{g.currency}</td>
                            <td className="px-5 py-3 font-mono text-xs text-emerald-800">
                              {g.planCode} · {g.subscriptionStatus}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </>
            )}
          </motion.div>
        )}

        {/* TAB 3: SUBSCRIPTIONS & PLANS */}
        {tab === 'subscriptions' && (
          <motion.div
            key="tab-subscriptions"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
            className="space-y-8"
          >
            {/* Tarifs configurables */}
            <section className="bg-white border border-stone-200 rounded-2xl p-6 space-y-4">
              <div>
                <h2 className="font-display text-lg font-bold text-stone-900">
                  Tarification des 3 offres par groupe (FCFA / mois)
                </h2>
                <p className="text-xs text-stone-500 mt-1">
                  Chaque niveau possède des quotas et droits distincts vérifiés côté serveur avant utilisation.
                </p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {plans.map((p) => (
                  <div key={p.code} className="border border-stone-200 rounded-xl p-4 flex flex-col justify-between gap-3">
                    <div className="space-y-1.5">
                      <p className="font-semibold text-stone-900">
                        {p.name} ({p.code})
                      </p>
                      <p className="text-xs text-stone-500 leading-relaxed">{p.description}</p>
                      {p.entitlements && (
                        <p className="text-[11px] font-mono text-emerald-800 pt-1">
                          Max {p.entitlements.maxMembers == null ? '∞' : p.entitlements.maxMembers} membres ·{' '}
                          {p.entitlements.maxBudgets == null ? '∞' : p.entitlements.maxBudgets} budgets
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-2 pt-2 border-t border-stone-100">
                      <input
                        type="number"
                        min={0}
                        step={50}
                        value={planPrices[p.code] ?? p.monthlyPriceInt}
                        onChange={(e) =>
                          setPlanPrices((prev) => ({ ...prev, [p.code]: e.target.value }))
                        }
                        className="w-full px-3 py-1.5 text-sm font-mono border border-stone-300 rounded-xl"
                      />
                      <button
                        type="button"
                        onClick={() => handleUpdatePlanPrice(p.code)}
                        className="px-3.5 py-1.5 text-xs font-semibold text-white bg-stone-900 rounded-xl hover:bg-stone-800 shrink-0"
                      >
                        Enregistrer
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {/* Demandes manuelles pilote Bénin */}
            <section className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
              <div>
                <h2 className="font-display text-lg font-bold text-slate-900">
                  Validation manuelle des abonnements (Pilote Mobile Money Bénin)
                </h2>
                <p className="text-xs text-slate-500 mt-1">
                  Aucune activation automatique n’est autorisée sur déclaration. Vérifiez la
                  référence reçue avant de valider.
                </p>
              </div>

              {requests.length === 0 ? (
                <p className="text-sm text-slate-500 py-4">
                  Aucune demande d’abonnement manuel enregistrée.
                </p>
              ) : (
                <div className="divide-y divide-slate-200">
                  {requests.map((r) => (
                    <div key={r.id} className="py-4 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                      <div className="space-y-1">
                        <p className="text-sm font-semibold text-slate-900">
                          {r.groupName} · {r.planCode} ({r.months} mois) ·{' '}
                          <span className="font-mono">{formatMoney(r.amountInt, r.currency)}</span>
                        </p>
                        <p className="text-xs text-slate-600">
                          Demandé par {r.requestedByName} ({r.requestedByEmail}) · Réf :{' '}
                          <span className="font-mono font-semibold">{r.reference}</span>
                        </p>
                        {r.proofNote && (
                          <p className="text-xs text-slate-500">Note : {r.proofNote}</p>
                        )}
                        <p className="text-xs font-mono text-slate-500">
                          Statut : {r.status} {r.adminComment ? `· ${r.adminComment}` : ''}
                        </p>
                      </div>

                      {r.status === 'PENDING' && (
                        <div className="flex flex-wrap items-center gap-2">
                          <input
                            type="text"
                            placeholder="Commentaire de vérification..."
                            value={commentByReq[r.id] || ''}
                            onChange={(e) =>
                              setCommentByReq((prev) => ({ ...prev, [r.id]: e.target.value }))
                            }
                            className="px-3 py-1.5 text-xs border border-slate-300 rounded-lg w-56"
                          />
                          <button
                            type="button"
                            onClick={() => handleApproveRequest(r.id)}
                            className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-white bg-emerald-700 rounded-lg hover:bg-emerald-800"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>Approuver</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleRejectRequest(r.id)}
                            className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-red-700 border border-red-200 rounded-lg hover:bg-red-50"
                          >
                            <XCircle className="w-3.5 h-3.5" />
                            <span>Rejeter</span>
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </section>
          </motion.div>
        )}

        {/* TAB 4: USERS & ANNOUNCEMENTS */}
        {tab === 'users' && (
          <motion.div
            key="tab-users"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
            className="grid grid-cols-1 lg:grid-cols-12 gap-6"
          >
            <div className="lg:col-span-7 bg-white border border-slate-200 rounded-xl overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-200">
                <h2 className="font-display text-base font-bold text-slate-900">
                  Comptes utilisateurs ({usersList.length})
                </h2>
              </div>
              <div className="divide-y divide-slate-100">
                {usersList.map((u) => (
                  <div key={u.id} className="px-5 py-3 flex items-center justify-between gap-4">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-slate-900 truncate">
                        {u.firstName} {u.lastName}
                      </p>
                      <p className="text-xs text-slate-500 truncate">{u.email}</p>
                    </div>
                    <select
                      aria-label={`Rôle de ${u.email}`}
                      value={u.role}
                      onChange={(e) => handleRoleChange(u.id, e.target.value)}
                      className="px-2.5 py-1 text-xs border border-slate-300 rounded-lg bg-white"
                    >
                      <option value="USER">USER</option>
                      <option value="ADMIN">ADMIN</option>
                      <option value="SUPER_ADMIN">SUPER_ADMIN</option>
                    </select>
                  </div>
                ))}
              </div>
            </div>

            <div className="lg:col-span-5 space-y-6">
              <form
                onSubmit={handleCreateAnnouncement}
                className="bg-white border border-slate-200 rounded-xl p-5 space-y-3"
              >
                <h2 className="font-display text-base font-bold text-slate-900 flex items-center gap-2">
                  <Megaphone className="w-4 h-4 text-emerald-700" />
                  <span>Publier une annonce</span>
                </h2>
                <input
                  type="text"
                  required
                  placeholder="Titre de l’annonce"
                  value={annTitle}
                  onChange={(e) => setAnnTitle(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                />
                <textarea
                  required
                  rows={3}
                  placeholder="Message affiché aux utilisateurs..."
                  value={annBody}
                  onChange={(e) => setAnnBody(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                />
                <div className="flex items-center justify-between gap-3">
                  <select
                    value={annLevel}
                    onChange={(e) => setAnnLevel(e.target.value as any)}
                    className="px-3 py-2 text-xs border border-slate-300 rounded-lg"
                  >
                    <option value="INFO">Information</option>
                    <option value="SUCCESS">Succès</option>
                    <option value="WARNING">Alerte</option>
                  </select>
                  <button
                    type="submit"
                    className="px-4 py-2 text-xs font-semibold text-white bg-emerald-700 rounded-lg hover:bg-emerald-800"
                  >
                    Publier
                  </button>
                </div>
              </form>

              <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-3">
                <h3 className="text-sm font-bold text-slate-900">Annonces actives</h3>
                {announcements.length === 0 ? (
                  <p className="text-xs text-slate-500">Aucune annonce publiée.</p>
                ) : (
                  <div className="space-y-3">
                    {announcements.map((a) => (
                      <div key={a.id} className="p-3 border border-slate-200 rounded-lg flex justify-between gap-2">
                        <div>
                          <p className="text-sm font-semibold text-slate-900">{a.title}</p>
                          <p className="text-xs text-slate-600 mt-0.5">{a.body}</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleDeleteAnnouncement(a.id)}
                          className="text-slate-400 hover:text-red-600 shrink-0"
                          aria-label="Supprimer l’annonce"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        )}

        {/* TAB 5: MESSAGES & AUDIT LOGS */}
        {tab === 'audit' && (
          <motion.div
            key="tab-audit"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
            className="grid grid-cols-1 lg:grid-cols-2 gap-6"
          >
            <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-3">
              <h2 className="font-display text-base font-bold text-slate-900">
                Messages de contact reçus
              </h2>
              {contactMessages.length === 0 ? (
                <p className="text-sm text-slate-500">Aucun message reçu.</p>
              ) : (
                <div className="divide-y divide-slate-100">
                  {contactMessages.map((m) => (
                    <div key={m.id} className="py-3 space-y-1">
                      <p className="text-sm font-semibold text-slate-900">
                        {m.subject} · <span className="font-normal text-slate-600">{m.name}</span>
                      </p>
                      <p className="text-xs text-slate-500">{m.email}</p>
                      <p className="text-xs text-slate-700 mt-1">{m.message}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-3">
              <h2 className="font-display text-base font-bold text-slate-900">
                Journal d’audit système
              </h2>
              <div className="divide-y divide-slate-100 max-h-[520px] overflow-y-auto">
                {auditLogs.map((l) => (
                  <div key={l.id} className="py-2.5 text-xs space-y-0.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono font-semibold text-slate-900">{l.action}</span>
                      <span className="text-slate-400 font-mono">
                        {new Date(l.createdAt).toLocaleString('fr-FR')}
                      </span>
                    </div>
                    <p className="text-slate-600">
                      Acteur : {l.actorEmail} · Cible : {l.targetType}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </main>
    </div>
  );
}
