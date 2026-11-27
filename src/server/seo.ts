import type { Request } from 'express';

export interface PublicPageSeo {
  path: string;
  title: string;
  description: string;
  priority: string;
  changefreq: string;
}

export const PUBLIC_SEO_PAGES: PublicPageSeo[] = [
  {
    path: '/',
    title: 'KPATA — Application de gestion des dépenses en groupe et finances collectives',
    description:
      'Organisez les dépenses familiales, colocations, cotisations entre amis et budgets d’associations avec KPATA. Simple, transparent et pensé pour le Bénin et l’Afrique.',
    priority: '1.0',
    changefreq: 'weekly',
  },
  {
    path: '/fonctionnalites',
    title: 'Fonctionnalités KPATA — Dépenses multi-payeurs, répartitions, cotisations et budgets',
    description:
      'Découvrez les 6 méthodes de répartition, le suivi des cotisations partielles, la confirmation des remboursements et les rapports PDF/Excel de KPATA.',
    priority: '0.9',
    changefreq: 'monthly',
  },
  {
    path: '/groupes',
    title: 'Types de groupes KPATA — Famille, colocation, couple, voyage et association',
    description:
      'Application de partage des dépenses adaptée à chaque communauté : budget familial au Bénin, dépenses entre colocataires, frais de voyage et cotisations associatives.',
    priority: '0.9',
    changefreq: 'monthly',
  },
  {
    path: '/tarifs',
    title: 'Tarifs KPATA — Offre gratuite et abonnements accessibles par groupe en FCFA',
    description:
      '3 formules claires par groupe : Gratuit (0 FCFA), Premium Famille & Coloc (500 FCFA/mois) et Association & Organisation (1 000 FCFA/mois) via Mobile Money.',
    priority: '0.9',
    changefreq: 'monthly',
  },
  {
    path: '/faq',
    title: 'Questions fréquentes (FAQ) — KPATA gestion financière collaborative',
    description:
      'Réponses sur le partage des dépenses, les membres sans compte KPATA, la sécurité des données, FedaPay et le fonctionnement des remboursements.',
    priority: '0.8',
    changefreq: 'monthly',
  },
  {
    path: '/contact',
    title: 'Contact et accompagnement — KPATA Bénin & Afrique de l’Ouest',
    description:
      'Contactez l’équipe KPATA à Abomey-Calavi (yekinikoubou@gmail.com · 0150495832) pour vos questions, partenariats associatifs ou retours utilisateurs.',
    priority: '0.7',
    changefreq: 'monthly',
  },
  {
    path: '/conditions-generales',
    title: 'Conditions générales d’utilisation — KPATA',
    description:
      'Consultez les conditions générales d’utilisation de la plateforme collaborative KPATA : transparence, rôle technique et abonnements.',
    priority: '0.4',
    changefreq: 'yearly',
  },
  {
    path: '/confidentialite',
    title: 'Politique de confidentialité et protection des données — KPATA',
    description:
      'Découvrez comment KPATA protège vos données financières personnelles, respecte la confidentialité et gère le consentement des cookies.',
    priority: '0.4',
    changefreq: 'yearly',
  },
];

export const PRIVATE_NOINDEX_PREFIXES = [
  '/app',
  '/admin',
  '/connexion',
  '/inscription',
  '/mot-de-passe-oublie',
  '/reinitialiser-mot-de-passe',
  '/verifier-email',
  '/invitation',
  '/api',
];

export function getPublicOrigin(req: Request): string {
  if (process.env.APP_URL && process.env.APP_URL.startsWith('http')) {
    return process.env.APP_URL.replace(/\/$/, '');
  }
  const proto = (req.headers['x-forwarded-proto'] as string) || req.protocol || 'https';
  const host = (req.headers['x-forwarded-host'] as string) || req.headers.host || 'localhost:3000';
  return `${proto}://${host}`;
}

export function isPrivateNoindexPath(pathname: string): boolean {
  const clean = pathname.split('?')[0];
  return PRIVATE_NOINDEX_PREFIXES.some(
    (prefix) => clean === prefix || clean.startsWith(`${prefix}/`)
  );
}

export function buildRobotsTxt(origin: string): string {
  return [
    'User-agent: *',
    'Allow: /',
    'Allow: /fonctionnalites',
    'Allow: /groupes',
    'Allow: /tarifs',
    'Allow: /faq',
    'Allow: /contact',
    'Allow: /conditions-generales',
    'Allow: /confidentialite',
    'Disallow: /app',
    'Disallow: /app/',
    'Disallow: /admin',
    'Disallow: /admin/',
    'Disallow: /api/',
    'Disallow: /connexion',
    'Disallow: /inscription',
    'Disallow: /mot-de-passe-oublie',
    'Disallow: /reinitialiser-mot-de-passe',
    'Disallow: /verifier-email',
    'Disallow: /invitation/',
    '',
    `Sitemap: ${origin}/sitemap.xml`,
    '',
  ].join('\n');
}

export function buildSitemapXml(origin: string): string {
  const today = new Date().toISOString().slice(0, 10);
  const urls = PUBLIC_SEO_PAGES.map(
    (p) => `  <url>
    <loc>${origin}${p.path === '/' ? '/' : p.path}</loc>
    <lastmod>${today}</lastmod>
    <changefreq>${p.changefreq}</changefreq>
    <priority>${p.priority}</priority>
  </url>`
  ).join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>
`;
}

function escapeHtmlAttr(val: string): string {
  return val
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

export function injectSeoIntoHtml(html: string, req: Request): { html: string; is404: boolean } {
  const pathname = (req.path || '/').replace(/\/+$/, '') || '/';
  const origin = getPublicOrigin(req);
  const isPrivate = isPrivateNoindexPath(pathname);
  const publicMeta = PUBLIC_SEO_PAGES.find((p) => p.path === pathname);

  const isKnownRoute =
    Boolean(publicMeta) ||
    isPrivate ||
    pathname === '/404';

  const is404 = !isKnownRoute;

  const title = isPrivate
    ? 'Espace sécurisé — KPATA'
    : publicMeta?.title || 'Page introuvable (404) — KPATA';

  const description = isPrivate
    ? 'Espace privé de gestion financière collaborative KPATA.'
    : publicMeta?.description ||
      'La page demandée est introuvable. Retournez sur KPATA pour gérer vos dépenses collectives.';

  const robots = isPrivate || is404 ? 'noindex, nofollow' : 'index, follow';
  const canonicalUrl = `${origin}${pathname === '/' ? '/' : pathname}`;

  const googleVerification = process.env.GOOGLE_SITE_VERIFICATION?.trim();
  const bingVerification = process.env.BING_SITE_VERIFICATION?.trim();

  const jsonLd = !isPrivate && !is404
    ? `<script type="application/ld+json">${JSON.stringify({
        '@context': 'https://schema.org',
        '@type': 'WebApplication',
        name: 'KPATA',
        url: origin,
        applicationCategory: 'FinanceApplication',
        operatingSystem: 'All',
        inLanguage: 'fr',
        description:
          'Application web de gestion des dépenses en groupe, cotisations familiales, frais de colocation et budgets associatifs au Bénin et en Afrique.',
        offers: {
          '@type': 'Offer',
          price: '0',
          priceCurrency: 'XOF',
        },
        publisher: {
          '@type': 'Organization',
          name: 'KPATA',
          url: origin,
          email: 'yekinikoubou@gmail.com',
          telephone: '+2290150495832',
          address: {
            '@type': 'PostalAddress',
            addressLocality: 'Abomey-Calavi',
            addressCountry: 'BJ',
          },
          areaServed: 'BJ',
        },
      })}</script>`
    : '';

  const extraHead = [
    googleVerification
      ? `<meta name="google-site-verification" content="${escapeHtmlAttr(googleVerification)}" />`
      : '',
    bingVerification
      ? `<meta name="msvalidate.01" content="${escapeHtmlAttr(bingVerification)}" />`
      : '',
    jsonLd,
  ]
    .filter(Boolean)
    .join('\n    ');

  let out = html
    .replace(/<title>[\s\S]*?<\/title>/, `<title>${escapeHtmlAttr(title)}</title>`)
    .replace(
      /<meta\s+name="description"\s+content="[^"]*"\s*\/>/,
      `<meta name="description" content="${escapeHtmlAttr(description)}" />`
    )
    .replace(
      /<meta\s+name="robots"\s+content="[^"]*"\s*\/>/,
      `<meta name="robots" content="${robots}" />`
    )
    .replace(
      /<link\s+rel="canonical"\s+href="[^"]*"\s*\/>/,
      `<link rel="canonical" href="${escapeHtmlAttr(canonicalUrl)}" />`
    )
    .replace(
      /<meta\s+property="og:title"\s+content="[^"]*"\s*\/>/,
      `<meta property="og:title" content="${escapeHtmlAttr(title)}" />`
    )
    .replace(
      /<meta\s+property="og:description"\s+content="[^"]*"\s*\/>/,
      `<meta property="og:description" content="${escapeHtmlAttr(description)}" />`
    )
    .replace(
      /<meta\s+name="twitter:title"\s+content="[^"]*"\s*\/>/,
      `<meta name="twitter:title" content="${escapeHtmlAttr(title)}" />`
    )
    .replace(
      /<meta\s+name="twitter:description"\s+content="[^"]*"\s*\/>/,
      `<meta name="twitter:description" content="${escapeHtmlAttr(description)}" />`
    )
    .replace('<!--KPATA_SEO_HEAD-->', extraHead);

  return { html: out, is404 };
}
