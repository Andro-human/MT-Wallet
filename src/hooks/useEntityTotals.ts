import { useMemo } from 'react';
import { useTransactions } from './useTransactions';
import { useFinanceContext } from './useFinanceData';
import { classifyTransaction, netAmount } from '@/lib/transactionMath';

export interface EntityTotal {
  /** Transactions that count, per classifyTransaction. Not the raw row count. */
  counted: number;
  /** Net debit spend after refunds. Credits are excluded, so an income-bearing
   *  category reports its outgoings only. */
  spent: number;
}

export interface EntityTotals {
  byCategory: Record<string, EntityTotal>;
  byGroup: Record<string, EntityTotal>;
  maxCategorySpent: number;
  maxGroupSpent: number;
  isLoading: boolean;
}

const EMPTY: EntityTotal = { counted: 0, spent: 0 };

function bump(acc: Record<string, EntityTotal>, key: string, spent: number) {
  const cur = acc[key] ?? { ...EMPTY };
  cur.counted += 1;
  cur.spent += spent;
  acc[key] = cur;
}

/** Lifetime counted totals per category and per group.
 *
 *  Replaces useCategoryTransactionCounts and useTransactionCountsByGroup, both
 *  of which issued an unbounded .select() and so silently counted only the first
 *  1000 of 1747 rows (Food & Dining read 213 against a true 372). Neither
 *  applied the counting rule either, so duplicates, is_expense=false rows and
 *  fully-refunded transactions were all included.
 */
export function useEntityTotals(): EntityTotals {
  const { data: txns = [], isLoading: txnsLoading } = useTransactions();
  const { refundTotals, refundAllocations, duplicateExcludeIds, isReady } = useFinanceContext();

  return useMemo(() => {
    const byCategory: Record<string, EntityTotal> = {};
    const byGroup: Record<string, EntityTotal> = {};
    const isLoading = txnsLoading || !isReady;

    if (isLoading) {
      return { byCategory, byGroup, maxCategorySpent: 0, maxGroupSpent: 0, isLoading };
    }

    for (const t of txns) {
      const bucket = classifyTransaction(t as never, {
        duplicateExcludeIds,
        refundTotals,
        refundAllocations,
      });
      if (bucket !== 'real') continue;

      const isDebit = (t as { direction?: string | null }).direction !== 'credit';
      const spent = isDebit ? netAmount(t as never, refundTotals) : 0;

      if (t.category_id) bump(byCategory, t.category_id, spent);
      if (t.group_id) bump(byGroup, t.group_id, spent);
    }

    const max = (r: Record<string, EntityTotal>) =>
      Object.values(r).reduce((m, e) => Math.max(m, e.spent), 0);

    return {
      byCategory,
      byGroup,
      maxCategorySpent: max(byCategory),
      maxGroupSpent: max(byGroup),
      isLoading,
    };
  }, [txns, txnsLoading, isReady, refundTotals, refundAllocations, duplicateExcludeIds]);
}
