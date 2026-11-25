# Architecture API, Sécurité RBAC & Paiements FedaPay — KPATA

## 1. Principes de calcul financier (`src/shared/finance.ts`)

- Tous les montants sont stockés et calculés en **entiers stricts** (ex. FCFA / XOF) — jamais en nombres flottants.
- **6 méthodes de répartition :** `EQUAL`, `CUSTOM`, `PERCENTAGE` (points de base), `WEIGHT` (milli-poids), `PARTICIPATION`, `FIXED`.
- Distribution déterministe du reste (méthode de Hamilton) garantissant que `sum(parts) === montant_total`.
- **Multi-payeurs :** la somme des avances payées est validée face au total de la dépense (`PAID` ou `PARTIAL`).
- **Soldes & Optimisation :** `solde_net = avances + remboursements_envoyés_confirmés - parts_dues - remboursements_reçus_confirmés`. L’algorithme glouton génère le nombre minimal de virements pour solder le groupe.

## 2. Sécurité et Isolation stricte par groupe

- Authentification par session (`scrypt` + sel aléatoire pour les mots de passe, jetons aléatoires hachés en SHA-256 côté base, cookie `HttpOnly` + `Authorization: Bearer`).
- Aucune route `/api/groups/:id/*` n’est accessible sans vérification d’appartenance active dans `group_members`.
- Matrice des rôles de groupe (`OWNER`, `ADMIN`, `TREASURER`, `MEMBER`, `OBSERVER`) totalement séparée des rôles globaux (`USER`, `ADMIN`, `SUPER_ADMIN`).
- Les justificatifs (`/api/groups/:id/documents` et `/api/documents/:docId`) sont vérifiés par appartenance au groupe propriétaire du document avant lecture.

## 3. Intégration FedaPay v1

- `POST /api/payments/fedapay/checkout` initialise une transaction sur l’API FedaPay v1 (`sandbox-api.fedapay.com/v1` ou `api.fedapay.com/v1`) avec montant calculé côté serveur.
- `POST /api/webhooks/fedapay` :
  - Vérifie l’en-tête `X-FEDAPAY-SIGNATURE` (`t=<timestamp>,s=<hmac_sha256_hex>`) avec `crypto.timingSafeEqual` et fenêtre anti-rejeu (300 s).
  - Vérifie que `amount` et `currency.iso` correspondent exactement à la transaction attendue.
  - Garantit l’idempotence (un webhook rejoué n’active jamais deux fois la durée).
- `POST /api/payments/fedapay/verify` interroge le serveur FedaPay après retour utilisateur. **Une simple redirection navigateur n’active jamais un abonnement.**
- En mode pilote Bénin sans clé FedaPay configurée, les administrateurs de groupe peuvent soumettre une référence Mobile Money (`POST /api/groups/:id/subscription/request`), validée manuellement dans `/admin`.
