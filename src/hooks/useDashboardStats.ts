import { useMemo } from 'react';
import { startOfMonth, endOfMonth, subMonths } from 'date-fns';
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

export function useDashboardStats() {
  const now = new Date();
  const thisMonthStart = startOfMonth(now);
  const thisMonthEnd = endOfMonth(now);
  const lastMonthStart = startOfMonth(subMonths(now, 1));
  const lastMonthEnd = endOfMonth(subMonths(now, 1));

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

    return {
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
