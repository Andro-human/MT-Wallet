import { useMemo } from 'react';
import { endOfMonth, startOfMonth } from 'date-fns';
import { useTransactions } from './useTransactions';
import { useCategories } from './useCategories';
import { useFinanceContext } from './useFinanceData';
import { useDaySummaries } from './useDaySummaries';
import { buildDayLedger, type DayLedgerRow } from '@/lib/dayLedger';
import { assignColors } from '@/lib/categoryColors';
import { classifyTransaction, spentByCategory } from '@/lib/transactionMath';
import type { TransactionWithCategory } from '@/types/database';

export interface MonthDayLedger {
  days: DayLedgerRow<TransactionWithCategory>[];
  summaries: Record<string, string>;
  isLoading: boolean;
}

/** The day ledger for any month, not only the one in progress.
 *
 *  Home builds the same thing for the current month inside useDashboardStats.
 *  This exists because the ledger of a finished month is worth reading and there
 *  was no way to see one: the data was there, nothing asked for it.
 */
export function useMonthDayLedger(month: string | null): MonthDayLedger {
  const start = month ? startOfMonth(new Date(`${month}-01T12:00:00`)) : null;
  const end = start ? endOfMonth(start) : null;

  const { data: txns = [], isLoading } = useTransactions(
    start && end ? { startDate: start, endDate: end } : {},
  );
  const { data: categories = [] } = useCategories();
  const { duplicateExcludeIds, refundTotals, refundAllocations } = useFinanceContext();
  // Already keyed by 'yyyy-MM-dd', which is how the ledger groups its rows.
  const { data: summaries = {} } = useDaySummaries(start ?? new Date(), end ?? new Date());

  const days = useMemo(() => {
    if (!month || txns.length === 0) return [];

    // Same gate as everywhere else, so a day here agrees with the same day on
    // Home rather than quietly counting a duplicate or a refunded charge.
    const counted = txns.filter(
      (t) =>
        classifyTransaction(t as any, {
          duplicateExcludeIds,
          refundTotals,
          refundAllocations,
        }) === 'real',
    ) as TransactionWithCategory[];

    const spending = spentByCategory(counted as any, refundTotals, duplicateExcludeIds);
    const colors = assignColors(
      Object.entries(spending)
        .sort((a, b) => b[1] - a[1])
        .map(([catId]) => catId),
    );

    return buildDayLedger(counted, {
      categoryName: (id) => categories.find((c) => c.id === id)?.name ?? 'Uncategorized',
      categoryColor: (id) => colors.get(id),
      refundTotals,
      refundAllocations,
    });
  }, [month, txns, categories, duplicateExcludeIds, refundTotals, refundAllocations]);

  return { days, summaries, isLoading: !!month && isLoading };
}
