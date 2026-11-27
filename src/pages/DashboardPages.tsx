import React, { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import {
  ArrowDownLeft,
  ArrowUpRight,
  Bell,
  Check,
  CreditCard,
  Lock,
  Plus,
  RefreshCw,
  ShieldCheck,
  Trash2,
  TrendingUp,
  Users,
  Wallet,
} from 'lucide-react';
import { AppShell } from '../components/AppShell';
import { apiFetch } from '../lib/api';
import { Link, useRouter } from '../lib/router';
import { useAuth } from '../context/AuthContext';
import { PasswordInput } from '../components/PasswordInput';
import {
  COUNTRIES,
  CURRENCIES,
  formatMoney,
  GROUP_ROLE_LABELS,
  GROUP_TYPES,
  PLAN_ENTITLEMENTS,
  type GroupRole,
  type SubscriptionPlanCode,
} from '../shared/types';

export function PersonalDashboardPage() {
  const [data, setData] = useState<any>(null);
  const [groupFilter, setGroupFilter] = useState<string>('');
  const [loading, setLoading] = useState(true);

  const load = async (filterId = groupFilter) => {
    setLoading(true);
    try {
      const qs = filterId ? `?groupId=${encodeURIComponent(filterId)}` : '';
      const res = await apiFetch(`/api/users/me/dashboard${qs}`);
      setData(res);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load(groupFilter);
  }, [groupFilter]);

  return (
    <AppShell
      title="Tableau de bord personnel"
      subtitle="Vue consolidée de vos groupes indépendants, avances, dettes et échéances"
      actions={
        <Link
          to="/app/groups"
          className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-gradient-to-r from-emerald-700 to-teal-700 rounded-xl hover:from-emerald-800 hover:to-teal-800 transition-all shadow-xs whitespace-nowrap"
        >
          <Plus className="w-4 h-4" />
          <span>Nouveau groupe</span>
        </Link>
      }
    >
      {loading && !data ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-28 rounded-2xl bg-white border border-slate-200 p-5 text-xs text-slate-400">
              Chargement...
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-8">
          {/* Group Filter */}
          <div className="flex flex-wrap items-center justify-between gap-4">
            <p className="text-sm text-slate-600">
              Vous participez à{' '}
              <span className="font-mono font-bold text-emerald-800">
                {data?.groupsCount || 0}
              </span>{' '}
              groupe(s) actif(s).
            </p>
            <select
              aria-label="Filtrer par groupe"
              value={groupFilter}
              onChange={(e) => setGroupFilter(e.target.value)}
              className="px-3.5 py-2 text-sm bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-600 shadow-xs"
            >
              <option value="">Tous mes groupes</option>
              {(data?.groupSummaries || []).map((g: any) => (
                <option key={g.groupId} value={g.groupId}>
                  {g.groupName}
                </option>
              ))}
            </select>
          </div>

          {/* Primary KPI Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.24, delay: 0 }}
              className="bg-gradient-to-br from-[#042F24] to-[#065F46] text-white rounded-2xl p-5 space-y-2 shadow-sm"
            >
              <div className="flex items-center justify-between text-xs text-emerald-200 font-medium">
                <span>Total des avances</span>
                <Wallet className="w-4 h-4 text-amber-300" />
              </div>
              <p className="font-mono text-2xl font-extrabold tabular-nums">
                {formatMoney(data?.totalAdvancesInt || 0)}
              </p>
              <p className="text-xs text-emerald-100/80">
                Dépenses personnelles :{' '}
                <span className="font-mono font-semibold text-white">
                  {formatMoney(data?.totalPersonalExpensesInt || 0)}
                </span>
              </p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.24, delay: 0.05 }}
              className="bg-gradient-to-br from-emerald-50 to-white border border-emerald-200 rounded-2xl p-5 space-y-2 shadow-xs"
            >
              <div className="flex items-center justify-between text-xs text-emerald-800 font-semibold">
                <span>Montants à recevoir</span>
                <ArrowDownLeft className="w-4 h-4 text-emerald-700" />
              </div>
              <p className="font-mono text-2xl font-extrabold text-emerald-700 tabular-nums">
                {formatMoney(data?.totalToReceiveInt || 0)}
              </p>
              <p className="text-xs text-slate-600">Créances nettes sur vos groupes</p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.24, delay: 0.1 }}
              className="bg-gradient-to-br from-rose-50/70 to-white border border-rose-200 rounded-2xl p-5 space-y-2 shadow-xs"
            >
              <div className="flex items-center justify-between text-xs text-rose-800 font-semibold">
                <span>Dettes à payer</span>
                <ArrowUpRight className="w-4 h-4 text-rose-600" />
              </div>
              <p className="font-mono text-2xl font-extrabold text-rose-700 tabular-nums">
                {formatMoney(data?.totalToPayInt || 0)}
              </p>
              <p className="text-xs text-slate-600">
                Remboursements en attente :{' '}
                <span className="font-mono font-semibold text-rose-800">
                  {data?.pendingSettlementsCount || 0}
                </span>
              </p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.24, delay: 0.15 }}
              className="bg-gradient-to-br from-amber-50/80 to-white border border-amber-200 rounded-2xl p-5 space-y-2 shadow-xs"
            >
              <div className="flex items-center justify-between text-xs text-amber-900 font-semibold">
                <span>Cotisations confirmées</span>
                <TrendingUp className="w-4 h-4 text-amber-600" />
              </div>
              <p className="font-mono text-2xl font-extrabold text-amber-800 tabular-nums">
                {formatMoney(data?.confirmedContributionsInt || 0)}
              </p>
              <p className="text-xs text-slate-600">
                Sur <span className="font-mono font-semibold">{formatMoney(data?.expectedContributionsInt || 0)}</span> attendus
              </p>
            </motion.div>
          </div>

          {/* Groups Summary */}
          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-lg font-extrabold text-slate-900">Mes groupes</h2>
              <Link to="/app/groups" className="text-xs font-bold text-emerald-700 hover:underline">
                Gérer tous les groupes →
              </Link>
            </div>
            {(data?.groupSummaries || []).length === 0 ? (
              <div className="bg-white border border-slate-200 rounded-2xl p-8 text-center space-y-3 shadow-xs">
                <p className="text-sm text-slate-600">Vous n’appartenez encore à aucun groupe.</p>
                <Link
                  to="/app/groups"
                  className="inline-block px-4 py-2 text-xs font-semibold text-white bg-emerald-700 rounded-xl hover:bg-emerald-800"
                >
                  Créer ou rejoindre un groupe
                </Link>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {data.groupSummaries.map((g: any, idx: number) => (
                  <motion.div
                    key={g.groupId}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.22, delay: idx * 0.04 }}
                    whileHover={{ y: -3 }}
                  >
                    <Link
                      to={`/app/groups/${g.groupId}`}
                      className="bg-white border border-slate-200 rounded-2xl p-5 hover:border-emerald-500 hover:shadow-md transition-all flex flex-col justify-between space-y-4 h-full"
                    >
                      <div className="space-y-1.5">
                        <p className="text-xs font-medium text-emerald-700">
                          {GROUP_TYPES.find((t) => t.value === g.groupType)?.label || g.groupType} ·{' '}
                          {GROUP_ROLE_LABELS[g.role as GroupRole] || g.role} · {g.membersCount} membres
                        </p>
                        <h3 className="font-display text-base font-extrabold text-slate-900 truncate">
                          {g.groupName}
                        </h3>
                      </div>
                      <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                        <span className="text-slate-500">Votre solde net</span>
                        <span
                          className={`font-mono font-extrabold tabular-nums ${
                            g.myNetBalanceInt > 0
                              ? 'text-emerald-700'
                              : g.myNetBalanceInt < 0
                              ? 'text-rose-700'
                              : 'text-slate-700'
                          }`}
                        >
                          {g.myNetBalanceInt > 0 ? '+' : ''}
                          {formatMoney(g.myNetBalanceInt, g.currency)}
                        </span>
                      </div>
                    </Link>
                  </motion.div>
                ))}
              </div>
            )}
          </section>

          {/* Recent Expenses & Notifications */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <section className="bg-white border border-slate-200 rounded-2xl p-5 space-y-4 shadow-xs">
              <h2 className="font-display text-base font-extrabold text-slate-900">
                Dernières dépenses
              </h2>
              {(data?.recentExpenses || []).length === 0 ? (
                <p className="text-sm text-slate-500">Aucune dépense récente.</p>
              ) : (
                <div className="divide-y divide-slate-100">
                  {data.recentExpenses.map((e: any) => (
                    <Link
                      key={e.id}
                      to={`/app/groups/${e.groupId}`}
                      className="py-2.5 flex items-center justify-between gap-3 hover:bg-emerald-50/40 rounded-xl px-2 transition-colors"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-slate-900 truncate">{e.title}</p>
                        <p className="text-xs text-slate-500 truncate">
                          {e.groupName} · {e.expenseDate} ·{' '}
                          {e.status === 'CANCELLED' ? 'Annulée' : e.paymentStatus}
                        </p>
                      </div>
                      <span className="font-mono text-sm font-bold text-slate-900 tabular-nums shrink-0">
                        {formatMoney(e.amountInt, e.currency)}
                      </span>
                    </Link>
                  ))}
                </div>
              )}
            </section>

            <section className="bg-white border border-slate-200 rounded-2xl p-5 space-y-4 shadow-xs">
              <div className="flex items-center justify-between">
                <h2 className="font-display text-base font-extrabold text-slate-900">
                  Échéances récurrentes & Notifications
                </h2>
                <Link to="/app/notifications" className="text-xs font-bold text-emerald-700 hover:underline">
                  Tout voir
                </Link>
              </div>
              {(data?.upcomingRecurring || []).length > 0 && (
                <div className="space-y-2 pb-3 border-b border-slate-100">
                  <p className="text-xs font-bold text-amber-800">Dépenses programmées</p>
                  {data.upcomingRecurring.slice(0, 3).map((r: any) => (
                    <div key={r.id} className="flex items-center justify-between text-xs">
                      <span className="text-slate-800 font-medium truncate">
                        {r.title} ({r.recurrenceFreq})
                      </span>
                      <span className="font-mono font-semibold text-slate-800 tabular-nums">
                        {formatMoney(r.amountInt, r.currency)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
              {(data?.notifications || []).length === 0 ? (
                <p className="text-sm text-slate-500">Aucune notification récente.</p>
              ) : (
                <div className="divide-y divide-slate-100">
                  {data.notifications.slice(0, 5).map((n: any) => (
                    <div key={n.id} className="py-2.5 text-sm">
                      <p className={`font-medium ${n.isRead ? 'text-slate-600' : 'text-slate-900 font-semibold'}`}>
                        {n.title}
                      </p>
                      <p className="text-xs text-slate-500">{n.body}</p>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>
        </div>
      )}
    </AppShell>
  );
}

export function GroupsListPage() {
  const { navigate } = useRouter();
  const [groups, setGroups] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);

  const [name, setName] = useState('');
  const [type, setType] = useState('FAMILLE');
  const [description, setDescription] = useState('');
  const [country, setCountry] = useState('BJ');
  const [currency, setCurrency] = useState('XOF');
  const [timezone, setTimezone] = useState('Africa/Porto-Novo');
  const [visibility, setVisibility] = useState('PRIVATE');
  const [desiredPlanCode, setDesiredPlanCode] = useState<SubscriptionPlanCode>('FREE');
  const [plans, setPlans] = useState<any[]>([]);

  const [joinCode, setJoinCode] = useState('');
  const [msg, setMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const [grpRes, planRes] = await Promise.all([
        apiFetch<{ groups: any[] }>('/api/groups'),
        apiFetch<{ plans: any[] }>('/api/plans').catch(() => ({ plans: [] })),
      ]);
      setGroups(grpRes.groups);
      setPlans(planRes.plans || []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const handleCountryChange = (code: string) => {
    setCountry(code);
    const found = COUNTRIES.find((c) => c.code === code);
    if (found) {
      setCurrency(found.defaultCurrency);
      setTimezone(found.defaultTimezone);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setMsg(null);
    try {
      const res = await apiFetch<{
        id: string;
        requiresPayment?: boolean;
        desiredPlanCode?: string;
      }>('/api/groups', {
        method: 'POST',
        body: JSON.stringify({
          name,
          type,
          description,
          country,
          currency,
          timezone,
          visibility,
          desiredPlanCode,
        }),
      });
      if (res.requiresPayment && res.desiredPlanCode && res.desiredPlanCode !== 'FREE') {
        navigate(`/app/abonnement?plan=${res.desiredPlanCode}&groupId=${res.id}`);
        return;
      }
      navigate(`/app/groups/${res.id}`);
    } catch (err: any) {
      setMsg({ type: 'err', text: err?.message || 'Création impossible.' });
    }
  };

  const handleJoinCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setMsg(null);
    try {
      const res = await apiFetch<{ groupId: string }>('/api/invitations/join-by-code', {
        method: 'POST',
        body: JSON.stringify({ code: joinCode }),
      });
      navigate(`/app/groups/${res.groupId}`);
    } catch (err: any) {
      setMsg({ type: 'err', text: err?.message || 'Code invalide.' });
    }
  };

  return (
    <AppShell
      title="Mes groupes KPATA"
      subtitle="Chaque groupe dispose de ses propres membres, dépenses, soldes et devises"
      actions={
        <button
          type="button"
          onClick={() => setShowCreate((v) => !v)}
          className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-gradient-to-r from-emerald-700 to-teal-700 rounded-xl hover:from-emerald-800 hover:to-teal-800 transition-all shadow-xs whitespace-nowrap"
        >
          <Plus className="w-4 h-4" />
          <span>{showCreate ? 'Fermer' : 'Créer un groupe'}</span>
        </button>
      }
    >
      <div className="space-y-6">
        {msg && (
          <div
            className={`p-3.5 rounded-xl text-sm border ${
              msg.type === 'ok'
                ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                : 'bg-red-50 border-red-200 text-red-800'
            }`}
          >
            {msg.text}
          </div>
        )}

        {showCreate && (
          <motion.form
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.22 }}
            onSubmit={handleCreate}
            className="bg-white border border-emerald-200 rounded-2xl p-6 space-y-4 shadow-sm"
          >
            <h2 className="font-display text-lg font-extrabold text-slate-900">
              Créer un nouveau groupe
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <label className="block space-y-1.5 text-sm">
                <span className="font-medium text-slate-700">Nom du groupe</span>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ex: Famille Houénou, Coloc Fidjrossè..."
                  className="w-full px-3.5 py-2 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-600"
                />
              </label>
              <label className="block space-y-1.5 text-sm">
                <span className="font-medium text-slate-700">Type de groupe</span>
                <select
                  value={type}
                  onChange={(e) => setType(e.target.value)}
                  className="w-full px-3.5 py-2 border border-slate-300 rounded-xl bg-white"
                >
                  {GROUP_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block space-y-1.5 text-sm">
                <span className="font-medium text-slate-700">Pays</span>
                <select
                  value={country}
                  onChange={(e) => handleCountryChange(e.target.value)}
                  className="w-full px-3.5 py-2 border border-slate-300 rounded-xl bg-white"
                >
                  {COUNTRIES.map((c) => (
                    <option key={c.code} value={c.code}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block space-y-1.5 text-sm">
                <span className="font-medium text-slate-700">Devise principale</span>
                <select
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value)}
                  className="w-full px-3.5 py-2 border border-slate-300 rounded-xl bg-white"
                >
                  {CURRENCIES.map((c) => (
                    <option key={c.code} value={c.code}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block space-y-1.5 text-sm">
                <span className="font-medium text-slate-700">Confidentialité</span>
                <select
                  value={visibility}
                  onChange={(e) => setVisibility(e.target.value)}
                  className="w-full px-3.5 py-2 border border-slate-300 rounded-xl bg-white"
                >
                  <option value="PRIVATE">Privé (sur invitation)</option>
                  <option value="LINK">Accessible par lien d’invitation</option>
                  <option value="PUBLIC">Communauté publique (finances privées)</option>
                </select>
              </label>
              <label className="block space-y-1.5 text-sm">
                <span className="font-medium text-slate-700">Fuseau horaire</span>
                <input
                  type="text"
                  value={timezone}
                  onChange={(e) => setTimezone(e.target.value)}
                  className="w-full px-3.5 py-2 border border-slate-300 rounded-xl font-mono text-xs"
                />
              </label>
            </div>
            <label className="block space-y-1.5 text-sm">
              <span className="font-medium text-slate-700">Description (facultatif)</span>
              <textarea
                rows={2}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full px-3.5 py-2 border border-slate-300 rounded-xl"
              />
            </label>

            <div className="space-y-2 pt-3 border-t border-slate-100">
              <span className="block text-sm font-semibold text-slate-800">
                Offre d’abonnement du groupe (3 formules)
              </span>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {(['FREE', 'PREMIUM', 'ORG'] as SubscriptionPlanCode[]).map((code) => {
                  const ent = PLAN_ENTITLEMENTS[code];
                  const dbPlan = plans.find((p) => p.code === code);
                  const price =
                    dbPlan?.monthlyPriceInt ?? (code === 'FREE' ? 0 : code === 'PREMIUM' ? 500 : 1000);
                  const active = desiredPlanCode === code;
                  return (
                    <button
                      key={code}
                      type="button"
                      onClick={() => setDesiredPlanCode(code)}
                      className={`text-left p-3.5 rounded-xl border transition-all ${
                        active
                          ? 'border-emerald-700 bg-emerald-50 ring-1 ring-emerald-600'
                          : 'border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-1">
                        <span className="font-bold text-xs text-slate-900">{ent.label}</span>
                        <span className="font-mono text-xs font-extrabold text-emerald-700">
                          {formatMoney(price, 'XOF')}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-600 mt-1">{ent.tagline}</p>
                    </button>
                  );
                })}
              </div>
              {desiredPlanCode !== 'FREE' && (
                <p className="text-xs text-amber-950 bg-amber-50 border border-amber-300 rounded-xl px-3.5 py-2.5 flex items-center gap-2">
                  <Lock className="w-3.5 h-3.5 text-amber-700 shrink-0" />
                  <span>
                    Le groupe sera créé puis vous serez dirigé vers le paiement avant activation de
                    l’offre {PLAN_ENTITLEMENTS[desiredPlanCode].label}.
                  </span>
                </p>
              )}
            </div>

            <button
              type="submit"
              className="px-5 py-2.5 text-sm font-semibold text-white bg-gradient-to-r from-emerald-700 to-teal-700 rounded-xl hover:from-emerald-800 hover:to-teal-800 transition-all shadow-xs"
            >
              {desiredPlanCode === 'FREE'
                ? 'Créer le groupe'
                : 'Créer le groupe et passer au paiement'}
            </button>
          </motion.form>
        )}

        {/* Join by code */}
        <form
          onSubmit={handleJoinCode}
          className="bg-white border border-slate-200 rounded-2xl p-4 flex flex-col sm:flex-row items-stretch sm:items-center gap-3 shadow-xs"
        >
          <span className="text-sm font-semibold text-slate-800 shrink-0">Rejoindre via un code :</span>
          <input
            type="text"
            value={joinCode}
            onChange={(e) => setJoinCode(e.target.value)}
            placeholder="Ex: KPT-A1B2C3"
            className="flex-1 px-3.5 py-2 text-sm border border-slate-300 rounded-xl font-mono focus:outline-none focus:ring-2 focus:ring-emerald-600"
          />
          <button
            type="submit"
            className="px-4 py-2 text-sm font-semibold text-emerald-900 bg-emerald-50 border border-emerald-200 rounded-xl hover:bg-emerald-100 whitespace-nowrap transition-colors"
          >
            Rejoindre
          </button>
        </form>

        {loading ? (
          <div className="h-40 rounded-2xl bg-white border border-slate-200 flex items-center justify-center text-sm text-slate-500">
            Chargement de vos groupes...
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {groups.map((g, idx) => (
              <motion.div
                key={g.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.22, delay: idx * 0.04 }}
                whileHover={{ y: -3 }}
                className="bg-white border border-slate-200 rounded-2xl p-6 hover:border-emerald-500 hover:shadow-md transition-all flex flex-col justify-between space-y-4"
              >
                <Link to={`/app/groups/${g.id}`} className="space-y-2 block">
                  <p className="text-xs font-semibold text-emerald-700">
                    {GROUP_TYPES.find((t) => t.value === g.type)?.label || g.type} ·{' '}
                    {GROUP_ROLE_LABELS[g.myRole as GroupRole] || g.myRole} · Plan {g.planCode}
                  </p>
                  <h3 className="font-display text-lg font-extrabold text-slate-900">{g.name}</h3>
                  {g.description && <p className="text-xs text-slate-600 line-clamp-2">{g.description}</p>}
                </Link>
                <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs gap-2">
                  <span className="flex items-center gap-1 text-slate-600 font-medium">
                    <Users className="w-3.5 h-3.5 text-emerald-700" />
                    <span className="font-mono font-bold text-slate-800">{g.membersCount}</span> membres
                  </span>
                  <div className="flex items-center gap-3">
                    {(g.myRole === 'OWNER' || g.myRole === 'ADMIN') && g.planCode === 'FREE' && (
                      <Link
                        to={`/app/abonnement?plan=PREMIUM&groupId=${g.id}`}
                        className="inline-flex items-center gap-1 text-amber-700 font-bold hover:underline"
                      >
                        <CreditCard className="w-3 h-3" />
                        <span>Offres</span>
                      </Link>
                    )}
                    <span className="font-mono font-bold text-slate-900 tabular-nums">
                      {formatMoney(g.totalExpensesInt, g.currency)}
                    </span>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}

export function InvitationsPage() {
  const { navigate } = useRouter();
  const { refreshUser } = useAuth();
  const [invitations, setInvitations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const res = await apiFetch<{ invitations: any[] }>('/api/invitations');
      setInvitations(res.invitations);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const act = async (token: string, action: 'accept' | 'reject') => {
    const res = await apiFetch<{ groupId?: string }>(`/api/invitations/${token}/${action}`, {
      method: 'POST',
    });
    await refreshUser();
    if (action === 'accept' && res.groupId) {
      navigate(`/app/groups/${res.groupId}`);
    } else {
      load();
    }
  };

  return (
    <AppShell title="Invitations reçues" subtitle="Acceptez ou refusez les invitations aux groupes KPATA">
      {loading ? (
        <div className="h-32 bg-white border border-slate-200 rounded-2xl flex items-center justify-center text-sm text-slate-500">
          Chargement des invitations...
        </div>
      ) : invitations.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-2xl p-8 text-center text-sm text-slate-600 shadow-xs">
          Aucune invitation en attente pour votre adresse e-mail.
        </div>
      ) : (
        <div className="space-y-3">
          {invitations.map((inv) => (
            <div
              key={inv.id}
              className="bg-white border border-slate-200 rounded-2xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-xs"
            >
              <div>
                <p className="font-display font-bold text-slate-900">{inv.groupName}</p>
                <p className="text-xs text-slate-500">
                  Rôle proposé : {GROUP_ROLE_LABELS[inv.role as GroupRole] || inv.role} · Code :{' '}
                  <span className="font-mono font-semibold">{inv.code}</span> · Statut : {inv.status}
                </p>
              </div>
              {inv.status === 'PENDING' && (
                <div className="flex gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => act(inv.token, 'accept')}
                    className="px-4 py-2 text-xs font-semibold text-white bg-emerald-700 rounded-xl hover:bg-emerald-800"
                  >
                    Accepter
                  </button>
                  <button
                    type="button"
                    onClick={() => act(inv.token, 'reject')}
                    className="px-4 py-2 text-xs font-medium text-slate-700 border border-slate-300 rounded-xl hover:bg-slate-50"
                  >
                    Refuser
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </AppShell>
  );
}

export function NotificationsPage() {
  const { refreshUser } = useAuth();
  const [notifications, setNotifications] = useState<any[]>([]);
  const [prefs, setPrefs] = useState({ inApp: true, email: true, pushWeb: false, sms: false, whatsapp: false });

  const load = async () => {
    const res = await apiFetch<{ notifications: any[]; preferences: any }>('/api/users/notifications');
    setNotifications(res.notifications);
    if (res.preferences) {
      setPrefs({
        inApp: Boolean(res.preferences.inApp),
        email: Boolean(res.preferences.email),
        pushWeb: Boolean(res.preferences.pushWeb),
        sms: Boolean(res.preferences.sms),
        whatsapp: Boolean(res.preferences.whatsapp),
      });
    }
  };

  useEffect(() => {
    load();
  }, []);

  const markRead = async (id: string) => {
    await apiFetch(`/api/users/notifications/${id}/read`, { method: 'POST' });
    await refreshUser();
    load();
  };

  const markAll = async () => {
    await apiFetch('/api/users/notifications/read-all', { method: 'POST' });
    await refreshUser();
    load();
  };

  const savePrefs = async (next: typeof prefs) => {
    setPrefs(next);
    await apiFetch('/api/users/notifications/preferences', {
      method: 'PUT',
      body: JSON.stringify(next),
    });
  };

  return (
    <AppShell
      title="Notifications & Préférences"
      subtitle="Suivez les alertes budgétaires, cotisations et demandes de confirmation"
      actions={
        <button
          type="button"
          onClick={markAll}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold border border-slate-300 bg-white rounded-xl hover:bg-slate-50"
        >
          <Check className="w-3.5 h-3.5 text-emerald-700" />
          <span>Tout marquer lu</span>
        </button>
      }
    >
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white border border-slate-200 rounded-2xl divide-y divide-slate-100 shadow-xs">
          {notifications.length === 0 ? (
            <p className="p-8 text-center text-sm text-slate-500">Aucune notification.</p>
          ) : (
            notifications.map((n) => (
              <div key={n.id} className="p-4 flex items-start justify-between gap-4">
                <div className="space-y-1">
                  <p className={`text-sm ${n.isRead ? 'text-slate-600' : 'font-bold text-slate-900'}`}>
                    {n.title}
                  </p>
                  <p className="text-xs text-slate-600">{n.body}</p>
                  <p className="text-[11px] font-mono text-slate-400">
                    {n.createdAt.slice(0, 16).replace('T', ' ')}
                  </p>
                </div>
                {!n.isRead && (
                  <button
                    type="button"
                    onClick={() => markRead(n.id)}
                    className="text-xs font-bold text-emerald-700 hover:underline shrink-0"
                  >
                    Marquer lu
                  </button>
                )}
              </div>
            ))
          )}
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-4 h-fit shadow-xs">
          <div className="flex items-center gap-2">
            <Bell className="w-4 h-4 text-emerald-700" />
            <h2 className="font-display font-bold text-slate-900 text-sm">Canaux de notification</h2>
          </div>
          <div className="space-y-2.5 text-sm">
            {[
              { key: 'inApp', label: 'Notifications internes KPATA' },
              { key: 'email', label: 'Alertes par e-mail' },
              { key: 'pushWeb', label: 'Push navigateur web' },
              { key: 'sms', label: 'Alertes SMS (selon disponibilité)' },
              { key: 'whatsapp', label: 'WhatsApp officiel (évolution)' },
            ].map((item) => (
              <label key={item.key} className="flex items-center justify-between gap-3 cursor-pointer">
                <span className="text-slate-700 text-xs">{item.label}</span>
                <input
                  type="checkbox"
                  checked={(prefs as any)[item.key]}
                  onChange={(e) => savePrefs({ ...prefs, [item.key]: e.target.checked })}
                  className="rounded border-slate-300 text-emerald-700 focus:ring-emerald-600"
                />
              </label>
            ))}
          </div>
        </div>
      </div>
    </AppShell>
  );
}

export function AccountPage() {
  const { user, refreshUser } = useAuth();
  const [firstName, setFirstName] = useState(user?.firstName || '');
  const [lastName, setLastName] = useState(user?.lastName || '');
  const [phone, setPhone] = useState(user?.phone || '');
  const [preferredLang, setPreferredLang] = useState(user?.preferredLang || 'fr');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [sessions, setSessions] = useState<any[]>([]);
  const [msg, setMsg] = useState('');

  const loadSessions = async () => {
    const res = await apiFetch<{ sessions: any[] }>('/api/auth/sessions');
    setSessions(res.sessions);
  };

  useEffect(() => {
    loadSessions();
  }, []);

  const saveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    await apiFetch('/api/auth/profile', {
      method: 'PUT',
      body: JSON.stringify({ firstName, lastName, phone, preferredLang }),
    });
    await refreshUser();
    setMsg('Profil mis à jour.');
  };

  const changePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    await apiFetch('/api/auth/change-password', {
      method: 'POST',
      body: JSON.stringify({ currentPassword, newPassword }),
    });
    setCurrentPassword('');
    setNewPassword('');
    setMsg('Mot de passe modifié.');
  };

  const revokeSession = async (id: string) => {
    await apiFetch(`/api/auth/sessions/${id}`, { method: 'DELETE' });
    loadSessions();
  };

  return (
    <AppShell title="Mon compte & Sécurité" subtitle="Profil utilisateur, mot de passe et gestion des sessions actives">
      <div className="space-y-6 max-w-3xl">
        {(user?.role === 'ADMIN' || user?.role === 'SUPER_ADMIN') && (
          <div className="p-4 rounded-2xl bg-gradient-to-r from-[#042F24] to-[#064E3B] text-white flex items-center justify-between gap-4">
            <div className="flex items-center gap-2.5 text-sm">
              <ShieldCheck className="w-5 h-5 text-amber-300 shrink-0" />
              <span>Vous disposez des droits Administrateur Principal ({user.role}).</span>
            </div>
            <Link
              to="/admin"
              className="px-3.5 py-2 text-xs font-bold text-slate-950 bg-amber-400 rounded-xl hover:bg-amber-300 shrink-0"
            >
              Ouvrir /admin
            </Link>
          </div>
        )}

        {msg && (
          <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-sm text-emerald-900">
            {msg}
          </div>
        )}

        <form onSubmit={saveProfile} className="bg-white border border-slate-200 rounded-2xl p-6 space-y-4 shadow-xs">
          <h2 className="font-display font-bold text-slate-900">Informations personnelles</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <label className="block space-y-1.5 text-sm">
              <span className="font-medium text-slate-700">Prénom</span>
              <input
                type="text"
                required
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                className="w-full px-3.5 py-2 border border-slate-300 rounded-xl"
              />
            </label>
            <label className="block space-y-1.5 text-sm">
              <span className="font-medium text-slate-700">Nom</span>
              <input
                type="text"
                required
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                className="w-full px-3.5 py-2 border border-slate-300 rounded-xl"
              />
            </label>
            <label className="block space-y-1.5 text-sm">
              <span className="font-medium text-slate-700">Téléphone</span>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full px-3.5 py-2 border border-slate-300 rounded-xl"
              />
            </label>
            <label className="block space-y-1.5 text-sm">
              <span className="font-medium text-slate-700">Langue de l’interface</span>
              <select
                value={preferredLang}
                onChange={(e) => setPreferredLang(e.target.value)}
                className="w-full px-3.5 py-2 border border-slate-300 rounded-xl bg-white"
              >
                <option value="fr">Français</option>
                <option value="en">English (architecture prête)</option>
              </select>
            </label>
          </div>
          <button
            type="submit"
            className="px-4 py-2 text-sm font-semibold text-white bg-emerald-700 rounded-xl hover:bg-emerald-800"
          >
            Enregistrer le profil
          </button>
        </form>

        <form onSubmit={changePassword} className="bg-white border border-slate-200 rounded-2xl p-6 space-y-4 shadow-xs">
          <h2 className="font-display font-bold text-slate-900">Modifier le mot de passe</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <label className="block space-y-1.5 text-sm">
              <span className="font-medium text-slate-700">Mot de passe actuel</span>
              <PasswordInput
                required
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                className="w-full px-3.5 py-2 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-600"
              />
            </label>
            <label className="block space-y-1.5 text-sm">
              <span className="font-medium text-slate-700">Nouveau mot de passe</span>
              <PasswordInput
                required
                minLength={8}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full px-3.5 py-2 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-600"
              />
            </label>
          </div>
          <button
            type="submit"
            className="px-4 py-2 text-sm font-semibold text-slate-800 border border-slate-300 rounded-xl hover:bg-slate-50"
          >
            Mettre à jour le mot de passe
          </button>
        </form>

        <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-4 shadow-xs">
          <div className="flex items-center justify-between">
            <h2 className="font-display font-bold text-slate-900">Sessions actives</h2>
            <button type="button" onClick={loadSessions} className="text-xs text-slate-600 flex items-center gap-1">
              <RefreshCw className="w-3.5 h-3.5" /> Actualiser
            </button>
          </div>
          <div className="divide-y divide-slate-100">
            {sessions.map((s) => (
              <div key={s.id} className="py-2.5 flex items-center justify-between gap-4 text-xs">
                <div className="min-w-0">
                  <p className="font-medium text-slate-800 truncate">
                    {s.current ? 'Session actuelle · ' : ''}
                    {s.userAgent || 'Navigateur'}
                  </p>
                  <p className="font-mono text-slate-400">Expire : {s.expiresAt.slice(0, 10)}</p>
                </div>
                {!s.current && (
                  <button
                    type="button"
                    onClick={() => revokeSession(s.id)}
                    className="text-rose-700 hover:underline flex items-center gap-1 shrink-0"
                  >
                    <Trash2 className="w-3.5 h-3.5" /> Révoquer
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </AppShell>
  );
}
