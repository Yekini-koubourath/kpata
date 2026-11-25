# Déploiement KPATA — Architecture locale vs Production Neon (PostgreSQL) & Vercel

## 1. Transparence sur l’environnement d’exécution

- **Environnement Preview / Développement local (`server.ts`) :**  
  Pour garantir un fonctionnement immédiat sans base PostgreSQL distante ni clé externe obligatoire, le serveur Express utilise **SQLite (`better-sqlite3`, fichier `data/kpata.db`)** avec un schéma relationnel strictement miroir du schéma Prisma.
- **Environnement Production cible (Vercel + Neon PostgreSQL) :**  
  Le fichier `/prisma/schema.prisma`, la migration SQL `/prisma/migrations/001_init/migration.sql`, `/prisma/seed.ts` et `/vercel.json` préparent le déploiement sur **Neon** et **Vercel**.

---

## 2. Variables d’environnement requises en production

Copiez `.env.example` et renseignez les valeurs suivantes dans Vercel :

| Variable | Rôle | Obligatoire au démarrage ? |
|---|---|---|
| `APP_URL` | URL publique du site (canoniques, FedaPay callback, sitemap) | Recommandée |
| `SESSION_SECRET` | Secret HMAC >= 32 caractères pour les sessions | Oui en production |
| `ADMIN_BOOTSTRAP_PASSCODE` | Code d’accès administrateur central (`/admin`) | Recommandée (sinon configuration au 1er accès) |
| `DATABASE_URL` | Chaîne de connexion pooled Neon (`?sslmode=require`) | Pour Prisma/Neon |
| `DIRECT_URL` | Chaîne de connexion directe Neon pour migrations | Pour Prisma/Neon |
| `FEDAPAY_SECRET_KEY` | Clé secrète API FedaPay (Sandbox ou Live) | Pour checkout FedaPay |
| `FEDAPAY_PUBLIC_KEY` | Clé publique FedaPay | Optionnelle |
| `FEDAPAY_ENVIRONMENT` | `sandbox` ou `live` | Défaut `sandbox` |
| `FEDAPAY_WEBHOOK_SECRET` | Secret de signature `X-FEDAPAY-SIGNATURE` | Pour webhooks FedaPay |
| `VITE_GA_MEASUREMENT_ID` | Identifiant GA4 (`G-XXXXXXXXXX`) | Optionnel |
| `GOOGLE_SITE_VERIFICATION` | Jeton méta Google Search Console | Optionnel |
| `BING_SITE_VERIFICATION` | Jeton méta Bing Webmaster Tools | Optionnel |

---

## 3. Étapes de mise en production sur Neon + Vercel

1. Créez une base PostgreSQL sur **Neon** et copiez `DATABASE_URL` et `DIRECT_URL`.
2. Appliquez la migration SQL initiale :
   ```bash
   npx prisma migrate deploy
   ```
   *(ou exécutez `/prisma/migrations/001_init/migration.sql` directement sur votre base Neon).*
3. Note : Pour basculer les routes Express de SQLite vers `@prisma/client` en production serverless Vercel, adaptez la couche d’accès dans `src/server/` vers Prisma Client et utilisez un stockage objet S3 / Cloudflare R2 (`S3_BUCKET`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`) pour les justificatifs à la place du système de fichiers local `data/uploads`.
4. Configurez votre webhook FedaPay dans le tableau de bord FedaPay vers :  
   `https://votre-domaine.com/api/webhooks/fedapay`
5. Déployez sur Vercel avec `npm run build`.
