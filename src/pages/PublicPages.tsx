import React, { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  ArrowRight,
  Calculator,
  Check,
  ChevronDown,
  Crown,
  Layers,
  Lock,
  Mail,
  MapPin,
  Minus,
  Phone,
  Shield,
  ShieldCheck,
  Users,
  Wallet,
} from 'lucide-react';
import { PublicLayout } from '../components/PublicLayout';
import { Link } from '../lib/router';
import { apiFetch } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { formatMoney, GROUP_TYPES, PLAN_ENTITLEMENTS, type SubscriptionPlanCode } from '../shared/types';

function EditorialImage({
  src,
  alt,
  caption,
  aspectClass = 'aspect-[4/3]',
  overlay,
}: {
  src: string;
  alt: string;
  caption?: string;
  aspectClass?: string;
  overlay?: React.ReactNode;
}) {
  const [failed, setFailed] = useState(false);

  return (
    <div className={`relative overflow-hidden rounded-2xl border border-emerald-950/10 bg-emerald-50 shadow-sm ${aspectClass}`}>
      {!failed ? (
        <img
          src={src}
          alt={alt}
          referrerPolicy="no-referrer"
          onError={() => setFailed(true)}
          className="w-full h-full object-cover transition-transform duration-500 ease-out group-hover:scale-105"
        />
      ) : (
        <div className="w-full h-full flex flex-col items-center justify-center p-6 text-center bg-gradient-to-br from-emerald-100 via-teal-50 to-amber-50">
          <span className="font-display text-sm font-bold text-emerald-900">KPATA</span>
          <span className="text-xs text-emerald-800/80 mt-1">{caption || alt}</span>
        </div>
      )}
      {overlay}
    </div>
  );
}

const SIMULATOR_SCENARIOS = [
  {
    key: 'famille',
    label: 'Famille Dossou',
    tag: 'Dépense multi-payeurs · Abomey-Calavi',
    subtitle: 'Courses marché · Répartition équitable',
    totalInt: 15000,
    method: 'Multi-payeurs + Équitable',
    rows: [
      { name: 'Jean (père)', advancedInt: 10000, shareInt: 5000, netInt: 5000 },
      { name: 'Mariam (mère)', advancedInt: 5000, shareInt: 5000, netInt: 0 },
      { name: 'Kossi (sans compte)', advancedInt: 0, shareInt: 5000, netInt: -5000 },
    ],
    suggestion: 'Kossi verse 5 000 FCFA à Jean pour tout solder.',
  },
  {
    key: 'coloc',
    label: 'Colocation Calavi',
    tag: 'Pourcentages · Abomey-Calavi',
    subtitle: 'Loyer + SBEE + Fibre · 3 colocataires',
    totalInt: 90000,
    method: 'Pourcentages (40% / 35% / 25%)',
    rows: [
      { name: 'Sèna (chambre 1)', advancedInt: 90000, shareInt: 36000, netInt: 54000 },
      { name: 'Roch (chambre 2)', advancedInt: 0, shareInt: 31500, netInt: -31500 },
      { name: 'Amina (chambre 3)', advancedInt: 0, shareInt: 22500, netInt: -22500 },
    ],
    suggestion: 'Roch (31 500 FCFA) et Amina (22 500 FCFA) règlent Sèna via MoMo.',
  },
  {
    key: 'assoc',
    label: 'Association Espoir',
    tag: 'Suivi Trésorier · Tontine',
    subtitle: 'Cotisation trimestrielle · Versements partiels',
    totalInt: 40000,
    method: 'Attendu vs Confirmé',
    rows: [
      { name: 'Nadine (confirmé)', advancedInt: 15000, shareInt: 15000, netInt: 0 },
      { name: 'Brice (4 000 + 6 000)', advancedInt: 10000, shareInt: 15000, netInt: -5000 },
      { name: 'Caisse activité', advancedInt: 15000, shareInt: 10000, netInt: 5000 },
    ],
    suggestion: 'Trésorier : reste 5 000 FCFA attendus sur la tranche de Brice.',
  },
];

function InteractiveLedgerSection() {
  const [idx, setIdx] = useState(0);
  const scenario = SIMULATOR_SCENARIOS[idx];

  return (
    <section className="relative overflow-hidden bg-gradient-to-br from-[#042F24] via-[#064E3B] to-[#0B5D48] text-white py-16 lg:py-24">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 items-center">
        <motion.div
          initial={{ opacity: 0, y: 18 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.2 }}
          transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
          className="lg:col-span-5 space-y-6"
        >
          <div className="space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-amber-300">
              Démonstration interactive
            </p>
            <h2 className="font-display text-2xl sm:text-3xl font-bold text-white tracking-tight">
              Chaque franc avancé et chaque part calculée en une seconde
            </h2>
            <p className="text-sm sm:text-base text-emerald-100/85 leading-relaxed">
              Sélectionnez un cas réel du Bénin pour voir comment KPATA équilibre instantanément
              les avances multi-payeurs, les pourcentages ou les cotisations par tranches.
            </p>
          </div>

          <div className="space-y-2.5">
            {SIMULATOR_SCENARIOS.map((s, i) => {
              const active = i === idx;
              return (
                <button
                  key={s.key}
                  type="button"
                  onClick={() => setIdx(i)}
                  className={`relative w-full text-left px-4 py-3.5 rounded-xl border transition-all duration-200 ${
                    active
                      ? 'border-amber-300/60 text-emerald-950'
                      : 'border-emerald-400/20 bg-emerald-950/30 text-white hover:bg-emerald-900/50'
                  }`}
                >
                  {active && (
                    <motion.span
                      layoutId="sim-scenario-bg"
                      transition={{ type: 'spring', stiffness: 360, damping: 32 }}
                      className="absolute inset-0 bg-gradient-to-r from-white to-emerald-50 rounded-xl shadow-md"
                    />
                  )}
                  <div className="relative z-10 flex items-center justify-between gap-2">
                    <span className="font-display font-bold text-sm">{s.label}</span>
                    <span
                      className={`font-mono text-xs font-bold tabular-nums ${
                        active ? 'text-emerald-800' : 'text-amber-300'
                      }`}
                    >
                      {formatMoney(s.totalInt)}
                    </span>
                  </div>
                  <p
                    className={`relative z-10 text-xs mt-0.5 ${
                      active ? 'text-emerald-800/80' : 'text-emerald-200/75'
                    }`}
                  >
                    {s.tag}
                  </p>
                </button>
              );
            })}
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 18 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.2 }}
          transition={{ duration: 0.45, delay: 0.08, ease: [0.16, 1, 0.3, 1] }}
          className="lg:col-span-7"
        >
          <div className="bg-white text-slate-900 border border-emerald-200/40 rounded-2xl shadow-2xl p-6 sm:p-8">
            <AnimatePresence mode="wait">
              <motion.div
                key={scenario.key}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
                className="space-y-6"
              >
                <div className="flex flex-wrap items-start justify-between gap-4 pb-5 border-b border-slate-100">
                  <div className="space-y-1">
                    <p className="font-display text-lg font-bold text-slate-900">
                      {scenario.label}
                    </p>
                    <p className="text-xs text-slate-500">{scenario.subtitle}</p>
                  </div>
                  <div className="text-left sm:text-right">
                    <p className="font-mono text-2xl font-extrabold text-emerald-700 tabular-nums">
                      {formatMoney(scenario.totalInt)}
                    </p>
                    <p className="text-xs font-medium text-amber-700">{scenario.method}</p>
                  </div>
                </div>

                <div className="space-y-3">
                  {scenario.rows.map((row, rowIdx) => {
                    const pct = Math.min(100, Math.round((row.advancedInt / scenario.totalInt) * 100));
                    return (
                      <div
                        key={row.name}
                        className="p-3.5 rounded-xl bg-slate-50 border border-slate-100 space-y-2"
                      >
                        <div className="flex items-center justify-between gap-3 text-sm">
                          <span className="font-semibold text-slate-800">{row.name}</span>
                          <div className="flex items-center gap-4 font-mono text-xs sm:text-sm tabular-nums">
                            <span className="text-slate-500 hidden sm:inline">
                              Avance {formatMoney(row.advancedInt)}
                            </span>
                            <span
                              className={`font-bold ${
                                row.netInt > 0
                                  ? 'text-emerald-700'
                                  : row.netInt < 0
                                  ? 'text-rose-600'
                                  : 'text-slate-500'
                              }`}
                            >
                              {row.netInt > 0
                                ? `+${formatMoney(row.netInt)}`
                                : formatMoney(row.netInt)}
                            </span>
                          </div>
                        </div>
                        <div className="h-1.5 w-full bg-slate-200 rounded-full overflow-hidden">
                          <motion.div
                            initial={{ scaleX: 0 }}
                            animate={{ scaleX: Math.max(0.05, pct / 100) }}
                            transition={{ duration: 0.45, delay: rowIdx * 0.08, ease: [0.16, 1, 0.3, 1] }}
                            style={{ transformOrigin: 'left' }}
                            className={`h-full rounded-full ${
                              row.netInt > 0
                                ? 'bg-gradient-to-r from-emerald-500 to-teal-600'
                                : row.netInt < 0
                                ? 'bg-gradient-to-r from-amber-400 to-rose-500'
                                : 'bg-emerald-400'
                            }`}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="bg-gradient-to-r from-amber-50 to-emerald-50 border border-amber-200/80 rounded-xl px-4 py-3 text-xs sm:text-sm font-medium text-emerald-950 flex items-center gap-2.5">
                  <ArrowRight className="w-4 h-4 text-amber-600 shrink-0" />
                  <span>{scenario.suggestion}</span>
                </div>
              </motion.div>
            </AnimatePresence>
          </div>
        </motion.div>
      </div>
    </section>
  );
}

export function HomePage() {
  return (
    <PublicLayout>
      {/* Hero Split with Rich Emerald & Gold Atmospheric Canvas */}
      <section className="relative overflow-hidden bg-gradient-to-b from-emerald-50/70 via-[#F8FAFC] to-[#F8FAFC]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 pt-12 pb-14 lg:pt-18 lg:pb-20">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 items-center">
            <motion.div
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
              className="lg:col-span-6 space-y-6"
            >
              <p className="text-xs font-bold uppercase tracking-wider text-emerald-700">
                Bénin · Afrique de l’Ouest · Gestion en FCFA
              </p>
              <h1
                className="font-display font-extrabold tracking-tight text-slate-900 leading-[1.08]"
                style={{ fontSize: 'clamp(2.25rem, 4.1vw, 3.5rem)' }}
              >
                Ensemble, gérons mieux{' '}
                <span className="bg-gradient-to-r from-emerald-700 via-teal-600 to-amber-600 bg-clip-text text-transparent">
                  notre argent partagé.
                </span>
              </h1>
              <p className="text-base sm:text-lg text-slate-600 leading-relaxed max-w-xl">
                KPATA est l’application de gestion des dépenses en groupe conçue pour les familles,
                colocataires, groupes d’amis et associations. Centralisez les avances multi-payeurs,
                suivez les cotisations et équilibrez vos remboursements sans erreur.
              </p>
              <div className="flex flex-wrap items-center gap-4 pt-1">
                <Link
                  to="/inscription"
                  className="inline-flex items-center gap-2 px-6 py-3.5 text-sm font-semibold text-white bg-gradient-to-r from-emerald-700 to-teal-700 rounded-xl hover:from-emerald-800 hover:to-teal-800 shadow-lg shadow-emerald-700/20 hover:-translate-y-0.5 transition-all duration-150 whitespace-nowrap"
                >
                  <span>Créer un groupe gratuit</span>
                  <ArrowRight className="w-4 h-4" />
                </Link>
                <Link
                  to="/tarifs"
                  className="inline-flex items-center gap-2 px-5 py-3.5 text-sm font-semibold text-amber-950 bg-amber-100/80 border border-amber-300/80 rounded-xl hover:bg-amber-200/80 transition-colors duration-150 whitespace-nowrap"
                >
                  <span>Découvrir les 3 offres</span>
                </Link>
              </div>
              <p className="text-xs font-medium text-slate-500">
                Offre gratuite pour démarrer · Facturation par groupe et jamais par membre
              </p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, scale: 0.97, y: 14 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.08, ease: [0.16, 1, 0.3, 1] }}
              className="lg:col-span-6 group"
            >
              <EditorialImage
                src="/src/assets/images/kpata_hero_collaboration_1795598769055.jpg"
                alt="Membres d'une famille et jeunes actifs à Abomey-Calavi organisant leurs dépenses communes sur KPATA"
                aspectClass="aspect-[16/10] w-full"
                overlay={
                  <div className="absolute inset-x-0 bottom-0 p-4 sm:p-5 bg-gradient-to-t from-[#042F24]/95 via-[#042F24]/75 to-transparent text-white">
                    <div className="flex flex-wrap items-center justify-between gap-2 text-xs sm:text-sm">
                      <div>
                        <p className="font-display font-bold text-white">Courses marché Dantokpa</p>
                        <p className="text-emerald-200/90 text-xs">
                          Mariam 5 000 FCFA + Jean 10 000 FCFA
                        </p>
                      </div>
                      <span className="font-mono font-bold text-amber-300 tabular-nums">
                        15 000 FCFA · Soldes à jour
                      </span>
                    </div>
                  </div>
                }
              />
            </motion.div>
          </div>

          {/* Colorful 4-Metric Ribbon */}
          <div className="mt-14 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {[
              {
                icon: Calculator,
                accent: 'bg-emerald-100 text-emerald-800',
                val: '6 méthodes',
                desc: 'Équitable, personnalisée, %, poids, participation ou fixe',
              },
              {
                icon: Layers,
                accent: 'bg-amber-100 text-amber-800',
                val: 'Multi-payeurs',
                desc: 'Plusieurs personnes peuvent avancer une même dépense',
              },
              {
                icon: Crown,
                accent: 'bg-teal-100 text-teal-800',
                val: '3 offres claires',
                desc: 'Gratuit (0), Premium (500) et Association (1 000 FCFA)',
              },
              {
                icon: ShieldCheck,
                accent: 'bg-sky-100 text-sky-800',
                val: '100 % exact',
                desc: 'Calculs entiers en FCFA sans perte d’arrondi',
              },
            ].map((item, i) => {
              const Icon = item.icon;
              return (
                <motion.div
                  key={item.val}
                  initial={{ opacity: 0, y: 14 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, amount: 0.2 }}
                  transition={{ duration: 0.35, delay: i * 0.06, ease: [0.16, 1, 0.3, 1] }}
                  className="bg-white border border-slate-200/90 rounded-2xl p-5 flex items-start gap-4 shadow-xs hover:shadow-md hover:border-emerald-300 transition-all duration-200"
                >
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${item.accent}`}>
                    <Icon className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="font-mono text-lg font-extrabold text-slate-900 tabular-nums">
                      {item.val}
                    </p>
                    <p className="text-xs text-slate-600 mt-0.5 leading-relaxed">{item.desc}</p>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Dedicated Dark-Pine Interactive Simulator */}
      <InteractiveLedgerSection />

      {/* Vibrant Asymmetric Bento Capabilities */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 py-16 lg:py-20 space-y-10">
        <div className="max-w-2xl space-y-3">
          <p className="text-xs font-bold uppercase tracking-wider text-emerald-700">
            Une méthode fiable et colorée
          </p>
          <h2 className="font-display text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">
            Fini les cahiers perdus et les fils WhatsApp confus
          </h2>
          <p className="text-slate-600 leading-relaxed">
            Distinguez ce qui est déclaré de ce qui est réellement confirmé, conservez vos reçus et
            protégez l’historique de chaque membre.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.2 }}
            whileHover={{ y: -4 }}
            transition={{ duration: 0.3 }}
            className="md:col-span-2 bg-gradient-to-br from-[#064E3B] to-[#0F766E] text-white rounded-2xl p-7 sm:p-8 space-y-4 shadow-lg shadow-emerald-950/10"
          >
            <p className="font-mono text-xs font-bold text-amber-300">01. Multi-payeurs & parts exactes</p>
            <h3 className="font-display text-xl sm:text-2xl font-bold">
              Dépenses avancées à plusieurs, soldées au franc près
            </h3>
            <p className="text-sm text-emerald-50/90 leading-relaxed max-w-2xl">
              Pour 15 000 FCFA de courses au marché Dantokpa, Mariam avance 5 000 FCFA et Jean
              10 000 FCFA. KPATA enregistre chaque avance séparément et calcule automatiquement la
              part nette de chacun.
            </p>
            <div className="pt-4 border-t border-white/15 grid grid-cols-3 gap-4 text-xs">
              <div>
                <span className="text-emerald-200/80 block">Avance Mariam</span>
                <span className="font-mono text-sm font-bold text-white tabular-nums">5 000 FCFA</span>
              </div>
              <div>
                <span className="text-emerald-200/80 block">Avance Jean</span>
                <span className="font-mono text-sm font-bold text-white tabular-nums">10 000 FCFA</span>
              </div>
              <div>
                <span className="text-amber-300 block">Total vérifié</span>
                <span className="font-mono text-sm font-bold text-amber-300 tabular-nums">15 000 FCFA</span>
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.2 }}
            whileHover={{ y: -4 }}
            transition={{ duration: 0.3, delay: 0.05 }}
            className="bg-gradient-to-br from-amber-50 to-orange-50/80 border border-amber-200 rounded-2xl p-7 space-y-3"
          >
            <p className="font-mono text-xs font-bold text-amber-800">02. Inclusion sans compte</p>
            <h3 className="font-display text-xl font-bold text-slate-900">
              Intégrez toute la famille dès le premier jour
            </h3>
            <p className="text-sm text-slate-700 leading-relaxed">
              Ajoutez un parent, un enfant ou un membre d’association sans compte KPATA. Son
              historique reste intact et pourra être rattaché en toute sécurité plus tard.
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.2 }}
            whileHover={{ y: -4 }}
            transition={{ duration: 0.3, delay: 0.08 }}
            className="bg-gradient-to-br from-emerald-50 to-teal-50/80 border border-emerald-200 rounded-2xl p-7 space-y-3"
          >
            <p className="font-mono text-xs font-bold text-emerald-800">03. Cotisations & preuves</p>
            <h3 className="font-display text-xl font-bold text-slate-900">
              Déclaré n’est jamais confondu avec confirmé
            </h3>
            <p className="text-sm text-slate-700 leading-relaxed">
              Suivez séparément l’attendu, le déclaré et le confirmé. Acceptez les versements
              partiels (4 000 + 6 000 FCFA) avec validation du créancier ou du trésorier.
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.2 }}
            whileHover={{ y: -4 }}
            transition={{ duration: 0.3, delay: 0.12 }}
            className="md:col-span-2 bg-gradient-to-br from-white to-sky-50/80 border border-sky-200 rounded-2xl p-7 sm:p-8 space-y-3"
          >
            <p className="font-mono text-xs font-bold text-sky-800">04. Budgets, coffre-fort & exports</p>
            <h3 className="font-display text-xl font-bold text-slate-900">
              Anticipez les dépenses du foyer et exportez vos bilans PDF / Excel
            </h3>
            <p className="text-sm text-slate-700 leading-relaxed max-w-2xl">
              Définissez des plafonds mensuels par catégorie (alimentation, électricité SBEE, eau
              SONEB, loyer) avec alertes à 50 %, 75 %, 90 % et 100 %, archivez vos factures dans un
              coffre-fort protégé et exportez vos rapports comptables.
            </p>
          </motion.div>
        </div>
      </section>

      {/* Use Cases Photography Cards */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 pb-16 lg:pb-20 space-y-10">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-t border-slate-200 pt-14">
          <div className="space-y-2 max-w-2xl">
            <h2 className="font-display text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">
              Un espace coloré et clair pour chaque communauté
            </h2>
            <p className="text-slate-600">
              Appartenez simultanément à plusieurs groupes indépendants sans jamais mélanger leurs
              opérations financières.
            </p>
          </div>
          <Link
            to="/groupes"
            className="text-sm font-semibold text-emerald-700 hover:text-emerald-900 whitespace-nowrap"
          >
            Voir les 12 types de groupes →
          </Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {[
            {
              img: '/src/assets/images/kpata_family_budget_1795598769578.jpg',
              alt: 'Gestion des dépenses familiales et du budget du foyer au Bénin avec KPATA',
              tag: 'Familles & Foyers',
              bar: 'bg-emerald-600',
              title: 'Budget familial & ménage',
              desc: 'Suivez les courses, factures d’eau et d’électricité, loyer et scolarité avec des contributions adaptées à chaque membre.',
            },
            {
              img: '/src/assets/images/kpata_student_colocation_1795598769862.jpg',
              alt: 'Gestion des dépenses entre colocataires et étudiants partageant loyer et Internet',
              tag: 'Colocations & Voyages',
              bar: 'bg-amber-500',
              title: 'Colocation & frais de voyage',
              desc: 'Partagez équitablement loyer, Wi-Fi, sorties ou transport. L’optimiseur réduit au minimum les virements nécessaires.',
            },
            {
              img: '/src/assets/images/kpata_association_group_1795598770028.jpg',
              alt: 'Gestion des dépenses d\'une association et suivi des cotisations collectives',
              tag: 'Associations & Tontines',
              bar: 'bg-teal-600',
              title: 'Associations & cotisations',
              desc: 'Nommez un trésorier, encaissez les cotisations périodiques par versements partiels et publiez des bilans transparents.',
            },
          ].map((card, i) => (
            <motion.article
              key={card.title}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.2 }}
              transition={{ duration: 0.35, delay: i * 0.08 }}
              className="group bg-white border border-slate-200 rounded-2xl overflow-hidden hover:shadow-lg hover:border-emerald-300 transition-all duration-200 flex flex-col"
            >
              <div className="overflow-hidden">
                <EditorialImage src={card.img} alt={card.alt} aspectClass="aspect-[4/3] rounded-none border-0" />
              </div>
              <div className={`h-1 w-full ${card.bar}`} />
              <div className="p-5 space-y-2 flex-1">
                <p className="text-xs font-bold text-emerald-700">{card.tag}</p>
                <h3 className="font-display text-lg font-bold text-slate-900">{card.title}</h3>
                <p className="text-sm text-slate-600 leading-relaxed">{card.desc}</p>
              </div>
            </motion.article>
          ))}
        </div>
      </section>

      {/* Vibrant CTA Banner */}
      <section className="bg-gradient-to-r from-[#042F24] via-[#064E3B] to-[#0B5D48] text-white py-16">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-8">
          <div className="space-y-3 max-w-2xl">
            <h2 className="font-display text-2xl sm:text-3xl font-bold tracking-tight">
              Trois offres simples et accessibles, facturées par groupe
            </h2>
            <p className="text-emerald-100/85 leading-relaxed text-sm sm:text-base">
              Une famille ou une association complète ne paie qu’un seul abonnement pour tout le
              groupe : Gratuit (0 FCFA), Premium Famille (500 FCFA / mois) ou Association &
              Organisation (1 000 FCFA / mois).
            </p>
          </div>
          <div className="flex flex-wrap gap-3 shrink-0">
            <Link
              to="/tarifs"
              className="px-5 py-3 text-sm font-bold bg-amber-400 text-slate-950 rounded-xl hover:bg-amber-300 transition-colors whitespace-nowrap"
            >
              Comparer les 3 offres
            </Link>
            <Link
              to="/connexion"
              className="px-5 py-3 text-sm font-semibold bg-white/15 text-white border border-white/25 rounded-xl hover:bg-white/25 transition-colors whitespace-nowrap"
            >
              Tester la démo Bénin
            </Link>
          </div>
        </div>
      </section>
    </PublicLayout>
  );
}

export function FeaturesPage() {
  const sections = [
    {
      num: '01',
      tint: 'from-emerald-50 to-white border-emerald-200',
      numColor: 'text-emerald-700',
      title: 'Dépenses collectives, partielles et multi-payeurs',
      body: 'Enregistrez des dépenses réglées par un ou plusieurs membres simultanément. KPATA vérifie côté serveur que la somme des avances correspond au montant payé et distingue payeurs, bénéficiaires et parts individuelles.',
    },
    {
      num: '02',
      tint: 'from-amber-50 to-white border-amber-200',
      numColor: 'text-amber-700',
      title: 'Six méthodes de répartition sans erreur d’arrondi',
      body: 'Choisissez entre répartition équitable, personnalisée, en pourcentage, par poids (coefficients familiaux), par participation effective ou par montant fixe. Les arrondis en FCFA sont équilibrés au franc près.',
    },
    {
      num: '03',
      tint: 'from-teal-50 to-white border-teal-200',
      numColor: 'text-teal-700',
      title: 'Cotisations périodiques et versements partiels',
      body: 'Créez des appels de cotisation pour une famille ou une association. Chaque membre peut régler en plusieurs fois ; le trésorier distingue clairement ce qui est attendu, déclaré, confirmé ou contesté.',
    },
    {
      num: '04',
      tint: 'from-sky-50 to-white border-sky-200',
      numColor: 'text-sky-700',
      title: 'Remboursements vérifiés et optimisation des dettes',
      body: 'Déclarez un remboursement effectué via MTN Mobile Money, Moov Money, Celtiis ou en espèces. Le solde n’évolue qu’après confirmation du créancier. Un algorithme propose le minimum de transferts pour tout équilibrer.',
    },
    {
      num: '05',
      tint: 'from-emerald-50 to-white border-emerald-200',
      numColor: 'text-emerald-700',
      title: 'Membres externes sans compte KPATA',
      body: 'Ajoutez immédiatement vos proches sans leur imposer la création d’un compte. Lorsqu’ils rejoignent KPATA plus tard, ils peuvent rattacher leur historique existant avec validation sécurisée.',
    },
    {
      num: '06',
      tint: 'from-amber-50 to-white border-amber-200',
      numColor: 'text-amber-700',
      title: 'Budgets, coffre-fort documentaire et exports PDF/Excel',
      body: 'Surveillez vos plafonds mensuels par catégorie avec alertes à 50 %, 75 %, 90 % et 100 %, joignez vos reçus (images ou PDF) et exportez vos bilans financiers complets.',
    },
  ];

  return (
    <PublicLayout>
      <section className="max-w-6xl mx-auto px-4 sm:px-6 py-14 lg:py-16 space-y-12">
        <div className="max-w-3xl space-y-4">
          <p className="text-xs font-bold uppercase tracking-wider text-emerald-700">
            Fonctionnalités KPATA
          </p>
          <h1 className="font-display text-3xl sm:text-4xl font-bold text-slate-900 tracking-tight">
            Tout ce qu’il faut pour une gestion financière collective transparente
          </h1>
          <p className="text-base sm:text-lg text-slate-600 leading-relaxed">
            Conçue comme une application de partage des dépenses fiable et compréhensible, KPATA
            remplace les calculs manuels et évite les malentendus entre membres.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {sections.map((s, idx) => (
            <motion.div
              key={s.num}
              initial={{ opacity: 0, y: 14 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.15 }}
              transition={{ duration: 0.3, delay: idx * 0.04 }}
              whileHover={{ y: -3 }}
              className={`border rounded-2xl p-6 sm:p-8 bg-gradient-to-br ${s.tint} space-y-3 hover:shadow-md transition-all`}
            >
              <span className={`font-mono text-xs font-extrabold ${s.numColor}`}>{s.num}.</span>
              <h2 className="font-display text-xl font-bold text-slate-900">{s.title}</h2>
              <p className="text-sm text-slate-600 leading-relaxed">{s.body}</p>
            </motion.div>
          ))}
        </div>

        <div className="bg-gradient-to-r from-[#042F24] to-[#064E3B] text-white rounded-2xl p-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
          <div className="space-y-1">
            <h2 className="font-display text-xl font-bold">
              Prêt à organiser les finances de votre groupe ?
            </h2>
            <p className="text-sm text-emerald-100/80">
              Créez votre premier espace en moins de deux minutes, sans carte bancaire.
            </p>
          </div>
          <Link
            to="/inscription"
            className="px-5 py-3 text-sm font-bold text-slate-950 bg-amber-400 rounded-xl hover:bg-amber-300 transition-colors whitespace-nowrap"
          >
            Ouvrir un compte gratuit
          </Link>
        </div>
      </section>
    </PublicLayout>
  );
}

export function GroupsShowcasePage() {
  const accentBorders = [
    'border-emerald-200 hover:border-emerald-400',
    'border-amber-200 hover:border-amber-400',
    'border-teal-200 hover:border-teal-400',
    'border-sky-200 hover:border-sky-400',
  ];

  return (
    <PublicLayout>
      <section className="max-w-6xl mx-auto px-4 sm:px-6 py-14 lg:py-16 space-y-12">
        <div className="max-w-3xl space-y-4">
          <p className="text-xs font-bold uppercase tracking-wider text-emerald-700">
            Multi-groupes indépendants
          </p>
          <h1 className="font-display text-3xl sm:text-4xl font-bold text-slate-900 tracking-tight">
            Douze types de groupes, une isolation financière stricte
          </h1>
          <p className="text-base sm:text-lg text-slate-600 leading-relaxed">
            Vous pouvez être administrateur du budget familial, membre d’une colocation étudiante
            et trésorier d’une association : chaque espace conserve ses propres soldes, devises,
            rôles et justificatifs.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {GROUP_TYPES.map((g, idx) => (
            <motion.div
              key={g.value}
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.15 }}
              transition={{ duration: 0.25, delay: (idx % 6) * 0.04 }}
              whileHover={{ y: -3 }}
              className={`border rounded-2xl p-6 bg-white space-y-2 hover:shadow-md transition-all ${
                accentBorders[idx % accentBorders.length]
              }`}
            >
              <h2 className="font-display text-lg font-bold text-slate-900">{g.label}</h2>
              <p className="text-sm text-slate-600 leading-relaxed">{g.description}</p>
            </motion.div>
          ))}
        </div>

        <div className="border-t border-slate-200 pt-10 grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
          <div className="space-y-4">
            <h2 className="font-display text-2xl font-bold text-slate-900 tracking-tight">
              Rôles techniques indépendants des liens familiaux
            </h2>
            <p className="text-sm text-slate-600 leading-relaxed">
              Dans KPATA, les permissions (Propriétaire, Administrateur, Trésorier, Membre,
              Observateur) sont contrôlées côté serveur indépendamment du lien familial ou du titre
              associatif. Aucun départ de membre n’efface ses dettes ou son historique.
            </p>
          </div>
          <div className="border border-emerald-200 rounded-2xl p-6 bg-gradient-to-br from-emerald-50 to-white space-y-2.5 text-sm">
            <p className="font-bold text-emerald-950">Rôles disponibles par groupe :</p>
            <ul className="space-y-1.5 text-slate-700">
              <li>• Propriétaire : paramètres, rôles, archivage et abonnement</li>
              <li>• Administrateur : gestion des membres, invitations et dépenses</li>
              <li>• Trésorier (offre Association & Org) : cotisations, validations et bilans</li>
              <li>• Membre : ajout de dépenses, consultation des soldes et déclarations</li>
              <li>• Observateur : lecture seule sur les données autorisées</li>
            </ul>
          </div>
        </div>
      </section>
    </PublicLayout>
  );
}

const COMPARISON_ROWS: {
  label: string;
  values: Record<SubscriptionPlanCode, string | boolean>;
}[] = [
  {
    label: 'Membres actifs par groupe',
    values: { FREE: 'Jusqu’à 5', PREMIUM: 'Jusqu’à 20', ORG: 'Illimité' },
  },
  {
    label: 'Méthodes de répartition',
    values: {
      FREE: '2 (Équitable, Participation)',
      PREMIUM: 'Les 6 méthodes exactes',
      ORG: 'Les 6 méthodes exactes',
    },
  },
  {
    label: 'Dépenses multi-payeurs & membres sans compte',
    values: { FREE: true, PREMIUM: true, ORG: true },
  },
  {
    label: 'Appels de cotisation actifs',
    values: { FREE: '1 ponctuel', PREMIUM: 'Jusqu’à 5', ORG: 'Illimité' },
  },
  {
    label: 'Dépenses & cotisations récurrentes',
    values: { FREE: false, PREMIUM: true, ORG: true },
  },
  {
    label: 'Budgets par catégorie & alertes 50–100 %',
    values: { FREE: '1 budget', PREMIUM: 'Jusqu’à 10', ORG: 'Illimité' },
  },
  {
    label: 'Objectifs d’épargne collective',
    values: { FREE: false, PREMIUM: true, ORG: true },
  },
  {
    label: 'Coffre-fort justificatifs (images & PDF)',
    values: { FREE: '3 fichiers', PREMIUM: '100 fichiers', ORG: 'Illimité' },
  },
  {
    label: 'Exports bilans PDF & Excel (.xlsx)',
    values: { FREE: false, PREMIUM: true, ORG: true },
  },
  {
    label: 'Rôle Trésorier dédié & gouvernance associative',
    values: { FREE: false, PREMIUM: false, ORG: true },
  },
];

export function PricingPage() {
  const { user } = useAuth();
  const [plans, setPlans] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch<{ plans: any[] }>('/api/plans')
      .then((res) => setPlans(res.plans))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const targetHref = (code: string) => {
    if (code === 'FREE') {
      return user ? '/app/groups' : '/inscription';
    }
    return user ? `/app/abonnement?plan=${code}` : `/inscription?plan=${code}`;
  };

  const tierSubtitle = (code: string) => {
    if (code === 'FREE') return 'Pour découvrir à petit comité';
    if (code === 'PREMIUM') return 'Idéal Familles, Couples & Colocs';
    return 'Recommandé Associations, Tontines & Clubs';
  };

  return (
    <PublicLayout>
      <section className="max-w-6xl mx-auto px-4 sm:px-6 py-14 lg:py-16 space-y-12">
        <div className="max-w-3xl space-y-4">
          <p className="text-xs font-bold uppercase tracking-wider text-emerald-700">
            Trois offres diversifiées par groupe
          </p>
          <h1 className="font-display text-3xl sm:text-4xl font-bold text-slate-900 tracking-tight">
            Une tarification vibrante, claire et adaptée à votre groupe
          </h1>
          <p className="text-base sm:text-lg text-slate-600 leading-relaxed">
            Facturation unique par groupe et jamais par membre. Chaque offre payante nécessite un
            règlement validé (FedaPay Mobile Money / carte ou transfert vérifié) avant déblocage de
            ses fonctionnalités avancées.
          </p>
        </div>

        <div className="bg-gradient-to-r from-[#042F24] to-[#064E3B] text-white rounded-2xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-sm shadow-md">
          <div className="flex items-center gap-3">
            <Lock className="w-4 h-4 text-amber-300 shrink-0" />
            <span>
              <strong>Paiement requis avant activation :</strong> le choix d’une offre payante
              redirige vers l’écran de règlement avant toute activation sur votre groupe.
            </span>
          </div>
          <span className="font-mono text-xs text-amber-300 font-semibold shrink-0">
            MTN MoMo · Moov · Celtiis · Visa
          </span>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-96 rounded-2xl border border-slate-200 bg-white animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {plans.map((p, idx) => {
              const isPremium = p.code === 'PREMIUM';
              const isOrg = p.code === 'ORG';
              const isPaid = p.monthlyPriceInt > 0;
              const ent = PLAN_ENTITLEMENTS[p.code as SubscriptionPlanCode];
              return (
                <motion.div
                  key={p.code}
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.35, delay: idx * 0.06 }}
                  whileHover={{ y: -4 }}
                  className={`rounded-2xl p-7 flex flex-col justify-between space-y-6 transition-shadow ${
                    isPremium
                      ? 'bg-gradient-to-br from-[#042F24] via-[#064E3B] to-[#0B5D48] text-white shadow-xl shadow-emerald-950/15 border border-emerald-700'
                      : isOrg
                      ? 'bg-gradient-to-br from-amber-50/70 via-white to-white border-2 border-amber-400 text-slate-900 shadow-sm'
                      : 'bg-white border border-slate-200 text-slate-900 hover:shadow-md'
                  }`}
                >
                  <div className="space-y-4">
                    <div className="space-y-1">
                      <p
                        className={`text-xs font-bold flex items-center gap-1.5 ${
                          isPremium
                            ? 'text-amber-300'
                            : isOrg
                            ? 'text-amber-700'
                            : 'text-emerald-700'
                        }`}
                      >
                        <Users className="w-3.5 h-3.5 shrink-0" />
                        <span>{tierSubtitle(p.code)}</span>
                      </p>
                      <h2 className="font-display text-2xl font-bold">{p.name}</h2>
                    </div>

                    <div className="flex items-baseline gap-1.5">
                      <span className="font-mono text-3xl font-extrabold tabular-nums">
                        {formatMoney(p.monthlyPriceInt, p.currency)}
                      </span>
                      <span
                        className={`text-xs ${
                          isPremium ? 'text-emerald-200/80' : 'text-slate-500'
                        }`}
                      >
                        / groupe / mois
                      </span>
                    </div>

                    <p
                      className={`text-sm leading-relaxed ${
                        isPremium ? 'text-emerald-100/90' : 'text-slate-600'
                      }`}
                    >
                      {ent?.tagline || p.description}
                    </p>

                    <ul
                      className={`space-y-2.5 pt-4 border-t ${
                        isPremium ? 'border-white/15' : 'border-slate-100'
                      }`}
                    >
                      {(p.features || []).map((f: string) => (
                        <li key={f} className="flex items-start gap-2.5 text-sm">
                          <Check
                            className={`w-4 h-4 shrink-0 mt-0.5 ${
                              isPremium
                                ? 'text-amber-300'
                                : isOrg
                                ? 'text-amber-600'
                                : 'text-emerald-700'
                            }`}
                          />
                          <span className={isPremium ? 'text-emerald-50' : 'text-slate-700'}>{f}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <Link
                    to={targetHref(p.code)}
                    className={`w-full inline-flex items-center justify-center gap-1.5 text-center py-3 px-4 rounded-xl text-sm font-bold transition-colors ${
                      isPremium
                        ? 'bg-amber-400 text-slate-950 hover:bg-amber-300'
                        : isPaid
                        ? 'bg-gradient-to-r from-amber-600 to-orange-600 text-white hover:from-amber-700 hover:to-orange-700'
                        : 'border border-slate-300 text-slate-800 hover:bg-slate-50'
                    }`}
                  >
                    <span>
                      {isPaid
                        ? `Souscrire & Payer (${formatMoney(p.monthlyPriceInt, p.currency)})`
                        : 'Démarrer gratuitement'}
                    </span>
                    <ArrowRight className="w-4 h-4" />
                  </Link>
                </motion.div>
              );
            })}
          </div>
        )}

        {/* Feature Comparison Matrix */}
        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-xs">
          <div className="px-6 py-5 border-b border-slate-200 bg-gradient-to-r from-emerald-50/70 to-amber-50/50">
            <h2 className="font-display text-lg font-bold text-slate-900">
              Tableau comparatif des 3 offres
            </h2>
            <p className="text-xs text-slate-600 mt-0.5">
              Chaque offre débloque des capacités distinctes vérifiées côté serveur sur votre groupe.
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs sm:text-sm">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-700">
                <tr>
                  <th className="px-5 py-3.5 font-semibold">Fonctionnalité</th>
                  <th className="px-4 py-3.5 font-semibold text-center">Gratuit (0 FCFA)</th>
                  <th className="px-4 py-3.5 font-bold text-center text-emerald-800">
                    Premium (500 FCFA)
                  </th>
                  <th className="px-4 py-3.5 font-bold text-center text-amber-800">
                    Association & Org (1 000 FCFA)
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {COMPARISON_ROWS.map((row) => (
                  <tr key={row.label} className="hover:bg-emerald-50/30 transition-colors">
                    <td className="px-5 py-3.5 font-medium text-slate-800">{row.label}</td>
                    {(['FREE', 'PREMIUM', 'ORG'] as SubscriptionPlanCode[]).map((code) => {
                      const val = row.values[code];
                      return (
                        <td key={code} className="px-4 py-3.5 text-center">
                          {typeof val === 'boolean' ? (
                            val ? (
                              <Check className="w-4 h-4 text-emerald-700 mx-auto" />
                            ) : (
                              <Minus className="w-4 h-4 text-slate-300 mx-auto" />
                            )
                          ) : (
                            <span className="font-mono text-xs font-medium text-slate-700">{val}</span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </PublicLayout>
  );
}

export function FaqPage() {
  const [openIdx, setOpenIdx] = useState<number | null>(0);
  const items = [
    {
      q: 'Est-ce que KPATA conserve l’argent des membres ou remplace un compte Mobile Money ?',
      a: 'Non. KPATA est une plateforme de suivi, de répartition et de transparence financière. Les membres effectuent leurs règlements directement entre eux (espèces, MTN MoMo, Moov Money, Celtiis, virement) puis déclarent et confirment chaque opération sur KPATA.',
    },
    {
      q: 'Puis-je ajouter un parent ou un membre qui n’a pas encore de compte KPATA ?',
      a: 'Oui. Les administrateurs peuvent créer des membres externes sans compte afin qu’ils participent aux dépenses, parts et remboursements dès le premier jour. Lorsque la personne crée un compte plus tard, elle peut demander le rattachement sécurisé de son profil tout en conservant son historique.',
    },
    {
      q: 'Comment fonctionne une dépense payée par plusieurs personnes ?',
      a: 'Lors de la création d’une dépense, vous pouvez ajouter plusieurs payeurs et indiquer exactement combien chacun a avancé (par exemple 5 000 FCFA pour Mariam et 10 000 FCFA pour Jean sur une course de 15 000 FCFA), indépendamment des parts de consommation.',
    },
    {
      q: 'Comment fonctionne l’activation d’un abonnement payant (Premium ou Association) ?',
      a: 'Lorsque vous sélectionnez une offre payante, vous êtes redirigé vers la page de paiement (FedaPay Mobile Money / carte bancaire ou déclaration de transfert vérifiée par le propriétaire du site). Aucune fonctionnalité payante n’est débloquée sans confirmation effective du paiement.',
    },
    {
      q: 'Mes données d’un groupe sont-elles visibles par les autres groupes ou sur Google ?',
      a: 'Jamais. Chaque groupe est strictement isolé côté serveur, et toutes les pages privées (tableaux de bord, dépenses, membres, administration) sont bloquées à l’indexation par les moteurs de recherche.',
    },
  ];

  return (
    <PublicLayout>
      <section className="max-w-4xl mx-auto px-4 sm:px-6 py-14 lg:py-16 space-y-10">
        <div className="space-y-3">
          <p className="text-xs font-bold uppercase tracking-wider text-emerald-700">
            Aide & Transparence
          </p>
          <h1 className="font-display text-3xl sm:text-4xl font-bold text-slate-900 tracking-tight">
            Questions fréquentes sur KPATA
          </h1>
        </div>

        <div className="divide-y divide-slate-200 border border-slate-200 rounded-2xl bg-white overflow-hidden shadow-xs">
          {items.map((item, idx) => {
            const isOpen = openIdx === idx;
            return (
              <div key={item.q} className={`p-5 sm:p-6 transition-colors ${isOpen ? 'bg-emerald-50/40' : ''}`}>
                <button
                  type="button"
                  onClick={() => setOpenIdx(isOpen ? null : idx)}
                  className="w-full flex items-center justify-between gap-4 text-left"
                >
                  <span className="font-display font-semibold text-slate-900">{item.q}</span>
                  <ChevronDown
                    className={`w-5 h-5 text-emerald-700 shrink-0 transition-transform duration-200 ${
                      isOpen ? 'rotate-180' : ''
                    }`}
                  />
                </button>
                <AnimatePresence initial={false}>
                  {isOpen && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
                      className="overflow-hidden"
                    >
                      <p className="mt-3 text-sm text-slate-600 leading-relaxed">{item.a}</p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </div>
      </section>
    </PublicLayout>
  );
}

export function ContactPage() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [status, setStatus] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setStatus(null);
    try {
      await apiFetch('/api/contact', {
        method: 'POST',
        body: JSON.stringify({ name, email, subject, message }),
      });
      setStatus({
        type: 'ok',
        text: 'Votre message a bien été enregistré. Notre équipe vous répondra rapidement.',
      });
      setName('');
      setEmail('');
      setSubject('');
      setMessage('');
    } catch (err: any) {
      setStatus({ type: 'err', text: err?.message || 'Erreur lors de l’envoi.' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <PublicLayout>
      <section className="max-w-5xl mx-auto px-4 sm:px-6 py-14 lg:py-16 grid grid-cols-1 lg:grid-cols-12 gap-10">
        <div className="lg:col-span-5 space-y-5">
          <p className="text-xs font-bold uppercase tracking-wider text-emerald-700">
            Contact KPATA
          </p>
          <h1 className="font-display text-3xl font-bold text-slate-900 tracking-tight">
            Parlons de votre groupe ou association
          </h1>
          <p className="text-sm text-slate-600 leading-relaxed">
            Une question sur l’utilisation de KPATA au Bénin, un besoin pour une association ou une
            suggestion d’amélioration ? Écrivez-nous directement.
          </p>
          <div className="space-y-3 pt-4 border-t border-slate-200 text-sm text-slate-700">
            <p className="flex items-center gap-2.5">
              <MapPin className="w-4 h-4 text-emerald-700 shrink-0" />
              <span>Abomey-Calavi, République du Bénin</span>
            </p>
            <p className="flex items-center gap-2.5">
              <Mail className="w-4 h-4 text-amber-600 shrink-0" />
              <a href="mailto:yekinikoubou@gmail.com" className="hover:text-emerald-800 hover:underline font-medium">
                yekinikoubou@gmail.com
              </a>
            </p>
            <p className="flex items-center gap-2.5">
              <Phone className="w-4 h-4 text-emerald-700 shrink-0" />
              <a href="tel:+2290150495832" className="font-mono hover:text-emerald-800 hover:underline font-medium">
                0150495832 (+229)
              </a>
            </p>
            <p className="flex items-center gap-2.5">
              <Shield className="w-4 h-4 text-teal-700 shrink-0" />
              <span>Support pilote & partenariats associatifs</span>
            </p>
          </div>
        </div>

        <form
          onSubmit={handleSubmit}
          className="lg:col-span-7 border border-slate-200 rounded-2xl p-6 sm:p-8 bg-white shadow-xs space-y-4"
        >
          <h2 className="font-display text-lg font-bold text-slate-900">Envoyer un message</h2>
          {status && (
            <div
              className={`p-3 rounded-xl text-sm border ${
                status.type === 'ok'
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                  : 'bg-red-50 border-red-200 text-red-800'
              }`}
            >
              {status.text}
            </div>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <label className="block space-y-1.5 text-sm">
              <span className="font-medium text-slate-700">Nom complet</span>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-3.5 py-2 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-600"
              />
            </label>
            <label className="block space-y-1.5 text-sm">
              <span className="font-medium text-slate-700">Adresse e-mail</span>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-3.5 py-2 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-600"
              />
            </label>
          </div>
          <label className="block space-y-1.5 text-sm">
            <span className="font-medium text-slate-700">Objet</span>
            <input
              type="text"
              required
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="w-full px-3.5 py-2 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-600"
            />
          </label>
          <label className="block space-y-1.5 text-sm">
            <span className="font-medium text-slate-700">Message</span>
            <textarea
              required
              rows={5}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              className="w-full px-3.5 py-2 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-600"
            />
          </label>
          <button
            type="submit"
            disabled={submitting}
            className="px-5 py-2.5 text-sm font-semibold text-white bg-gradient-to-r from-emerald-700 to-teal-700 rounded-xl hover:from-emerald-800 hover:to-teal-800 disabled:opacity-50 transition-all"
          >
            {submitting ? 'Envoi en cours...' : 'Envoyer le message'}
          </button>
        </form>
      </section>
    </PublicLayout>
  );
}

export function TermsPage() {
  return (
    <PublicLayout>
      <article className="max-w-3xl mx-auto px-4 sm:px-6 py-14 space-y-6">
        <h1 className="font-display text-3xl font-bold text-slate-900">
          Conditions générales d’utilisation
        </h1>
        <p className="text-sm text-slate-500">Version applicable au lancement pilote au Bénin</p>
        <section className="space-y-2">
          <h2 className="font-display text-lg font-bold text-slate-900">1. Nature du service</h2>
          <p className="text-sm text-slate-600 leading-relaxed">
            KPATA est un outil numérique collaboratif de suivi des dépenses, contributions,
            cotisations et remboursements entre membres d’un groupe. KPATA n’est ni un établissement
            bancaire, ni un prestataire de monnaie électronique, et ne conserve aucun fonds pour le
            compte des groupes.
          </p>
        </section>
        <section className="space-y-2">
          <h2 className="font-display text-lg font-bold text-slate-900">2. Fiabilité des opérations</h2>
          <p className="text-sm text-slate-600 leading-relaxed">
            Les règlements déclarés entre membres restent en attente jusqu’à confirmation par le
            bénéficiaire ou un responsable autorisé. Toute annulation ou modification financière est
            journalisée afin de préserver la transparence au sein du groupe.
          </p>
        </section>
        <section className="space-y-2">
          <h2 className="font-display text-lg font-bold text-slate-900">3. Abonnements par groupe</h2>
          <p className="text-sm text-slate-600 leading-relaxed">
            Les abonnements Premium et Association & Organisation s’appliquent par groupe et donnent
            accès à des fonctionnalités étendues d’export, de budgets et de gouvernance. Les paiements
            électroniques sont traités via FedaPay ou vérifiés manuellement avant activation.
          </p>
        </section>
      </article>
    </PublicLayout>
  );
}

export function PrivacyPage() {
  return (
    <PublicLayout>
      <article className="max-w-3xl mx-auto px-4 sm:px-6 py-14 space-y-6">
        <h1 className="font-display text-3xl font-bold text-slate-900">
          Politique de confidentialité et protection des données
        </h1>
        <p className="text-sm text-slate-500">
          Conformité aux principes de protection des données personnelles au Bénin et en Afrique de
          l’Ouest
        </p>
        <section className="space-y-2">
          <h2 className="font-display text-lg font-bold text-slate-900">1. Minimisation des données</h2>
          <p className="text-sm text-slate-600 leading-relaxed">
            KPATA collecte uniquement les informations nécessaires au fonctionnement des comptes et
            des groupes (nom, prénom, e-mail, téléphone facultatif et écritures financières du
            groupe). Aucune donnée financière n’est revendue ou exposée aux moteurs de recherche.
          </p>
        </section>
        <section className="space-y-2">
          <h2 className="font-display text-lg font-bold text-slate-900">2. Isolation et accès administrateur</h2>
          <p className="text-sm text-slate-600 leading-relaxed">
            Les données de chaque groupe sont strictement isolées. L’administration centrale ne
            consulte pas les dépenses privées des groupes dans son tableau de bord courant, et toute
            opération sensible est journalisée.
          </p>
        </section>
        <section className="space-y-2">
          <h2 className="font-display text-lg font-bold text-slate-900">3. Cookies et mesure d’audience</h2>
          <p className="text-sm text-slate-600 leading-relaxed">
            Des cookies de session sécurisés (HttpOnly) assurent l’authentification. Les cookies de
            statistiques Google Analytics 4 ne sont activés qu’après votre consentement explicite et
            avec anonymisation d’adresse IP, sans collecte de données personnelles identifiantes.
          </p>
        </section>
      </article>
    </PublicLayout>
  );
}

export function NotFoundPage() {
  return (
    <PublicLayout>
      <section className="max-w-2xl mx-auto px-4 py-24 text-center space-y-5">
        <p className="font-mono text-sm font-bold text-emerald-700">Erreur 404</p>
        <h1 className="font-display text-3xl font-bold text-slate-900">
          Cette page est introuvable
        </h1>
        <p className="text-slate-600">
          L’adresse demandée n’existe pas ou a été déplacée. Vous pouvez revenir à l’accueil public
          de KPATA ou accéder à votre tableau de bord.
        </p>
        <div className="flex items-center justify-center gap-3 pt-2">
          <Link
            to="/"
            className="px-5 py-2.5 text-sm font-semibold text-white bg-gradient-to-r from-emerald-700 to-teal-700 rounded-xl"
          >
            Retour à l’accueil
          </Link>
          <Link
            to="/app"
            className="px-5 py-2.5 text-sm font-semibold text-slate-700 border border-slate-300 rounded-xl hover:bg-slate-50"
          >
            Mon espace
          </Link>
        </div>
      </section>
    </PublicLayout>
  );
}
