import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { motion } from 'motion/react';
import {
  AlertTriangle,
  CheckCircle2,
  Download,
  FileSpreadsheet,
  FileText,
  Lock,
  Paperclip,
  Plus,
  Send,
  ShieldAlert,
  UserPlus,
  XCircle,
} from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { AppShell } from '../components/AppShell';
import { apiFetch, openProtectedDocument } from '../lib/api';
import { Link } from '../lib/router';
import { exportGroupReportExcel, exportGroupReportPdf } from '../lib/exports';
import { calculateShares } from '../shared/finance';
import {
  formatMoney,
  getEffectiveEntitlements,
  GROUP_ROLE_LABELS,
  GROUP_TYPES,
  PLAN_ENTITLEMENTS,
  SPLIT_METHOD_LABELS,
  type GroupRole,
  type PlanEntitlements,
  type SplitMethod,
  type SubscriptionPlanCode,
} from '../shared/types';

type TabKey =
  | 'overview'
  | 'expenses'
  | 'contributions'
  | 'settlements'
  | 'budgets'
  | 'members'
  | 'reports';

export function GroupWorkspacePage({ groupId }: { groupId: string }) {
  const [tab, setTab] = useState<TabKey>('overview');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [feedback, setFeedback] = useState('');

  // Core group state
  const [group, setGroup] = useState<any>(null);
  const [myMembership, setMyMembership] = useState<any>(null);
  const [members, setMembers] = useState<any[]>([]);
  const [invitations, setInvitations] = useState<any[]>([]);
  const [linkRequests, setLinkRequests] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [expenses, setExpenses] = useState<any[]>([]);
  const [balances, setBalances] = useState<any[]>([]);
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [settlements, setSettlements] = useState<any[]>([]);
  const [contribPlans, setContribPlans] = useState<any[]>([]);
  const [budgets, setBudgets] = useState<any[]>([]);
  const [savingsGoals, setSavingsGoals] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [subInfo, setSubInfo] = useState<any>(null);
  const [entitlements, setEntitlements] = useState<PlanEntitlements>(PLAN_ENTITLEMENTS.FREE);

  const loadAll = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [gRes, catRes, expRes, balRes, stlRes, ctrRes, bdgRes, savRes, stRes, subRes] =
        await Promise.all([
          apiFetch(`/api/groups/${groupId}`),
          apiFetch(`/api/groups/${groupId}/categories`),
          apiFetch(`/api/groups/${groupId}/expenses`),
          apiFetch(`/api/groups/${groupId}/balances`),
          apiFetch(`/api/groups/${groupId}/settlements`),
          apiFetch(`/api/groups/${groupId}/contributions`),
          apiFetch(`/api/groups/${groupId}/budgets`),
          apiFetch(`/api/groups/${groupId}/savings-goals`),
          apiFetch(`/api/groups/${groupId}/statistics`),
          apiFetch(`/api/groups/${groupId}/subscription`),
        ]);

      setGroup(gRes.group);
      setEntitlements(
        gRes.entitlements ||
          getEffectiveEntitlements(gRes.group?.planCode, gRes.group?.subscriptionStatus)
      );
      setMyMembership(gRes.myMembership);
      setMembers(gRes.members);
      setInvitations(gRes.invitations || []);
      setLinkRequests(gRes.linkRequests || []);
      setCategories(catRes.categories);
      setExpenses(expRes.expenses);
      setBalances(balRes.balances);
      setSuggestions(balRes.suggestions);
      setSettlements(stlRes.settlements);
      setContribPlans(ctrRes.plans);
      setBudgets(bdgRes.budgets);
      setSavingsGoals(savRes.goals);
      setStats(stRes);
      setSubInfo(subRes);
    } catch (err: any) {
      setError(err?.message || 'Impossible de charger ce groupe.');
    } finally {
      setLoading(false);
    }
  }, [groupId]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  // Verify FedaPay return query param if redirected back
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const paymentTx = params.get('payment_tx');
    if (paymentTx) {
      apiFetch('/api/payments/fedapay/verify', {
        method: 'POST',
        body: JSON.stringify({ transactionId: paymentTx }),
      })
        .then((r) => {
          setFeedback(
            r.verified
              ? 'Paiement FedaPay vérifié côté serveur : abonnement activé !'
              : `Statut du paiement vérifié : ${r.status}`
          );
          loadAll();
        })
        .catch(() => {});
    }
  }, [loadAll]);

  const currency = group?.currency || 'XOF';
  const perms = myMembership?.permissions || {};
  const activeMembers = useMemo(() => members.filter((m) => m.status === 'ACTIVE'), [members]);

  if (loading && !group) {
    return (
      <AppShell title="Chargement du groupe...">
        <div className="h-48 rounded-xl bg-white border border-slate-200 animate-pulse" />
      </AppShell>
    );
  }

  if (error && !group) {
    return (
      <AppShell title="Accès groupe">
        <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-sm text-red-800">{error}</div>
      </AppShell>
    );
  }

  const tabs: { key: TabKey; label: string }[] = [
    { key: 'overview', label: 'Synthèse & Soldes' },
    { key: 'expenses', label: `Dépenses (${expenses.length})` },
    { key: 'contributions', label: 'Cotisations' },
    { key: 'settlements', label: 'Remboursements' },
    { key: 'budgets', label: 'Budgets & Objectifs' },
    { key: 'members', label: `Membres (${activeMembers.length})` },
    { key: 'reports', label: 'Rapports & Abonnement' },
  ];

  return (
    <AppShell
      title={group?.name || 'Groupe'}
      subtitle={`${GROUP_TYPES.find((t) => t.value === group?.type)?.label || group?.type} · Devise : ${currency} · Mon rôle : ${GROUP_ROLE_LABELS[myMembership?.role as GroupRole] || myMembership?.role} · Plan ${group?.planCode}`}
      actions={
        perms.canCreateExpense ? (
          <button
            type="button"
            onClick={() => setTab('expenses')}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-emerald-700 rounded-lg hover:bg-emerald-800 whitespace-nowrap"
          >
            <Plus className="w-4 h-4" />
            <span>Ajouter une dépense</span>
          </button>
        ) : undefined
      }
    >
      <div className="space-y-6">
        {feedback && (
          <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-sm text-emerald-900 flex items-center justify-between gap-2">
            <span>{feedback}</span>
            <button type="button" onClick={() => setFeedback('')} className="text-xs font-semibold">
              Fermer
            </button>
          </div>
        )}

        {/* Segmented Tab Bar */}
        <div className="flex items-center gap-1 p-1.5 bg-white border border-stone-200 rounded-2xl overflow-x-auto">
          {tabs.map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => setTab(t.key)}
              className={`px-3.5 py-2 text-xs font-medium rounded-xl transition-colors whitespace-nowrap shrink-0 ${
                tab === t.key
                  ? 'bg-emerald-800 text-white font-semibold'
                  : 'text-stone-600 hover:bg-stone-100 hover:text-stone-950'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {tab === 'overview' && (
          <OverviewTab
            group={group}
            currency={currency}
            stats={stats}
            balances={balances}
            suggestions={suggestions}
            onDeclareSuggested={async (s) => {
              await apiFetch(`/api/groups/${groupId}/settlements`, {
                method: 'POST',
                body: JSON.stringify({
                  fromMemberId: s.fromMemberId,
                  toMemberId: s.toMemberId,
                  amountInt: s.amountInt,
                  settlementDate: new Date().toISOString().slice(0, 10),
                  paymentMethod: 'MTN_MOMO',
                  note: 'Règlement issu de la suggestion d’optimisation',
                }),
              });
              setFeedback('Remboursement déclaré en attente de confirmation par le créancier.');
              loadAll();
            }}
          />
        )}

        {tab === 'expenses' && (
          <ExpensesTab
            groupId={groupId}
            currency={currency}
            members={activeMembers}
            categories={categories}
            expenses={expenses}
            perms={perms}
            entitlements={entitlements}
            myMemberId={myMembership?.memberId}
            onSuccess={(m) => {
              setFeedback(m);
              loadAll();
            }}
          />
        )}

        {tab === 'contributions' && (
          <ContributionsTab
            groupId={groupId}
            currency={currency}
            plans={contribPlans}
            perms={perms}
            entitlements={entitlements}
            onSuccess={(m) => {
              setFeedback(m);
              loadAll();
            }}
          />
        )}

        {tab === 'settlements' && (
          <SettlementsTab
            groupId={groupId}
            currency={currency}
            members={activeMembers}
            settlements={settlements}
            myMemberId={myMembership?.memberId}
            perms={perms}
            onSuccess={(m) => {
              setFeedback(m);
              loadAll();
            }}
          />
        )}

        {tab === 'budgets' && (
          <BudgetsTab
            groupId={groupId}
            currency={currency}
            categories={categories}
            budgets={budgets}
            savingsGoals={savingsGoals}
            perms={perms}
            entitlements={entitlements}
            onSuccess={(m) => {
              setFeedback(m);
              loadAll();
            }}
          />
        )}

        {tab === 'members' && (
          <MembersTab
            groupId={groupId}
            members={members}
            invitations={invitations}
            linkRequests={linkRequests}
            perms={perms}
            entitlements={entitlements}
            onSuccess={(m) => {
              setFeedback(m);
              loadAll();
            }}
          />
        )}

        {tab === 'reports' && (
          <ReportsAndSubTab
            group={group}
            currency={currency}
            balances={balances}
            expenses={expenses}
            settlements={settlements}
            contribPlans={contribPlans}
            stats={stats}
            subInfo={subInfo}
            perms={perms}
            entitlements={entitlements}
            onSuccess={(m) => {
              setFeedback(m);
              loadAll();
            }}
          />
        )}
      </div>
    </AppShell>
  );
}

/* -------------------------------------------------------------------------- */
/* TAB 1: OVERVIEW & BALANCES                                                 */
/* -------------------------------------------------------------------------- */
function OverviewTab({
  group,
  currency,
  stats,
  balances,
  suggestions,
  onDeclareSuggested,
}: {
  group: any;
  currency: string;
  stats: any;
  balances: any[];
  suggestions: any[];
  onDeclareSuggested: (s: any) => Promise<void>;
}) {
  const chartColors = ['#047857', '#0f766e', '#0369a1', '#b45309', '#475569'];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-1">
          <p className="text-xs text-slate-500">Dépenses actives totales</p>
          <p className="font-mono text-xl font-bold text-slate-900 tabular-nums">
            {formatMoney(stats?.totalExpensesInt || 0, currency)}
          </p>
          <p className="text-xs text-slate-500">{stats?.activeExpensesCount || 0} opérations</p>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-1">
          <p className="text-xs text-slate-500">Dépenses du mois</p>
          <p className="font-mono text-xl font-bold text-slate-900 tabular-nums">
            {formatMoney(stats?.monthExpensesInt || 0, currency)}
          </p>
          <p className="text-xs text-slate-500">Mois en cours</p>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-1">
          <p className="text-xs text-slate-500">Cotisations confirmées</p>
          <p className="font-mono text-xl font-bold text-emerald-700 tabular-nums">
            {formatMoney(stats?.contributionConfirmedInt || 0, currency)}
          </p>
          <p className="text-xs text-slate-500">
            Restant : <span className="font-mono">{formatMoney(stats?.contributionRemainingInt || 0, currency)}</span>
          </p>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-1">
          <p className="text-xs text-slate-500">Remboursements confirmés</p>
          <p className="font-mono text-xl font-bold text-slate-900 tabular-nums">
            {formatMoney(stats?.settlementConfirmedInt || 0, currency)}
          </p>
          <p className="text-xs text-amber-700">
            En attente : <span className="font-mono">{formatMoney(stats?.settlementPendingInt || 0, currency)}</span>
          </p>
        </div>
      </div>

      {/* Balances Table */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
          <div>
            <h2 className="font-display font-bold text-slate-900">Soldes individuels du groupe</h2>
            <p className="text-xs text-slate-500">
              Solde net = Avances effectuées − Parts attribuées + Remboursements envoyés − Remboursements reçus
            </p>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-slate-50 text-xs text-slate-500 border-b border-slate-200">
              <tr>
                <th className="px-5 py-3 font-medium">Membre</th>
                <th className="px-5 py-3 font-medium text-right">Avances</th>
                <th className="px-5 py-3 font-medium text-right">Parts dues</th>
                <th className="px-5 py-3 font-medium text-right">Remb. confirmés</th>
                <th className="px-5 py-3 font-medium text-right">Solde net</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {balances.map((b) => (
                <tr key={b.memberId} className="hover:bg-slate-50">
                  <td className="px-5 py-3">
                    <span className="font-medium text-slate-900">{b.displayName}</span>
                    {b.isExternal && (
                      <span className="ml-2 text-xs text-slate-500">· Sans compte</span>
                    )}
                    {b.memberStatus !== 'ACTIVE' && (
                      <span className="ml-2 text-xs text-amber-700">· {b.memberStatus}</span>
                    )}
                  </td>
                  <td className="px-5 py-3 text-right font-mono tabular-nums text-slate-700">
                    {formatMoney(b.totalAdvancedInt, currency)}
                  </td>
                  <td className="px-5 py-3 text-right font-mono tabular-nums text-slate-700">
                    {formatMoney(b.totalShareInt, currency)}
                  </td>
                  <td className="px-5 py-3 text-right font-mono tabular-nums text-slate-500">
                    +{formatMoney(b.settlementsPaidInt, currency)} / -{formatMoney(b.settlementsReceivedInt, currency)}
                  </td>
                  <td
                    className={`px-5 py-3 text-right font-mono font-bold tabular-nums ${
                      b.netBalanceInt > 0
                        ? 'text-emerald-700'
                        : b.netBalanceInt < 0
                        ? 'text-red-700'
                        : 'text-slate-600'
                    }`}
                  >
                    {b.netBalanceInt > 0
                      ? `+${formatMoney(b.netBalanceInt, currency)} (à recevoir)`
                      : b.netBalanceInt < 0
                      ? `${formatMoney(b.netBalanceInt, currency)} (à payer)`
                      : formatMoney(0, currency)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Debt Optimizer + Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
          <div>
            <h2 className="font-display font-bold text-slate-900">
              Optimisation des remboursements
            </h2>
            <p className="text-xs text-slate-500">
              Propositions minimales pour solder le groupe sans modifier les historiques d’origine.
            </p>
          </div>
          {suggestions.length === 0 ? (
            <p className="text-sm text-emerald-700 font-medium">
              Tous les soldes du groupe sont actuellement équilibrés.
            </p>
          ) : (
            <div className="space-y-3">
              {suggestions.map((s, idx) => (
                <div
                  key={idx}
                  className="p-3.5 border border-slate-200 rounded-lg flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                >
                  <div className="text-sm">
                    <span className="font-semibold text-slate-900">{s.fromName}</span>
                    <span className="text-slate-500"> doit verser à </span>
                    <span className="font-semibold text-slate-900">{s.toName}</span>
                    <p className="font-mono font-bold text-emerald-700 tabular-nums mt-0.5">
                      {formatMoney(s.amountInt, currency)}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => onDeclareSuggested(s)}
                    className="px-3 py-1.5 text-xs font-semibold text-slate-800 border border-slate-300 rounded-lg hover:bg-slate-50 whitespace-nowrap"
                  >
                    Déclarer ce paiement
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
          <h2 className="font-display font-bold text-slate-900">Dépenses par catégorie</h2>
          {(stats?.byCategory || []).length === 0 ? (
            <p className="text-sm text-slate-500">Aucune donnée de catégorie disponible.</p>
          ) : (
            <div className="h-60 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={stats.byCategory} margin={{ top: 10, right: 10, left: 10, bottom: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="category" tick={{ fontSize: 11, fill: '#475569' }} />
                  <YAxis tick={{ fontSize: 11, fill: '#475569' }} />
                  <Tooltip
                    formatter={(value: any) => formatMoney(Number(value), currency)}
                  />
                  <Bar dataKey="totalInt" radius={[6, 6, 0, 0]}>
                    {stats.byCategory.map((_: any, index: number) => (
                      <Cell key={index} fill={chartColors[index % chartColors.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* TAB 2: EXPENSES (Multi-payers, 6 Split Methods, Attachments, Comments)     */
/* -------------------------------------------------------------------------- */
function ExpensesTab({
  groupId,
  currency,
  members,
  categories,
  expenses,
  perms,
  entitlements,
  myMemberId,
  onSuccess,
}: {
  groupId: string;
  currency: string;
  members: any[];
  categories: any[];
  expenses: any[];
  perms: any;
  entitlements: PlanEntitlements;
  myMemberId?: string;
  onSuccess: (msg: string) => void;
}) {
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [amountStr, setAmountStr] = useState('15000');
  const [expenseDate, setExpenseDate] = useState(new Date().toISOString().slice(0, 10));
  const [categoryId, setCategoryId] = useState(categories[0]?.id || '');
  const [scope, setScope] = useState<'COLLECTIVE' | 'PARTIAL' | 'PERSONAL'>('COLLECTIVE');
  const [splitMethod, setSplitMethod] = useState<SplitMethod>('EQUAL');
  const [allowPartialPayment, setAllowPartialPayment] = useState(false);
  const [isRecurring, setIsRecurring] = useState(false);
  const [recurrenceFreq, setRecurrenceFreq] = useState('MONTHLY');
  const [formError, setFormError] = useState('');

  // Payers state: map memberId -> amount string
  const [payerAmounts, setPayerAmounts] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {};
    if (myMemberId) initial[myMemberId] = '15000';
    else if (members[0]) initial[members[0].id] = '15000';
    return initial;
  });

  // Participants state
  const [includedIds, setIncludedIds] = useState<Record<string, boolean>>(() => {
    const init: Record<string, boolean> = {};
    members.forEach((m) => (init[m.id] = true));
    return init;
  });
  const [customValues, setCustomValues] = useState<Record<string, string>>({});
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [commentInputs, setCommentInputs] = useState<Record<string, string>>({});

  const amountInt = Math.max(0, Math.round(Number(amountStr) || 0));

  const livePreview = useMemo(() => {
    try {
      if (amountInt <= 0) return { ok: false, error: 'Montant positif requis', shares: [] };
      const parts = members
        .filter((m) => includedIds[m.id])
        .map((m) => {
          const val = Number(customValues[m.id] || 0);
          return {
            memberId: m.id,
            included: true,
            amountInt: Math.round(val),
            percentage: val,
            weight: val > 0 ? val : 1,
          };
        });
      const shares = calculateShares(amountInt, splitMethod, parts);
      return { ok: true, error: '', shares };
    } catch (err: any) {
      return { ok: false, error: err?.message || 'Répartition invalide', shares: [] };
    }
  }, [amountInt, splitMethod, members, includedIds, customValues]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    try {
      const payers = members
        .map((m) => ({
          memberId: m.id,
          amountPaidInt: Math.max(0, Math.round(Number(payerAmounts[m.id] || 0))),
        }))
        .filter((p) => p.amountPaidInt > 0);

      if (payers.length === 0 && !allowPartialPayment) {
        setFormError('Indiquez au moins un payeur et le montant avancé.');
        return;
      }

      const participants = members
        .filter((m) => includedIds[m.id])
        .map((m) => {
          const val = Number(customValues[m.id] || 0);
          return {
            memberId: m.id,
            included: true,
            amountInt: Math.round(val),
            percentage: val,
            weight: val > 0 ? val : 1,
          };
        });

      const created = await apiFetch<{ id: string }>(`/api/groups/${groupId}/expenses`, {
        method: 'POST',
        body: JSON.stringify({
          title,
          description,
          amountInt,
          expenseDate,
          categoryId: categoryId || null,
          scope,
          splitMethod,
          allowPartialPayment,
          isRecurring,
          recurrenceFreq: isRecurring ? recurrenceFreq : null,
          payers: payers.length > 0 ? payers : [{ memberId: members[0].id, amountPaidInt: 0 }],
          participants,
        }),
      });

      if (receiptFile) {
        const base64Data = await fileToBase64(receiptFile);
        await apiFetch(`/api/groups/${groupId}/documents`, {
          method: 'POST',
          body: JSON.stringify({
            entityType: 'EXPENSE',
            entityId: created.id,
            filename: receiptFile.name,
            mimeType: receiptFile.type,
            base64Data,
          }),
        });
      }

      setTitle('');
      setDescription('');
      setReceiptFile(null);
      setShowForm(false);
      onSuccess('Dépense enregistrée et soldes mis à jour.');
    } catch (err: any) {
      setFormError(err?.message || 'Erreur lors de l’enregistrement.');
    }
  };

  const handleCancelExpense = async (expenseId: string) => {
    await apiFetch(`/api/expenses/${expenseId}/cancel`, {
      method: 'POST',
      body: JSON.stringify({ reason: 'Annulation depuis l’espace groupe' }),
    });
    onSuccess('Dépense annulée avec conservation de la trace comptable.');
  };

  const handleAddComment = async (expenseId: string, isDispute = false) => {
    const content = (commentInputs[expenseId] || '').trim();
    if (!content) return;
    await apiFetch(`/api/expenses/${expenseId}/comments`, {
      method: 'POST',
      body: JSON.stringify({ content, isDispute }),
    });
    setCommentInputs((prev) => ({ ...prev, [expenseId]: '' }));
    onSuccess(isDispute ? 'Contestation signalée aux membres.' : 'Commentaire ajouté.');
  };

  return (
    <div className="space-y-6">
      {perms.canCreateExpense && (
        <div className="flex justify-end">
          <button
            type="button"
            onClick={() => setShowForm((v) => !v)}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-white bg-emerald-700 rounded-lg hover:bg-emerald-800"
          >
            <Plus className="w-4 h-4" />
            <span>{showForm ? 'Masquer le formulaire' : 'Nouvelle dépense'}</span>
          </button>
        </div>
      )}

      {showForm && (
        <form onSubmit={handleSubmit} className="bg-white border border-slate-200 rounded-xl p-6 space-y-5">
          <h2 className="font-display text-lg font-bold text-slate-900">
            Enregistrer une dépense (multi-payeurs & répartition exacte)
          </h2>
          {formError && (
            <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-800 flex flex-wrap items-center justify-between gap-2">
              <span>{formError}</span>
              <Link
                to={`/app/abonnement?plan=PREMIUM&groupId=${groupId}`}
                className="text-xs font-semibold text-emerald-800 underline"
              >
                Passer à une offre payante →
              </Link>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <label className="block space-y-1 text-sm sm:col-span-2">
              <span className="font-medium text-slate-700">Intitulé de la dépense</span>
              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Ex: Courses marché Dantokpa, Facture SBEE..."
                className="w-full px-3 py-2 border border-slate-300 rounded-lg"
              />
            </label>
            <label className="block space-y-1 text-sm">
              <span className="font-medium text-slate-700">Montant total ({currency})</span>
              <input
                type="number"
                required
                min={1}
                step={1}
                value={amountStr}
                onChange={(e) => setAmountStr(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono"
              />
            </label>
            <label className="block space-y-1 text-sm">
              <span className="font-medium text-slate-700">Date</span>
              <input
                type="date"
                required
                value={expenseDate}
                onChange={(e) => setExpenseDate(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg"
              />
            </label>
            <label className="block space-y-1 text-sm">
              <span className="font-medium text-slate-700">Catégorie</span>
              <select
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white"
              >
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="block space-y-1 text-sm">
              <span className="font-medium text-slate-700">Portée</span>
              <select
                value={scope}
                onChange={(e) => setScope(e.target.value as any)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white"
              >
                <option value="COLLECTIVE">Entièrement collective</option>
                <option value="PARTIAL">Partiellement collective</option>
                <option value="PERSONAL">Personnelle (dans le groupe)</option>
              </select>
            </label>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pt-2 border-t border-slate-100">
            {/* Payers Section */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-slate-900">1. Payeur(s) et montants avancés</h3>
                <label className="flex items-center gap-1.5 text-xs text-slate-600">
                  <input
                    type="checkbox"
                    checked={allowPartialPayment}
                    onChange={(e) => setAllowPartialPayment(e.target.checked)}
                  />
                  Paiement partiel autorisé
                </label>
              </div>
              <div className="space-y-2">
                {members.map((m) => (
                  <div key={m.id} className="flex items-center justify-between gap-3 text-sm">
                    <span className="text-slate-700 truncate">
                      {m.firstName} {m.lastName}
                      {m.isExternal ? ' (Externe)' : ''}
                    </span>
                    <input
                      type="number"
                      min={0}
                      step={1}
                      value={payerAmounts[m.id] || ''}
                      onChange={(e) =>
                        setPayerAmounts((prev) => ({ ...prev, [m.id]: e.target.value }))
                      }
                      placeholder="0"
                      className="w-32 px-2.5 py-1.5 text-right border border-slate-300 rounded-lg font-mono text-xs"
                    />
                  </div>
                ))}
              </div>
            </div>

            {/* Split Section */}
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-sm font-bold text-slate-900">2. Participants & Répartition</h3>
                <select
                  value={splitMethod}
                  onChange={(e) => setSplitMethod(e.target.value as SplitMethod)}
                  className="px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg bg-white"
                >
                  {(Object.keys(SPLIT_METHOD_LABELS) as SplitMethod[]).map((k) => {
                    const allowed = entitlements.allowedSplitMethods.includes(k);
                    return (
                      <option key={k} value={k} disabled={!allowed}>
                        {SPLIT_METHOD_LABELS[k]}
                        {!allowed ? ' (Premium+)' : ''}
                      </option>
                    );
                  })}
                </select>
              </div>
              {entitlements.allowedSplitMethods.length < 6 && (
                <p className="text-[11px] text-slate-500">
                  Offre {entitlements.label} : Équitable et Participation incluses.{' '}
                  <Link
                    to={`/app/abonnement?plan=PREMIUM&groupId=${groupId}`}
                    className="text-emerald-700 font-semibold hover:underline"
                  >
                    Débloquer les 6 méthodes (500 FCFA/mois) →
                  </Link>
                </p>
              )}

              <div className="space-y-2">
                {members.map((m) => {
                  const previewShare = livePreview.shares.find((s) => s.memberId === m.id);
                  return (
                    <div key={m.id} className="flex items-center justify-between gap-2 text-sm">
                      <label className="flex items-center gap-2 text-slate-700 min-w-0 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={Boolean(includedIds[m.id])}
                          onChange={(e) =>
                            setIncludedIds((prev) => ({ ...prev, [m.id]: e.target.checked }))
                          }
                        />
                        <span className="truncate">
                          {m.firstName} {m.lastName}
                        </span>
                      </label>
                      <div className="flex items-center gap-2 shrink-0">
                        {(splitMethod === 'CUSTOM' ||
                          splitMethod === 'FIXED' ||
                          splitMethod === 'PERCENTAGE' ||
                          splitMethod === 'WEIGHT') &&
                          includedIds[m.id] && (
                            <input
                              type="number"
                              step="any"
                              min={0}
                              value={customValues[m.id] || ''}
                              onChange={(e) =>
                                setCustomValues((prev) => ({ ...prev, [m.id]: e.target.value }))
                              }
                              placeholder={
                                splitMethod === 'PERCENTAGE'
                                  ? '%'
                                  : splitMethod === 'WEIGHT'
                                  ? 'Poids'
                                  : currency
                              }
                              className="w-24 px-2 py-1 text-right border border-slate-300 rounded font-mono text-xs"
                            />
                          )}
                        <span className="w-24 text-right font-mono text-xs font-semibold text-emerald-700 tabular-nums">
                          {previewShare ? formatMoney(previewShare.shareAmountInt, currency) : '—'}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
              {!livePreview.ok && (
                <p className="text-xs text-red-700">{livePreview.error}</p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-slate-100">
            <label className="block space-y-1 text-sm">
              <span className="font-medium text-slate-700">Justificatif (Image JPG/PNG/WebP ou PDF, max 5 Mo)</span>
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp,application/pdf"
                onChange={(e) => setReceiptFile(e.target.files?.[0] || null)}
                className="block w-full text-xs text-slate-600"
              />
            </label>
            <div className="flex flex-wrap items-center gap-4">
              <label
                className={`flex items-center gap-2 text-sm ${
                  entitlements.allowRecurringExpenses ? 'text-slate-700' : 'text-slate-400'
                }`}
              >
                <input
                  type="checkbox"
                  disabled={!entitlements.allowRecurringExpenses}
                  checked={isRecurring}
                  onChange={(e) => setIsRecurring(e.target.checked)}
                />
                <span>
                  Dépense récurrente
                  {!entitlements.allowRecurringExpenses ? ' (Offre Premium+)' : ''}
                </span>
              </label>
              {!entitlements.allowRecurringExpenses && (
                <Link
                  to={`/app/abonnement?plan=PREMIUM&groupId=${groupId}`}
                  className="text-xs font-semibold text-emerald-700 hover:underline"
                >
                  Activer par paiement →
                </Link>
              )}
              {isRecurring && entitlements.allowRecurringExpenses && (
                <select
                  value={recurrenceFreq}
                  onChange={(e) => setRecurrenceFreq(e.target.value)}
                  className="px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg bg-white"
                >
                  <option value="DAILY">Quotidienne</option>
                  <option value="WEEKLY">Hebdomadaire</option>
                  <option value="MONTHLY">Mensuelle</option>
                  <option value="QUARTERLY">Trimestrielle</option>
                  <option value="YEARLY">Annuelle</option>
                </select>
              )}
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="px-4 py-2 text-sm font-medium text-slate-700 border border-slate-300 rounded-lg"
            >
              Annuler
            </button>
            <button
              type="submit"
              className="px-5 py-2 text-sm font-semibold text-white bg-emerald-700 rounded-lg hover:bg-emerald-800"
            >
              Enregistrer la dépense
            </button>
          </div>
        </form>
      )}

      {/* Expenses List */}
      <div className="space-y-4">
        {expenses.length === 0 ? (
          <div className="bg-white border border-slate-200 rounded-xl p-8 text-center text-sm text-slate-500">
            Aucune dépense enregistrée pour ce groupe.
          </div>
        ) : (
          expenses.map((exp) => (
            <div
              key={exp.id}
              className={`bg-white border border-slate-200 rounded-xl p-5 space-y-3 ${
                exp.status === 'CANCELLED' ? 'opacity-65' : ''
              }`}
            >
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                <div className="space-y-1">
                  <p className="text-xs text-slate-500">
                    {exp.expenseDate} · {exp.categoryName || 'Non catégorisé'} ·{' '}
                    {SPLIT_METHOD_LABELS[exp.splitMethod as SplitMethod] || exp.splitMethod} ·{' '}
                    {exp.status === 'CANCELLED' ? 'Annulée' : exp.paymentStatus}
                    {exp.isRecurring ? ` · Récurrente (${exp.recurrenceFreq})` : ''}
                  </p>
                  <h3 className="font-display font-bold text-slate-900">{exp.title}</h3>
                  {exp.description && <p className="text-xs text-slate-600">{exp.description}</p>}
                </div>

                <div className="text-right shrink-0 space-y-1">
                  <p className="font-mono text-lg font-bold text-slate-900 tabular-nums">
                    {formatMoney(exp.amountInt, currency)}
                  </p>
                  {exp.status === 'ACTIVE' &&
                    (perms.canCancelExpense || exp.createdByMemberId === myMemberId) && (
                      <button
                        type="button"
                        onClick={() => handleCancelExpense(exp.id)}
                        className="text-xs text-red-700 hover:underline"
                      >
                        Annuler l’opération
                      </button>
                    )}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-slate-100 text-xs">
                <div>
                  <span className="font-semibold text-slate-700 block mb-1">Payeurs :</span>
                  <div className="space-y-0.5 text-slate-600">
                    {(exp.payers || []).map((p: any) => (
                      <p key={p.id}>
                        {p.memberName} :{' '}
                        <span className="font-mono font-semibold text-slate-900">
                          {formatMoney(p.amountPaidInt, currency)}
                        </span>
                      </p>
                    ))}
                  </div>
                </div>
                <div>
                  <span className="font-semibold text-slate-700 block mb-1">Parts attribuées :</span>
                  <div className="space-y-0.5 text-slate-600">
                    {(exp.shares || []).map((s: any) => (
                      <p key={s.id}>
                        {s.memberName} :{' '}
                        <span className="font-mono font-semibold text-slate-900">
                          {formatMoney(s.shareAmountInt, currency)}
                        </span>
                      </p>
                    ))}
                  </div>
                </div>
              </div>

              {(exp.documents || []).length > 0 && (
                <div className="flex flex-wrap gap-2 pt-2 border-t border-slate-100">
                  {exp.documents.map((doc: any) => (
                    <button
                      key={doc.id}
                      type="button"
                      onClick={() => openProtectedDocument(doc.id)}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-lg hover:bg-emerald-100"
                    >
                      <Paperclip className="w-3.5 h-3.5" />
                      <span>{doc.filename}</span>
                    </button>
                  ))}
                </div>
              )}

              {/* Comments & Disputes */}
              <div className="pt-2 border-t border-slate-100 space-y-2">
                {(exp.comments || []).map((c: any) => (
                  <div
                    key={c.id}
                    className={`text-xs px-3 py-2 rounded-lg ${
                      c.isDispute ? 'bg-amber-50 text-amber-900 border border-amber-200' : 'bg-slate-50 text-slate-700'
                    }`}
                  >
                    <span className="font-semibold">{c.memberName}</span>
                    {c.isDispute ? ' (Signalement) : ' : ' : '}
                    {c.content}
                  </div>
                ))}
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={commentInputs[exp.id] || ''}
                    onChange={(e) =>
                      setCommentInputs((prev) => ({ ...prev, [exp.id]: e.target.value }))
                    }
                    placeholder="Ajouter un commentaire ou signaler une erreur..."
                    className="flex-1 px-3 py-1.5 text-xs border border-slate-300 rounded-lg"
                  />
                  <button
                    type="button"
                    onClick={() => handleAddComment(exp.id, false)}
                    className="px-3 py-1.5 text-xs font-medium text-slate-700 border border-slate-300 rounded-lg hover:bg-slate-50"
                  >
                    <Send className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleAddComment(exp.id, true)}
                    title="Signaler une erreur sur cette dépense"
                    className="px-3 py-1.5 text-xs font-medium text-amber-800 border border-amber-300 rounded-lg hover:bg-amber-50"
                  >
                    <ShieldAlert className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* TAB 3: CONTRIBUTIONS & COTISATIONS (Expected vs Declared vs Confirmed)     */
/* -------------------------------------------------------------------------- */
function ContributionsTab({
  groupId,
  currency,
  plans,
  perms,
  entitlements,
  onSuccess,
}: {
  groupId: string;
  currency: string;
  plans: any[];
  perms: any;
  entitlements: PlanEntitlements;
  onSuccess: (msg: string) => void;
}) {
  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState('');
  const [objective, setObjective] = useState('');
  const [amountPerMemberInt, setAmountPerMemberInt] = useState('10000');
  const [frequency, setFrequency] = useState('ONCE');
  const [dueDate, setDueDate] = useState('');
  const [ctrError, setCtrError] = useState('');

  const [payDraft, setPayDraft] = useState<{
    contributionId: string;
    amountInt: string;
    paymentMethod: string;
    reference: string;
  } | null>(null);

  const reachedPlanLimit =
    entitlements.maxContributionPlans !== null && plans.length >= entitlements.maxContributionPlans;

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setCtrError('');
    try {
      await apiFetch(`/api/groups/${groupId}/contributions`, {
        method: 'POST',
        body: JSON.stringify({
          name,
          objective,
          amountPerMemberInt: Math.round(Number(amountPerMemberInt)),
          frequency,
          startDate: new Date().toISOString().slice(0, 10),
          dueDate: dueDate || null,
        }),
      });
      setName('');
      setObjective('');
      setShowCreate(false);
      onSuccess('Cotisation collective créée.');
    } catch (err: any) {
      setCtrError(err?.message || 'Création impossible.');
    }
  };

  const handleDeclarePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!payDraft) return;
    await apiFetch(`/api/contributions/${payDraft.contributionId}/payments`, {
      method: 'POST',
      body: JSON.stringify({
        amountInt: Math.round(Number(payDraft.amountInt)),
        paymentMethod: payDraft.paymentMethod,
        reference: payDraft.reference || null,
      }),
    });
    setPayDraft(null);
    onSuccess('Versement déclaré. Il reste en attente de confirmation par le trésorier.');
  };

  const confirmPayment = async (paymentId: string) => {
    await apiFetch(`/api/contributions/payments/${paymentId}/confirm`, { method: 'POST' });
    onSuccess('Versement de cotisation confirmé.');
  };

  const disputePayment = async (paymentId: string) => {
    await apiFetch(`/api/contributions/payments/${paymentId}/dispute`, {
      method: 'POST',
      body: JSON.stringify({ reason: 'Référence non retrouvée par le trésorier' }),
    });
    onSuccess('Versement marqué comme contesté.');
  };

  return (
    <div className="space-y-6">
      {perms.canManageContributions && (
        <div className="flex flex-wrap items-center justify-between gap-3">
          {reachedPlanLimit ? (
            <div className="text-xs text-amber-900 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 flex items-center gap-2">
              <Lock className="w-3.5 h-3.5 shrink-0" />
              <span>
                Quota atteint ({plans.length}/{entitlements.maxContributionPlans}) sur l’offre{' '}
                {entitlements.label}.
              </span>
              <Link
                to={`/app/abonnement?plan=ORG&groupId=${groupId}`}
                className="font-semibold text-emerald-800 underline"
              >
                Passer à Association / Premium →
              </Link>
            </div>
          ) : (
            <span />
          )}
          <button
            type="button"
            onClick={() => setShowCreate((v) => !v)}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-white bg-emerald-700 rounded-lg hover:bg-emerald-800"
          >
            <Plus className="w-4 h-4" />
            <span>{showCreate ? 'Fermer' : 'Nouvelle cotisation'}</span>
          </button>
        </div>
      )}

      {showCreate && (
        <form onSubmit={handleCreate} className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
          <h2 className="font-display font-bold text-slate-900">Créer une cotisation collective</h2>
          {ctrError && (
            <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-red-800 flex items-center justify-between gap-2">
              <span>{ctrError}</span>
              <Link to={`/app/abonnement?plan=ORG&groupId=${groupId}`} className="font-semibold underline">
                Souscrire →
              </Link>
            </div>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <label className="block space-y-1 text-sm">
              <span className="font-medium text-slate-700">Nom de la cotisation</span>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ex: Cotisation mensuelle, Fonds d'urgence..."
                className="w-full px-3 py-2 border border-slate-300 rounded-lg"
              />
            </label>
            <label className="block space-y-1 text-sm">
              <span className="font-medium text-slate-700">Montant attendu par membre ({currency})</span>
              <input
                type="number"
                required
                min={1}
                value={amountPerMemberInt}
                onChange={(e) => setAmountPerMemberInt(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono"
              />
            </label>
            <label className="block space-y-1 text-sm">
              <span className="font-medium text-slate-700">Fréquence</span>
              <select
                value={frequency}
                onChange={(e) => setFrequency(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white"
              >
                <option value="ONCE">Ponctuelle</option>
                <option value="WEEKLY" disabled={!entitlements.allowRecurringContributions}>
                  Hebdomadaire {!entitlements.allowRecurringContributions ? '(Premium+)' : ''}
                </option>
                <option value="MONTHLY" disabled={!entitlements.allowRecurringContributions}>
                  Mensuelle {!entitlements.allowRecurringContributions ? '(Premium+)' : ''}
                </option>
                <option value="QUARTERLY" disabled={!entitlements.allowRecurringContributions}>
                  Trimestrielle {!entitlements.allowRecurringContributions ? '(Premium+)' : ''}
                </option>
                <option value="YEARLY" disabled={!entitlements.allowRecurringContributions}>
                  Annuelle {!entitlements.allowRecurringContributions ? '(Premium+)' : ''}
                </option>
              </select>
            </label>
            <label className="block space-y-1 text-sm">
              <span className="font-medium text-slate-700">Date limite (facultatif)</span>
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg"
              />
            </label>
          </div>
          <label className="block space-y-1 text-sm">
            <span className="font-medium text-slate-700">Objectif</span>
            <input
              type="text"
              value={objective}
              onChange={(e) => setObjective(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg"
            />
          </label>
          <button
            type="submit"
            className="px-5 py-2 text-sm font-semibold text-white bg-emerald-700 rounded-lg"
          >
            Créer la cotisation
          </button>
        </form>
      )}

      {payDraft && (
        <form onSubmit={handleDeclarePayment} className="bg-white border-2 border-emerald-700 rounded-xl p-5 space-y-4">
          <h3 className="font-display font-bold text-slate-900">
            Déclarer un versement de cotisation (partiel ou total)
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <label className="block space-y-1 text-sm">
              <span className="font-medium text-slate-700">Montant versé ({currency})</span>
              <input
                type="number"
                required
                min={1}
                value={payDraft.amountInt}
                onChange={(e) => setPayDraft({ ...payDraft, amountInt: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono"
              />
            </label>
            <label className="block space-y-1 text-sm">
              <span className="font-medium text-slate-700">Moyen de paiement</span>
              <select
                value={payDraft.paymentMethod}
                onChange={(e) => setPayDraft({ ...payDraft, paymentMethod: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white"
              >
                <option value="MTN_MOMO">MTN Mobile Money</option>
                <option value="MOOV_MONEY">Moov Money</option>
                <option value="CELTIIS">CELTIIS Cash</option>
                <option value="ESPECES">Espèces</option>
                <option value="VIREMENT">Virement</option>
              </select>
            </label>
            <label className="block space-y-1 text-sm">
              <span className="font-medium text-slate-700">Référence (facultatif)</span>
              <input
                type="text"
                value={payDraft.reference}
                onChange={(e) => setPayDraft({ ...payDraft, reference: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg"
              />
            </label>
          </div>
          <div className="flex gap-2">
            <button type="submit" className="px-4 py-2 text-xs font-semibold text-white bg-emerald-700 rounded-lg">
              Enregistrer la déclaration
            </button>
            <button
              type="button"
              onClick={() => setPayDraft(null)}
              className="px-4 py-2 text-xs text-slate-700 border border-slate-300 rounded-lg"
            >
              Annuler
            </button>
          </div>
        </form>
      )}

      {plans.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-xl p-8 text-center text-sm text-slate-500">
          Aucune cotisation active dans ce groupe.
        </div>
      ) : (
        plans.map((plan) => (
          <div key={plan.id} className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            <div className="p-5 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h3 className="font-display font-bold text-slate-900">{plan.name}</h3>
                <p className="text-xs text-slate-500">
                  {plan.objective || 'Cotisation du groupe'} · {plan.frequency}
                  {plan.dueDate ? ` · Échéance : ${plan.dueDate}` : ''}
                </p>
              </div>
              <p className="font-mono text-sm font-bold text-slate-900 tabular-nums">
                Objectif : {formatMoney(plan.targetAmountInt, currency)}
              </p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="bg-slate-50 text-xs text-slate-500 border-b border-slate-200">
                  <tr>
                    <th className="px-5 py-3 font-medium">Membre</th>
                    <th className="px-5 py-3 font-medium text-right">Attendu</th>
                    <th className="px-5 py-3 font-medium text-right">Déclaré</th>
                    <th className="px-5 py-3 font-medium text-right">Confirmé</th>
                    <th className="px-5 py-3 font-medium text-right">Restant</th>
                    <th className="px-5 py-3 font-medium text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {plan.items.map((item: any) => (
                    <React.Fragment key={item.id}>
                      <tr>
                        <td className="px-5 py-3 font-medium text-slate-900">
                          {item.memberName}
                          {item.isExternal ? ' (Externe)' : ''}
                        </td>
                        <td className="px-5 py-3 text-right font-mono tabular-nums">
                          {formatMoney(item.expectedAmountInt, currency)}
                        </td>
                        <td className="px-5 py-3 text-right font-mono tabular-nums text-amber-700">
                          {formatMoney(item.declaredInt, currency)}
                        </td>
                        <td className="px-5 py-3 text-right font-mono tabular-nums text-emerald-700 font-semibold">
                          {formatMoney(item.confirmedInt, currency)}
                        </td>
                        <td className="px-5 py-3 text-right font-mono tabular-nums text-slate-900">
                          {formatMoney(item.remainingInt, currency)}
                        </td>
                        <td className="px-5 py-3 text-right">
                          {item.remainingInt > 0 && (
                            <button
                              type="button"
                              onClick={() =>
                                setPayDraft({
                                  contributionId: item.id,
                                  amountInt: String(item.remainingInt),
                                  paymentMethod: 'MTN_MOMO',
                                  reference: '',
                                })
                              }
                              className="text-xs font-semibold text-emerald-700 hover:underline"
                            >
                              Déclarer versement
                            </button>
                          )}
                        </td>
                      </tr>
                      {(item.payments || []).map((pmt: any) => (
                        <tr key={pmt.id} className="bg-slate-50/70 text-xs">
                          <td colSpan={4} className="px-8 py-2 text-slate-600">
                            Versement {pmt.paymentMethod} {pmt.reference ? `(${pmt.reference})` : ''} :{' '}
                            <span className="font-mono font-semibold text-slate-900">
                              {formatMoney(pmt.amountInt, currency)}
                            </span>{' '}
                            · Statut :{' '}
                            <span
                              className={
                                pmt.status === 'CONFIRMED'
                                  ? 'text-emerald-700 font-semibold'
                                  : pmt.status === 'DISPUTED'
                                  ? 'text-red-700 font-semibold'
                                  : 'text-amber-700 font-semibold'
                              }
                            >
                              {pmt.status}
                            </span>
                          </td>
                          <td colSpan={2} className="px-5 py-2 text-right space-x-2">
                            {perms.canConfirmPayments && pmt.status === 'DECLARED' && (
                              <>
                                <button
                                  type="button"
                                  onClick={() => confirmPayment(pmt.id)}
                                  className="text-emerald-700 font-semibold hover:underline"
                                >
                                  Confirmer
                                </button>
                                <button
                                  type="button"
                                  onClick={() => disputePayment(pmt.id)}
                                  className="text-red-700 hover:underline"
                                >
                                  Contester
                                </button>
                              </>
                            )}
                          </td>
                        </tr>
                      ))}
                    </React.Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ))
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* TAB 4: SETTLEMENTS (Declare, Confirm, Dispute, Partial)                    */
/* -------------------------------------------------------------------------- */
function SettlementsTab({
  groupId,
  currency,
  members,
  settlements,
  myMemberId,
  perms,
  onSuccess,
}: {
  groupId: string;
  currency: string;
  members: any[];
  settlements: any[];
  myMemberId?: string;
  perms: any;
  onSuccess: (msg: string) => void;
}) {
  const [fromMemberId, setFromMemberId] = useState(myMemberId || members[0]?.id || '');
  const [toMemberId, setToMemberId] = useState(members[1]?.id || members[0]?.id || '');
  const [amountInt, setAmountInt] = useState('5000');
  const [paymentMethod, setPaymentMethod] = useState('MTN_MOMO');
  const [reference, setReference] = useState('');
  const [note, setNote] = useState('');
  const [err, setErr] = useState('');

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr('');
    try {
      await apiFetch(`/api/groups/${groupId}/settlements`, {
        method: 'POST',
        body: JSON.stringify({
          fromMemberId,
          toMemberId,
          amountInt: Math.round(Number(amountInt)),
          settlementDate: new Date().toISOString().slice(0, 10),
          paymentMethod,
          reference: reference || null,
          note: note || null,
        }),
      });
      setReference('');
      setNote('');
      onSuccess('Remboursement déclaré (en attente de confirmation par le bénéficiaire).');
    } catch (e: any) {
      setErr(e?.message || 'Erreur lors de la déclaration.');
    }
  };

  const act = async (id: string, action: 'confirm' | 'dispute' | 'cancel') => {
    await apiFetch(`/api/settlements/${id}/${action}`, {
      method: 'POST',
      body: action === 'dispute' ? JSON.stringify({ reason: 'Montant non reçu sur le compte' }) : undefined,
    });
    onSuccess(
      action === 'confirm'
        ? 'Remboursement confirmé et soldes actualisés.'
        : action === 'dispute'
        ? 'Remboursement contesté.'
        : 'Déclaration annulée.'
    );
  };

  return (
    <div className="space-y-6">
      {perms.canCreateExpense && (
        <form onSubmit={handleCreate} className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
          <h2 className="font-display font-bold text-slate-900">
            Déclarer un remboursement (total ou partiel)
          </h2>
          {err && <p className="text-sm text-red-700">{err}</p>}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <label className="block space-y-1 text-sm">
              <span className="font-medium text-slate-700">Qui paie (débiteur)</span>
              <select
                value={fromMemberId}
                onChange={(e) => setFromMemberId(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white"
              >
                {members.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.firstName} {m.lastName}
                  </option>
                ))}
              </select>
            </label>
            <label className="block space-y-1 text-sm">
              <span className="font-medium text-slate-700">Qui reçoit (créancier)</span>
              <select
                value={toMemberId}
                onChange={(e) => setToMemberId(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white"
              >
                {members.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.firstName} {m.lastName}
                  </option>
                ))}
              </select>
            </label>
            <label className="block space-y-1 text-sm">
              <span className="font-medium text-slate-700">Montant ({currency})</span>
              <input
                type="number"
                required
                min={1}
                value={amountInt}
                onChange={(e) => setAmountInt(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono"
              />
            </label>
            <label className="block space-y-1 text-sm">
              <span className="font-medium text-slate-700">Canal externe</span>
              <select
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white"
              >
                <option value="MTN_MOMO">MTN Mobile Money</option>
                <option value="MOOV_MONEY">Moov Money</option>
                <option value="CELTIIS">CELTIIS Cash</option>
                <option value="ESPECES">Espèces</option>
                <option value="VIREMENT">Virement bancaire</option>
              </select>
            </label>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <input
              type="text"
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              placeholder="Référence transaction (facultatif)"
              className="px-3 py-2 text-sm border border-slate-300 rounded-lg"
            />
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Note / commentaire (facultatif)"
              className="px-3 py-2 text-sm border border-slate-300 rounded-lg"
            />
          </div>
          <button
            type="submit"
            className="px-5 py-2 text-sm font-semibold text-white bg-emerald-700 rounded-lg hover:bg-emerald-800"
          >
            Déclarer le remboursement
          </button>
        </form>
      )}

      <div className="bg-white border border-slate-200 rounded-xl divide-y divide-slate-100">
        {settlements.length === 0 ? (
          <p className="p-8 text-center text-sm text-slate-500">Aucun remboursement enregistré.</p>
        ) : (
          settlements.map((s) => {
            const canValidate =
              (s.toMemberId === myMemberId || perms.canConfirmPayments) &&
              (s.status === 'PENDING' || s.status === 'DISPUTED');
            return (
              <div key={s.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="space-y-1">
                  <p className="text-sm font-medium text-slate-900">
                    {s.fromName} → {s.toName}{' '}
                    <span className="font-mono font-bold text-slate-900 ml-2">
                      {formatMoney(s.amountInt, currency)}
                    </span>
                  </p>
                  <p className="text-xs text-slate-500">
                    {s.settlementDate} · {s.paymentMethod}
                    {s.reference ? ` · Réf: ${s.reference}` : ''} · Statut :{' '}
                    <span
                      className={
                        s.status === 'CONFIRMED'
                          ? 'text-emerald-700 font-semibold'
                          : s.status === 'DISPUTED'
                          ? 'text-red-700 font-semibold'
                          : 'text-amber-700 font-semibold'
                      }
                    >
                      {s.status}
                    </span>
                  </p>
                  {s.disputeReason && <p className="text-xs text-red-700">Motif : {s.disputeReason}</p>}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {canValidate && (
                    <>
                      <button
                        type="button"
                        onClick={() => act(s.id, 'confirm')}
                        className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-white bg-emerald-700 rounded-lg hover:bg-emerald-800"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" /> Confirmer
                      </button>
                      <button
                        type="button"
                        onClick={() => act(s.id, 'dispute')}
                        className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-red-700 border border-red-200 rounded-lg hover:bg-red-50"
                      >
                        <XCircle className="w-3.5 h-3.5" /> Contester
                      </button>
                    </>
                  )}
                  {s.status === 'PENDING' && (
                    <button
                      type="button"
                      onClick={() => act(s.id, 'cancel')}
                      className="text-xs text-slate-500 hover:underline"
                    >
                      Annuler
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* TAB 5: BUDGETS & COLLECTIVE SAVINGS GOALS                                  */
/* -------------------------------------------------------------------------- */
function BudgetsTab({
  groupId,
  currency,
  categories,
  budgets,
  savingsGoals,
  perms,
  entitlements,
  onSuccess,
}: {
  groupId: string;
  currency: string;
  categories: any[];
  budgets: any[];
  savingsGoals: any[];
  perms: any;
  entitlements: PlanEntitlements;
  onSuccess: (msg: string) => void;
}) {
  const [bName, setBName] = useState('');
  const [bCat, setBCat] = useState(categories[0]?.id || '');
  const [bLimit, setBLimit] = useState('50000');
  const [budgetErr, setBudgetErr] = useState('');

  const [gTitle, setGTitle] = useState('');
  const [gTarget, setGTarget] = useState('300000');
  const [gContrib, setGContrib] = useState<Record<string, string>>({});

  const createBudget = async (e: React.FormEvent) => {
    e.preventDefault();
    setBudgetErr('');
    try {
      const now = new Date();
      const startDate = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}-01`;
      const endDate = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}-28`;
      await apiFetch(`/api/groups/${groupId}/budgets`, {
        method: 'POST',
        body: JSON.stringify({
          name: bName,
          categoryId: bCat || null,
          periodType: 'MONTHLY',
          startDate,
          endDate,
          limitAmountInt: Math.round(Number(bLimit)),
        }),
      });
      setBName('');
      onSuccess('Budget créé.');
    } catch (err: any) {
      setBudgetErr(err?.message || 'Création du budget impossible.');
    }
  };

  const createGoal = async (e: React.FormEvent) => {
    e.preventDefault();
    setBudgetErr('');
    try {
      await apiFetch(`/api/groups/${groupId}/savings-goals`, {
        method: 'POST',
        body: JSON.stringify({
          title: gTitle,
          targetAmountInt: Math.round(Number(gTarget)),
        }),
      });
      setGTitle('');
      onSuccess('Objectif d’épargne collective créé.');
    } catch (err: any) {
      setBudgetErr(err?.message || 'Création de l’objectif impossible.');
    }
  };

  const addGoalContrib = async (goalId: string) => {
    const amt = Math.round(Number(gContrib[goalId] || 0));
    if (amt <= 0) return;
    await apiFetch(`/api/savings-goals/${goalId}/contributions`, {
      method: 'POST',
      body: JSON.stringify({ amountInt: amt }),
    });
    setGContrib((prev) => ({ ...prev, [goalId]: '' }));
    onSuccess('Engagement d’épargne déclaré.');
  };

  const confirmGoalContrib = async (scId: string) => {
    await apiFetch(`/api/savings-contributions/${scId}/confirm`, { method: 'POST' });
    onSuccess('Contribution d’objectif confirmée.');
  };

  return (
    <div className="space-y-8">
      {budgetErr && (
        <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-red-800 flex items-center justify-between gap-2">
          <span>{budgetErr}</span>
          <Link to={`/app/abonnement?plan=PREMIUM&groupId=${groupId}`} className="font-semibold underline">
            Débloquer via paiement →
          </Link>
        </div>
      )}

      {/* Budgets */}
      <section className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-display text-lg font-bold text-slate-900">
            Budgets par catégorie et alertes
          </h2>
          {entitlements.maxBudgets !== null && (
            <span className="text-xs text-slate-500 font-mono">
              {budgets.length}/{entitlements.maxBudgets} budget(s) · Offre {entitlements.label}
            </span>
          )}
        </div>
        {perms.canManageBudgets && (
          <form onSubmit={createBudget} className="bg-white border border-slate-200 rounded-xl p-5 grid grid-cols-1 sm:grid-cols-4 gap-3 items-end">
            <label className="block space-y-1 text-xs">
              <span className="font-medium text-slate-700">Nom du budget</span>
              <input
                type="text"
                required
                value={bName}
                onChange={(e) => setBName(e.target.value)}
                placeholder="Ex: Eau SONEB"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
              />
            </label>
            <label className="block space-y-1 text-xs">
              <span className="font-medium text-slate-700">Catégorie</span>
              <select
                value={bCat}
                onChange={(e) => setBCat(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white text-sm"
              >
                <option value="">Toutes catégories</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="block space-y-1 text-xs">
              <span className="font-medium text-slate-700">Plafond ({currency})</span>
              <input
                type="number"
                required
                min={1}
                value={bLimit}
                onChange={(e) => setBLimit(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono text-sm"
              />
            </label>
            <button
              type="submit"
              className="px-4 py-2 text-sm font-semibold text-white bg-emerald-700 rounded-lg hover:bg-emerald-800"
            >
              Ajouter le budget
            </button>
          </form>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {budgets.map((b) => (
            <div key={b.id} className="bg-white border border-slate-200 rounded-xl p-5 space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h3 className="font-display font-bold text-slate-900">{b.name}</h3>
                  <p className="text-xs text-slate-500">
                    {b.categoryName || 'Global'} · {b.startDate} → {b.endDate}
                  </p>
                </div>
                {b.alertLevel !== 'OK' && (
                  <span
                    className={`inline-flex items-center gap-1 text-xs font-semibold ${
                      b.alertLevel === 'EXCEEDED' ? 'text-red-700' : 'text-amber-700'
                    }`}
                  >
                    <AlertTriangle className="w-3.5 h-3.5" />
                    {b.alertLevel === 'EXCEEDED' ? 'Dépassé' : `Seuil ${b.alertLevel}%`}
                  </span>
                )}
              </div>
              <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">
                <div
                  className={`h-full ${
                    b.percent > 100
                      ? 'bg-red-600'
                      : b.percent >= 75
                      ? 'bg-amber-600'
                      : 'bg-emerald-700'
                  }`}
                  style={{ width: `${Math.min(100, b.percent)}%` }}
                />
              </div>
              <div className="flex justify-between text-xs font-mono tabular-nums">
                <span className="text-slate-700">
                  Dépensé : {formatMoney(b.spentInt, currency)} ({b.percent}%)
                </span>
                <span className="text-slate-500">Plafond : {formatMoney(b.limitAmountInt, currency)}</span>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Collective Savings Goals */}
      <section className="space-y-4 pt-4 border-t border-slate-200">
        <div>
          <h2 className="font-display text-lg font-bold text-slate-900">
            Objectifs d’épargne collective
          </h2>
          <p className="text-xs text-slate-500">
            Suivi transparent des engagements entre membres. KPATA ne conserve pas les fonds.
          </p>
        </div>

        {!entitlements.allowSavingsGoals ? (
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-start gap-2.5 text-sm text-slate-700">
              <Lock className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" />
              <span>
                Les objectifs d’épargne collective sont inclus à partir de l’offre{' '}
                <strong>Premium Famille & Coloc (500 FCFA/mois)</strong>.
              </span>
            </div>
            <Link
              to={`/app/abonnement?plan=PREMIUM&groupId=${groupId}`}
              className="px-4 py-2 text-xs font-semibold text-white bg-emerald-700 rounded-lg hover:bg-emerald-800 whitespace-nowrap"
            >
              Activer par paiement →
            </Link>
          </div>
        ) : (
          perms.canManageBudgets && (
            <form onSubmit={createGoal} className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col sm:flex-row gap-3 items-end">
              <label className="flex-1 block space-y-1 text-xs">
                <span className="font-medium text-slate-700">Objectif collectif</span>
                <input
                  type="text"
                  required
                  value={gTitle}
                  onChange={(e) => setGTitle(e.target.value)}
                  placeholder="Ex: Achat équipement familial..."
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                />
              </label>
              <label className="w-full sm:w-48 block space-y-1 text-xs">
                <span className="font-medium text-slate-700">Cible ({currency})</span>
                <input
                  type="number"
                  required
                  min={1}
                  value={gTarget}
                  onChange={(e) => setGTarget(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono text-sm"
                />
              </label>
              <button
                type="submit"
                className="px-4 py-2 text-sm font-semibold text-white bg-emerald-700 rounded-lg"
              >
                Créer l’objectif
              </button>
            </form>
          )
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {savingsGoals.map((g) => (
            <div key={g.id} className="bg-white border border-slate-200 rounded-xl p-5 space-y-3">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-display font-bold text-slate-900">{g.title}</h3>
                  {g.description && <p className="text-xs text-slate-500">{g.description}</p>}
                </div>
                <span className="font-mono text-xs font-semibold text-emerald-700">{g.percent}%</span>
              </div>
              <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">
                <div className="h-full bg-emerald-700" style={{ width: `${g.percent}%` }} />
              </div>
              <p className="text-xs font-mono text-slate-700 tabular-nums">
                Confirmé : {formatMoney(g.confirmedInt, currency)} / {formatMoney(g.targetAmountInt, currency)}
              </p>
              <div className="flex gap-2">
                <input
                  type="number"
                  min={1}
                  value={gContrib[g.id] || ''}
                  onChange={(e) => setGContrib((p) => ({ ...p, [g.id]: e.target.value }))}
                  placeholder={`Montant (${currency})`}
                  className="flex-1 px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg font-mono"
                />
                <button
                  type="button"
                  onClick={() => addGoalContrib(g.id)}
                  className="px-3 py-1.5 text-xs font-semibold text-slate-800 border border-slate-300 rounded-lg hover:bg-slate-50"
                >
                  Déclarer apport
                </button>
              </div>
              {(g.contributions || []).slice(0, 4).map((c: any) => (
                <div key={c.id} className="flex items-center justify-between text-xs text-slate-600 pt-1 border-t border-slate-100">
                  <span>
                    {c.memberName} : <span className="font-mono">{formatMoney(c.amountInt, currency)}</span> ({c.status})
                  </span>
                  {perms.canConfirmPayments && c.status === 'DECLARED' && (
                    <button
                      type="button"
                      onClick={() => confirmGoalContrib(c.id)}
                      className="text-emerald-700 font-semibold hover:underline"
                    >
                      Confirmer
                    </button>
                  )}
                </div>
              ))}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* TAB 6: MEMBERS (External members, Roles, Invitations, Account Linking)     */
/* -------------------------------------------------------------------------- */
function MembersTab({
  groupId,
  members,
  invitations,
  linkRequests,
  perms,
  entitlements,
  onSuccess,
}: {
  groupId: string;
  members: any[];
  invitations: any[];
  linkRequests: any[];
  perms: any;
  entitlements: PlanEntitlements;
  onSuccess: (msg: string) => void;
}) {
  const [extFirst, setExtFirst] = useState('');
  const [extLast, setExtLast] = useState('');
  const [extPhone, setExtPhone] = useState('');
  const [extRelation, setExtRelation] = useState('');

  const [invEmail, setInvEmail] = useState('');
  const [invRole, setInvRole] = useState('MEMBER');
  const [memberErr, setMemberErr] = useState('');

  const activeCount = members.filter((m) => m.status === 'ACTIVE').length;
  const atMemberLimit = entitlements.maxMembers !== null && activeCount >= entitlements.maxMembers;

  const addExternal = async (e: React.FormEvent) => {
    e.preventDefault();
    setMemberErr('');
    try {
      await apiFetch(`/api/groups/${groupId}/members`, {
        method: 'POST',
        body: JSON.stringify({
          firstName: extFirst,
          lastName: extLast,
          phone: extPhone || null,
          familyRelation: extRelation || null,
        }),
      });
      setExtFirst('');
      setExtLast('');
      setExtPhone('');
      setExtRelation('');
      onSuccess('Membre sans compte KPATA ajouté au groupe.');
    } catch (err: any) {
      setMemberErr(err?.message || 'Ajout impossible.');
    }
  };

  const sendInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    setMemberErr('');
    try {
      const res = await apiFetch<{ code: string }>(`/api/groups/${groupId}/invitations`, {
        method: 'POST',
        body: JSON.stringify({ email: invEmail || null, role: invRole }),
      });
      setInvEmail('');
      onSuccess(`Invitation créée ! Code à partager : ${res.code}`);
    } catch (err: any) {
      setMemberErr(err?.message || 'Invitation impossible.');
    }
  };

  const updateMember = async (memberId: string, body: Record<string, string>) => {
    setMemberErr('');
    try {
      await apiFetch(`/api/groups/${groupId}/members/${memberId}`, {
        method: 'PUT',
        body: JSON.stringify(body),
      });
      onSuccess('Membre mis à jour (historique financier conservé).');
    } catch (err: any) {
      setMemberErr(err?.message || 'Mise à jour impossible.');
    }
  };

  const reviewLink = async (reqId: string, decision: 'APPROVE' | 'REJECT') => {
    await apiFetch(`/api/groups/${groupId}/link-requests/${reqId}/review`, {
      method: 'POST',
      body: JSON.stringify({ decision }),
    });
    onSuccess(decision === 'APPROVE' ? 'Compte rattaché au profil externe.' : 'Demande refusée.');
  };

  return (
    <div className="space-y-6">
      {memberErr && (
        <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-red-800 flex items-center justify-between gap-2">
          <span>{memberErr}</span>
          <Link to={`/app/abonnement?plan=ORG&groupId=${groupId}`} className="font-semibold underline">
            Passer à une offre supérieure →
          </Link>
        </div>
      )}

      {atMemberLimit && (
        <div className="p-3.5 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-900 flex flex-wrap items-center justify-between gap-2">
          <span>
            Limite de membres atteinte ({activeCount}/{entitlements.maxMembers}) sur l’offre{' '}
            <strong>{entitlements.label}</strong>.
          </span>
          <Link
            to={`/app/abonnement?plan=PREMIUM&groupId=${groupId}`}
            className="font-semibold text-emerald-800 underline"
          >
            Augmenter la capacité (Premium / Association) →
          </Link>
        </div>
      )}

      {perms.canManageMembers && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <form onSubmit={addExternal} className="bg-white border border-slate-200 rounded-xl p-5 space-y-3">
            <div className="flex items-center gap-2">
              <UserPlus className="w-4 h-4 text-emerald-700" />
              <h2 className="font-display font-bold text-slate-900 text-sm">
                Ajouter un membre sans compte KPATA
              </h2>
            </div>
            <p className="text-xs text-slate-500">
              Aucun faux compte n’est créé : le membre participe aux dépenses et pourra rattacher
              son profil ultérieurement.
            </p>
            <div className="grid grid-cols-2 gap-3">
              <input
                type="text"
                required
                value={extFirst}
                onChange={(e) => setExtFirst(e.target.value)}
                placeholder="Prénom"
                className="px-3 py-2 text-sm border border-slate-300 rounded-lg"
              />
              <input
                type="text"
                required
                value={extLast}
                onChange={(e) => setExtLast(e.target.value)}
                placeholder="Nom"
                className="px-3 py-2 text-sm border border-slate-300 rounded-lg"
              />
              <input
                type="tel"
                value={extPhone}
                onChange={(e) => setExtPhone(e.target.value)}
                placeholder="Téléphone (facultatif)"
                className="px-3 py-2 text-sm border border-slate-300 rounded-lg"
              />
              <input
                type="text"
                value={extRelation}
                onChange={(e) => setExtRelation(e.target.value)}
                placeholder="Lien (ex: Enfant, Parent)"
                className="px-3 py-2 text-sm border border-slate-300 rounded-lg"
              />
            </div>
            <button
              type="submit"
              className="px-4 py-2 text-xs font-semibold text-white bg-emerald-700 rounded-lg hover:bg-emerald-800"
            >
              Ajouter le membre externe
            </button>
          </form>

          {perms.canInvite && (
            <form onSubmit={sendInvite} className="bg-white border border-slate-200 rounded-xl p-5 space-y-3">
              <h2 className="font-display font-bold text-slate-900 text-sm">
                Inviter un utilisateur par e-mail ou code
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <input
                  type="email"
                  value={invEmail}
                  onChange={(e) => setInvEmail(e.target.value)}
                  placeholder="E-mail (facultatif pour code seul)"
                  className="px-3 py-2 text-sm border border-slate-300 rounded-lg"
                />
                <select
                  value={invRole}
                  onChange={(e) => setInvRole(e.target.value)}
                  className="px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white"
                >
                  <option value="MEMBER">Membre</option>
                  <option value="TREASURER" disabled={!entitlements.allowTreasurerRole}>
                    Trésorier {!entitlements.allowTreasurerRole ? '(Association+)' : ''}
                  </option>
                  <option value="ADMIN">Administrateur</option>
                  <option value="OBSERVER">Observateur</option>
                </select>
              </div>
              <button
                type="submit"
                className="px-4 py-2 text-xs font-semibold text-slate-800 border border-slate-300 rounded-lg hover:bg-slate-50"
              >
                Générer une invitation
              </button>
              {invitations.length > 0 && (
                <div className="pt-2 border-t border-slate-100 space-y-1 text-xs text-slate-600">
                  {invitations.slice(0, 4).map((inv) => (
                    <p key={inv.id}>
                      Code <span className="font-mono font-semibold text-slate-900">{inv.code}</span> ·{' '}
                      {inv.email || 'Lien/Code'} · {inv.status}
                    </p>
                  ))}
                </div>
              )}
            </form>
          )}
        </div>
      )}

      {linkRequests.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-5 space-y-3">
          <h3 className="font-display font-bold text-amber-950 text-sm">
            Demandes de rattachement de profils externes
          </h3>
          {linkRequests.map((lr) => (
            <div key={lr.id} className="flex items-center justify-between gap-4 text-xs">
              <span>
                <strong>{lr.userFirstName} {lr.userLastName}</strong> ({lr.userEmail}) demande à
                rattacher le profil externe « {lr.memberFirstName} {lr.memberLastName} »
              </span>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => reviewLink(lr.id, 'APPROVE')}
                  className="px-3 py-1 font-semibold bg-emerald-700 text-white rounded"
                >
                  Valider
                </button>
                <button
                  type="button"
                  onClick={() => reviewLink(lr.id, 'REJECT')}
                  className="px-3 py-1 bg-white border border-slate-300 rounded"
                >
                  Refuser
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="bg-white border border-slate-200 rounded-xl divide-y divide-slate-100">
        {members.map((m) => (
          <div key={m.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <p className="font-medium text-slate-900 text-sm">
                {m.firstName} {m.lastName}
                <span className="ml-2 text-xs text-slate-500">
                  · {m.isExternal ? 'Membre sans compte KPATA' : 'Compte KPATA vérifié'}
                  {m.familyRelation ? ` · ${m.familyRelation}` : ''}
                </span>
              </p>
              <p className="text-xs text-slate-500">
                Rôle : {GROUP_ROLE_LABELS[m.role as GroupRole] || m.role} · Statut : {m.status}
              </p>
            </div>

            {perms.canManageMembers && m.role !== 'OWNER' && (
              <div className="flex items-center gap-2">
                <select
                  aria-label={`Rôle de ${m.firstName}`}
                  value={m.role}
                  onChange={(e) => updateMember(m.id, { role: e.target.value })}
                  className="px-2.5 py-1 text-xs border border-slate-300 rounded-lg bg-white"
                >
                  <option value="ADMIN">Administrateur</option>
                  <option value="TREASURER" disabled={!entitlements.allowTreasurerRole}>
                    Trésorier {!entitlements.allowTreasurerRole ? '(Association+)' : ''}
                  </option>
                  <option value="MEMBER">Membre</option>
                  <option value="OBSERVER">Observateur</option>
                </select>
                {m.status === 'ACTIVE' ? (
                  <button
                    type="button"
                    onClick={() => updateMember(m.id, { status: 'LEFT' })}
                    className="text-xs text-red-700 hover:underline"
                  >
                    Retirer (garder historique)
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => updateMember(m.id, { status: 'ACTIVE' })}
                    className="text-xs text-emerald-700 hover:underline"
                  >
                    Réactiver
                  </button>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* TAB 7: REPORTS (PDF / EXCEL) & SUBSCRIPTION (FEDAPAY + MANUAL PILOT)       */
/* -------------------------------------------------------------------------- */
function ReportsAndSubTab({
  group,
  currency,
  balances,
  expenses,
  settlements,
  contribPlans,
  stats,
  subInfo,
  perms,
  entitlements,
  onSuccess,
}: {
  group: any;
  currency: string;
  balances: any[];
  expenses: any[];
  settlements: any[];
  contribPlans: any[];
  stats: any;
  subInfo: any;
  perms: any;
  entitlements: PlanEntitlements;
  onSuccess: (msg: string) => void;
}) {
  const [planCode, setPlanCode] = useState<'PREMIUM' | 'ORG'>('PREMIUM');
  const [months, setMonths] = useState(1);
  const [manualRef, setManualRef] = useState('');
  const [manualNote, setManualNote] = useState('');
  const [fedaMsg, setFedaMsg] = useState('');

  const unitPrice = planCode === 'PREMIUM' ? 500 : 1000;

  const handleFedaPayCheckout = async () => {
    setFedaMsg('');
    const res = await apiFetch<any>('/api/payments/fedapay/checkout', {
      method: 'POST',
      body: JSON.stringify({ groupId: group.id, planCode, months }),
    });
    if (!res.configured) {
      setFedaMsg(res.message);
      return;
    }
    if (res.paymentUrl) {
      window.location.href = res.paymentUrl;
    }
  };

  const handleManualRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    await apiFetch(`/api/groups/${group.id}/subscription/request`, {
      method: 'POST',
      body: JSON.stringify({ planCode, months, reference: manualRef, proofNote: manualNote }),
    });
    setManualRef('');
    setManualNote('');
    onSuccess('Demande d’abonnement soumise pour vérification manuelle par l’administrateur KPATA.');
  };

  const reportPayload = {
    groupName: group.name,
    currency,
    balances,
    expenses,
    settlements,
    contributions: contribPlans,
  };

  return (
    <div className="space-y-8">
      {/* Exports */}
      <section className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="font-display font-bold text-slate-900">Rapports financiers & Exports</h2>
            <p className="text-xs text-slate-500">
              Exportez les soldes, dépenses actives/annulées et remboursements confirmés/en attente.
            </p>
          </div>
          {perms.canExportReports && entitlements.allowExports ? (
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => exportGroupReportPdf(reportPayload)}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-slate-900 rounded-lg hover:bg-slate-800"
              >
                <FileText className="w-4 h-4" /> Export PDF
              </button>
              <button
                type="button"
                onClick={() => exportGroupReportExcel(reportPayload)}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-lg hover:bg-emerald-100"
              >
                <FileSpreadsheet className="w-4 h-4" /> Export Excel (.xlsx)
              </button>
            </div>
          ) : (
            <Link
              to={`/app/abonnement?plan=PREMIUM&groupId=${group.id}`}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-emerald-700 rounded-lg hover:bg-emerald-800"
            >
              <Lock className="w-3.5 h-3.5" />
              <span>Débloquer PDF & Excel (500 FCFA/mois)</span>
            </Link>
          )}
        </div>
      </section>

      {/* Subscription & FedaPay */}
      <section className="bg-white border border-slate-200 rounded-xl p-6 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-4 border-b border-slate-100">
          <div>
            <h2 className="font-display font-bold text-slate-900">Abonnement du groupe</h2>
            <p className="text-xs text-slate-500">
              Offre actuelle : <strong>{subInfo?.subscription?.planName || group.planCode}</strong> ·
              Statut : {subInfo?.subscription?.status || 'ACTIVE'}
              {subInfo?.subscription?.endDate
                ? ` · Valide jusqu’au ${subInfo.subscription.endDate.slice(0, 10)}`
                : ''}
            </p>
          </div>
          <Link
            to={`/app/abonnement?plan=${planCode}&groupId=${group.id}`}
            className="text-xs font-semibold text-emerald-700 hover:underline"
          >
            Ouvrir la page dédiée de paiement →
          </Link>
        </div>

        {perms.canManageSubscription && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="space-y-4">
              <h3 className="text-sm font-bold text-slate-900">
                Paiement en ligne sécurisé via FedaPay
              </h3>
              <div className="grid grid-cols-2 gap-3">
                <label className="block space-y-1 text-xs">
                  <span className="font-medium text-slate-700">Offre par groupe</span>
                  <select
                    value={planCode}
                    onChange={(e) => setPlanCode(e.target.value as Exclude<SubscriptionPlanCode, 'FREE'>)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white text-sm"
                  >
                    <option value="PREMIUM">Premium Famille (500 FCFA/mois)</option>
                    <option value="ORG">Association & Organisation (1 000 FCFA/mois)</option>
                  </select>
                </label>
                <label className="block space-y-1 text-xs">
                  <span className="font-medium text-slate-700">Durée (mois)</span>
                  <input
                    type="number"
                    min={1}
                    max={24}
                    value={months}
                    onChange={(e) => setMonths(Math.max(1, Number(e.target.value)))}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono text-sm"
                  />
                </label>
              </div>
              <p className="text-xs text-slate-600">
                Moyens pris en charge selon activation FedaPay : MTN Mobile Money, Moov Money,
                CELTIIS Cash, CORIS Money, BMO, Visa / Mastercard.
              </p>
              {fedaMsg && (
                <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-900">
                  {fedaMsg}
                </div>
              )}
              <button
                type="button"
                onClick={handleFedaPayCheckout}
                className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-semibold text-white bg-emerald-700 rounded-lg hover:bg-emerald-800"
              >
                <Download className="w-4 h-4" />
                Payer avec FedaPay ({formatMoney(unitPrice * months, 'XOF')})
              </button>
            </div>

            <form onSubmit={handleManualRequest} className="space-y-3 border-t lg:border-t-0 lg:border-l border-slate-200 pt-4 lg:pt-0 lg:pl-6">
              <h3 className="text-sm font-bold text-slate-900">
                Déclaration manuelle (Pilote Bénin)
              </h3>
              <p className="text-xs text-slate-500">
                Après transfert Mobile Money, saisissez la référence. L’abonnement ne sera activé
                qu’après validation par l’administrateur central.
              </p>
              <input
                type="text"
                required
                value={manualRef}
                onChange={(e) => setManualRef(e.target.value)}
                placeholder="Référence du transfert Mobile Money"
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
              />
              <input
                type="text"
                value={manualNote}
                onChange={(e) => setManualNote(e.target.value)}
                placeholder="Numéro émetteur / note"
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
              />
              <button
                type="submit"
                className="px-4 py-2 text-xs font-semibold text-slate-800 border border-slate-300 rounded-lg hover:bg-slate-50"
              >
                Soumettre pour validation
              </button>
            </form>
          </div>
        )}

        {(subInfo?.requests || []).length > 0 && (
          <div className="pt-4 border-t border-slate-100 space-y-2">
            <p className="text-xs font-semibold text-slate-700">Historique des demandes d’abonnement</p>
            {subInfo.requests.map((r: any) => (
              <p key={r.id} className="text-xs text-slate-600">
                {r.createdAt.slice(0, 10)} · {r.planCode} ({r.months} mois) ·{' '}
                <span className="font-mono">{formatMoney(r.amountInt, r.currency)}</span> · Réf:{' '}
                {r.reference} · <strong>{r.status}</strong>
              </p>
            ))}
          </div>
        )}
      </section>

      {/* Audit Trail */}
      <section className="bg-white border border-slate-200 rounded-xl p-6 space-y-3">
        <h2 className="font-display font-bold text-slate-900">Journal d’activité du groupe</h2>
        <div className="divide-y divide-slate-100 text-xs">
          {(stats?.auditLogs || []).map((log: any) => (
            <div key={log.id} className="py-2 flex items-center justify-between gap-4">
              <span className="text-slate-700">
                <strong>{log.actorName}</strong> · {log.action} ({log.targetType})
              </span>
              <span className="font-mono text-slate-400 shrink-0">
                {log.createdAt.slice(0, 16).replace('T', ' ')}
              </span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
