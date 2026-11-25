import type { SplitMethod } from './types';

export interface SplitParticipantInput {
  memberId: string;
  included?: boolean;
  /** Used for CUSTOM or FIXED: exact integer amount in currency unit (e.g. FCFA) */
  amountInt?: number;
  /** Used for PERCENTAGE: percentage 0..100 (supports up to 2 decimals, e.g. 33.33 -> converted to basis points) */
  percentage?: number;
  /** Used for WEIGHT: positive weight coefficient (e.g. 1, 2, 1.5 -> converted to integer milli-weights) */
  weight?: number;
}

export interface CalculatedShare {
  memberId: string;
  shareAmountInt: number;
  weightOrPctNum: number;
}

export interface PayerInput {
  memberId: string;
  amountPaidInt: number;
}

/**
 * Computes exact integer shares with zero floating-point drift.
 * Guarantees sum(shareAmountInt) === totalAmountInt.
 */
export function calculateShares(
  totalAmountInt: number,
  method: SplitMethod,
  participants: SplitParticipantInput[]
): CalculatedShare[] {
  if (!Number.isInteger(totalAmountInt) || totalAmountInt <= 0) {
    throw new Error('Le montant total doit être un entier strictement positif.');
  }

  const active = participants.filter((p) => p.included !== false);
  if (active.length === 0) {
    throw new Error('Au moins un participant doit être sélectionné pour répartir la dépense.');
  }

  // Deduplicate memberIds
  const seen = new Set<string>();
  for (const p of active) {
    if (seen.has(p.memberId)) {
      throw new Error('Un même membre ne peut pas figurer deux fois dans la répartition.');
    }
    seen.add(p.memberId);
  }

  if (method === 'EQUAL' || method === 'PARTICIPATION') {
    const count = active.length;
    const base = Math.floor(totalAmountInt / count);
    const remainder = totalAmountInt - base * count;

    return active.map((p, index) => ({
      memberId: p.memberId,
      shareAmountInt: base + (index < remainder ? 1 : 0),
      weightOrPctNum: 1,
    }));
  }

  if (method === 'CUSTOM' || method === 'FIXED') {
    const shares = active.map((p) => {
      const amt = p.amountInt ?? 0;
      if (!Number.isInteger(amt) || amt < 0) {
        throw new Error('Chaque part personnalisée ou fixe doit être un entier positif ou nul.');
      }
      return {
        memberId: p.memberId,
        shareAmountInt: amt,
        weightOrPctNum: amt,
      };
    });

    const sum = shares.reduce((acc, s) => acc + s.shareAmountInt, 0);
    if (sum !== totalAmountInt) {
      throw new Error(
        `La somme des parts (${sum}) doit correspondre exactement au montant total (${totalAmountInt}).`
      );
    }
    return shares;
  }

  if (method === 'PERCENTAGE') {
    // Convert percentages to integer basis points (1% = 100 bp, 100% = 10000 bp)
    const bps = active.map((p) => {
      const pct = p.percentage ?? 0;
      if (!Number.isFinite(pct) || pct < 0) {
        throw new Error('Les pourcentages doivent être positifs ou nuls.');
      }
      return Math.round(pct * 100);
    });

    const totalBp = bps.reduce((a, b) => a + b, 0);
    if (totalBp !== 10000) {
      throw new Error(
        `La somme des pourcentages doit être exactement égale à 100 % (actuellement ${(totalBp / 100).toFixed(2)} %).`
      );
    }

    return allocateByIntegerWeights(totalAmountInt, active, bps);
  }

  if (method === 'WEIGHT') {
    // Convert weights to integer milli-weights (weight 1.5 -> 1500)
    const weights = active.map((p) => {
      const w = p.weight ?? 0;
      if (!Number.isFinite(w) || w < 0) {
        throw new Error('Les coefficients de pondération doivent être positifs ou nuls.');
      }
      return Math.round(w * 1000);
    });

    const totalWeight = weights.reduce((a, b) => a + b, 0);
    if (totalWeight <= 0) {
      throw new Error('La somme des poids doit être strictement supérieure à 0.');
    }

    return allocateByIntegerWeights(totalAmountInt, active, weights);
  }

  throw new Error(`Méthode de répartition non supportée: ${method}`);
}

/**
 * Largest-remainder (Hamilton) integer apportionment using BigInt to avoid precision loss.
 */
function allocateByIntegerWeights(
  totalAmountInt: number,
  participants: SplitParticipantInput[],
  integerWeights: number[]
): CalculatedShare[] {
  const totalWeight = integerWeights.reduce((a, b) => a + b, 0);
  const totalBig = BigInt(totalAmountInt);
  const weightSumBig = BigInt(totalWeight);

  const items = participants.map((p, idx) => {
    const w = integerWeights[idx];
    const numerator = totalBig * BigInt(w);
    const floorShare = Number(numerator / weightSumBig);
    const remainder = numerator % weightSumBig;
    return {
      memberId: p.memberId,
      floorShare,
      remainder,
      idx,
      weightValue: w,
    };
  });

  const allocatedSum = items.reduce((acc, it) => acc + it.floorShare, 0);
  let remaining = totalAmountInt - allocatedSum;

  // Sort by largest remainder descending, tie-break by original index ascending
  const byRemainder = [...items].sort((a, b) => {
    if (b.remainder > a.remainder) return 1;
    if (b.remainder < a.remainder) return -1;
    return a.idx - b.idx;
  });

  const bonus = new Map<number, number>();
  for (let i = 0; i < remaining; i++) {
    const target = byRemainder[i];
    bonus.set(target.idx, 1);
  }

  return items.map((it) => ({
    memberId: it.memberId,
    shareAmountInt: it.floorShare + (bonus.get(it.idx) ?? 0),
    weightOrPctNum: it.weightValue,
  }));
}

/**
 * Validates multi-payer or single-payer payment lines.
 */
export function validatePayers(
  totalAmountInt: number,
  payers: PayerInput[],
  allowPartial = false
): { totalPaidInt: number; paymentStatus: 'RECORDED' | 'PARTIAL' | 'PAID' } {
  if (!Number.isInteger(totalAmountInt) || totalAmountInt <= 0) {
    throw new Error('Le montant total de la dépense doit être un entier positif.');
  }

  const seen = new Set<string>();
  let totalPaidInt = 0;
  for (const p of payers) {
    if (seen.has(p.memberId)) {
      throw new Error('Un même payeur ne peut pas apparaître en double.');
    }
    seen.add(p.memberId);
    if (!Number.isInteger(p.amountPaidInt) || p.amountPaidInt < 0) {
      throw new Error('Le montant payé par chaque payeur doit être un entier positif ou nul.');
    }
    totalPaidInt += p.amountPaidInt;
  }

  if (totalPaidInt > totalAmountInt) {
    throw new Error(
      `La somme des avances (${totalPaidInt}) dépasse le montant total de la dépense (${totalAmountInt}).`
    );
  }

  if (!allowPartial && totalPaidInt !== totalAmountInt) {
    throw new Error(
      `Pour une dépense réglée, la somme des avances (${totalPaidInt}) doit égaler le montant total (${totalAmountInt}).`
    );
  }

  const paymentStatus =
    totalPaidInt === 0 ? 'RECORDED' : totalPaidInt < totalAmountInt ? 'PARTIAL' : 'PAID';

  return { totalPaidInt, paymentStatus };
}

export interface BalanceMemberInput {
  id: string;
  displayName: string;
  isExternal: boolean;
  status: string;
}

export interface BalanceExpenseInput {
  id: string;
  status: 'ACTIVE' | 'CANCELLED';
  payers: { memberId: string; amountPaidInt: number }[];
  shares: { memberId: string; shareAmountInt: number }[];
}

export interface BalanceSettlementInput {
  id: string;
  fromMemberId: string;
  toMemberId: string;
  amountInt: number;
  status: 'PENDING' | 'CONFIRMED' | 'DISPUTED' | 'CANCELLED';
}

export interface MemberBalance {
  memberId: string;
  displayName: string;
  isExternal: boolean;
  memberStatus: string;
  totalAdvancedInt: number;
  totalShareInt: number;
  settlementsPaidInt: number;
  settlementsReceivedInt: number;
  /** Net balance: > 0 means member should RECEIVE money; < 0 means member OWES money */
  netBalanceInt: number;
}

/**
 * Calculates exact per-member balances inside a single group.
 * Confirmed settlements reduce the debtor's debt (increase their net balance)
 * and reduce the creditor's receivable (decrease their net balance).
 */
export function computeGroupBalances(
  members: BalanceMemberInput[],
  expenses: BalanceExpenseInput[],
  settlements: BalanceSettlementInput[]
): MemberBalance[] {
  const map = new Map<string, MemberBalance>();

  for (const m of members) {
    map.set(m.id, {
      memberId: m.id,
      displayName: m.displayName,
      isExternal: m.isExternal,
      memberStatus: m.status,
      totalAdvancedInt: 0,
      totalShareInt: 0,
      settlementsPaidInt: 0,
      settlementsReceivedInt: 0,
      netBalanceInt: 0,
    });
  }

  for (const exp of expenses) {
    if (exp.status !== 'ACTIVE') continue;
    for (const payer of exp.payers) {
      const entry = map.get(payer.memberId);
      if (entry) {
        entry.totalAdvancedInt += payer.amountPaidInt;
      }
    }
    for (const share of exp.shares) {
      const entry = map.get(share.memberId);
      if (entry) {
        entry.totalShareInt += share.shareAmountInt;
      }
    }
  }

  for (const st of settlements) {
    if (st.status !== 'CONFIRMED') continue;
    const from = map.get(st.fromMemberId);
    const to = map.get(st.toMemberId);
    if (from) from.settlementsPaidInt += st.amountInt;
    if (to) to.settlementsReceivedInt += st.amountInt;
  }

  for (const entry of map.values()) {
    entry.netBalanceInt =
      entry.totalAdvancedInt -
      entry.totalShareInt +
      entry.settlementsPaidInt -
      entry.settlementsReceivedInt;
  }

  return Array.from(map.values());
}

export interface SuggestedSettlement {
  fromMemberId: string;
  fromName: string;
  toMemberId: string;
  toName: string;
  amountInt: number;
}

/**
 * Greedy minimal-transfer settlement optimizer (§6.6).
 * Does not mutate original operations; generates explainable proposals.
 */
export function optimizeSettlements(balances: MemberBalance[]): SuggestedSettlement[] {
  const debtors = balances
    .filter((b) => b.netBalanceInt < 0)
    .map((b) => ({ id: b.memberId, name: b.displayName, owe: -b.netBalanceInt }))
    .sort((a, b) => b.owe - a.owe);

  const creditors = balances
    .filter((b) => b.netBalanceInt > 0)
    .map((b) => ({ id: b.memberId, name: b.displayName, receive: b.netBalanceInt }))
    .sort((a, b) => b.receive - a.receive);

  const suggestions: SuggestedSettlement[] = [];
  let i = 0;
  let j = 0;

  while (i < debtors.length && j < creditors.length) {
    const debtor = debtors[i];
    const creditor = creditors[j];
    const amount = Math.min(debtor.owe, creditor.receive);

    if (amount > 0) {
      suggestions.push({
        fromMemberId: debtor.id,
        fromName: debtor.name,
        toMemberId: creditor.id,
        toName: creditor.name,
        amountInt: amount,
      });
    }

    debtor.owe -= amount;
    creditor.receive -= amount;

    if (debtor.owe === 0) i++;
    if (creditor.receive === 0) j++;
  }

  return suggestions;
}

export function evaluateBudgetAlert(spentInt: number, limitInt: number): {
  percent: number;
  level: 'OK' | '50' | '75' | '90' | 'EXCEEDED';
} {
  if (limitInt <= 0) return { percent: 0, level: 'OK' };
  const percent = Math.round((spentInt * 100) / limitInt);
  if (spentInt > limitInt) return { percent, level: 'EXCEEDED' };
  if (percent >= 90) return { percent, level: '90' };
  if (percent >= 75) return { percent, level: '75' };
  if (percent >= 50) return { percent, level: '50' };
  return { percent, level: 'OK' };
}
