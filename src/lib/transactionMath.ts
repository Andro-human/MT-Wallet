import type { Transaction, TransactionWithCategory } from '@/types/database';
import { cappedColor } from './categoryColors';

type AnyTxn = Pick<
  Transaction,
  'id' | 'amount' | 'is_expense' | 'is_income' | 'category_id'
>;

export type RefundTotalsMap = Record<string, number>;
export type RefundAllocationsMap = Record<string, number>;
export type DuplicateExcludeSet = Set<string>;

// Clamped at 0: over-allocated refunds never render as negative.
export function netAmount(txn: AnyTxn, refundTotals: RefundTotalsMap): number {
  const refund = refundTotals[txn.id] ?? 0;
  return Math.max(Number(txn.amount) - refund, 0);
}

export function isCountable(
  txn: AnyTxn,
  duplicateExcludeIds: DuplicateExcludeSet,
): boolean {
  return !duplicateExcludeIds.has(txn.id);
}

export type TransactionBucket = 'duplicate' | 'non-counted' | 'refunded' | 'real';

// Precedence matters: a confirmed duplicate also has is_expense=false, so 'duplicate'
// must be checked before 'non-counted' or the duplicate filter appears broken.
export function classifyTransaction(
  txn: AnyTxn & { direction?: string | null },
  opts: {
    duplicateExcludeIds: DuplicateExcludeSet;
    refundTotals: RefundTotalsMap;
    refundAllocations: RefundAllocationsMap;
  },
): TransactionBucket {
  if (opts.duplicateExcludeIds.has(txn.id)) return 'duplicate';
  const isDebit = txn.direction !== 'credit';
  const counted = isDebit ? txn.is_expense : txn.is_income;
  if (!counted) return 'non-counted';
  const net = isDebit
    ? netAmount(txn, opts.refundTotals)
    : creditNet(txn, opts.refundAllocations);
  if (net <= 0) return 'refunded';
  return 'real';
}

export function sumSpent(
  txns: AnyTxn[],
  refundTotals: RefundTotalsMap,
  duplicateExcludeIds: DuplicateExcludeSet,
): number {
  let total = 0;
  for (const t of txns) {
    if (!t.is_expense) continue;
    if (!isCountable(t, duplicateExcludeIds)) continue;
    total += netAmount(t, refundTotals);
  }
  return total;
}

// Returns 0 for non-income rows; subtracts the credit's allocated portion.
export function creditNet(
  txn: AnyTxn & { direction?: string | null },
  allocations: RefundAllocationsMap,
): number {
  if (!txn.is_income) return 0;
  const allocated = allocations[txn.id] ?? 0;
  return Math.max(Number(txn.amount) - allocated, 0);
}

export function sumIncome(
  txns: AnyTxn[],
  duplicateExcludeIds: DuplicateExcludeSet,
  allocations: RefundAllocationsMap = {},
): number {
  let total = 0;
  for (const t of txns) {
    if (!t.is_income) continue;
    if (!isCountable(t, duplicateExcludeIds)) continue;
    total += creditNet(t as any, allocations);
  }
  return total;
}

export function spentByCategory(
  txns: AnyTxn[],
  refundTotals: RefundTotalsMap,
  duplicateExcludeIds: DuplicateExcludeSet,
): Record<string, number> {
  const acc: Record<string, number> = {};
  for (const t of txns) {
    if (!t.is_expense) continue;
    if (!isCountable(t, duplicateExcludeIds)) continue;
    const key = t.category_id || 'uncategorized';
    acc[key] = (acc[key] || 0) + netAmount(t, refundTotals);
  }
  return acc;
}

export interface CategoryChartSlice {
  name: string;
  value: number;
  color: string;
  icon: string;
}

export function categoryChartData(
  txns: AnyTxn[],
  refundTotals: RefundTotalsMap,
  duplicateExcludeIds: DuplicateExcludeSet,
  categories: Array<{ id: string; name: string; color: string; icon: string }>,
  topN: number = 6,
): CategoryChartSlice[] {
  const byCat = spentByCategory(txns, refundTotals, duplicateExcludeIds);
  const catMap = new Map(categories.map((c) => [c.id, c]));

  return Object.entries(byCat)
    .map(([catId, value]) => {
      const cat = catMap.get(catId);
      return {
        name: cat?.name ?? 'Uncategorized',
        value,
        color: cat?.color ?? '#9CA3AF',
        icon: cat?.icon ?? '📦',
      };
    })
    .sort((a, b) => b.value - a.value)
    .slice(0, topN)
    .map((slice, i) => ({ ...slice, color: cappedColor(i, slice.color) }));
}

export function filterOutDuplicates<T extends { id: string }>(
  txns: T[],
  duplicateExcludeIds: DuplicateExcludeSet,
): T[] {
  if (duplicateExcludeIds.size === 0) return txns;
  return txns.filter((t) => !duplicateExcludeIds.has(t.id));
}

// Guards against Infinity% when prior period was zero.
export function percentChange(current: number, previous: number): number {
  if (previous <= 0) return 0;
  return ((current - previous) / previous) * 100;
}

export function refundFor(txnId: string, refundTotals: RefundTotalsMap): number {
  return refundTotals[txnId] ?? 0;
}

export type { AnyTxn };
export type CountableTxn = TransactionWithCategory;
