/**
 * KPATA — Script de seed pour déploiement PostgreSQL / Neon via Prisma.
 * Note : Le runtime local Express utilise src/server/seed.ts sur SQLite.
 * Ce fichier documente et exécute l'initialisation des données de démonstration
 * lors d'un déploiement Neon + Prisma.
 */

import { ensureSeedData } from '../src/server/seed';

export async function runSeed() {
  ensureSeedData();
  console.log('[KPATA] Données de démonstration initialisées avec succès.');
}

if (process.argv[1]?.endsWith('seed.ts')) {
  runSeed().catch((err) => {
    console.error('[KPATA] Erreur seed:', err);
    process.exit(1);
  });
}
