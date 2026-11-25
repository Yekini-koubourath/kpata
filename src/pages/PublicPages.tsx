import React, { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  ArrowRight,
  Check,
  ChevronDown,
  Lock,
  Mail,
  MapPin,
  Minus,
  Shield,
  Users,
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
}: {
  src: string;
  alt: string;
  caption?: string;
  aspectClass?: string;
}) {
  const [failed, setFailed] = useState(false);

  return (
    <div className={`relative overflow-hidden rounded-2xl border border-stone-200 bg-stone-100 ${aspectClass}`}>
      {!failed ? (
        <img
          src={src}
          alt={alt}
          referrerPolicy="no-referrer"
          onError={() => setFailed(true)}
          className="w-full h-full object-cover transition-opacity duration-200"
        />
      ) : (
        <div className="w-full h-full flex flex-col items-center justify-center p-6 text-center bg-gradient-to-br from-stone-100 to-emerald-50">
          <span className="font-display text-sm font-semibold text-stone-700">KPATA</span>
          <span className="text-xs text-stone-500 mt-1">{caption || alt}</span>
        </div>
      )}
    </div>
  );
}

const SIMULATOR_SCENARIOS = [
  {
    key: 'famille',
    label: 'Famille Dossou',
    tag: 'Dépense multi-payeurs · Cotonou',
    subtitle: 'Courses marché Dantokpa · Répartition équitable',
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
    <section className="bg-white border-y border-stone-200/80 py-16 lg:py-20">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 items-center">
        <div className="lg:col-span-5 space-y-6">
          <div className="space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-emerald-800">
              Clarté financière en direct
            </p>
            <h2 className="font-display text-2xl sm:text-3xl font-bold text-stone-900 tracking-tight">
              Chaque franc avancé et chaque part calculée sans erreur
            </h2>
            <p className="text-sm sm:text-base text-stone-600 leading-relaxed">
              Testez trois situations concrètes du quotidien au Bénin : dépenses payées à
              plusieurs, colocation au pourcentage ou cotisations associatives par tranches.
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
                  className={`w-full text-left px-4 py-3.5 rounded-xl border transition-colors duration-150 ${
                    active
                      ? 'bg-[#FAF9F6] border-emerald-800'
                      : 'bg-white border-stone-200 hover:border-stone-300'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-display font-semibold text-sm text-stone-900">
                      {s.label}
                    </span>
                    <span className="font-mono text-xs font-semibold text-emerald-800 tabular-nums">
                      {formatMoney(s.totalInt)}
                    </span>
                  </div>
                  <p className="text-xs text-stone-500 mt-0.5">{s.tag}</p>
                </button>
              );
            })}
          </div>
        </div>

        <div className="lg:col-span-7">
          <div className="bg-[#FAF9F6] border border-stone-200 rounded-2xl p-6 sm:p-8">
            <AnimatePresence mode="wait">
              <motion.div
                key={scenario.key}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
                className="space-y-6"
              >
                <div className="flex flex-wrap items-start justify-between gap-4 pb-5 border-b border-stone-200">
                  <div className="space-y-1">
                    <p className="font-display text-lg font-bold text-stone-900">
                      {scenario.label}
                    </p>
                    <p className="text-xs text-stone-500">{scenario.subtitle}</p>
                  </div>
                  <div className="text-left sm:text-right">
                    <p className="font-mono text-2xl font-bold text-emerald-800 tabular-nums">
                      {formatMoney(scenario.totalInt)}
                    </p>
                    <p className="text-xs text-stone-500">{scenario.method}</p>
                  </div>
                </div>

                <div className="bg-white border border-stone-200 rounded-xl divide-y divide-stone-100">
                  {scenario.rows.map((row) => (
                    <div
                      key={row.name}
                      className="px-4 py-3 flex items-center justify-between gap-3 text-sm"
                    >
                      <span className="font-medium text-stone-800">{row.name}</span>
                      <div className="flex items-center gap-5 font-mono text-xs sm:text-sm tabular-nums">
                        <span className="text-stone-500 hidden sm:inline">
                          Avance {formatMoney(row.advancedInt)}
                        </span>
                        <span
                          className={`font-semibold ${
                            row.netInt > 0
                              ? 'text-emerald-800'
                              : row.netInt < 0
                              ? 'text-red-700'
                              : 'text-stone-500'
                          }`}
                        >
                          {row.netInt > 0
                            ? `+${formatMoney(row.netInt)}`
                            : formatMoney(row.netInt)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="bg-emerald-50/80 border border-emerald-200/80 rounded-xl px-4 py-3 text-xs sm:text-sm text-emerald-950">
                  {scenario.suggestion}
                </div>
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </div>
    </section>
  );
}

export function HomePage() {
  return (
    <PublicLayout>
      {/* Clean Hero Split */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 pt-12 pb-14 lg:pt-20 lg:pb-20">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 items-center">
          <div className="lg:col-span-6 space-y-6">
            <p className="text-xs font-semibold uppercase tracking-wider text-emerald-800">
              Bénin · Afrique de l’Ouest · Gestion en FCFA
            </p>
            <h1
              className="font-display font-bold tracking-tight text-stone-900 leading-[1.08]"
              style={{ fontSize: 'clamp(2.2rem, 4vw, 3.35rem)' }}
            >
              Ensemble, gérons mieux notre argent partagé.
            </h1>
            <p className="text-base sm:text-lg text-stone-600 leading-relaxed max-w-xl">
              KPATA est l’application de gestion des dépenses en groupe conçue pour les familles,
              colocataires, groupes d’amis et associations. Centralisez vos avances multi-payeurs,
              suivez vos cotisations et équilibrez les remboursements en toute transparence.
            </p>
            <div className="flex flex-wrap items-center gap-4 pt-1">
              <Link
                to="/inscription"
                className="inline-flex items-center gap-2 px-6 py-3.5 text-sm font-semibold text-white bg-emerald-800 rounded-xl hover:bg-emerald-900 transition-colors duration-150 whitespace-nowrap"
              >
                <span>Créer un groupe gratuit</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
              <Link
                to="/tarifs"
                className="inline-flex items-center gap-1.5 px-4 py-3 text-sm font-semibold text-stone-700 hover:text-stone-950 transition-colors duration-150 whitespace-nowrap"
              >
                <span>Découvrir les 3 offres</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
            <p className="text-xs text-stone-500">
              Gratuit pour démarrer · Facturation par groupe et jamais par membre
            </p>
          </div>

          <div className="lg:col-span-6">
            <EditorialImage
              src="/src/assets/images/kpata_hero_collaboration_1795598769055.jpg"
              alt="Membres d'une famille et jeunes actifs à Cotonou organisant leurs dépenses communes sur KPATA"
              aspectClass="aspect-[16/10] w-full"
            />
          </div>
        </div>

        {/* Clean 4-Metric Strip */}
        <div className="mt-14 grid grid-cols-2 lg:grid-cols-4 gap-8 border-y border-stone-200/80 py-8">
          <div>
            <p className="font-mono text-2xl font-bold text-stone-900 tabular-nums">6 méthodes</p>
            <p className="text-sm text-stone-600 mt-1">
              Répartition égale, personnalisée, pourcentage, poids, participation ou fixe
            </p>
          </div>
          <div>
            <p className="font-mono text-2xl font-bold text-stone-900 tabular-nums">Multi-payeurs</p>
            <p className="text-sm text-stone-600 mt-1">
              Plusieurs personnes peuvent avancer une même dépense collective
            </p>
          </div>
          <div>
            <p className="font-mono text-2xl font-bold text-stone-900 tabular-nums">3 offres</p>
            <p className="text-sm text-stone-600 mt-1">
              Gratuit (0 FCFA), Premium Famille (500 FCFA) et Association (1 000 FCFA)
            </p>
          </div>
          <div>
            <p className="font-mono text-2xl font-bold text-stone-900 tabular-nums">100 % exact</p>
            <p className="text-sm text-stone-600 mt-1">
              Calculs entiers en FCFA sans perte d’arrondi et soldes isolés par groupe
            </p>
          </div>
        </div>
      </section>

      {/* Dedicated Interactive Ledger Preview */}
      <InteractiveLedgerSection />

      {/* Core Capabilities 2x2 Editorial Grid */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 py-16 lg:py-20 space-y-10">
        <div className="max-w-2xl space-y-3">
          <p className="text-xs font-semibold uppercase tracking-wider text-emerald-800">
            Une méthode fiable
          </p>
          <h2 className="font-display text-2xl sm:text-3xl font-bold text-stone-900 tracking-tight">
            Fini les cahiers perdus et les calculs approximatifs
          </h2>
          <p className="text-stone-600 leading-relaxed">
            Distinguez ce qui est déclaré de ce qui est réellement confirmé, conservez vos reçus et
            protégez l’historique de chaque membre.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white border border-stone-200 rounded-2xl p-6 sm:p-8 space-y-3 hover:border-stone-300 transition-colors">
            <p className="font-mono text-xs font-semibold text-emerald-800">01 · Multi-payeurs</p>
            <h3 className="font-display text-xl font-bold text-stone-900">
              Dépenses avancées à plusieurs, soldées au franc près
            </h3>
            <p className="text-sm text-stone-600 leading-relaxed">
              Pour 15 000 FCFA de courses, Mariam avance 5 000 FCFA et Jean 10 000 FCFA. KPATA
              enregistre les deux avances et calcule automatiquement la part nette de chacun.
            </p>
          </div>

          <div className="bg-white border border-stone-200 rounded-2xl p-6 sm:p-8 space-y-3 hover:border-stone-300 transition-colors">
            <p className="font-mono text-xs font-semibold text-emerald-800">02 · Inclusion</p>
            <h3 className="font-display text-xl font-bold text-stone-900">
              Intégrez aussi les proches sans compte KPATA
            </h3>
            <p className="text-sm text-stone-600 leading-relaxed">
              Ajoutez un parent, un enfant ou un membre d’association dès le premier jour. Son
              historique reste intact et pourra être rattaché s’il crée un profil plus tard.
            </p>
          </div>

          <div className="bg-white border border-stone-200 rounded-2xl p-6 sm:p-8 space-y-3 hover:border-stone-300 transition-colors">
            <p className="font-mono text-xs font-semibold text-emerald-800">03 · Confirmations</p>
            <h3 className="font-display text-xl font-bold text-stone-900">
              Déclaré n’est jamais confondu avec confirmé
            </h3>
            <p className="text-sm text-stone-600 leading-relaxed">
              Suivez séparément l’attendu, le déclaré et le confirmé. Acceptez les versements
              partiels (4 000 + 6 000 FCFA) avec validation du créancier ou du trésorier.
            </p>
          </div>

          <div className="bg-white border border-stone-200 rounded-2xl p-6 sm:p-8 space-y-3 hover:border-stone-300 transition-colors">
            <p className="font-mono text-xs font-semibold text-emerald-800">04 · Coffre & Exports</p>
            <h3 className="font-display text-xl font-bold text-stone-900">
              Budgets mensuels, factures et bilans PDF / Excel
            </h3>
            <p className="text-sm text-stone-600 leading-relaxed">
              Définissez des plafonds par catégorie (alimentation, SBEE, SONEB, loyer) avec alertes
              automatiques, archivez vos justificatifs et exportez vos bilans.
            </p>
          </div>
        </div>
      </section>

      {/* Use Cases with Authentic Photography */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 pb-16 lg:pb-20 space-y-10">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-t border-stone-200/80 pt-14">
          <div className="space-y-2 max-w-2xl">
            <h2 className="font-display text-2xl sm:text-3xl font-bold text-stone-900 tracking-tight">
              Un espace adapté à chaque communauté
            </h2>
            <p className="text-stone-600">
              Appartenez simultanément à plusieurs groupes indépendants sans jamais mélanger leurs
              opérations financières.
            </p>
          </div>
          <Link
            to="/groupes"
            className="text-sm font-semibold text-emerald-800 hover:text-emerald-950 whitespace-nowrap"
          >
            Voir les 12 types de groupes →
          </Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <article className="space-y-4">
            <EditorialImage
              src="/src/assets/images/kpata_family_budget_1795598769578.jpg"
              alt="Gestion des dépenses familiales et du budget du foyer au Bénin avec KPATA"
            />
            <div className="space-y-1.5">
              <h3 className="font-display text-lg font-bold text-stone-900">
                Budget familial & foyer
              </h3>
              <p className="text-sm text-stone-600 leading-relaxed">
                Suivez les courses, factures d’eau et d’électricité, loyer et scolarité avec des
                contributions adaptées à chaque membre du ménage.
              </p>
            </div>
          </article>

          <article className="space-y-4">
            <EditorialImage
              src="/src/assets/images/kpata_student_colocation_1795598769862.jpg"
              alt="Gestion des dépenses entre colocataires et étudiants partageant loyer et Internet"
            />
            <div className="space-y-1.5">
              <h3 className="font-display text-lg font-bold text-stone-900">
                Colocation & frais de voyage
              </h3>
              <p className="text-sm text-stone-600 leading-relaxed">
                Partagez équitablement loyer, Wi-Fi, sorties ou transport. L’optimiseur réduit au
                minimum les virements nécessaires pour solder les dettes.
              </p>
            </div>
          </article>

          <article className="space-y-4">
            <EditorialImage
              src="/src/assets/images/kpata_association_group_1795598770028.jpg"
              alt="Gestion des dépenses d'une association et suivi des cotisations collectives"
            />
            <div className="space-y-1.5">
              <h3 className="font-display text-lg font-bold text-stone-900">
                Associations & tontines
              </h3>
              <p className="text-sm text-stone-600 leading-relaxed">
                Nommez un trésorier, encaissez les cotisations périodiques par versements partiels,
                conservez les justificatifs et publiez des bilans clairs.
              </p>
            </div>
          </article>
        </div>
      </section>

      {/* Calm Deep Pine Conversion Banner */}
      <section className="bg-[#0B1F19] text-white py-16">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-8">
          <div className="space-y-3 max-w-2xl">
            <h2 className="font-display text-2xl sm:text-3xl font-bold tracking-tight">
              Des tarifs pensés pour le Bénin, facturés par groupe
            </h2>
            <p className="text-stone-300 leading-relaxed text-sm sm:text-base">
              Une famille ou une association complète ne paie qu’un seul abonnement pour l’ensemble
              du groupe : Gratuit (0 FCFA), Premium Famille (500 FCFA / mois) ou Association &
              Organisation (1 000 FCFA / mois).
            </p>
          </div>
          <div className="flex flex-wrap gap-3 shrink-0">
            <Link
              to="/tarifs"
              className="px-5 py-3 text-sm font-semibold bg-white text-stone-900 rounded-xl hover:bg-stone-100 transition-colors whitespace-nowrap"
            >
              Comparer les 3 offres
            </Link>
            <Link
              to="/connexion"
              className="px-5 py-3 text-sm font-semibold bg-emerald-700 text-white rounded-xl hover:bg-emerald-600 transition-colors whitespace-nowrap"
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
      title: 'Dépenses collectives, partielles et multi-payeurs',
      body: 'Enregistrez des dépenses réglées par un ou plusieurs membres simultanément. KPATA vérifie côté serveur que la somme des avances correspond au montant payé et distingue payeurs, bénéficiaires et parts individuelles.',
    },
    {
      num: '02',
      title: 'Six méthodes de répartition sans erreur d’arrondi',
      body: 'Choisissez entre répartition équitable, personnalisée, en pourcentage, par poids (coefficients familiaux), par participation effective ou par montant fixe. Les arrondis en FCFA sont équilibrés au franc près.',
    },
    {
      num: '03',
      title: 'Cotisations périodiques et versements partiels',
      body: 'Créez des appels de cotisation pour une famille ou une association. Chaque membre peut régler en plusieurs fois ; le trésorier distingue clairement ce qui est attendu, déclaré, confirmé ou contesté.',
    },
    {
      num: '04',
      title: 'Remboursements vérifiés et optimisation des dettes',
      body: 'Déclarez un remboursement effectué via MTN Mobile Money, Moov Money, Celtiis ou en espèces. Le solde n’évolue qu’après confirmation du créancier. Un algorithme propose le minimum de transferts pour tout équilibrer.',
    },
    {
      num: '05',
      title: 'Membres externes sans compte KPATA',
      body: 'Ajoutez immédiatement vos proches sans leur imposer la création d’un compte. Lorsqu’ils rejoignent KPATA plus tard, ils peuvent rattacher leur historique existant avec validation sécurisée.',
    },
    {
      num: '06',
      title: 'Budgets, coffre-fort documentaire et exports PDF/Excel',
      body: 'Surveillez vos plafonds mensuels par catégorie avec alertes à 50 %, 75 %, 90 % et 100 %, joignez vos reçus (images ou PDF) et exportez vos bilans financiers complets.',
    },
  ];

  return (
    <PublicLayout>
      <section className="max-w-6xl mx-auto px-4 sm:px-6 py-14 lg:py-16 space-y-12">
        <div className="max-w-3xl space-y-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-emerald-800">
            Fonctionnalités KPATA
          </p>
          <h1 className="font-display text-3xl sm:text-4xl font-bold text-stone-900 tracking-tight">
            Tout ce qu’il faut pour une gestion financière collective transparente
          </h1>
          <p className="text-base sm:text-lg text-stone-600 leading-relaxed">
            Conçue comme une application de partage des dépenses fiable et compréhensible, KPATA
            remplace les calculs manuels et évite les malentendus entre membres.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {sections.map((s) => (
            <div
              key={s.num}
              className="border border-stone-200 rounded-2xl p-6 sm:p-8 bg-white space-y-3 hover:border-stone-300 transition-colors"
            >
              <span className="font-mono text-xs font-semibold text-emerald-800">{s.num}</span>
              <h2 className="font-display text-xl font-bold text-stone-900">{s.title}</h2>
              <p className="text-sm text-stone-600 leading-relaxed">{s.body}</p>
            </div>
          ))}
        </div>

        <div className="bg-white border border-stone-200 rounded-2xl p-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
          <div className="space-y-1">
            <h2 className="font-display text-xl font-bold text-stone-900">
              Prêt à organiser les finances de votre groupe ?
            </h2>
            <p className="text-sm text-stone-600">
              Créez votre premier espace en moins de deux minutes, sans carte bancaire.
            </p>
          </div>
          <Link
            to="/inscription"
            className="px-5 py-3 text-sm font-semibold text-white bg-emerald-800 rounded-xl hover:bg-emerald-900 transition-colors whitespace-nowrap"
          >
            Ouvrir un compte gratuit
          </Link>
        </div>
      </section>
    </PublicLayout>
  );
}

export function GroupsShowcasePage() {
  return (
    <PublicLayout>
      <section className="max-w-6xl mx-auto px-4 sm:px-6 py-14 lg:py-16 space-y-12">
        <div className="max-w-3xl space-y-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-emerald-800">
            Multi-groupes indépendants
          </p>
          <h1 className="font-display text-3xl sm:text-4xl font-bold text-stone-900 tracking-tight">
            Douze types de groupes, une isolation financière stricte
          </h1>
          <p className="text-base sm:text-lg text-stone-600 leading-relaxed">
            Vous pouvez être administrateur du budget familial, membre d’une colocation étudiante
            et trésorier d’une association : chaque espace conserve ses propres soldes, devises,
            rôles et justificatifs.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {GROUP_TYPES.map((g) => (
            <div
              key={g.value}
              className="border border-stone-200 rounded-2xl p-6 bg-white space-y-2 hover:border-stone-300 transition-colors"
            >
              <h2 className="font-display text-lg font-bold text-stone-900">{g.label}</h2>
              <p className="text-sm text-stone-600 leading-relaxed">{g.description}</p>
            </div>
          ))}
        </div>

        <div className="border-t border-stone-200 pt-10 grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
          <div className="space-y-4">
            <h2 className="font-display text-2xl font-bold text-stone-900 tracking-tight">
              Rôles techniques indépendants des liens familiaux
            </h2>
            <p className="text-sm text-stone-600 leading-relaxed">
              Dans KPATA, les permissions (Propriétaire, Administrateur, Trésorier, Membre,
              Observateur) sont contrôlées côté serveur indépendamment du lien familial ou du titre
              associatif. Aucun départ de membre n’efface ses dettes ou son historique.
            </p>
          </div>
          <div className="border border-stone-200 rounded-2xl p-6 bg-white space-y-2.5 text-sm">
            <p className="font-semibold text-stone-900">Rôles disponibles par groupe :</p>
            <ul className="space-y-1.5 text-stone-600">
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
    values: { FREE: 'Jusqu’à 5', PREMIUM: 'Jusqu’à 25', ORG: 'Illimité' },
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
          <p className="text-xs font-semibold uppercase tracking-wider text-emerald-800">
            Trois offres claires par groupe
          </p>
          <h1 className="font-display text-3xl sm:text-4xl font-bold text-stone-900 tracking-tight">
            Une tarification transparente adaptée à votre communauté
          </h1>
          <p className="text-base sm:text-lg text-stone-600 leading-relaxed">
            Facturation unique par groupe et jamais par membre. Chaque offre payante demande un
            règlement validé (FedaPay Mobile Money / carte ou transfert vérifié) avant déblocage de
            ses fonctionnalités avancées.
          </p>
        </div>

        <div className="bg-[#0B1F19] text-white rounded-2xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-sm">
          <div className="flex items-center gap-3">
            <Lock className="w-4 h-4 text-emerald-300 shrink-0" />
            <span>
              <strong>Paiement requis avant activation :</strong> le choix d’une offre payante
              redirige vers l’écran de règlement avant toute activation sur votre groupe.
            </span>
          </div>
          <span className="font-mono text-xs text-emerald-200 shrink-0">
            MTN MoMo · Moov · Celtiis · Visa
          </span>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-96 rounded-2xl border border-stone-200 bg-white animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {plans.map((p) => {
              const isFeatured = p.code === 'PREMIUM';
              const isPaid = p.monthlyPriceInt > 0;
              const ent = PLAN_ENTITLEMENTS[p.code as SubscriptionPlanCode];
              return (
                <div
                  key={p.code}
                  className={`rounded-2xl p-7 flex flex-col justify-between space-y-6 bg-white transition-colors ${
                    isFeatured
                      ? 'border-2 border-emerald-800'
                      : 'border border-stone-200 hover:border-stone-300'
                  }`}
                >
                  <div className="space-y-4">
                    <div className="space-y-1">
                      <p className="text-xs font-medium text-emerald-800 flex items-center gap-1.5">
                        <Users className="w-3.5 h-3.5 shrink-0" />
                        <span>{tierSubtitle(p.code)}</span>
                      </p>
                      <h2 className="font-display text-2xl font-bold text-stone-900">{p.name}</h2>
                    </div>

                    <div className="flex items-baseline gap-1.5">
                      <span className="font-mono text-3xl font-bold text-stone-900 tabular-nums">
                        {formatMoney(p.monthlyPriceInt, p.currency)}
                      </span>
                      <span className="text-xs text-stone-500">/ groupe / mois</span>
                    </div>

                    <p className="text-sm text-stone-600 leading-relaxed">
                      {ent?.tagline || p.description}
                    </p>

                    <ul className="space-y-2.5 pt-4 border-t border-stone-100">
                      {(p.features || []).map((f: string) => (
                        <li key={f} className="flex items-start gap-2.5 text-sm text-stone-700">
                          <Check className="w-4 h-4 text-emerald-800 shrink-0 mt-0.5" />
                          <span>{f}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <Link
                    to={targetHref(p.code)}
                    className={`w-full inline-flex items-center justify-center gap-1.5 text-center py-3 px-4 rounded-xl text-sm font-semibold transition-colors ${
                      isFeatured
                        ? 'bg-emerald-800 text-white hover:bg-emerald-900'
                        : isPaid
                        ? 'bg-stone-900 text-white hover:bg-stone-800'
                        : 'border border-stone-300 text-stone-800 hover:bg-stone-50'
                    }`}
                  >
                    <span>
                      {isPaid
                        ? `Souscrire & Payer (${formatMoney(p.monthlyPriceInt, p.currency)})`
                        : 'Démarrer gratuitement'}
                    </span>
                    <ArrowRight className="w-4 h-4" />
                  </Link>
                </div>
              );
            })}
          </div>
        )}

        {/* Feature Comparison Matrix */}
        <div className="bg-white border border-stone-200 rounded-2xl overflow-hidden">
          <div className="px-6 py-5 border-b border-stone-200 bg-[#F7F5F0]">
            <h2 className="font-display text-lg font-bold text-stone-900">
              Tableau comparatif des 3 offres
            </h2>
            <p className="text-xs text-stone-500 mt-0.5">
              Chaque offre débloque des capacités distinctes vérifiées côté serveur sur votre groupe.
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs sm:text-sm">
              <thead className="bg-stone-50/70 border-b border-stone-200 text-stone-700">
                <tr>
                  <th className="px-5 py-3.5 font-semibold">Fonctionnalité</th>
                  <th className="px-4 py-3.5 font-semibold text-center">Gratuit (0 FCFA)</th>
                  <th className="px-4 py-3.5 font-semibold text-center text-emerald-900">
                    Premium (500 FCFA)
                  </th>
                  <th className="px-4 py-3.5 font-semibold text-center">
                    Association & Org (1 000 FCFA)
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {COMPARISON_ROWS.map((row) => (
                  <tr key={row.label} className="hover:bg-stone-50/60">
                    <td className="px-5 py-3.5 font-medium text-stone-800">{row.label}</td>
                    {(['FREE', 'PREMIUM', 'ORG'] as SubscriptionPlanCode[]).map((code) => {
                      const val = row.values[code];
                      return (
                        <td key={code} className="px-4 py-3.5 text-center">
                          {typeof val === 'boolean' ? (
                            val ? (
                              <Check className="w-4 h-4 text-emerald-800 mx-auto" />
                            ) : (
                              <Minus className="w-4 h-4 text-stone-300 mx-auto" />
                            )
                          ) : (
                            <span className="font-mono text-xs text-stone-700">{val}</span>
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
          <p className="text-xs font-semibold uppercase tracking-wider text-emerald-800">
            Aide & Transparence
          </p>
          <h1 className="font-display text-3xl sm:text-4xl font-bold text-stone-900 tracking-tight">
            Questions fréquentes sur KPATA
          </h1>
        </div>

        <div className="divide-y divide-stone-200 border border-stone-200 rounded-2xl bg-white overflow-hidden">
          {items.map((item, idx) => {
            const isOpen = openIdx === idx;
            return (
              <div key={item.q} className="p-5 sm:p-6">
                <button
                  type="button"
                  onClick={() => setOpenIdx(isOpen ? null : idx)}
                  className="w-full flex items-center justify-between gap-4 text-left"
                >
                  <span className="font-display font-semibold text-stone-900">{item.q}</span>
                  <ChevronDown
                    className={`w-5 h-5 text-stone-500 shrink-0 transition-transform duration-150 ${
                      isOpen ? 'rotate-180' : ''
                    }`}
                  />
                </button>
                {isOpen && (
                  <p className="mt-3 text-sm text-stone-600 leading-relaxed">{item.a}</p>
                )}
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
          <p className="text-xs font-semibold uppercase tracking-wider text-emerald-800">
            Contact KPATA
          </p>
          <h1 className="font-display text-3xl font-bold text-stone-900 tracking-tight">
            Parlons de votre groupe ou association
          </h1>
          <p className="text-sm text-stone-600 leading-relaxed">
            Une question sur l’utilisation de KPATA au Bénin, un besoin pour une association ou une
            suggestion d’amélioration ? Écrivez-nous directement.
          </p>
          <div className="space-y-3 pt-4 border-t border-stone-200 text-sm text-stone-700">
            <p className="flex items-center gap-2.5">
              <MapPin className="w-4 h-4 text-emerald-800 shrink-0" />
              <span>Cotonou, République du Bénin</span>
            </p>
            <p className="flex items-center gap-2.5">
              <Mail className="w-4 h-4 text-emerald-800 shrink-0" />
              <span>contact@kpata.bj</span>
            </p>
            <p className="flex items-center gap-2.5">
              <Shield className="w-4 h-4 text-emerald-800 shrink-0" />
              <span>Support pilote & partenariats associatifs</span>
            </p>
          </div>
        </div>

        <form
          onSubmit={handleSubmit}
          className="lg:col-span-7 border border-stone-200 rounded-2xl p-6 sm:p-8 bg-white space-y-4"
        >
          <h2 className="font-display text-lg font-bold text-stone-900">Envoyer un message</h2>
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
              <span className="font-medium text-stone-700">Nom complet</span>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-3.5 py-2 border border-stone-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-700"
              />
            </label>
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
          </div>
          <label className="block space-y-1.5 text-sm">
            <span className="font-medium text-stone-700">Objet</span>
            <input
              type="text"
              required
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="w-full px-3.5 py-2 border border-stone-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-700"
            />
          </label>
          <label className="block space-y-1.5 text-sm">
            <span className="font-medium text-stone-700">Message</span>
            <textarea
              required
              rows={5}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              className="w-full px-3.5 py-2 border border-stone-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-700"
            />
          </label>
          <button
            type="submit"
            disabled={submitting}
            className="px-5 py-2.5 text-sm font-semibold text-white bg-emerald-800 rounded-xl hover:bg-emerald-900 disabled:opacity-50 transition-colors"
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
        <h1 className="font-display text-3xl font-bold text-stone-900">
          Conditions générales d’utilisation
        </h1>
        <p className="text-sm text-stone-500">Version applicable au lancement pilote au Bénin</p>
        <section className="space-y-2">
          <h2 className="font-display text-lg font-bold text-stone-900">1. Nature du service</h2>
          <p className="text-sm text-stone-600 leading-relaxed">
            KPATA est un outil numérique collaboratif de suivi des dépenses, contributions,
            cotisations et remboursements entre membres d’un groupe. KPATA n’est ni un établissement
            bancaire, ni un prestataire de monnaie électronique, et ne conserve aucun fonds pour le
            compte des groupes.
          </p>
        </section>
        <section className="space-y-2">
          <h2 className="font-display text-lg font-bold text-stone-900">2. Fiabilité des opérations</h2>
          <p className="text-sm text-stone-600 leading-relaxed">
            Les règlements déclarés entre membres restent en attente jusqu’à confirmation par le
            bénéficiaire ou un responsable autorisé. Toute annulation ou modification financière est
            journalisée afin de préserver la transparence au sein du groupe.
          </p>
        </section>
        <section className="space-y-2">
          <h2 className="font-display text-lg font-bold text-stone-900">3. Abonnements par groupe</h2>
          <p className="text-sm text-stone-600 leading-relaxed">
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
        <h1 className="font-display text-3xl font-bold text-stone-900">
          Politique de confidentialité et protection des données
        </h1>
        <p className="text-sm text-stone-500">
          Conformité aux principes de protection des données personnelles au Bénin et en Afrique de
          l’Ouest
        </p>
        <section className="space-y-2">
          <h2 className="font-display text-lg font-bold text-stone-900">1. Minimisation des données</h2>
          <p className="text-sm text-stone-600 leading-relaxed">
            KPATA collecte uniquement les informations nécessaires au fonctionnement des comptes et
            des groupes (nom, prénom, e-mail, téléphone facultatif et écritures financières du
            groupe). Aucune donnée financière n’est revendue ou exposée aux moteurs de recherche.
          </p>
        </section>
        <section className="space-y-2">
          <h2 className="font-display text-lg font-bold text-stone-900">2. Isolation et accès administrateur</h2>
          <p className="text-sm text-stone-600 leading-relaxed">
            Les données de chaque groupe sont strictement isolées. L’administration centrale ne
            consulte pas les dépenses privées des groupes dans son tableau de bord courant, et toute
            opération sensible est journalisée.
          </p>
        </section>
        <section className="space-y-2">
          <h2 className="font-display text-lg font-bold text-stone-900">3. Cookies et mesure d’audience</h2>
          <p className="text-sm text-stone-600 leading-relaxed">
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
        <p className="font-mono text-sm font-semibold text-emerald-800">Erreur 404</p>
        <h1 className="font-display text-3xl font-bold text-stone-900">
          Cette page est introuvable
        </h1>
        <p className="text-stone-600">
          L’adresse demandée n’existe pas ou a été déplacée. Vous pouvez revenir à l’accueil public
          de KPATA ou accéder à votre tableau de bord.
        </p>
        <div className="flex items-center justify-center gap-3 pt-2">
          <Link
            to="/"
            className="px-5 py-2.5 text-sm font-semibold text-white bg-emerald-800 rounded-xl hover:bg-emerald-900 transition-colors"
          >
            Retour à l’accueil
          </Link>
          <Link
            to="/app"
            className="px-5 py-2.5 text-sm font-semibold text-stone-700 border border-stone-300 rounded-xl hover:bg-stone-50 transition-colors"
          >
            Mon espace
          </Link>
        </div>
      </section>
    </PublicLayout>
  );
}
