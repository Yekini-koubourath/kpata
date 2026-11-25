interface RouteSeoMeta {
  title: string;
  description: string;
  noindex?: boolean;
}

const ROUTE_SEO_MAP: Record<string, RouteSeoMeta> = {
  '/': {
    title: 'KPATA — Application de gestion des dépenses en groupe et finances collectives',
    description:
      'Organisez les dépenses familiales, colocations, cotisations entre amis et budgets d’associations avec KPATA. Simple, transparent et pensé pour le Bénin et l’Afrique.',
  },
  '/fonctionnalites': {
    title: 'Fonctionnalités KPATA — Dépenses multi-payeurs, répartitions, cotisations et budgets',
    description:
      'Découvrez les 6 méthodes de répartition, le suivi des cotisations partielles, la confirmation des remboursements et les rapports PDF/Excel de KPATA.',
  },
  '/groupes': {
    title: 'Types de groupes KPATA — Famille, colocation, couple, voyage et association',
    description:
      'Application de partage des dépenses adaptée à chaque communauté : budget familial au Bénin, dépenses entre colocataires, frais de voyage et cotisations associatives.',
  },
  '/tarifs': {
    title: 'Tarifs KPATA — Offre gratuite et abonnements accessibles par groupe en FCFA',
    description:
      '3 formules claires par groupe : Gratuit (0 FCFA), Premium Famille & Coloc (500 FCFA/mois) et Association & Organisation (1 000 FCFA/mois) via Mobile Money.',
  },
  '/faq': {
    title: 'Questions fréquentes (FAQ) — KPATA gestion financière collaborative',
    description:
      'Réponses sur le partage des dépenses, les membres sans compte KPATA, la sécurité des données, FedaPay et le fonctionnement des remboursements.',
  },
  '/contact': {
    title: 'Contact et accompagnement — KPATA Bénin & Afrique de l’Ouest',
    description:
      'Contactez l’équipe KPATA à Cotonou pour vos questions, partenariats associatifs ou retours utilisateurs.',
  },
  '/conditions-generales': {
    title: 'Conditions générales d’utilisation — KPATA',
    description:
      'Consultez les conditions générales d’utilisation de la plateforme collaborative KPATA.',
  },
  '/confidentialite': {
    title: 'Politique de confidentialité et protection des données — KPATA',
    description:
      'Découvrez comment KPATA protège vos données financières personnelles et respecte le consentement.',
  },
  '/connexion': {
    title: 'Connexion — KPATA',
    description: 'Accédez à votre espace privé KPATA.',
    noindex: true,
  },
  '/inscription': {
    title: 'Créer un compte — KPATA',
    description: 'Créez votre compte KPATA gratuitement.',
    noindex: true,
  },
  '/app/abonnement': {
    title: 'Activer un abonnement — KPATA',
    description: 'Paiement sécurisé et activation de votre offre KPATA.',
    noindex: true,
  },
};

export function applyClientSeo(pathname: string): void {
  const clean = pathname.replace(/\/+$/, '') || '/';
  const isPrivate =
    clean.startsWith('/app') ||
    clean.startsWith('/admin') ||
    clean.startsWith('/connexion') ||
    clean.startsWith('/inscription') ||
    clean.startsWith('/mot-de-passe-oublie') ||
    clean.startsWith('/reinitialiser-mot-de-passe') ||
    clean.startsWith('/verifier-email');

  const meta = ROUTE_SEO_MAP[clean] || {
    title: isPrivate ? 'Espace privé — KPATA' : 'Page introuvable — KPATA',
    description: isPrivate
      ? 'Gestion financière collaborative KPATA.'
      : 'La page demandée est introuvable sur KPATA.',
    noindex: true,
  };

  document.title = meta.title;

  const setMeta = (selector: string, attr: string, content: string) => {
    const el = document.querySelector(selector);
    if (el) el.setAttribute(attr, content);
  };

  setMeta('meta[name="description"]', 'content', meta.description);
  setMeta('meta[property="og:title"]', 'content', meta.title);
  setMeta('meta[property="og:description"]', 'content', meta.description);
  setMeta('meta[name="twitter:title"]', 'content', meta.title);
  setMeta('meta[name="twitter:description"]', 'content', meta.description);
  setMeta('meta[name="robots"]', 'content', isPrivate || meta.noindex ? 'noindex, nofollow' : 'index, follow');

  const canonical = document.querySelector('link[rel="canonical"]');
  if (canonical) {
    canonical.setAttribute('href', `${window.location.origin}${clean}`);
  }
}
