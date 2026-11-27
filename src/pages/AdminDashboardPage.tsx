import React, { useCallback, useEffect, useState } from 'react';
import {
  Activity,
  BarChart3,
  CheckCircle2,
  CreditCard,
  Globe,
  KeyRound,
  Lock,
  LogOut,
  Megaphone,
  Monitor,
  RefreshCw,
  Search,
  ShieldCheck,
  Sparkles,
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
import { PasswordInput } from '../components/PasswordInput';
import { formatMoney, GROUP_TYPES } from '../shared/types';

type AdminTab = 'analytics' | 'overview' | 'subscriptions' | 'users' | 'audit';
type Period = 'day' | 'week' | 'month' | 'year';

export function AdminDashboardPage() {
  const { user, login, setDirectSession, logout, refreshUser } = useAuth();
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
      const targetEmail = (adminEmail || user?.email || 'admin@kpata.bj').trim();
      const res = await apiFetch<{ token: string; user: any }>('/api/admin/bootstrap', {
        method: 'POST',
        body: JSON.stringify({
          passcode,
          email: targetEmail,
        }),
      });
      setDirectSession(res.user, res.token);
      await refreshUser();
      await checkBootstrap();
    } catch (err: any) {
      setAuthError(err?.message || 'Identifiants administrateur invalides.');
    } finally {
      setAuthSubmitting(false);
    }
  };

  const handleQuickAdminLogin = async () => {
    setAuthError('');
    setAuthSubmitting(true);
    try {
      await login('admin@kpata.bj', 'KpataAdmin2026!');
      await checkBootstrap();
    } catch (err: any) {
      setAuthError(err?.message || 'Connexion administrateur impossible.');
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
      <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center p-6">
        <div className="bg-white border border-emerald-950/10 rounded-2xl px-6 py-4 shadow-sm text-sm font-medium text-emerald-950">
          Chargement de l’espace d’administration KPATA...
        </div>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#042F24] via-[#064E3B] to-[#0F766E] flex flex-col justify-center items-center px-4 py-12 relative overflow-hidden">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -top-24 -right-24 w-96 h-96 rounded-full bg-amber-400/15 blur-3xl"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -bottom-24 -left-24 w-96 h-96 rounded-full bg-emerald-400/15 blur-3xl"
        />

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
          className="relative w-full max-w-md bg-white border border-white/20 rounded-3xl p-6 sm:p-8 space-y-6 shadow-2xl"
        >
          <div className="flex items-center justify-between">
            <Link to="/" className="inline-flex items-center gap-2 font-display text-xl font-extrabold text-slate-900">
              <span className="w-8 h-8 rounded-xl bg-gradient-to-br from-emerald-600 to-teal-700 text-white inline-flex items-center justify-center text-sm font-bold shadow-sm">
                K
              </span>
              <span>KPATA</span>
            </Link>
            <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-900 bg-emerald-100 px-2.5 py-1 rounded-lg">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-700" />
              <span>Espace Propriétaire</span>
            </span>
          </div>

          <div className="space-y-2">
            <h1 className="font-display text-2xl font-extrabold text-slate-900">
              {bootStatus.needsInitialSetup
                ? 'Initialiser l’accès propriétaire KPATA'
                : 'Connexion Administrateur Principal'}
            </h1>
            <p className="text-sm text-slate-600 leading-relaxed">
              {bootStatus.needsInitialSetup
                ? 'Premier accès : saisissez votre e-mail propriétaire et choisissez un mot de passe (8 caractères min.) pour créer votre compte SUPER_ADMIN.'
                : 'Connectez-vous avec votre compte propriétaire pour piloter les statistiques du site, les abonnements, les tarifs et les utilisateurs.'}
            </p>
          </div>

          {!bootStatus.needsInitialSetup && (
            <div className="rounded-2xl bg-gradient-to-br from-amber-50 to-orange-50/70 border border-amber-300/80 p-4 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <span className="inline-flex items-center gap-1.5 text-xs font-bold text-amber-950">
                  <KeyRound className="w-4 h-4 text-amber-700" />
                  <span>Identifiants Administrateur Pilote</span>
                </span>
                <span className="text-[11px] font-semibold text-amber-800">SUPER_ADMIN</span>
              </div>
              <div className="text-xs text-slate-800 font-mono bg-white/90 border border-amber-200 rounded-xl px-3 py-2 space-y-1">
                <div>
                  E-mail : <strong className="text-slate-950">admin@kpata.bj</strong>
                </div>
                <div>
                  Mot de passe : <strong className="text-slate-950">KpataAdmin2026!</strong>
                </div>
              </div>
              <button
                type="button"
                disabled={authSubmitting}
                onClick={handleQuickAdminLogin}
                className="w-full py-2.5 px-4 text-xs font-bold text-slate-950 bg-amber-400 hover:bg-amber-300 rounded-xl transition-colors shadow-sm disabled:opacity-50 inline-flex items-center justify-center gap-1.5"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Se connecter en Admin Pilote (1 clic)</span>
              </button>
            </div>
          )}

          {authError && (
            <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-sm text-red-800">
              {authError}
            </div>
          )}

          <form onSubmit={handleBootstrapSubmit} className="space-y-4">
            <label className="block space-y-1.5 text-sm">
              <span className="font-medium text-slate-700">E-mail propriétaire</span>
              <input
                type="email"
                required
                value={adminEmail}
                onChange={(e) => setAdminEmail(e.target.value)}
                placeholder="admin@kpata.bj"
                className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-600"
              />
            </label>

            <label className="block space-y-1.5 text-sm">
              <span className="font-medium text-slate-700">
                {bootStatus.needsInitialSetup
                  ? 'Mot de passe propriétaire (8 caractères min.)'
                  : 'Mot de passe administrateur'}
              </span>
              <PasswordInput
                required
                minLength={8}
                value={passcode}
                onChange={(e) => setPasscode(e.target.value)}
                placeholder="KpataAdmin2026!"
                className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-600"
              />
            </label>

            <button
              type="submit"
              disabled={authSubmitting}
              className="w-full py-2.5 px-4 text-sm font-semibold text-white bg-gradient-to-r from-emerald-700 to-teal-700 rounded-xl hover:from-emerald-800 hover:to-teal-800 disabled:opacity-50 transition-all shadow-sm inline-flex items-center justify-center gap-2"
            >
              <Lock className="w-4 h-4" />
              <span>
                {authSubmitting
                  ? 'Vérification...'
                  : bootStatus.needsInitialSetup
                  ? 'Créer mon accès propriétaire'
                  : 'Accéder au tableau de bord admin'}
              </span>
            </button>
          </form>

          <div className="pt-3 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500">
            <Link to="/app" className="hover:text-emerald-800 font-medium">
              Espace personnel
            </Link>
            <Link to="/" className="hover:text-emerald-800 font-medium">
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
    <div className="min-h-screen bg-[#F8FAFC] text-slate-900">
      <header className="sticky top-0 z-30 bg-[#042F24] text-white shadow-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <Link to="/" className="inline-flex items-center gap-2 font-display text-lg font-extrabold text-white shrink-0">
              <span className="w-7 h-7 rounded-lg bg-gradient-to-br from-emerald-400 to-amber-400 text-[#042F24] inline-flex items-center justify-center text-xs font-extrabold">
                K
              </span>
              <span>KPATA</span>
            </Link>
            <span className="text-emerald-700 hidden sm:inline">·</span>
            <span className="text-sm font-semibold text-amber-300 truncate hidden sm:inline">
              Espace Propriétaire KPATA · Administration centrale
            </span>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            <Link
              to="/app"
              className="px-3.5 py-1.5 text-xs font-semibold text-emerald-100 border border-emerald-700/80 rounded-xl hover:bg-emerald-900/70 transition-colors"
            >
              Espace utilisateur
            </Link>
            <button
              type="button"
              onClick={async () => {
                await logout();
                navigate('/connexion');
              }}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-slate-950 bg-amber-400 rounded-xl hover:bg-amber-300 transition-colors"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Déconnexion</span>
            </button>
          </div>
        </div>

        {/* Sub-navigation tabs with animated indicator */}
        <div className="bg-[#064E3B]/70 border-t border-emerald-800/60">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 flex items-center gap-1 overflow-x-auto">
            {tabs.map((t) => {
              const Icon = t.icon;
              const active = tab === t.id;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setTab(t.id)}
                  className={`relative inline-flex items-center gap-2 px-4 py-3 text-xs sm:text-sm font-medium whitespace-nowrap transition-colors ${
                    active ? 'text-white font-semibold' : 'text-emerald-100/75 hover:text-white'
                  }`}
                >
                  <Icon className={`w-4 h-4 shrink-0 ${active ? 'text-amber-300' : ''}`} />
                  <span>{t.label}</span>
                  {active && (
                    <motion.span
                      layoutId="admin-tab-indicator"
                      transition={{ type: 'spring', stiffness: 420, damping: 32 }}
                      className="absolute inset-x-2 bottom-0 h-0.5 rounded-full bg-amber-400"
                    />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-6">
        {actionMsg && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-300 text-sm text-emerald-950 flex items-center justify-between shadow-xs"
          >
            <span className="font-medium">{actionMsg}</span>
            <button
              type="button"
              onClick={() => setActionMsg('')}
              className="text-xs font-bold text-emerald-800 hover:underline"
            >
              Fermer
            </button>
          </motion.div>
        )}

        {/* TAB 1: STATISTIQUES DU SITE */}
        {tab === 'analytics' && (
          <motion.div
            key="tab-analytics"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
            className="space-y-6"
          >
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <h1 className="font-display text-xl sm:text-2xl font-extrabold text-slate-900">
                  Statistiques du site & Visibilité SEO
                </h1>
                <p className="text-sm text-slate-600 mt-1">
                  Mesure de fréquentation humaine sans cookies publicitaires intrusifs · robots
                  d’indexation (Googlebot, Bingbot) filtrés automatiquement.
                </p>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
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
                    className={`px-3.5 py-1.5 text-xs font-semibold rounded-xl border transition-all ${
                      period === p
                        ? 'bg-gradient-to-r from-emerald-700 to-teal-700 text-white border-emerald-700 shadow-xs'
                        : 'bg-white text-slate-700 border-slate-200 hover:border-emerald-300'
                    }`}
                  >
                    {label}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => loadAnalytics(period)}
                  className="p-2 bg-white border border-slate-200 rounded-xl text-emerald-800 hover:bg-emerald-50 transition-colors"
                  aria-label="Actualiser les statistiques"
                >
                  <RefreshCw className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* External SEO / GA4 Configuration Status */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-gradient-to-br from-emerald-50/70 to-white border border-emerald-200/80 rounded-2xl p-4 space-y-1.5 shadow-xs">
                <div className="flex items-center justify-between text-xs font-bold text-emerald-900">
                  <span>GOOGLE ANALYTICS 4 (GA4)</span>
                  <span className={siteStats?.ga4?.configured ? 'text-emerald-700' : 'text-amber-700'}>
                    {siteStats?.ga4?.configured ? 'Configuré' : 'À configurer'}
                  </span>
                </div>
                <p className="text-sm font-semibold text-slate-900">
                  {siteStats?.ga4?.configured
                    ? `ID de mesure : ${siteStats.ga4.measurementIdMasked}`
                    : 'Définir VITE_GA_MEASUREMENT_ID dans les variables Vercel'}
                </p>
                <p className="text-xs text-slate-600">
                  Collecte soumise au consentement visiteur (Consent Mode v2).
                </p>
              </div>

              <div className="bg-gradient-to-br from-sky-50/70 to-white border border-sky-200/80 rounded-2xl p-4 space-y-1.5 shadow-xs">
                <div className="flex items-center justify-between text-xs font-bold text-sky-900">
                  <span>GOOGLE SEARCH CONSOLE</span>
                  <span className={publicConfig?.searchConsoleConfigured ? 'text-emerald-700' : 'text-amber-700'}>
                    {publicConfig?.searchConsoleConfigured ? 'Balise présente' : 'À vérifier'}
                  </span>
                </div>
                <p className="text-sm font-semibold text-slate-900">
                  Sitemap dynamique : <span className="font-mono text-xs">/sitemap.xml</span>
                </p>
                <p className="text-xs text-slate-600">
                  Renseigner GOOGLE_SITE_VERIFICATION ou DNS TXT dans Search Console.
                </p>
              </div>

              <div className="bg-gradient-to-br from-amber-50/70 to-white border border-amber-200/80 rounded-2xl p-4 space-y-1.5 shadow-xs">
                <div className="flex items-center justify-between text-xs font-bold text-amber-900">
                  <span>BING WEBMASTER & ROBOTS</span>
                  <span className={publicConfig?.bingConfigured ? 'text-emerald-700' : 'text-slate-700'}>
                    {publicConfig?.bingConfigured ? 'Balise présente' : 'Prêt (/robots.txt)'}
                  </span>
                </div>
                <p className="text-sm font-semibold text-slate-900">
                  Routes privées protégées (noindex)
                </p>
                <p className="text-xs text-slate-600">
                  /app, /admin, /connexion et données financières bloqués à l’indexation.
                </p>
              </div>
            </div>

            {/* Primary Traffic KPIs */}
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3.5">
              {[
                { label: 'Visiteurs totaux', value: metrics.totalVisitors ?? 0, tone: 'text-slate-900 border-slate-200 bg-white' },
                { label: 'Visiteurs uniques', value: metrics.uniqueVisitors ?? 0, tone: 'text-emerald-700 border-emerald-200 bg-emerald-50/40' },
                { label: 'Visites (sessions)', value: metrics.totalSessions ?? 0, tone: 'text-teal-800 border-teal-200 bg-teal-50/40' },
                { label: 'Actifs (5 min)', value: metrics.activeVisitors ?? 0, tone: 'text-amber-700 border-amber-200 bg-amber-50/50' },
                { label: 'Pages consultées', value: metrics.totalPageviews ?? 0, tone: 'text-sky-800 border-sky-200 bg-sky-50/40' },
                { label: 'Durée moyenne', value: formatDuration(metrics.avgDurationSec), tone: 'text-slate-900 border-slate-200 bg-white' },
                { label: 'Taux d’engagement', value: `${metrics.engagementRatePct ?? 0}%`, tone: 'text-emerald-800 border-emerald-200 bg-emerald-50/40' },
              ].map((kpi, idx) => (
                <motion.div
                  key={kpi.label}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.2, delay: idx * 0.03 }}
                  className={`border rounded-2xl p-4 shadow-xs ${kpi.tone}`}
                >
                  <p className="text-xs font-medium text-slate-600">{kpi.label}</p>
                  <p className="font-mono text-2xl font-extrabold mt-1 tabular-nums">{kpi.value}</p>
                </motion.div>
              ))}
            </div>

            {/* Timeline Chart */}
            <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-4 shadow-xs">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="font-display text-base font-bold text-slate-900">
                  Évolution du trafic (Visites vs Visiteurs uniques)
                </h2>
                <span className="text-xs text-slate-500">
                  Les visiteurs uniques sont distingués des visites (sessions).
                </span>
              </div>

              {(siteStats?.timeline || []).length === 0 ? (
                <div className="h-56 flex items-center justify-center text-sm text-slate-500 border border-dashed border-slate-200 rounded-xl">
                  Aucune visite enregistrée sur cette période. Naviguez sur les pages publiques
                  pour observer la télémétrie en temps réel.
                </div>
              ) : (
                <div className="h-64 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={siteStats.timeline}>
                      <defs>
                        <linearGradient id="kpataSessionsFill" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#F59E0B" stopOpacity={0.35} />
                          <stop offset="95%" stopColor="#F59E0B" stopOpacity={0.02} />
                        </linearGradient>
                        <linearGradient id="kpataUniqueFill" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#059669" stopOpacity={0.4} />
                          <stop offset="95%" stopColor="#059669" stopOpacity={0.04} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                      <XAxis dataKey="bucket" tick={{ fontSize: 11, fill: '#64748B' }} />
                      <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#64748B' }} />
                      <Tooltip />
                      <Area
                        type="monotone"
                        dataKey="sessions"
                        name="Visites (sessions)"
                        stroke="#D97706"
                        strokeWidth={2}
                        fill="url(#kpataSessionsFill)"
                      />
                      <Area
                        type="monotone"
                        dataKey="uniqueVisitors"
                        name="Visiteurs uniques"
                        stroke="#059669"
                        strokeWidth={2.5}
                        fill="url(#kpataUniqueFill)"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>

            {/* Breakdown Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-3 shadow-xs">
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
                        <span className="font-mono font-bold text-emerald-800 tabular-nums">
                          {p.views} vues
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-3 shadow-xs">
                <h3 className="font-display text-base font-bold text-slate-900 flex items-center gap-2">
                  <Globe className="w-4 h-4 text-sky-700" />
                  <span>Sources de trafic</span>
                </h3>
                <div className="divide-y divide-slate-100">
                  {(siteStats?.sources || []).length === 0 ? (
                    <p className="text-sm text-slate-500 py-4">Aucune source enregistrée.</p>
                  ) : (
                    siteStats.sources.map((s: any) => (
                      <div key={s.source} className="py-2.5 flex items-center justify-between text-sm">
                        <span className="text-slate-700 font-medium">{s.source}</span>
                        <span className="font-mono font-bold text-slate-900 tabular-nums">
                          {s.sessions} sessions
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-4 shadow-xs">
                <h3 className="font-display text-base font-bold text-slate-900 flex items-center gap-2">
                  <Monitor className="w-4 h-4 text-amber-600" />
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

              <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-3 shadow-xs">
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
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
            className="space-y-6"
          >
            <h1 className="font-display text-2xl font-extrabold text-slate-900">
              Indicateurs plateforme KPATA
            </h1>

            {loadingData && !overview ? (
              <div className="h-32 bg-white border border-slate-200 rounded-2xl flex items-center justify-center text-sm text-slate-500">
                Chargement des indicateurs...
              </div>
            ) : (
              <>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                  <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs">
                    <p className="text-xs text-slate-500 font-medium">Utilisateurs inscrits</p>
                    <p className="font-mono text-2xl font-extrabold text-slate-900 mt-1 tabular-nums">
                      {overview?.usersCount ?? 0}
                    </p>
                  </div>
                  <div className="bg-gradient-to-br from-teal-50/70 to-white border border-teal-200 rounded-2xl p-4 shadow-xs">
                    <p className="text-xs text-teal-800 font-medium">Groupes actifs</p>
                    <p className="font-mono text-2xl font-extrabold text-teal-900 mt-1 tabular-nums">
                      {overview?.groupsCount ?? 0}
                    </p>
                  </div>
                  <div className="bg-gradient-to-br from-emerald-50 to-white border border-emerald-300 rounded-2xl p-4 shadow-xs">
                    <p className="text-xs text-emerald-800 font-semibold">MRR abonnements</p>
                    <p className="font-mono text-xl font-extrabold text-emerald-800 mt-1 tabular-nums">
                      {formatMoney(overview?.estimatedMrrInt ?? 0, 'XOF')}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setTab('subscriptions')}
                    className="bg-gradient-to-br from-amber-50 to-white border border-amber-300 rounded-2xl p-4 text-left hover:border-amber-500 transition-colors shadow-xs"
                  >
                    <p className="text-xs text-amber-900 font-semibold">Demandes en attente</p>
                    <p className="font-mono text-2xl font-extrabold text-amber-700 mt-1 tabular-nums">
                      {overview?.pendingRequests ?? 0}
                    </p>
                    {(overview?.pendingRequests ?? 0) > 0 && (
                      <p className="text-[11px] font-bold text-amber-800 mt-0.5">Valider →</p>
                    )}
                  </button>
                  <div className="bg-gradient-to-br from-sky-50/70 to-white border border-sky-200 rounded-2xl p-4 shadow-xs">
                    <p className="text-xs text-sky-900 font-medium">Volume dépenses suivi</p>
                    <p className="font-mono text-xl font-extrabold text-sky-950 mt-1 tabular-nums">
                      {formatMoney(overview?.expensesVolumeInt ?? 0, 'XOF')}
                    </p>
                  </div>
                  <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs">
                    <p className="text-xs text-slate-500 font-medium">Transactions paiement</p>
                    <p className="font-mono text-2xl font-extrabold text-slate-900 mt-1 tabular-nums">
                      {overview?.totalTransactionsCount ?? 0}
                    </p>
                  </div>
                </div>

                <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-xs">
                  <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50/70">
                    <h2 className="font-display text-base font-bold text-slate-900">
                      Métadonnées des groupes (données financières privées protégées)
                    </h2>
                    <span className="text-xs font-semibold text-emerald-800">
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
                          <tr key={g.id} className="hover:bg-emerald-50/30 transition-colors">
                            <td className="px-5 py-3 font-semibold text-slate-900">{g.name}</td>
                            <td className="px-5 py-3 text-slate-600">
                              {GROUP_TYPES.find((t) => t.value === g.type)?.label || g.type}
                            </td>
                            <td className="px-5 py-3 font-mono tabular-nums">{g.membersCount}</td>
                            <td className="px-5 py-3 font-mono">{g.currency}</td>
                            <td className="px-5 py-3 font-mono text-xs font-semibold text-emerald-800">
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
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
            className="space-y-8"
          >
            {/* Tarifs configurables (3 offres exactement) */}
            <section className="bg-white border border-slate-200 rounded-2xl p-6 space-y-5 shadow-xs">
              <div>
                <h2 className="font-display text-lg font-extrabold text-slate-900">
                  Tarification des 3 offres par groupe (FCFA / mois)
                </h2>
                <p className="text-xs text-slate-600 mt-1">
                  Chaque niveau possède des quotas et droits distincts vérifiés côté serveur avant utilisation.
                </p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {plans.map((p) => {
                  const accent =
                    p.code === 'ORG'
                      ? 'border-amber-300 bg-gradient-to-b from-amber-50/60 to-white'
                      : p.code === 'PREMIUM'
                      ? 'border-emerald-300 bg-gradient-to-b from-emerald-50/70 to-white'
                      : 'border-slate-200 bg-white';
                  return (
                    <div
                      key={p.code}
                      className={`border rounded-2xl p-5 flex flex-col justify-between gap-4 shadow-xs ${accent}`}
                    >
                      <div className="space-y-1.5">
                        <p className="font-display font-bold text-slate-900">
                          {p.name} <span className="font-mono text-xs text-slate-500">({p.code})</span>
                        </p>
                        <p className="text-xs text-slate-600 leading-relaxed">{p.description}</p>
                        {p.entitlements && (
                          <p className="text-[11px] font-mono font-semibold text-emerald-800 pt-1">
                            Max {p.entitlements.maxMembers == null ? '∞' : p.entitlements.maxMembers} membres ·{' '}
                            {p.entitlements.maxBudgets == null ? '∞' : p.entitlements.maxBudgets} budgets
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-2 pt-3 border-t border-slate-200/70">
                        <input
                          type="number"
                          min={0}
                          step={50}
                          value={planPrices[p.code] ?? p.monthlyPriceInt}
                          onChange={(e) =>
                            setPlanPrices((prev) => ({ ...prev, [p.code]: e.target.value }))
                          }
                          className="w-full px-3 py-1.5 text-sm font-mono border border-slate-300 rounded-xl bg-white"
                        />
                        <button
                          type="button"
                          onClick={() => handleUpdatePlanPrice(p.code)}
                          className="px-3.5 py-2 text-xs font-semibold text-white bg-emerald-700 rounded-xl hover:bg-emerald-800 shrink-0 transition-colors"
                        >
                          Enregistrer
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>

            {/* Demandes manuelles pilote Bénin */}
            <section className="bg-white border border-slate-200 rounded-2xl p-6 space-y-4 shadow-xs">
              <div>
                <h2 className="font-display text-lg font-extrabold text-slate-900">
                  Validation manuelle des abonnements (Pilote Mobile Money Bénin)
                </h2>
                <p className="text-xs text-slate-600 mt-1">
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
                        <p className="text-sm font-bold text-slate-900">
                          {r.groupName} · {r.planCode} ({r.months} mois) ·{' '}
                          <span className="font-mono text-emerald-800">
                            {formatMoney(r.amountInt, r.currency)}
                          </span>
                        </p>
                        <p className="text-xs text-slate-600">
                          Demandé par {r.requestedByName} ({r.requestedByEmail}) · Réf :{' '}
                          <span className="font-mono font-semibold text-slate-900">{r.reference}</span>
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
                            className="px-3 py-1.5 text-xs border border-slate-300 rounded-xl w-56"
                          />
                          <button
                            type="button"
                            onClick={() => handleApproveRequest(r.id)}
                            className="inline-flex items-center gap-1 px-3.5 py-2 text-xs font-semibold text-white bg-emerald-700 rounded-xl hover:bg-emerald-800"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>Approuver</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleRejectRequest(r.id)}
                            className="inline-flex items-center gap-1 px-3.5 py-2 text-xs font-semibold text-red-700 border border-red-200 rounded-xl hover:bg-red-50"
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
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
            className="grid grid-cols-1 lg:grid-cols-12 gap-6"
          >
            <div className="lg:col-span-7 bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-xs">
              <div className="px-5 py-4 border-b border-slate-200 bg-slate-50/70">
                <h2 className="font-display text-base font-bold text-slate-900">
                  Comptes utilisateurs ({usersList.length})
                </h2>
              </div>
              <div className="divide-y divide-slate-100">
                {usersList.map((u) => (
                  <div key={u.id} className="px-5 py-3 flex items-center justify-between gap-4 hover:bg-slate-50/70">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-900 truncate">
                        {u.firstName} {u.lastName}
                      </p>
                      <p className="text-xs text-slate-500 truncate">{u.email}</p>
                    </div>
                    <select
                      aria-label={`Rôle de ${u.email}`}
                      value={u.role}
                      onChange={(e) => handleRoleChange(u.id, e.target.value)}
                      className="px-2.5 py-1.5 text-xs font-semibold border border-slate-300 rounded-xl bg-white"
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
                className="bg-white border border-slate-200 rounded-2xl p-5 space-y-3 shadow-xs"
              >
                <h2 className="font-display text-base font-bold text-slate-900 flex items-center gap-2">
                  <Megaphone className="w-4 h-4 text-amber-600" />
                  <span>Publier une annonce</span>
                </h2>
                <input
                  type="text"
                  required
                  placeholder="Titre de l’annonce"
                  value={annTitle}
                  onChange={(e) => setAnnTitle(e.target.value)}
                  className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-xl"
                />
                <textarea
                  required
                  rows={3}
                  placeholder="Message affiché aux utilisateurs..."
                  value={annBody}
                  onChange={(e) => setAnnBody(e.target.value)}
                  className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-xl"
                />
                <div className="flex items-center justify-between gap-3">
                  <select
                    value={annLevel}
                    onChange={(e) => setAnnLevel(e.target.value as any)}
                    className="px-3 py-2 text-xs border border-slate-300 rounded-xl bg-white"
                  >
                    <option value="INFO">Information</option>
                    <option value="SUCCESS">Succès</option>
                    <option value="WARNING">Alerte</option>
                  </select>
                  <button
                    type="submit"
                    className="px-4 py-2 text-xs font-semibold text-white bg-emerald-700 rounded-xl hover:bg-emerald-800 transition-colors"
                  >
                    Publier
                  </button>
                </div>
              </form>

              <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-3 shadow-xs">
                <h3 className="text-sm font-bold text-slate-900">Annonces actives</h3>
                {announcements.length === 0 ? (
                  <p className="text-xs text-slate-500">Aucune annonce publiée.</p>
                ) : (
                  <div className="space-y-3">
                    {announcements.map((a) => (
                      <div key={a.id} className="p-3 border border-slate-200 rounded-xl flex justify-between gap-2">
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
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
            className="grid grid-cols-1 lg:grid-cols-2 gap-6"
          >
            <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-3 shadow-xs">
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

            <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-3 shadow-xs">
              <h2 className="font-display text-base font-bold text-slate-900">
                Journal d’audit système
              </h2>
              <div className="divide-y divide-slate-100 max-h-[520px] overflow-y-auto">
                {auditLogs.map((l) => (
                  <div key={l.id} className="py-2.5 text-xs space-y-0.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono font-semibold text-emerald-900">{l.action}</span>
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
