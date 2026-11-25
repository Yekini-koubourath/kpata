# Guide Complet : Google Analytics 4, SEO, Google Search Console et Bing Webmaster Tools — KPATA

Ce guide décrit étape par étape la mise en production de la mesure d’audience et du référencement naturel de KPATA.  
**Important :** L’application fonctionne immédiatement sans aucune erreur même avant la saisie de ces identifiants. Aucune propriété Google n’est créée automatiquement ni aucune indexation prétendue tant que vous n’avez pas effectué la vérification ci-dessous.

---

## 1. Créer une propriété Google Analytics 4 (GA4)

1. Connectez-vous sur [https://analytics.google.com/](https://analytics.google.com/) avec votre compte Google professionnel.
2. Cliquez sur **Administration** (icône d’engrenage en bas à gauche) → **Créer** → **Compte** (ex. `KPATA`).
3. Créez une **Propriété** nommée `KPATA Web` :
   - Fuseau horaire des rapports : **Bénin (GMT+01:00)**.
   - Devise : **Franc CFA BCEAO (XOF)** ou EUR/USD selon votre préférence comptable.
4. Sélectionnez l’objectif métier (ex. *Générer des prospects / Visites de site*) et la plateforme **Web**.
5. Renseignez l’URL publique de votre site (ex. `https://kpata.bj` ou votre URL Vercel) et nommez le flux de données `KPATA Site Public`.

---

## 2. Où récupérer l’identifiant de mesure GA4

1. Dans **Administration** → **Collecte et modification des données** → **Flux de données**.
2. Cliquez sur votre flux web `KPATA Site Public`.
3. En haut à droite, copiez l’**ID de mesure** au format `G-XXXXXXXXXX`.
4. **Confidentialité intégrée dans KPATA :**
   - KPATA n’envoie aucun e-mail, téléphone ou identifiant personnel financier à GA4.
   - Le mode Consentement v2 (`Consent Mode v2`) reste refusé tant que le visiteur n’a pas accepté les cookies analytiques via la bannière de consentement, et l’anonymisation IP est activée (`anonymize_ip: true`).

---

## 3. Renseigner l’identifiant GA4 (et les clés SEO) dans Vercel

1. Ouvrez votre projet dans le tableau de bord **Vercel** → **Settings** → **Environment Variables**.
2. Ajoutez les variables suivantes (cochez *Production*, *Preview* et *Development* selon besoin) :
   - `VITE_GA_MEASUREMENT_ID` = `G-XXXXXXXXXX` *(identifiant public côté client, aucune clé secrète)*
   - `APP_URL` = `https://votre-domaine.com` *(utilisé pour les URL canoniques, `sitemap.xml` et `robots.txt`)*
   - `GOOGLE_SITE_VERIFICATION` = *(code fourni par Search Console à l’étape 4)*
   - `BING_SITE_VERIFICATION` = *(code fourni par Bing Webmaster Tools)*
3. Redéployez le projet (`Deployments` → `Redeploy`) pour que Vite injecte `VITE_GA_MEASUREMENT_ID` dans le bundle frontend.

---

## 4. Ajouter et vérifier le domaine dans Google Search Console (et Bing)

### Google Search Console
1. Rendez-vous sur [https://search.google.com/search-console](https://search.google.com/search-console).
2. Cliquez sur **Ajouter une propriété**.
3. **Option recommandée — Propriété « Domaine » (vérification DNS) :**
   - Saisissez `kpata.bj` (sans `https://`).
   - Copiez l’enregistrement `TXT` (`google-site-verification=...`).
   - Ajoutez cet enregistrement `TXT` dans la zone DNS de votre registraire (Cloudflare, Namecheap, Vercel DNS, etc.).
   - Attendez la propagation DNS puis cliquez sur **Valider**.
4. **Option alternative — Préfixe d’URL (balise HTML automatique dans KPATA) :**
   - Choisissez **Balise HTML** dans Search Console.
   - Copiez uniquement la valeur de l’attribut `content="..."` (sans `<meta ...>`).
   - Enregistrez cette valeur dans la variable d’environnement `GOOGLE_SITE_VERIFICATION` puis redéployez. Le serveur Express KPATA injecte automatiquement `<meta name="google-site-verification" content="..." />` sur la page d’accueil.

### Bing Webmaster Tools
1. Connectez-vous sur [https://www.bing.com/webmasters](https://www.bing.com/webmasters).
2. Importez directement votre propriété depuis Google Search Console ou ajoutez le code de vérification dans `BING_SITE_VERIFICATION` (injecté automatiquement via `<meta name="msvalidate.01" content="..." />`).

---

## 5. Soumettre le fichier `sitemap.xml` et vérifier `robots.txt`

KPATA génère dynamiquement ces deux fichiers sur votre serveur :
- `https://votre-domaine.com/robots.txt`
- `https://votre-domaine.com/sitemap.xml`

Dans **Google Search Console** :
1. Menu de gauche → **Sitemaps**.
2. Dans « Ajouter un sitemap », saisissez `sitemap.xml` et cliquez sur **Envoyer**.
3. Vérifiez que le statut passe à **Opérationnel** et que seules les pages publiques apparaissent (`/`, `/fonctionnalites`, `/groupes`, `/tarifs`, `/faq`, `/contact`, `/conditions-generales`, `/confidentialite`).

**Protection des pages privées :**
`/app/*`, `/admin`, `/connexion`, `/inscription`, `/mot-de-passe-oublie`, `/api/*` sont bloqués dans `robots.txt`, marqués `noindex, nofollow` dans `<meta name="robots">` et renvoient l’en-tête HTTP `X-Robots-Tag: noindex, nofollow`.

---

## 6. Demander l’indexation et consulter les statistiques de fréquentation

### Demander l’indexation initiale des pages clés
Dans Google Search Console, utilisez la barre **Inspection de l’URL** tout en haut pour tester et cliquer sur **Demander une indexation** pour :
1. `/`
2. `/fonctionnalites`
3. `/groupes`
4. `/tarifs`
5. `/faq`
6. `/contact`

### Consulter les statistiques dans KPATA
1. Accédez à `/admin` (connectez-vous en tant qu’administrateur central).
2. Ouvrez l’onglet **« Statistiques du site »**.
3. Filtrez par période (**Jour**, **Semaine**, **Mois**, **Année**) pour suivre :
   - Visiteurs totaux et **Visiteurs uniques** (distincts des **Visites / Sessions**)
   - Visiteurs actifs sur les 5 dernières minutes
   - Pages consultées, top pages, durée moyenne et taux d’engagement
   - Sources de trafic (*Google & Moteurs*, *Réseaux sociaux*, *Direct*, *Autres sites*)
   - Pays/villes, appareils et navigateurs
   - Exclusion automatique des robots (`Googlebot`, `Bingbot`, crawlers connus)
4. Pour des rapports marketing avancés (entonnoirs, démographie), ouvrez directement votre propriété dans Google Analytics 4.

---

## 7. Suivre les performances SEO dans le temps

Dans **Google Search Console → Performances → Résultats de recherche** :
- **Clics totaux** et **Impressions** : mesurez la visibilité sur des requêtes naturelles telles que *application de gestion des dépenses en groupe*, *application de partage des dépenses au Bénin*, *cotisation entre amis*, *budget familial*.
- **CTR moyen** : améliorez les méta-descriptions si une page reçoit beaucoup d’impressions avec peu de clics.
- **Position moyenne** : suivez l’évolution du classement par page et par pays (Bénin, Togo, Côte d’Ivoire, Sénégal, France).
- **Couverture / Indexation des pages** : vérifiez régulièrement qu’aucune page privée (`/app`, `/admin`) n’est indexée par erreur et que toutes les pages publiques retournent `200 OK` sans erreur 404.
