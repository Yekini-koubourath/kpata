export type GlobalRole = 'USER' | 'ADMIN' | 'SUPER_ADMIN';

export type GroupType =
  | 'FAMILLE'
  | 'FOYER'
  | 'COUPLE'
  | 'COLOCATION'
  | 'AMIS'
  | 'ASSOCIATION'
  | 'ORGANISATION'
  | 'PROFESSIONNEL'
  | 'VOYAGE'
  | 'EVENEMENT'
  | 'COMMUNAUTE'
  | 'AUTRE';

export type GroupRole = 'OWNER' | 'ADMIN' | 'TREASURER' | 'MEMBER' | 'OBSERVER';

export type MemberStatus = 'ACTIVE' | 'SUSPENDED' | 'LEFT';

export type SplitMethod =
  | 'EQUAL'
  | 'CUSTOM'
  | 'PERCENTAGE'
  | 'WEIGHT'
  | 'PARTICIPATION'
  | 'FIXED';

export type ExpenseScope = 'COLLECTIVE' | 'PARTIAL' | 'PERSONAL';
export type ExpensePaymentStatus = 'RECORDED' | 'PARTIAL' | 'PAID';
export type ExpenseStatus = 'ACTIVE' | 'CANCELLED';

export type SettlementStatus = 'PENDING' | 'CONFIRMED' | 'DISPUTED' | 'CANCELLED';
export type ContributionPaymentStatus = 'DECLARED' | 'CONFIRMED' | 'DISPUTED' | 'CANCELLED';

export type SubscriptionPlanCode = 'FREE' | 'PREMIUM' | 'ORG';
export type SubscriptionStatus = 'ACTIVE' | 'PENDING_PAYMENT' | 'EXPIRED' | 'SUSPENDED';

export interface PlanEntitlements {
  code: SubscriptionPlanCode;
  label: string;
  tagline: string;
  maxMembers: number | null;
  maxContributionPlans: number | null;
  maxBudgets: number | null;
  maxDocuments: number | null;
  allowedSplitMethods: SplitMethod[];
  allowRecurringExpenses: boolean;
  allowRecurringContributions: boolean;
  allowExports: boolean;
  allowTreasurerRole: boolean;
  allowSavingsGoals: boolean;
  allowCustomCategories: boolean;
  allowOptimizerFull: boolean;
}

export const PLAN_ENTITLEMENTS: Record<SubscriptionPlanCode, PlanEntitlements> = {
  FREE: {
    code: 'FREE',
    label: 'Gratuit',
    tagline: 'Pour découvrir à petit comité (jusqu’à 5 membres)',
    maxMembers: 5,
    maxContributionPlans: 1,
    maxBudgets: 1,
    maxDocuments: 3,
    allowedSplitMethods: ['EQUAL', 'PARTICIPATION'],
    allowRecurringExpenses: false,
    allowRecurringContributions: false,
    allowExports: false,
    allowTreasurerRole: false,
    allowSavingsGoals: false,
    allowCustomCategories: false,
    allowOptimizerFull: false,
  },
  PREMIUM: {
    code: 'PREMIUM',
    label: 'Premium Famille & Coloc',
    tagline: 'Foyers, couples, colocations & voyages (jusqu’à 20 membres)',
    maxMembers: 20,
    maxContributionPlans: 5,
    maxBudgets: 10,
    maxDocuments: 100,
    allowedSplitMethods: ['EQUAL', 'CUSTOM', 'PERCENTAGE', 'WEIGHT', 'PARTICIPATION', 'FIXED'],
    allowRecurringExpenses: true,
    allowRecurringContributions: true,
    allowExports: true,
    allowTreasurerRole: false,
    allowSavingsGoals: true,
    allowCustomCategories: true,
    allowOptimizerFull: true,
  },
  ORG: {
    code: 'ORG',
    label: 'Association & Organisation',
    tagline: 'Associations, tontines, ONG & communautés (membres illimités)',
    maxMembers: null,
    maxContributionPlans: null,
    maxBudgets: null,
    maxDocuments: null,
    allowedSplitMethods: ['EQUAL', 'CUSTOM', 'PERCENTAGE', 'WEIGHT', 'PARTICIPATION', 'FIXED'],
    allowRecurringExpenses: true,
    allowRecurringContributions: true,
    allowExports: true,
    allowTreasurerRole: true,
    allowSavingsGoals: true,
    allowCustomCategories: true,
    allowOptimizerFull: true,
  },
};

export function getEffectiveEntitlements(
  planCode?: string | null,
  subscriptionStatus?: string | null
): PlanEntitlements {
  if (subscriptionStatus && subscriptionStatus !== 'ACTIVE') {
    return PLAN_ENTITLEMENTS.FREE;
  }
  const code = (planCode || 'FREE') as SubscriptionPlanCode;
  return PLAN_ENTITLEMENTS[code] || PLAN_ENTITLEMENTS.FREE;
}

export const GROUP_TYPES: { value: GroupType; label: string; description: string }[] = [
  { value: 'FAMILLE', label: 'Famille', description: 'Ménage, parents, enfants et charges familiales' },
  { value: 'FOYER', label: 'Foyer', description: 'Courses, loyer, eau, électricité et entretien' },
  { value: 'COUPLE', label: 'Couple', description: 'Dépenses partagées et projets à deux' },
  { value: 'COLOCATION', label: 'Colocation', description: 'Étudiants ou colocataires partageant un logement' },
  { value: 'AMIS', label: "Groupe d'amis", description: 'Sorties, restaurants, cotisations entre amis' },
  { value: 'ASSOCIATION', label: 'Association', description: 'Cotisations membres, trésorerie et activités' },
  { value: 'ORGANISATION', label: 'Organisation', description: 'Structure associative ou communautaire multi-responsables' },
  { value: 'PROFESSIONNEL', label: 'Groupe professionnel', description: 'Équipe, bureau ou caisse collective' },
  { value: 'VOYAGE', label: 'Voyage', description: 'Transport, hébergement et frais de séjour partagés' },
  { value: 'EVENEMENT', label: 'Événement', description: 'Mariage, anniversaire, cérémonie ou activité ponctuelle' },
  { value: 'COMMUNAUTE', label: 'Communauté', description: 'Groupe religieux, quartier ou tontine solidaire' },
  { value: 'AUTRE', label: 'Autre', description: 'Tout autre collectif avec finances partagées' },
];

export const GROUP_ROLE_LABELS: Record<GroupRole, string> = {
  OWNER: 'Propriétaire',
  ADMIN: 'Administrateur',
  TREASURER: 'Trésorier',
  MEMBER: 'Membre',
  OBSERVER: 'Observateur',
};

export const SPLIT_METHOD_LABELS: Record<SplitMethod, string> = {
  EQUAL: 'Répartition équitable',
  CUSTOM: 'Répartition personnalisée',
  PERCENTAGE: 'Répartition en pourcentage',
  WEIGHT: 'Répartition par poids',
  PARTICIPATION: 'Répartition par participation',
  FIXED: 'Répartition par montant fixe',
};

export const CURRENCIES: { code: string; label: string; symbol: string; decimals: number }[] = [
  { code: 'XOF', label: 'Franc CFA BCEAO (FCFA)', symbol: 'FCFA', decimals: 0 },
  { code: 'XAF', label: 'Franc CFA BEAC (FCFA)', symbol: 'FCFA', decimals: 0 },
  { code: 'NGN', label: 'Naira nigérian (NGN)', symbol: '₦', decimals: 0 },
  { code: 'GHS', label: 'Cedi ghanéen (GHS)', symbol: 'GH₵', decimals: 0 },
  { code: 'EUR', label: 'Euro (EUR)', symbol: '€', decimals: 0 },
];

export const COUNTRIES: { code: string; name: string; defaultCurrency: string; defaultTimezone: string }[] = [
  { code: 'BJ', name: 'Bénin', defaultCurrency: 'XOF', defaultTimezone: 'Africa/Porto-Novo' },
  { code: 'TG', name: 'Togo', defaultCurrency: 'XOF', defaultTimezone: 'Africa/Lome' },
  { code: 'CI', name: "Côte d'Ivoire", defaultCurrency: 'XOF', defaultTimezone: 'Africa/Abidjan' },
  { code: 'SN', name: 'Sénégal', defaultCurrency: 'XOF', defaultTimezone: 'Africa/Dakar' },
  { code: 'BF', name: 'Burkina Faso', defaultCurrency: 'XOF', defaultTimezone: 'Africa/Ouagadougou' },
  { code: 'ML', name: 'Mali', defaultCurrency: 'XOF', defaultTimezone: 'Africa/Bamako' },
  { code: 'NE', name: 'Niger', defaultCurrency: 'XOF', defaultTimezone: 'Africa/Niamey' },
  { code: 'CM', name: 'Cameroun', defaultCurrency: 'XAF', defaultTimezone: 'Africa/Douala' },
  { code: 'NG', name: 'Nigéria', defaultCurrency: 'NGN', defaultTimezone: 'Africa/Lagos' },
  { code: 'GH', name: 'Ghana', defaultCurrency: 'GHS', defaultTimezone: 'Africa/Accra' },
];

export function formatMoney(amountInt: number, currency = 'XOF'): string {
  const safe = Number.isFinite(amountInt) ? Math.round(amountInt) : 0;
  const formatted = new Intl.NumberFormat('fr-FR', {
    maximumFractionDigits: 0,
  }).format(safe);
  const curr = CURRENCIES.find((c) => c.code === currency);
  const suffix = curr ? curr.symbol : currency;
  return `${formatted} ${suffix}`;
}

export const ROLE_PERMISSIONS: Record<
  GroupRole,
  {
    canManageGroup: boolean;
    canManageMembers: boolean;
    canAssignRoles: boolean;
    canInvite: boolean;
    canCreateExpense: boolean;
    canEditAnyExpense: boolean;
    canCancelExpense: boolean;
    canManageContributions: boolean;
    canConfirmPayments: boolean;
    canManageBudgets: boolean;
    canExportReports: boolean;
    canManageSubscription: boolean;
  }
> = {
  OWNER: {
    canManageGroup: true,
    canManageMembers: true,
    canAssignRoles: true,
    canInvite: true,
    canCreateExpense: true,
    canEditAnyExpense: true,
    canCancelExpense: true,
    canManageContributions: true,
    canConfirmPayments: true,
    canManageBudgets: true,
    canExportReports: true,
    canManageSubscription: true,
  },
  ADMIN: {
    canManageGroup: true,
    canManageMembers: true,
    canAssignRoles: false,
    canInvite: true,
    canCreateExpense: true,
    canEditAnyExpense: true,
    canCancelExpense: true,
    canManageContributions: true,
    canConfirmPayments: true,
    canManageBudgets: true,
    canExportReports: true,
    canManageSubscription: true,
  },
  TREASURER: {
    canManageGroup: false,
    canManageMembers: false,
    canAssignRoles: false,
    canInvite: false,
    canCreateExpense: true,
    canEditAnyExpense: false,
    canCancelExpense: false,
    canManageContributions: true,
    canConfirmPayments: true,
    canManageBudgets: true,
    canExportReports: true,
    canManageSubscription: false,
  },
  MEMBER: {
    canManageGroup: false,
    canManageMembers: false,
    canAssignRoles: false,
    canInvite: false,
    canCreateExpense: true,
    canEditAnyExpense: false,
    canCancelExpense: false,
    canManageContributions: false,
    canConfirmPayments: false,
    canManageBudgets: false,
    canExportReports: true,
    canManageSubscription: false,
  },
  OBSERVER: {
    canManageGroup: false,
    canManageMembers: false,
    canAssignRoles: false,
    canInvite: false,
    canCreateExpense: false,
    canEditAnyExpense: false,
    canCancelExpense: false,
    canManageContributions: false,
    canConfirmPayments: false,
    canManageBudgets: false,
    canExportReports: false,
    canManageSubscription: false,
  },
};

export interface UserPublic {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone: string | null;
  role: GlobalRole;
  emailVerified: boolean;
  preferredLang: string;
  createdAt: string;
}
