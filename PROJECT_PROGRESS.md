# KPATA — Journal de Progression & Vérification Technique

## Fonctionnalités livrées

1. **Site public & SEO complet :**
   - Pages publiques complètes en français : `/`, `/fonctionnalites`, `/groupes`, `/tarifs`, `/faq`, `/contact`, `/conditions-generales`, `/confidentialite`, et page `404` dédiée.
   - Images éditoriales générées localement dans `/src/assets/images/` avec textes alternatifs descriptifs et repli gracieux.
   - Balises SEO dynamiques par route (`title`, `description`, `canonical`, OpenGraph, Twitter Card, Schema.org JSON-LD `WebApplication`), `/robots.txt`, `/sitemap.xml`, en-têtes HTTP `X-Robots-Tag: noindex, nofollow` sur `/app/*`, `/admin`, `/connexion`, `/inscription`, `/mot-de-passe-oublie`, `/api/*`.
   - Support méta Google Search Console (`GOOGLE_SITE_VERIFICATION`) et Bing (`BING_SITE_VERIFICATION`).

2. **Mesure d’audience GA4 + Statistiques du site (`/admin`) :**
   - Intégration GA4 (`VITE_GA_MEASUREMENT_ID`) soumise au consentement visiteur (Consent Mode v2, anonymisation IP, aucune PII).
   - Analytique interne respectueuse de la vie privée (`/api/analytics/track` + `/api/admin/site-analytics`) filtrant les robots (`Googlebot`, `Bingbot`, etc.) et distinguant visiteurs uniques, visites/sessions, visiteurs actifs (5 min), pages les plus visitées, sources, appareils, navigateurs, pays/villes et évolution Jour/Semaine/Mois/Année.

3. **Authentification, RBAC & Isolation stricte des groupes :**
   - Inscription, connexion, vérification e-mail, récupération mot de passe, révocation de sessions actives, gestion du profil.
   - 12 types de groupes, 5 rôles de groupe (`OWNER`, `ADMIN`, `TREASURER`, `MEMBER`, `OBSERVER`), membres externes sans compte avec rattachement ultérieur conservant l’historique financier.
   - Isolation stricte vérifiée côté serveur sur toutes les routes `/api/groups/:id/*` et `/api/documents/:docId`.

4. **Moteur financier & Coffre justificatifs :**
   - Calculs entiers exacts (FCFA / XOF et autres devises), multi-payeurs, 6 méthodes de répartition (`EQUAL`, `CUSTOM`, `PERCENTAGE`, `WEIGHT`, `PARTICIPATION`, `FIXED`), commentaires/contestations, annulation contrôlée avec journal de révisions.
   - Cotisations avec distinction **Attendu / Déclaré / Confirmé / Restant** et versements partiels.
   - Remboursements avec optimisation minimale, déclaration `PENDING`, confirmation créancier/trésorier, contestation et annulation.
   - Budgets avec seuils d’alerte (50 / 75 / 90 / 100 %), objectifs d’épargne collectifs avec mention réglementaire, exports PDF (`jsPDF`) et Excel (`ExcelJS`).
   - Coffre-fort de justificatifs (JPG/PNG/WebP/PDF) protégé par appartenance au groupe.

5. **FedaPay v1 & Administration centrale :**
   - Checkout FedaPay Sandbox/Live (`FEDAPAY_SECRET_KEY`), vérification serveur, webhook HMAC-SHA256 `X-FEDAPAY-SIGNATURE` anti-rejeu et anti-tampering montant/devise, idempotence.
   - Mode pilote Bénin avec validation manuelle administrateur dans `/admin` et tarification dynamique (`FREE`, `PREMIUM`, `ORG`).

6. **Base de données & Migration Neon/Vercel :**
   - Runtime immédiat fonctionnel via SQLite (`better-sqlite3` dans `data/kpata.db`) avec données de démo clairement identifiées.
   - Schéma Prisma PostgreSQL (`/prisma/schema.prisma`), migration SQL (`/prisma/migrations/001_init/migration.sql`), seed et `vercel.json` prêts pour le déploiement Neon + Vercel.

---

## Configurations externes restant à fournir par l’utilisateur

1. `VITE_GA_MEASUREMENT_ID` : Identifiant GA4 (`G-XXXXXXXXXX`) pour activer l’envoi vers Google Analytics 4.
2. `GOOGLE_SITE_VERIFICATION` / `BING_SITE_VERIFICATION` : Codes de validation Search Console et Bing (ou enregistrement DNS TXT).
3. `FEDAPAY_SECRET_KEY`, `FEDAPAY_PUBLIC_KEY`, `FEDAPAY_WEBHOOK_SECRET`, `FEDAPAY_ENVIRONMENT` : Clés FedaPay Sandbox puis Live pour les paiements en ligne automatiques.
4. `DATABASE_URL` & `DIRECT_URL` : Chaînes Neon PostgreSQL lors de la migration hors SQLite local vers Vercel.
5. `SESSION_SECRET` & `ADMIN_BOOTSTRAP_PASSCODE` : Secrets de production.
