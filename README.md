# KPATA — Ensemble, gérons mieux notre argent

Application web FinTech collaborative conçue pour le contexte béninois et ouest-africain (FCFA / XOF par défaut, multi-devises), dédiée à la gestion des dépenses partagées, cotisations collectives, remboursements, budgets et objectifs d’épargne par groupe.

> **Avertissement réglementaire :** KPATA est un outil d’enregistrement, de suivi et d’organisation comptable. KPATA ne détient pas l’argent des membres, n’exécute pas de transferts entre membres et ne remplace pas un établissement financier agréé.

---

## Démarrage rapide (Développement & Preview)

1. Installer les dépendances :
   ```bash
   npm install
   ```
2. Configurer les variables d’environnement (facultatif pour démarrer en local — une base SQLite `data/kpata.db` et des données de démonstration sont créées automatiquement) :
   ```bash
   cp .env.example .env
   ```
3. Lancer le serveur full-stack (Express + Vite sur le port `3000`) :
   ```bash
   npm run dev
   ```
4. Exécuter la suite de tests automatisés :
   ```bash
   npm test
   ```
5. Vérifier la compilation et le lint :
   ```bash
   npm run lint
   npm run build
   ```

---

## Comptes de démonstration pré-chargés

*(Mot de passe commun : `KpataDemo2026!`)*
- `jean.dossou@kpata.bj` — Propriétaire de la *Famille Dossou* et membre de l’*Association Jeunes Leaders*
- `mariam.kone@kpata.bj` — Administratrice et co-payeuse
- `kossi.agbo@kpata.bj` — Colocataire (*Colocation Calavi*)
- `nadia.houngbo@kpata.bj` — Trésorière

---

## Administration centrale (`/admin`)

- Au premier lancement sans `ADMIN_BOOTSTRAP_PASSCODE` défini dans `.env`, rendez-vous sur `/admin` pour définir le code secret de l’administrateur principal.
- Si `ADMIN_BOOTSTRAP_PASSCODE` est défini dans `.env`, saisissez ce code pour déverrouiller l’administration.
- Inclut l’onglet **Statistiques du site** (visiteurs totaux, visiteurs uniques, visites/sessions, visiteurs actifs, pages vues, sources de trafic, appareils, navigateurs, pays/villes, filtrage des robots, état GA4 et Search Console).

---

## Documentation complémentaire

- [Guide GA4, SEO, Google Search Console et Bing](/docs/ANALYTICS_SEO_SEARCH_CONSOLE.md)
- [Déploiement Neon (PostgreSQL) et Vercel](/docs/DEPLOYMENT_NEON_VERCEL.md)
- [Architecture API, RBAC et FedaPay v1](/docs/API_AND_PAYMENTS.md)
- [Suivi de progression technique](/PROJECT_PROGRESS.md)
