import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Menu, ShieldCheck, X } from 'lucide-react';
import { Link, useRouter } from '../lib/router';
import { useAuth } from '../context/AuthContext';
import { getAnalyticsConsent, setAnalyticsConsent, type ConsentState } from '../lib/analytics';

export function PublicLayout({ children }: { children: React.ReactNode }) {
  const { pathname } = useRouter();
  const { user } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [consent, setConsent] = useState<ConsentState>(() => getAnalyticsConsent());

  const navLinks = [
    { to: '/fonctionnalites', label: 'Fonctionnalités' },
    { to: '/groupes', label: 'Groupes' },
    { to: '/tarifs', label: 'Tarifs' },
    { to: '/faq', label: 'FAQ' },
    { to: '/contact', label: 'Contact' },
  ];

  const handleConsent = (choice: 'granted' | 'denied') => {
    setAnalyticsConsent(choice);
    setConsent(choice);
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#FAF9F6] text-stone-900">
      {/* Strict 3-Zone Top Bar Contract */}
      <header className="sticky top-0 z-40 bg-[#FAF9F6]/92 backdrop-blur-md border-b border-stone-200/80">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-8">
          {/* Zone 1: Single text element wordmark */}
          <Link
            to="/"
            className="font-display text-xl font-bold tracking-tight text-stone-900 whitespace-nowrap shrink-0"
          >
            KPATA
          </Link>

          {/* Zone 2: 5 concise single-line nav links */}
          <nav
            aria-label="Navigation principale"
            className="hidden md:flex items-center gap-7 text-sm font-medium text-stone-600"
          >
            {navLinks.map((item) => {
              const active = pathname === item.to;
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  className={`whitespace-nowrap shrink-0 py-1 transition-colors duration-150 hover:text-stone-950 ${
                    active ? 'text-emerald-800 font-semibold underline underline-offset-4' : ''
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>

          {/* Zone 3: 1 primary action */}
          <div className="flex items-center gap-3 shrink-0">
            <Link
              to={user ? '/app' : '/connexion'}
              className="hidden md:inline-flex items-center justify-center px-4 py-2 text-sm font-semibold text-white bg-emerald-800 rounded-xl hover:bg-emerald-900 transition-colors duration-150 whitespace-nowrap shrink-0"
            >
              {user ? 'Mon espace' : 'Accéder à KPATA'}
            </Link>
            <button
              type="button"
              onClick={() => setMobileOpen((v) => !v)}
              className="md:hidden inline-flex items-center justify-center w-11 h-11 rounded-xl border border-stone-200 bg-white text-stone-700 hover:bg-stone-50"
              aria-label={mobileOpen ? 'Fermer le menu' : 'Ouvrir le menu'}
            >
              {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {mobileOpen && (
          <div className="md:hidden border-t border-stone-200 bg-white px-4 py-4 space-y-3">
            <nav className="flex flex-col space-y-1.5">
              {navLinks.map((item) => (
                <Link
                  key={item.to}
                  to={item.to}
                  onClick={() => setMobileOpen(false)}
                  className={`py-2.5 px-3 rounded-xl text-sm font-medium transition-colors ${
                    pathname === item.to ? 'bg-emerald-50 text-emerald-900 font-semibold' : 'text-stone-700 hover:bg-stone-50'
                  }`}
                >
                  {item.label}
                </Link>
              ))}
            </nav>
            <div className="pt-3 border-t border-stone-100 flex flex-col gap-2">
              <Link
                to={user ? '/app' : '/connexion'}
                onClick={() => setMobileOpen(false)}
                className="w-full text-center py-2.5 px-4 rounded-xl text-sm font-semibold text-white bg-emerald-800 hover:bg-emerald-900"
              >
                {user ? 'Accéder à mon espace' : 'Se connecter'}
              </Link>
              {!user && (
                <Link
                  to="/inscription"
                  onClick={() => setMobileOpen(false)}
                  className="w-full text-center py-2.5 px-4 rounded-xl text-sm font-semibold text-stone-700 border border-stone-300 hover:bg-stone-50"
                >
                  Créer un compte gratuit
                </Link>
              )}
            </div>
          </div>
        )}
      </header>

      <motion.main
        key={pathname}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
        className="flex-1"
      >
        {children}
      </motion.main>

      <footer className="border-t border-stone-200 bg-[#F3F1EB]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-12 grid grid-cols-1 md:grid-cols-4 gap-8">
          <div className="md:col-span-2 space-y-3">
            <span className="font-display text-lg font-bold text-stone-900">KPATA</span>
            <p className="text-sm text-stone-600 max-w-md leading-relaxed">
              Ensemble, gérons mieux notre argent. Plateforme collaborative de suivi des dépenses
              partagées, cotisations et budgets collectifs conçue au Bénin pour l’Afrique.
            </p>
            <p className="text-xs text-stone-500">
              Cotonou, Bénin · Devise principale : FCFA (XOF) · Plateforme web
            </p>
          </div>

          <div className="space-y-2.5">
            <h3 className="text-sm font-semibold text-stone-900">Découvrir</h3>
            <ul className="space-y-2 text-sm text-stone-600">
              <li><Link to="/fonctionnalites" className="hover:text-stone-950 transition-colors">Fonctionnalités</Link></li>
              <li><Link to="/groupes" className="hover:text-stone-950 transition-colors">Types de groupes</Link></li>
              <li><Link to="/tarifs" className="hover:text-stone-950 transition-colors">Tarifs par groupe</Link></li>
              <li><Link to="/faq" className="hover:text-stone-950 transition-colors">Questions fréquentes</Link></li>
              <li><Link to="/contact" className="hover:text-stone-950 transition-colors">Contact</Link></li>
            </ul>
          </div>

          <div className="space-y-2.5">
            <h3 className="text-sm font-semibold text-stone-900">Légal & Accès</h3>
            <ul className="space-y-2 text-sm text-stone-600">
              <li><Link to="/conditions-generales" className="hover:text-stone-950 transition-colors">Conditions générales</Link></li>
              <li><Link to="/confidentialite" className="hover:text-stone-950 transition-colors">Politique de confidentialité</Link></li>
              <li><Link to="/connexion" className="hover:text-stone-950 transition-colors">Connexion</Link></li>
              <li><Link to="/inscription" className="hover:text-stone-950 transition-colors">Créer un compte</Link></li>
              <li>
                <Link
                  to="/admin"
                  className="inline-flex items-center gap-1.5 font-medium text-emerald-800 hover:text-emerald-950 transition-colors"
                >
                  <ShieldCheck className="w-3.5 h-3.5 shrink-0" />
                  <span>Espace Propriétaire / Admin</span>
                </Link>
              </li>
            </ul>
          </div>
        </div>
        <div className="border-t border-stone-200/90 py-5 px-4 sm:px-6">
          <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-stone-500">
            <span>© {new Date().getFullYear()} KPATA. Tous droits réservés.</span>
            <span>KPATA n’est pas une banque et ne conserve pas les fonds des utilisateurs.</span>
          </div>
        </div>
      </footer>

      {/* Non-intrusive Cookie & Analytics Consent Banner */}
      {consent === 'unset' && (
        <div
          role="dialog"
          aria-label="Gestion des cookies de mesure d'audience"
          className="fixed bottom-4 left-4 right-4 sm:left-auto sm:right-6 sm:max-w-md z-50 bg-white border border-stone-200 rounded-2xl shadow-md p-4 flex flex-col sm:flex-row sm:items-center gap-3"
        >
          <p className="text-xs text-stone-600 leading-snug flex-1">
            KPATA utilise des cookies d’audience anonymisés (GA4) uniquement avec votre accord, sans
            publicité.
          </p>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => handleConsent('denied')}
              className="px-3 py-1.5 text-xs font-medium text-stone-700 border border-stone-300 rounded-lg hover:bg-stone-50 whitespace-nowrap"
            >
              Refuser
            </button>
            <button
              type="button"
              onClick={() => handleConsent('granted')}
              className="px-3 py-1.5 text-xs font-semibold text-white bg-emerald-800 rounded-lg hover:bg-emerald-900 whitespace-nowrap"
            >
              Accepter
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
