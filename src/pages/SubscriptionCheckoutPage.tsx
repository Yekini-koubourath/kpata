import React, { useCallback, useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { ArrowRight, Check, CreditCard, Lock, ShieldCheck, Wallet } from 'lucide-react';
import { AppShell } from '../components/AppShell';
import { apiFetch } from '../lib/api';
import { Link, useRouter } from '../lib/router';
import { COUNTRIES, formatMoney, GROUP_TYPES, type SubscriptionPlanCode } from '../shared/types';

export function SubscriptionCheckoutPage() {
  const { search, navigate } = useRouter();
  const params = new URLSearchParams(search);
  const initialPlan = (params.get('plan') || 'PREMIUM').toUpperCase();
  const initialGroupId = params.get('groupId') || '';

  const [plans, setPlans] = useState<any[]>([]);
  const [groups, setGroups] = useState<any[]>([]);
  const [selectedPlan, setSelectedPlan] = useState<'PREMIUM' | 'ORG'>(
    initialPlan === 'ORG' ? 'ORG' : 'PREMIUM'
  );
  const [selectedGroupId, setSelectedGroupId] = useState(initialGroupId);
  const [months, setMonths] = useState(1);
  const [loading, setLoading] = useState(true);

  const [creatingGroup, setCreatingGroup] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [newGroupType, setNewGroupType] = useState('FAMILLE');
  const [newGroupCountry, setNewGroupCountry] = useState('BJ');

  const [fedaMsg, setFedaMsg] = useState('');
  const [manualRef, setManualRef] = useState('');
  const [manualNote, setManualNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submittedRequest, setSubmittedRequest] = useState<{
    id: string;
    amountInt: number;
    currency: string;
    planCode: string;
  } | null>(null);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [plansRes, groupsRes] = await Promise.all([
        apiFetch<{ plans: any[] }>('/api/plans'),
        apiFetch<{ groups: any[] }>('/api/groups'),
      ]);
      const paidPlans = (plansRes.plans || []).filter((p) => p.code !== 'FREE');
      setPlans(paidPlans);
      const manageable = (groupsRes.groups || []).filter(
        (g) => g.myRole === 'OWNER' || g.myRole === 'ADMIN'
      );
      setGroups(manageable);
      if (!selectedGroupId && manageable.length > 0) {
        setSelectedGroupId(manageable[0].id);
      }
      if (manageable.length === 0) {
        setCreatingGroup(true);
      }
    } finally {
      setLoading(false);
    }
  }, [selectedGroupId]);

  useEffect(() => {
    load();
  }, [load]);

  const activePlan = plans.find((p) => p.code === selectedPlan);
  const totalAmountInt = (activePlan?.monthlyPriceInt || 0) * months;

  const handleCreateGroupFirst = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      const c = COUNTRIES.find((x) => x.code === newGroupCountry);
      const res = await apiFetch<{ id: string }>('/api/groups', {
        method: 'POST',
        body: JSON.stringify({
          name: newGroupName,
          type: newGroupType,
          country: newGroupCountry,
          currency: c?.defaultCurrency || 'XOF',
          timezone: c?.defaultTimezone || 'Africa/Porto-Novo',
          desiredPlanCode: selectedPlan,
        }),
      });
      setNewGroupName('');
      setCreatingGroup(false);
      await load();
      setSelectedGroupId(res.id);
    } catch (err: any) {
      setError(err?.message || 'Création du groupe impossible.');
    } finally {
      setSubmitting(false);
    }
  };

  const handlePayWithFedaPay = async () => {
    if (!selectedGroupId) {
      setError('Veuillez d’abord sélectionner ou créer un groupe à activer.');
      return;
    }
    setError('');
    setFedaMsg('');
    setSubmitting(true);
    try {
      const res = await apiFetch<any>('/api/payments/fedapay/checkout', {
        method: 'POST',
        body: JSON.stringify({
          groupId: selectedGroupId,
          planCode: selectedPlan,
          months,
        }),
      });
      if (!res.configured) {
        setFedaMsg(res.message);
        return;
      }
      if (res.paymentUrl) {
        window.location.href = res.paymentUrl;
      }
    } catch (err: any) {
      setError(err?.message || 'Erreur lors de l’initialisation du paiement FedaPay.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmitManualPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedGroupId) {
      setError('Veuillez d’abord sélectionner ou créer un groupe.');
      return;
    }
    setError('');
    setSubmitting(true);
    try {
      const res = await apiFetch<{ id: string; status: string; amountInt: number }>(
        `/api/groups/${selectedGroupId}/subscription/request`,
        {
          method: 'POST',
          body: JSON.stringify({
            planCode: selectedPlan,
            months,
            reference: manualRef,
            proofNote: manualNote,
          }),
        }
      );
      setSubmittedRequest({
        id: res.id,
        amountInt: res.amountInt,
        currency: activePlan?.currency || 'XOF',
        planCode: selectedPlan,
      });
      setManualRef('');
      setManualNote('');
    } catch (err: any) {
      setError(err?.message || 'Impossible d’enregistrer la référence.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AppShell
      title="Paiement & Activation d’offre"
      subtitle="Les fonctionnalités payantes sont débloquées uniquement après confirmation du paiement."
      actions={
        <Link
          to="/app/groups"
          className="px-3.5 py-2 text-xs font-medium text-stone-700 bg-white border border-stone-300 rounded-xl hover:bg-stone-50 whitespace-nowrap"
        >
          Retour aux groupes
        </Link>
      }
    >
      {loading ? (
        <div className="h-64 rounded-2xl bg-white border border-stone-200 animate-pulse" />
      ) : (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
          className="space-y-6"
        >
          {/* Payment Gate Notice */}
          <div className="bg-[#0B1F19] text-white rounded-2xl p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-xs font-medium text-emerald-300">
                <Lock className="w-3.5 h-3.5" />
                <span>Paiement obligatoire avant activation</span>
              </div>
              <h2 className="font-display text-lg font-bold">
                Finalisez le règlement pour activer l’offre {activePlan?.name}
              </h2>
              <p className="text-xs text-stone-300">
                Tant que le paiement n’est pas confirmé par FedaPay ou validé par l’administrateur
                central, le groupe reste sur l’offre Gratuite sans déblocage anticipé.
              </p>
            </div>
            <div className="text-left sm:text-right shrink-0">
              <p className="text-xs text-stone-400">Montant total à régler</p>
              <p className="font-mono text-2xl font-bold text-emerald-300 tabular-nums">
                {formatMoney(totalAmountInt, activePlan?.currency || 'XOF')}
              </p>
            </div>
          </div>

          {error && (
            <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-sm text-red-800">
              {error}
            </div>
          )}

          {submittedRequest ? (
            <div className="bg-white border border-emerald-200 rounded-2xl p-6 sm:p-8 space-y-4">
              <div className="flex items-center gap-2 text-emerald-800 font-semibold">
                <ShieldCheck className="w-5 h-5" />
                <span>Demande de paiement enregistrée (en attente de validation)</span>
              </div>
              <p className="text-sm text-stone-600 leading-relaxed">
                Votre transfert de{' '}
                <strong className="font-mono">
                  {formatMoney(submittedRequest.amountInt, submittedRequest.currency)}
                </strong>{' '}
                pour l’offre <strong>{submittedRequest.planCode}</strong> est en attente de
                vérification par le propriétaire de KPATA. Les fonctionnalités payantes seront
                débloquées automatiquement dès validation.
              </p>
              <div className="flex flex-wrap gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => navigate(`/app/groups/${selectedGroupId}`)}
                  className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-emerald-800 rounded-xl hover:bg-emerald-900"
                >
                  <span>Continuer sur le groupe (Offre Gratuite en attendant)</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Step 1 & 2: Choose Plan & Target Group */}
              <div className="lg:col-span-5 space-y-5">
                <section className="bg-white border border-stone-200 rounded-2xl p-5 space-y-4">
                  <h3 className="font-display text-base font-bold text-stone-900">
                    1. Offre choisie & durée
                  </h3>
                  <div className="space-y-2.5">
                    {plans.map((p) => {
                      const active = p.code === selectedPlan;
                      return (
                        <button
                          key={p.code}
                          type="button"
                          onClick={() =>
                            setSelectedPlan(p.code as Exclude<SubscriptionPlanCode, 'FREE'>)
                          }
                          className={`w-full text-left p-3.5 rounded-xl border transition-colors ${
                            active
                              ? 'border-emerald-800 bg-emerald-50/70'
                              : 'border-stone-200 hover:bg-stone-50'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-semibold text-sm text-stone-900">{p.name}</span>
                            <span className="font-mono text-sm font-bold text-emerald-800 tabular-nums">
                              {formatMoney(p.monthlyPriceInt, p.currency)} / mois
                            </span>
                          </div>
                          <p className="text-xs text-stone-600 mt-1">{p.description}</p>
                        </button>
                      );
                    })}
                  </div>

                  <label className="block space-y-1.5 text-xs">
                    <span className="font-medium text-stone-700">Durée d’abonnement</span>
                    <select
                      value={months}
                      onChange={(e) => setMonths(Number(e.target.value))}
                      className="w-full px-3.5 py-2 text-sm border border-stone-300 rounded-xl bg-white"
                    >
                      <option value={1}>1 mois ({formatMoney((activePlan?.monthlyPriceInt || 0) * 1, 'XOF')})</option>
                      <option value={3}>3 mois ({formatMoney((activePlan?.monthlyPriceInt || 0) * 3, 'XOF')})</option>
                      <option value={6}>6 mois ({formatMoney((activePlan?.monthlyPriceInt || 0) * 6, 'XOF')})</option>
                      <option value={12}>12 mois ({formatMoney((activePlan?.monthlyPriceInt || 0) * 12, 'XOF')})</option>
                    </select>
                  </label>

                  {activePlan && (
                    <ul className="pt-3 border-t border-stone-100 space-y-1.5">
                      {(activePlan.features || []).map((f: string) => (
                        <li key={f} className="flex items-start gap-2 text-xs text-stone-700">
                          <Check className="w-3.5 h-3.5 text-emerald-800 shrink-0 mt-0.5" />
                          <span>{f}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </section>

                <section className="bg-white border border-stone-200 rounded-2xl p-5 space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="font-display text-base font-bold text-stone-900">
                      2. Groupe à activer
                    </h3>
                    <button
                      type="button"
                      onClick={() => setCreatingGroup((v) => !v)}
                      className="text-xs font-semibold text-emerald-800 hover:underline"
                    >
                      {creatingGroup ? 'Choisir un groupe existant' : '+ Créer un nouveau groupe'}
                    </button>
                  </div>

                  {creatingGroup ? (
                    <form onSubmit={handleCreateGroupFirst} className="space-y-3">
                      <input
                        type="text"
                        required
                        value={newGroupName}
                        onChange={(e) => setNewGroupName(e.target.value)}
                        placeholder="Nom du groupe (ex: Association Espoir)"
                        className="w-full px-3.5 py-2 text-sm border border-stone-300 rounded-xl"
                      />
                      <div className="grid grid-cols-2 gap-2">
                        <select
                          value={newGroupType}
                          onChange={(e) => setNewGroupType(e.target.value)}
                          className="px-3 py-2 text-xs border border-stone-300 rounded-xl bg-white"
                        >
                          {GROUP_TYPES.map((t) => (
                            <option key={t.value} value={t.value}>
                              {t.label}
                            </option>
                          ))}
                        </select>
                        <select
                          value={newGroupCountry}
                          onChange={(e) => setNewGroupCountry(e.target.value)}
                          className="px-3 py-2 text-xs border border-stone-300 rounded-xl bg-white"
                        >
                          {COUNTRIES.map((c) => (
                            <option key={c.code} value={c.code}>
                              {c.name}
                            </option>
                          ))}
                        </select>
                      </div>
                      <button
                        type="submit"
                        disabled={submitting}
                        className="w-full py-2.5 text-xs font-semibold text-white bg-stone-900 rounded-xl hover:bg-stone-800"
                      >
                        Créer le groupe et passer au paiement
                      </button>
                    </form>
                  ) : (
                    <select
                      aria-label="Groupe cible"
                      value={selectedGroupId}
                      onChange={(e) => setSelectedGroupId(e.target.value)}
                      className="w-full px-3.5 py-2.5 text-sm border border-stone-300 rounded-xl bg-white"
                    >
                      {groups.map((g) => (
                        <option key={g.id} value={g.id}>
                          {g.name} (Offre actuelle : {g.planCode})
                        </option>
                      ))}
                    </select>
                  )}
                </section>
              </div>

              {/* Step 3: Pay via FedaPay or Mobile Money Pilot */}
              <div className="lg:col-span-7 space-y-5">
                <section className="bg-white border border-stone-200 rounded-2xl p-6 space-y-4">
                  <div className="flex items-center gap-2">
                    <CreditCard className="w-5 h-5 text-emerald-800" />
                    <h3 className="font-display text-base font-bold text-stone-900">
                      3A. Paiement immédiat par FedaPay
                    </h3>
                  </div>
                  <p className="text-sm text-stone-600 leading-relaxed">
                    Réglez par MTN Mobile Money, Moov Money, Celtiis Cash, Coris Money ou carte
                    bancaire. L’abonnement est activé automatiquement dès confirmation du serveur
                    FedaPay.
                  </p>
                  {fedaMsg && (
                    <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-900">
                      {fedaMsg}
                    </div>
                  )}
                  <button
                    type="button"
                    disabled={submitting || !selectedGroupId}
                    onClick={handlePayWithFedaPay}
                    className="inline-flex items-center gap-2 px-5 py-3 text-sm font-semibold text-white bg-emerald-800 rounded-xl hover:bg-emerald-900 disabled:opacity-50 transition-colors"
                  >
                    <span>
                      Payer {formatMoney(totalAmountInt, activePlan?.currency || 'XOF')} via FedaPay
                    </span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </section>

                <form
                  onSubmit={handleSubmitManualPayment}
                  className="bg-white border border-stone-200 rounded-2xl p-6 space-y-4"
                >
                  <div className="flex items-center gap-2">
                    <Wallet className="w-5 h-5 text-stone-700" />
                    <h3 className="font-display text-base font-bold text-stone-900">
                      3B. Transfert Mobile Money (Validation manuelle Pilote Bénin)
                    </h3>
                  </div>
                  <p className="text-xs text-stone-600 leading-relaxed">
                    Si vous utilisez un transfert direct Mobile Money, renseignez la référence exacte
                    de la transaction. Le propriétaire du site vérifiera le reçu avant d’activer
                    l’offre <strong>{activePlan?.name}</strong> sur votre groupe.
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <input
                      type="text"
                      required
                      value={manualRef}
                      onChange={(e) => setManualRef(e.target.value)}
                      placeholder="Référence transaction (ex: MOMO-229-...)"
                      className="px-3.5 py-2 text-sm border border-stone-300 rounded-xl"
                    />
                    <input
                      type="text"
                      value={manualNote}
                      onChange={(e) => setManualNote(e.target.value)}
                      placeholder="Numéro émetteur ou précision"
                      className="px-3.5 py-2 text-sm border border-stone-300 rounded-xl"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={submitting || !selectedGroupId}
                    className="px-4 py-2.5 text-sm font-semibold text-stone-900 border border-stone-300 rounded-xl hover:bg-stone-50 disabled:opacity-50 transition-colors"
                  >
                    Soumettre ma preuve de paiement ({formatMoney(totalAmountInt, 'XOF')})
                  </button>
                </form>
              </div>
            </div>
          )}
        </motion.div>
      )}
    </AppShell>
  );
}
