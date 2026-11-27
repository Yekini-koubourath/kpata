import crypto from 'node:crypto';
import { getDb } from './db';
import { hashPassword } from './auth';

const DEFAULT_CATEGORIES = [
  'Alimentation',
  'Logement',
  'Loyer',
  'Eau',
  'Électricité',
  'Internet',
  'Gaz',
  'Transport',
  'Santé',
  'Éducation',
  'Habillement',
  'Entretien',
  'Loisirs',
  'Événements',
  'Voyages',
  'Activités associatives',
  'Autres',
];

export function ensureSeedData(): void {
  const db = getDb();
  const now = new Date();
  const nowIso = now.toISOString();

  // 1. Subscription Plans (3 diversified tiers: FREE, PREMIUM, ORG)
  db.prepare("UPDATE subscriptions SET plan_code = 'ORG' WHERE plan_code = 'PRO'").run();
  db.prepare("DELETE FROM subscription_plans WHERE code = 'PRO'").run();

  const upsertPlan = db.prepare(
    `INSERT INTO subscription_plans (code, name, description, monthly_price_int, currency, max_members, features_json, is_active)
     VALUES (?, ?, ?, ?, ?, ?, ?, 1)
     ON CONFLICT(code) DO UPDATE SET
       name = excluded.name,
       description = excluded.description,
       max_members = excluded.max_members,
       features_json = excluded.features_json`
  );
  upsertPlan.run(
    'FREE',
    'Gratuit',
    'L’essentiel pour découvrir à petit comité sans bloquer vos soldes ni vos remboursements.',
    0,
    'XOF',
    5,
    JSON.stringify([
      'Jusqu’à 5 membres par groupe (internes ou externes)',
      'Dépenses multi-payeurs (répartition équitable & participation)',
      '1 appel de cotisation ponctuelle & 1 budget mensuel',
      'Jusqu’à 3 justificatifs archivés',
      'Calcul automatique des soldes et remboursements déclarés',
    ])
  );
  upsertPlan.run(
    'PREMIUM',
    'Premium Famille & Coloc',
    'Conçu pour les foyers, couples, colocations et voyages. Facturation par groupe.',
    500,
    'XOF',
    20,
    JSON.stringify([
      'Jusqu’à 20 membres par groupe',
      'Les 6 méthodes de répartition (Pourcentage, Poids familiaux, Fixe, Personnalisée)',
      'Dépenses récurrentes (loyer, électricité SBEE, eau SONEB, Internet)',
      'Jusqu’à 10 budgets avec alertes 50/75/90/100 % & Objectifs d’épargne',
      'Exports comptables PDF & Excel + Coffre 100 justificatifs',
      'Optimisation complète des remboursements (transferts minimaux)',
    ])
  );
  upsertPlan.run(
    'ORG',
    'Association & Organisation',
    'Pensé pour les associations, tontines, mutuelles, ONG et grands collectifs.',
    1000,
    'XOF',
    null,
    JSON.stringify([
      'Membres illimités par groupe',
      'Tout le plan Premium Famille & Coloc inclus',
      'Rôle Trésorier dédié & validation financière indépendante',
      'Appels de cotisations illimités & récurrents (paiements partiels)',
      'Budgets, catégories personnalisées et coffre-fort justificatifs illimités',
      'Rapports associatifs complets et journal d’audit détaillé',
    ])
  );

  // 2. Default Categories
  const existingCats = db
    .prepare('SELECT COUNT(*) as c FROM expense_categories WHERE group_id IS NULL')
    .get() as { c: number };
  if (existingCats.c === 0) {
    const insCat = db.prepare(
      'INSERT INTO expense_categories (id, group_id, name, is_active) VALUES (?, NULL, ?, 1)'
    );
    for (const name of DEFAULT_CATEGORIES) {
      insCat.run(`cat_${name.toLowerCase().replace(/[^a-z0-9]/g, '_')}`, name);
    }
  }

  // 3. Ensure default Super Admin exists (admin@kpata.bj / KpataAdmin2026!) if no admin user exists yet
  const existingAdmin = db
    .prepare("SELECT id FROM users WHERE role IN ('ADMIN', 'SUPER_ADMIN') LIMIT 1")
    .get() as { id: string } | undefined;
  if (!existingAdmin) {
    const adminPassHash = hashPassword('KpataAdmin2026!');
    const existingAdminEmail = db
      .prepare("SELECT id FROM users WHERE email = 'admin@kpata.bj'")
      .get() as { id: string } | undefined;
    if (existingAdminEmail) {
      db.prepare("UPDATE users SET role = 'SUPER_ADMIN', password_hash = ?, updated_at = ? WHERE id = ?").run(
        adminPassHash,
        nowIso,
        existingAdminEmail.id
      );
    } else {
      const adminId = 'usr_admin_kpata';
      db.prepare(
        `INSERT INTO users (id, email, first_name, last_name, phone, password_hash, role, email_verified, preferred_lang, created_at, updated_at)
         VALUES (?, 'admin@kpata.bj', 'Admin', 'KPATA', '+229 0150495832', ?, 'SUPER_ADMIN', 1, 'fr', ?, ?)`
      ).run(adminId, adminPassHash, nowIso, nowIso);
      db.prepare('INSERT OR IGNORE INTO notification_preferences (user_id) VALUES (?)').run(adminId);
    }
  }

  // 4. Check if demo users already seeded
  const existingDemoUser = db
    .prepare("SELECT id FROM users WHERE email = 'jean.dossou@kpata.bj'")
    .get() as { id: string } | undefined;
  if (existingDemoUser) return;

  const demoPasswordHash = hashPassword('KpataDemo2026!');

  const uJean = 'usr_jean_dossou';
  const uMariam = 'usr_mariam_kone';
  const uKossi = 'usr_kossi_agbo';
  const uNadia = 'usr_nadia_houngbo';

  const insertUser = db.prepare(
    `INSERT INTO users (id, email, first_name, last_name, phone, password_hash, role, email_verified, preferred_lang, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, 1, 'fr', ?, ?)`
  );

  insertUser.run(uJean, 'jean.dossou@kpata.bj', 'Jean', 'Dossou', '+229 01 97 11 22 33', demoPasswordHash, 'USER', nowIso, nowIso);
  insertUser.run(uMariam, 'mariam.kone@kpata.bj', 'Mariam', 'Koné', '+229 01 96 44 55 66', demoPasswordHash, 'USER', nowIso, nowIso);
  insertUser.run(uKossi, 'kossi.agbo@kpata.bj', 'Kossi', 'Agbo', '+229 01 95 77 88 99', demoPasswordHash, 'USER', nowIso, nowIso);
  insertUser.run(uNadia, 'nadia.houngbo@kpata.bj', 'Nadia', 'Houngbo', '+229 01 66 20 30 40', demoPasswordHash, 'USER', nowIso, nowIso);

  const insPref = db.prepare('INSERT OR IGNORE INTO notification_preferences (user_id) VALUES (?)');
  [uJean, uMariam, uKossi, uNadia].forEach((u) => insPref.run(u));

  // Group 1: Famille Dossou (Cotonou) - Démo
  const gFamille = 'grp_famille_dossou';
  db.prepare(
    `INSERT INTO groups (id, name, type, description, country, currency, timezone, visibility, status, created_by, created_at, updated_at)
     VALUES (?, ?, 'FAMILLE', ?, 'BJ', 'XOF', 'Africa/Porto-Novo', 'PRIVATE', 'ACTIVE', ?, ?, ?)`
  ).run(
    gFamille,
    'Famille Dossou (Démo)',
    'Gestion mensuelle du foyer familial à Cotonou : marché, factures SBEE/SONEB et scolarité.',
    uJean,
    nowIso,
    nowIso
  );

  db.prepare(
    `INSERT INTO subscriptions (id, group_id, plan_code, status, start_date, end_date, auto_renew, updated_at)
     VALUES (?, ?, 'PREMIUM', 'ACTIVE', ?, ?, 0, ?)`
  ).run('sub_famille', gFamille, nowIso, new Date(now.getTime() + 30 * 86400000).toISOString(), nowIso);

  const mFamJean = 'mem_fam_jean';
  const mFamMariam = 'mem_fam_mariam';
  const mFamCecile = 'mem_fam_cecile'; // Membre externe sans compte
  const mFamJunior = 'mem_fam_junior'; // Membre externe sans compte

  const insMember = db.prepare(
    `INSERT INTO group_members (id, group_id, user_id, first_name, last_name, email, phone, family_relation, role, status, is_external, joined_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'ACTIVE', ?, ?)`
  );
  insMember.run(mFamJean, gFamille, uJean, 'Jean', 'Dossou', 'jean.dossou@kpata.bj', '+229 01 97 11 22 33', 'Parent', 'OWNER', 0, nowIso);
  insMember.run(mFamMariam, gFamille, uMariam, 'Mariam', 'Koné', 'mariam.kone@kpata.bj', '+229 01 96 44 55 66', 'Parent', 'ADMIN', 0, nowIso);
  insMember.run(mFamCecile, gFamille, null, 'Cécile', 'Dossou', null, '+229 01 90 12 34 56', 'Grand-mère', 'MEMBER', 1, nowIso);
  insMember.run(mFamJunior, gFamille, null, 'Junior', 'Dossou', null, null, 'Enfant étudiant', 'MEMBER', 1, nowIso);

  // Expense 1 (Multi-payer exact example from Cahier des charges §4.7): 15 000 FCFA, Mariam 5 000, Jean 10 000
  const daysAgo = (d: number) => new Date(now.getTime() - d * 86400000).toISOString().slice(0, 10);
  const exp1 = 'exp_fam_marche';
  db.prepare(
    `INSERT INTO expenses (id, group_id, title, description, amount_int, currency, expense_date, category_id, scope, split_method, payment_status, status, created_by_member_id, created_at, updated_at)
     VALUES (?, ?, ?, ?, 15000, 'XOF', ?, 'cat_alimentation', 'COLLECTIVE', 'EQUAL', 'PAID', 'ACTIVE', ?, ?, ?)`
  ).run(exp1, gFamille, 'Courses marché Dantokpa', 'Provisions alimentaires de la semaine (exemple multi-payeurs)', daysAgo(4), mFamJean, nowIso, nowIso);
  db.prepare('INSERT INTO expense_payers (id, expense_id, member_id, amount_paid_int) VALUES (?, ?, ?, ?)').run('pay_1a', exp1, mFamMariam, 5000);
  db.prepare('INSERT INTO expense_payers (id, expense_id, member_id, amount_paid_int) VALUES (?, ?, ?, ?)').run('pay_1b', exp1, mFamJean, 10000);
  db.prepare('INSERT INTO expense_shares (id, expense_id, member_id, share_amount_int, weight_or_pct_num) VALUES (?, ?, ?, ?, 1)').run('shr_1a', exp1, mFamJean, 5000);
  db.prepare('INSERT INTO expense_shares (id, expense_id, member_id, share_amount_int, weight_or_pct_num) VALUES (?, ?, ?, ?, 1)').run('shr_1b', exp1, mFamMariam, 5000);
  db.prepare('INSERT INTO expense_shares (id, expense_id, member_id, share_amount_int, weight_or_pct_num) VALUES (?, ?, ?, ?, 1)').run('shr_1c', exp1, mFamCecile, 5000);

  // Expense 2: Facture SBEE 24 000 FCFA paid by Jean, split by weight (Jean 2, Mariam 2, Cécile 1, Junior 1 => 8000, 8000, 4000, 4000)
  const exp2 = 'exp_fam_sbee';
  db.prepare(
    `INSERT INTO expenses (id, group_id, title, description, amount_int, currency, expense_date, category_id, scope, split_method, payment_status, status, is_recurring, recurrence_freq, created_by_member_id, created_at, updated_at)
     VALUES (?, ?, ?, ?, 24000, 'XOF', ?, 'cat__lectricit_', 'COLLECTIVE', 'WEIGHT', 'PAID', 'ACTIVE', 1, 'MONTHLY', ?, ?, ?)`
  ).run(exp2, gFamille, 'Facture électricité SBEE', 'Compteur principal du domicile familial', daysAgo(9), mFamJean, nowIso, nowIso);
  db.prepare('INSERT INTO expense_payers (id, expense_id, member_id, amount_paid_int) VALUES (?, ?, ?, ?)').run('pay_2a', exp2, mFamJean, 24000);
  db.prepare('INSERT INTO expense_shares (id, expense_id, member_id, share_amount_int, weight_or_pct_num) VALUES (?, ?, ?, ?, 2000)').run('shr_2a', exp2, mFamJean, 8000);
  db.prepare('INSERT INTO expense_shares (id, expense_id, member_id, share_amount_int, weight_or_pct_num) VALUES (?, ?, ?, ?, 2000)').run('shr_2b', exp2, mFamMariam, 8000);
  db.prepare('INSERT INTO expense_shares (id, expense_id, member_id, share_amount_int, weight_or_pct_num) VALUES (?, ?, ?, ?, 1000)').run('shr_2c', exp2, mFamCecile, 4000);
  db.prepare('INSERT INTO expense_shares (id, expense_id, member_id, share_amount_int, weight_or_pct_num) VALUES (?, ?, ?, ?, 1000)').run('shr_2d', exp2, mFamJunior, 4000);

  // Partial settlement from Mariam to Jean
  db.prepare(
    `INSERT INTO settlements (id, group_id, from_member_id, to_member_id, amount_int, currency, settlement_date, payment_method, reference, note, status, declared_by_user_id, confirmed_by_user_id, created_at, confirmed_at)
     VALUES (?, ?, ?, ?, 5000, 'XOF', ?, 'MTN_MOMO', 'MOMO-88412', 'Premier versement sur la facture SBEE', 'CONFIRMED', ?, ?, ?, ?)`
  ).run('stl_fam_1', gFamille, mFamMariam, mFamJean, daysAgo(2), uMariam, uJean, nowIso, nowIso);

  // Pending settlement waiting confirmation
  db.prepare(
    `INSERT INTO settlements (id, group_id, from_member_id, to_member_id, amount_int, currency, settlement_date, payment_method, reference, note, status, declared_by_user_id, created_at)
     VALUES (?, ?, ?, ?, 3000, 'XOF', ?, 'MOOV_MONEY', 'MOOV-22019', 'Solde complémentaire SBEE', 'PENDING', ?, ?)`
  ).run('stl_fam_2', gFamille, mFamMariam, mFamJean, daysAgo(1), uMariam, nowIso);

  // Budgets for Famille
  const monthStart = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}-01`;
  const monthEnd = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}-28`;
  db.prepare(
    `INSERT INTO budgets (id, group_id, category_id, name, period_type, start_date, end_date, limit_amount_int, created_at)
     VALUES (?, ?, 'cat_alimentation', 'Budget Alimentation Mensuel', 'MONTHLY', ?, ?, 80000, ?)`
  ).run('bdg_fam_alim', gFamille, monthStart, monthEnd, nowIso);
  db.prepare(
    `INSERT INTO budgets (id, group_id, category_id, name, period_type, start_date, end_date, limit_amount_int, created_at)
     VALUES (?, ?, 'cat__lectricit_', 'Budget Électricité SBEE', 'MONTHLY', ?, ?, 25000, ?)`
  ).run('bdg_fam_elec', gFamille, monthStart, monthEnd, nowIso);

  // Savings goal
  db.prepare(
    `INSERT INTO savings_goals (id, group_id, title, description, target_amount_int, deadline, status, created_at)
     VALUES (?, ?, 'Kit solaire familial', 'Suivi des engagements familiaux pour l’autonomie énergétique (KPATA ne conserve pas les fonds).', 300000, ?, 'ACTIVE', ?)`
  ).run('sav_fam_1', gFamille, daysAgo(-60), nowIso);
  db.prepare(
    `INSERT INTO savings_contributions (id, goal_id, member_id, amount_int, status, note, created_at, confirmed_at)
     VALUES (?, 'sav_fam_1', ?, 120000, 'CONFIRMED', 'Apport initial sur compte dédié', ?, ?)`
  ).run('savc_1', mFamJean, nowIso, nowIso);
  db.prepare(
    `INSERT INTO savings_contributions (id, goal_id, member_id, amount_int, status, note, created_at, confirmed_at)
     VALUES (?, 'sav_fam_1', ?, 60000, 'CONFIRMED', 'Participation mois en cours', ?, ?)`
  ).run('savc_2', mFamMariam, nowIso, nowIso);

  // Group 2: Colocation Calavi Résidence (Démo)
  const gColoc = 'grp_coloc_calavi';
  db.prepare(
    `INSERT INTO groups (id, name, type, description, country, currency, timezone, visibility, status, created_by, created_at, updated_at)
     VALUES (?, ?, 'COLOCATION', ?, 'BJ', 'XOF', 'Africa/Porto-Novo', 'PRIVATE', 'ACTIVE', ?, ?, ?)`
  ).run(
    gColoc,
    'Colocation Calavi Résidence (Démo)',
    'Partage du loyer, connexion Wi-Fi et factures d’eau entre étudiants à Abomey-Calavi.',
    uKossi,
    nowIso,
    nowIso
  );
  db.prepare(
    `INSERT INTO subscriptions (id, group_id, plan_code, status, start_date, auto_renew, updated_at)
     VALUES (?, ?, 'FREE', 'ACTIVE', ?, 0, ?)`
  ).run('sub_coloc', gColoc, nowIso, nowIso);

  const mColJean = 'mem_col_jean';
  const mColKossi = 'mem_col_kossi';
  const mColNadia = 'mem_col_nadia';
  insMember.run(mColKossi, gColoc, uKossi, 'Kossi', 'Agbo', 'kossi.agbo@kpata.bj', '+229 01 95 77 88 99', null, 'OWNER', 0, nowIso);
  insMember.run(mColJean, gColoc, uJean, 'Jean', 'Dossou', 'jean.dossou@kpata.bj', '+229 01 97 11 22 33', null, 'MEMBER', 0, nowIso);
  insMember.run(mColNadia, gColoc, uNadia, 'Nadia', 'Houngbo', 'nadia.houngbo@kpata.bj', '+229 01 66 20 30 40', null, 'TREASURER', 0, nowIso);

  const expCol1 = 'exp_col_loyer';
  db.prepare(
    `INSERT INTO expenses (id, group_id, title, description, amount_int, currency, expense_date, category_id, scope, split_method, payment_status, status, is_recurring, recurrence_freq, created_by_member_id, created_at, updated_at)
     VALUES (?, ?, 'Loyer appartement Calavi', 'Loyer mensuel 3 chambres salon', 90000, 'XOF', ?, 'cat_loyer', 'COLLECTIVE', 'EQUAL', 'PAID', 'ACTIVE', 1, 'MONTHLY', ?, ?, ?)`
  ).run(expCol1, gColoc, daysAgo(6), mColKossi, nowIso, nowIso);
  db.prepare('INSERT INTO expense_payers (id, expense_id, member_id, amount_paid_int) VALUES (?, ?, ?, 90000)').run('pay_c1', expCol1, mColKossi);
  db.prepare('INSERT INTO expense_shares (id, expense_id, member_id, share_amount_int) VALUES (?, ?, ?, 30000)').run('shr_c1', expCol1, mColKossi);
  db.prepare('INSERT INTO expense_shares (id, expense_id, member_id, share_amount_int) VALUES (?, ?, ?, 30000)').run('shr_c2', expCol1, mColJean);
  db.prepare('INSERT INTO expense_shares (id, expense_id, member_id, share_amount_int) VALUES (?, ?, ?, 30000)').run('shr_c3', expCol1, mColNadia);

  const expCol2 = 'exp_col_internet';
  db.prepare(
    `INSERT INTO expenses (id, group_id, title, description, amount_int, currency, expense_date, category_id, scope, split_method, payment_status, status, created_by_member_id, created_at, updated_at)
     VALUES (?, ?, 'Fibre optique Wi-Fi', 'Abonnement mensuel partagé', 18000, 'XOF', ?, 'cat_internet', 'COLLECTIVE', 'EQUAL', 'PAID', 'ACTIVE', ?, ?, ?)`
  ).run(expCol2, gColoc, daysAgo(3), mColNadia, nowIso, nowIso);
  db.prepare('INSERT INTO expense_payers (id, expense_id, member_id, amount_paid_int) VALUES (?, ?, ?, 18000)').run('pay_c2', expCol2, mColNadia);
  db.prepare('INSERT INTO expense_shares (id, expense_id, member_id, share_amount_int) VALUES (?, ?, ?, 6000)').run('shr_c2a', expCol2, mColKossi);
  db.prepare('INSERT INTO expense_shares (id, expense_id, member_id, share_amount_int) VALUES (?, ?, ?, 6000)').run('shr_c2b', expCol2, mColJean);
  db.prepare('INSERT INTO expense_shares (id, expense_id, member_id, share_amount_int) VALUES (?, ?, ?, 6000)').run('shr_c2c', expCol2, mColNadia);

  // Group 3: Association Jeunes Leaders Bénin (Démo)
  const gAssoc = 'grp_assoc_jlb';
  db.prepare(
    `INSERT INTO groups (id, name, type, description, country, currency, timezone, visibility, status, created_by, created_at, updated_at)
     VALUES (?, ?, 'ASSOCIATION', ?, 'BJ', 'XOF', 'Africa/Porto-Novo', 'PRIVATE', 'ACTIVE', ?, ?, ?)`
  ).run(
    gAssoc,
    'Association Jeunes Leaders Bénin (Démo)',
    'Suivi des cotisations annuelles, fonds d’entraide et budget d’événements communautaires.',
    uMariam,
    nowIso,
    nowIso
  );
  db.prepare(
    `INSERT INTO subscriptions (id, group_id, plan_code, status, start_date, end_date, auto_renew, updated_at)
     VALUES (?, ?, 'ORG', 'ACTIVE', ?, ?, 0, ?)`
  ).run('sub_assoc', gAssoc, nowIso, new Date(now.getTime() + 30 * 86400000).toISOString(), nowIso);

  const mAssMariam = 'mem_ass_mariam';
  const mAssJean = 'mem_ass_jean';
  const mAssNadia = 'mem_ass_nadia';
  const mAssPaul = 'mem_ass_paul'; // External member
  insMember.run(mAssMariam, gAssoc, uMariam, 'Mariam', 'Koné', 'mariam.kone@kpata.bj', null, null, 'OWNER', 0, nowIso);
  insMember.run(mAssJean, gAssoc, uJean, 'Jean', 'Dossou', 'jean.dossou@kpata.bj', null, null, 'TREASURER', 0, nowIso);
  insMember.run(mAssNadia, gAssoc, uNadia, 'Nadia', 'Houngbo', 'nadia.houngbo@kpata.bj', null, null, 'MEMBER', 0, nowIso);
  insMember.run(mAssPaul, gAssoc, null, 'Paul', 'Gandonou', 'paul.g@exemple.bj', '+229 01 94 00 11 22', null, 'MEMBER', 1, nowIso);

  // Contribution Plan (10 000 FCFA per member, partial payments example from Cahier §5.4: 4000 + 6000)
  const cPlanId = 'cplan_assoc_1';
  db.prepare(
    `INSERT INTO contribution_plans (id, group_id, name, objective, target_amount_int, amount_per_member_int, frequency, start_date, due_date, currency, status, created_by, created_at)
     VALUES (?, ?, 'Cotisation Journée Communautaire', 'Financer la conférence annuelle et le matériel logistique', 40000, 10000, 'ONCE', ?, ?, 'XOF', 'ACTIVE', ?, ?)`
  ).run(cPlanId, gAssoc, daysAgo(15), daysAgo(-15), uMariam, nowIso);

  const insContrib = db.prepare(
    'INSERT INTO contributions (id, plan_id, group_id, member_id, expected_amount_int, status) VALUES (?, ?, ?, ?, 10000, ?)'
  );
  insContrib.run('ctr_1', cPlanId, gAssoc, mAssMariam, 'CONFIRMED');
  insContrib.run('ctr_2', cPlanId, gAssoc, mAssJean, 'PARTIAL');
  insContrib.run('ctr_3', cPlanId, gAssoc, mAssNadia, 'EXPECTED');
  insContrib.run('ctr_4', cPlanId, gAssoc, mAssPaul, 'PARTIAL');

  const insCPay = db.prepare(
    `INSERT INTO contribution_payments (id, contribution_id, amount_int, payment_method, reference, note, status, declared_by_user_id, confirmed_by_user_id, created_at, confirmed_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );
  insCPay.run('cpay_1', 'ctr_1', 4000, 'MTN_MOMO', 'MOMO-1001', 'Premier versement partiel', 'CONFIRMED', uMariam, uJean, daysAgo(10), daysAgo(9));
  insCPay.run('cpay_2', 'ctr_1', 6000, 'MTN_MOMO', 'MOMO-1002', 'Second versement pour solde', 'CONFIRMED', uMariam, uJean, daysAgo(5), daysAgo(5));
  insCPay.run('cpay_3', 'ctr_2', 4000, 'ESPECES', 'RECU-04', 'Versement partiel initial', 'CONFIRMED', uJean, uJean, daysAgo(7), daysAgo(7));
  insCPay.run('cpay_4', 'ctr_4', 5000, 'MOOV_MONEY', 'MOOV-991', 'En attente de validation trésorier', 'DECLARED', uMariam, null, daysAgo(1), null);

  // Notifications
  const insNotif = db.prepare(
    `INSERT INTO notifications (id, user_id, group_id, type, title, body, is_read, link, created_at)
     VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?)`
  );
  insNotif.run(
    crypto.randomUUID(),
    uJean,
    gFamille,
    'SETTLEMENT_PENDING',
    'Remboursement à confirmer',
    'Mariam Koné a déclaré un remboursement de 3 000 FCFA via Moov Money.',
    `/app/groups/${gFamille}`,
    nowIso
  );
  insNotif.run(
    crypto.randomUUID(),
    uJean,
    gAssoc,
    'CONTRIBUTION_DECLARED',
    'Versement de cotisation à vérifier',
    'Un versement de 5 000 FCFA pour Paul Gandonou attend votre validation de trésorier.',
    `/app/groups/${gAssoc}`,
    nowIso
  );

  // Announcement
  db.prepare(
    `INSERT INTO announcements (id, title, body, level, is_active, created_at)
     VALUES (?, 'Lancement pilote Bénin', 'Bienvenue sur KPATA ! Gérez vos dépenses familiales, colocations et cotisations associatives en FCFA.', 'INFO', 1, ?)`
  ).run('ann_1', nowIso);
}
