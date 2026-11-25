import React, { useState } from 'react';
import { Lock, ShieldCheck } from 'lucide-react';
import { PublicLayout } from '../components/PublicLayout';
import { Link, useRouter } from '../lib/router';
import { useAuth } from '../context/AuthContext';
import { apiFetch } from '../lib/api';
import { PLAN_ENTITLEMENTS, type SubscriptionPlanCode } from '../shared/types';

function useSelectedPlanRedirect() {
  const { search } = useRouter();
  const params = new URLSearchParams(search);
  const rawPlan = (params.get('plan') || '').toUpperCase();
  const paidPlan =
    rawPlan === 'PREMIUM' || rawPlan === 'ORG'
      ? (rawPlan as Exclude<SubscriptionPlanCode, 'FREE'>)
      : null;

  const postAuthTarget = paidPlan ? `/app/abonnement?plan=${paidPlan}` : '/app';
  const planSuffix = paidPlan ? `?plan=${paidPlan}` : '';

  return { paidPlan, postAuthTarget, planSuffix };
}

export function LoginPage() {
  const { login } = useAuth();
  const { navigate } = useRouter();
  const { paidPlan, postAuthTarget, planSuffix } = useSelectedPlanRedirect();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(email, password);
      navigate(postAuthTarget);
    } catch (err: any) {
      setError(err?.message || 'Connexion impossible.');
    } finally {
      setLoading(false);
    }
  };

  const quickDemoLogin = async (demoEmail: string) => {
    setError('');
    setLoading(true);
    try {
      await login(demoEmail, 'KpataDemo2026!');
      navigate(postAuthTarget);
    } catch (err: any) {
      setError(err?.message || 'Connexion démo impossible.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <PublicLayout>
      <section className="max-w-md mx-auto px-4 py-14 space-y-6">
        <div className="space-y-2 text-center">
          <h1 className="font-display text-2xl font-bold text-stone-900">Connexion à KPATA</h1>
          <p className="text-sm text-stone-600">
            Accédez à vos groupes, dépenses partagées et remboursements.
          </p>
        </div>

        {paidPlan && (
          <div className="p-3.5 rounded-xl bg-[#0B1F19] text-white text-xs flex items-start gap-2.5">
            <Lock className="w-4 h-4 text-emerald-300 shrink-0 mt-0.5" />
            <span>
              Offre choisie : <strong>{PLAN_ENTITLEMENTS[paidPlan].label}</strong>. Connectez-vous
              pour finaliser le paiement avant d’activer votre groupe.
            </span>
          </div>
        )}

        <form
          onSubmit={handleSubmit}
          className="border border-stone-200 rounded-2xl bg-white p-6 sm:p-7 space-y-4"
        >
          {error && (
            <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-sm text-red-800">
              {error}
            </div>
          )}
          <label className="block space-y-1.5 text-sm">
            <span className="font-medium text-stone-700">Adresse e-mail</span>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="jean.dossou@kpata.bj"
              className="w-full px-3.5 py-2 border border-stone-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-700"
            />
          </label>
          <label className="block space-y-1.5 text-sm">
            <span className="font-medium text-stone-700">Mot de passe</span>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3.5 py-2 border border-stone-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-700"
            />
          </label>
          <div className="flex items-center justify-between text-xs">
            <Link to="/mot-de-passe-oublie" className="text-emerald-800 hover:underline">
              Mot de passe oublié ?
            </Link>
            <Link to={`/inscription${planSuffix}`} className="text-stone-600 hover:underline">
              Créer un compte
            </Link>
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 px-4 text-sm font-semibold text-white bg-emerald-800 rounded-xl hover:bg-emerald-900 disabled:opacity-50 transition-colors"
          >
            {loading ? 'Connexion...' : paidPlan ? 'Se connecter et passer au paiement' : 'Se connecter'}
          </button>
        </form>

        {/* Explicit clearly-labeled demo accounts */}
        <div className="border border-stone-200 rounded-2xl bg-white p-5 space-y-3">
          <p className="text-xs font-semibold text-stone-800">
            Comptes de démonstration (environnement pilote Bénin)
          </p>
          <p className="text-xs text-stone-600">
            Testez immédiatement la Famille Dossou, la Colocation Calavi et l’Association Jeunes
            Leaders :
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <button
              type="button"
              disabled={loading}
              onClick={() => quickDemoLogin('jean.dossou@kpata.bj')}
              className="px-3.5 py-2.5 text-xs font-medium bg-[#FAF9F6] border border-stone-200 rounded-xl hover:border-stone-300 text-left transition-colors"
            >
              <span className="block font-semibold text-stone-900">Jean Dossou</span>
              <span className="text-stone-500">Propriétaire Famille · Trésorier Assoc.</span>
            </button>
            <button
              type="button"
              disabled={loading}
              onClick={() => quickDemoLogin('mariam.kone@kpata.bj')}
              className="px-3.5 py-2.5 text-xs font-medium bg-[#FAF9F6] border border-stone-200 rounded-xl hover:border-stone-300 text-left transition-colors"
            >
              <span className="block font-semibold text-stone-900">Mariam Koné</span>
              <span className="text-stone-500">Admin Famille · Présidente Assoc.</span>
            </button>
          </div>
        </div>

        {/* Site Owner / Central Admin entry */}
        <div className="text-center pt-1">
          <Link
            to="/admin"
            className="inline-flex items-center gap-1.5 text-xs font-medium text-stone-600 hover:text-emerald-800 transition-colors"
          >
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-800" />
            <span>Propriétaire du site ? Accéder à l’administration centrale →</span>
          </Link>
        </div>
      </section>
    </PublicLayout>
  );
}

export function RegisterPage() {
  const { register } = useAuth();
  const { navigate } = useRouter();
  const { paidPlan, postAuthTarget, planSuffix } = useSelectedPlanRedirect();

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [verifyNotice, setVerifyNotice] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await register({ firstName, lastName, email, phone, password });
      if (res.verificationTokenPreview) {
        setVerifyNotice(res.verificationTokenPreview);
      } else {
        navigate(postAuthTarget);
      }
    } catch (err: any) {
      setError(err?.message || 'Inscription impossible.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyNow = async () => {
    if (!verifyNotice) return;
    await apiFetch('/api/auth/verify-email', {
      method: 'POST',
      body: JSON.stringify({ token: verifyNotice }),
    });
    navigate(postAuthTarget);
  };

  return (
    <PublicLayout>
      <section className="max-w-md mx-auto px-4 py-14 space-y-6">
        <div className="space-y-2 text-center">
          <h1 className="font-display text-2xl font-bold text-stone-900">Créer un compte KPATA</h1>
          <p className="text-sm text-stone-600">
            Gratuit pour créer ou rejoindre vos groupes familiaux, colocations et associations.
          </p>
        </div>

        {paidPlan && (
          <div className="p-3.5 rounded-xl bg-[#0B1F19] text-white text-xs flex items-start gap-2.5">
            <Lock className="w-4 h-4 text-emerald-300 shrink-0 mt-0.5" />
            <span>
              Offre choisie : <strong>{PLAN_ENTITLEMENTS[paidPlan].label}</strong>. Après
              inscription, vous passerez directement au règlement sécurisé pour activer votre
              groupe.
            </span>
          </div>
        )}

        {verifyNotice ? (
          <div className="border border-emerald-200 bg-emerald-50 rounded-2xl p-6 space-y-4">
            <h2 className="font-display text-lg font-bold text-emerald-950">Compte créé avec succès</h2>
            <p className="text-sm text-emerald-900">
              Votre compte est actif. En environnement sans serveur SMTP externe, vous pouvez
              confirmer votre adresse e-mail directement ci-dessous :
            </p>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={handleVerifyNow}
                className="px-4 py-2 text-sm font-semibold text-white bg-emerald-800 rounded-xl hover:bg-emerald-900"
              >
                {paidPlan ? 'Vérifier et passer au paiement' : 'Vérifier mon e-mail et continuer'}
              </button>
              <button
                type="button"
                onClick={() => navigate(postAuthTarget)}
                className="px-4 py-2 text-sm font-medium text-stone-700 bg-white border border-stone-300 rounded-xl"
              >
                Plus tard
              </button>
            </div>
          </div>
        ) : (
          <form
            onSubmit={handleSubmit}
            className="border border-stone-200 rounded-2xl bg-white p-6 sm:p-7 space-y-4"
          >
            {error && (
              <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-sm text-red-800">
                {error}
              </div>
            )}
            <div className="grid grid-cols-2 gap-3">
              <label className="block space-y-1.5 text-sm">
                <span className="font-medium text-stone-700">Prénom</span>
                <input
                  type="text"
                  required
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  className="w-full px-3.5 py-2 border border-stone-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-700"
                />
              </label>
              <label className="block space-y-1.5 text-sm">
                <span className="font-medium text-stone-700">Nom</span>
                <input
                  type="text"
                  required
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  className="w-full px-3.5 py-2 border border-stone-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-700"
                />
              </label>
            </div>
            <label className="block space-y-1.5 text-sm">
              <span className="font-medium text-stone-700">Adresse e-mail</span>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-3.5 py-2 border border-stone-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-700"
              />
            </label>
            <label className="block space-y-1.5 text-sm">
              <span className="font-medium text-stone-700">Téléphone (facultatif)</span>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+229 01 ..."
                className="w-full px-3.5 py-2 border border-stone-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-700"
              />
            </label>
            <label className="block space-y-1.5 text-sm">
              <span className="font-medium text-stone-700">Mot de passe (8 caractères min.)</span>
              <input
                type="password"
                required
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-3.5 py-2 border border-stone-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-700"
              />
            </label>
            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 px-4 text-sm font-semibold text-white bg-emerald-800 rounded-xl hover:bg-emerald-900 disabled:opacity-50 transition-colors"
            >
              {loading
                ? 'Création du compte...'
                : paidPlan
                ? 'Créer mon compte et continuer vers le paiement'
                : 'Créer mon compte'}
            </button>
            <p className="text-center text-xs text-stone-600">
              Déjà inscrit ?{' '}
              <Link to={`/connexion${planSuffix}`} className="text-emerald-800 font-semibold hover:underline">
                Se connecter
              </Link>
            </p>
          </form>
        )}
      </section>
    </PublicLayout>
  );
}

export function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [result, setResult] = useState<{ message: string; token?: string } | null>(null);
  const [token, setToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [resetDone, setResetDone] = useState(false);
  const [error, setError] = useState('');

  const handleRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const res = await apiFetch<{ message: string; resetTokenPreview?: string }>(
      '/api/auth/forgot-password',
      { method: 'POST', body: JSON.stringify({ email }) }
    );
    setResult({ message: res.message, token: res.resetTokenPreview });
    if (res.resetTokenPreview) setToken(res.resetTokenPreview);
  };

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      await apiFetch('/api/auth/reset-password', {
        method: 'POST',
        body: JSON.stringify({ token, newPassword }),
      });
      setResetDone(true);
    } catch (err: any) {
      setError(err?.message || 'Réinitialisation impossible.');
    }
  };

  return (
    <PublicLayout>
      <section className="max-w-md mx-auto px-4 py-14 space-y-6">
        <h1 className="font-display text-2xl font-bold text-stone-900 text-center">
          Récupération du mot de passe
        </h1>

        {resetDone ? (
          <div className="border border-emerald-200 bg-emerald-50 rounded-2xl p-6 space-y-4 text-center">
            <p className="text-sm text-emerald-900">Votre mot de passe a été réinitialisé.</p>
            <Link
              to="/connexion"
              className="inline-block px-5 py-2.5 text-sm font-semibold text-white bg-emerald-800 rounded-xl"
            >
              Se connecter
            </Link>
          </div>
        ) : !result ? (
          <form onSubmit={handleRequest} className="border border-stone-200 rounded-2xl bg-white p-6 space-y-4">
            <label className="block space-y-1.5 text-sm">
              <span className="font-medium text-stone-700">Votre adresse e-mail</span>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-3.5 py-2 border border-stone-300 rounded-xl"
              />
            </label>
            <button
              type="submit"
              className="w-full py-2.5 text-sm font-semibold text-white bg-emerald-800 rounded-xl hover:bg-emerald-900 transition-colors"
            >
              Demander un lien de réinitialisation
            </button>
          </form>
        ) : (
          <form onSubmit={handleReset} className="border border-stone-200 rounded-2xl bg-white p-6 space-y-4">
            <p className="text-sm text-stone-600">{result.message}</p>
            {error && <p className="text-sm text-red-700">{error}</p>}
            <label className="block space-y-1.5 text-sm">
              <span className="font-medium text-stone-700">Jeton de réinitialisation</span>
              <input
                type="text"
                required
                value={token}
                onChange={(e) => setToken(e.target.value)}
                className="w-full px-3.5 py-2 border border-stone-300 rounded-xl font-mono text-xs"
              />
            </label>
            <label className="block space-y-1.5 text-sm">
              <span className="font-medium text-stone-700">Nouveau mot de passe</span>
              <input
                type="password"
                required
                minLength={8}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full px-3.5 py-2 border border-stone-300 rounded-xl"
              />
            </label>
            <button
              type="submit"
              className="w-full py-2.5 text-sm font-semibold text-white bg-emerald-800 rounded-xl hover:bg-emerald-900"
            >
              Enregistrer le nouveau mot de passe
            </button>
          </form>
        )}
      </section>
    </PublicLayout>
  );
}
