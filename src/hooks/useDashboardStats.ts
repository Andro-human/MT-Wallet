import { useMemo } from 'react';
import { startOfMonth, endOfMonth, subMonths, format } from 'date-fns';
import { useTransactions } from './useTransactions';
import { useCategories } from './useCategories';
import { useFinanceContext } from './useFinanceData';
import { useMonthSummary } from './useMonthSummary';
import {
  sumSpent,
  sumIncome,
  categoryChartData,
  spentByCategory,
  percentChange,
  classifyTransaction,
} from '@/lib/transactionMath';
import { assignColors } from '@/lib/categoryColors';
import type { TransactionWithCategory } from '@/types/database';
import { buildDayLedger, type DayLedgerRow as DayLedgerRowOf, type DaySegment } from '@/lib/dayLedger';

export type DayLedgerRow = DayLedgerRowOf<TransactionWithCategory>;
export type { DaySegment };

/** Every figure on the dashboard, for the month being viewed.
 *
 *  Defaults to the month in progress. Passing an earlier one makes the whole
 *  dashboard describe that month instead, including "vs last month", which
 *  compares against the month before the one on screen rather than against
 *  today. */
export function useDashboardStats(viewingMonth?: Date) {
  const anchor = viewingMonth ?? new Date();
  const thisMonthStart = startOfMonth(anchor);
  const thisMonthEnd = endOfMonth(anchor);
  const lastMonthStart = startOfMonth(subMonths(anchor, 1));
  const lastMonthEnd = endOfMonth(subMonths(anchor, 1));

  const { data: thisMonthTxns = [], isLoading: thisMonthLoading } = useTransactions({
    startDate: thisMonthStart,
    endDate: thisMonthEnd,
  });

  // Last month is summary-only — no need to ship rows for a chart we don't render.
  const { data: lastMonthSummary, isLoading: lastMonthLoading } = useMonthSummary(
    lastMonthStart,
    lastMonthEnd,
  );

  const { data: categories = [] } = useCategories();
  const { refundTotals, refundAllocations, duplicateExcludeIds, isReady: contextReady } = useFinanceContext();

  const stats = useMemo(() => {
    const thisMonthSpent = sumSpent(thisMonthTxns, refundTotals, duplicateExcludeIds);
    const lastMonthSpent = lastMonthSummary?.spent ?? 0;
    const monthChange = percentChange(thisMonthSpent, lastMonthSpent);
    const thisMonthIncome = sumIncome(thisMonthTxns, duplicateExcludeIds, refundAllocations);

    const categorySpending = spentByCategory(thisMonthTxns, refundTotals, duplicateExcludeIds);
    const chartData = categoryChartData(thisMonthTxns, refundTotals, duplicateExcludeIds, categories);

    // Same noise rule as the transactions page defaults: duplicates, fully
    // refunded, and non-counted rows stay off the home feed.
    const recentTxns = thisMonthTxns
      .filter(
        (t) =>
          classifyTransaction(t as any, { duplicateExcludeIds, refundTotals, refundAllocations }) ===
          'real',
      )
      .slice(0, 5);

    // One row per day that actually has activity. Category colours are assigned
    // once over the whole month so a category reads the same on every row and
    // matches the donut above.
    const real = thisMonthTxns.filter(
      (t) =>
        classifyTransaction(t as any, { duplicateExcludeIds, refundTotals, refundAllocations }) ===
        'real',
    );

    const monthColors = assignColors(
      Object.entries(categorySpending)
        .sort((a, b) => b[1] - a[1])
        .map(([catId]) => catId),
    );

    const dayLedger = buildDayLedger(real as TransactionWithCategory[], {
      categoryName: (id) => categories.find((c) => c.id === id)?.name ?? 'Uncategorized',
      categoryColor: (id) => monthColors.get(id),
      refundTotals,
      refundAllocations,
    });

    return {
      dayLedger,
      thisMonthSpent,
      lastMonthSpent,
      monthChange,
      thisMonthIncome,
      categorySpending,
      chartData,
      recentTxns,
      transactionCount: thisMonthTxns.length,
    };
  }, [thisMonthTxns, lastMonthSummary, categories, refundTotals, refundAllocations, duplicateExcludeIds]);

  return {
    ...stats,
    isLoading: thisMonthLoading || lastMonthLoading || !contextReady,
  };
}
