import { useMemo } from 'react';
import { startOfMonth, endOfMonth, subMonths } from 'date-fns';
import { useTransactions } from './useTransactions';
import { useCategories } from './useCategories';
import { useRefundTotals } from './useRefundLinks';
import { useDuplicateExcludeIds } from './useDuplicateLinks';

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

  const { data: lastMonthTxns = [], isLoading: lastMonthLoading } = useTransactions({
    startDate: lastMonthStart,
    endDate: lastMonthEnd,
  });

  const { data: categories = [] } = useCategories();
  const { data: refundTotals = {}, isLoading: refundTotalsLoading } = useRefundTotals();
  const { data: duplicateExcludeIds = new Set<string>() } = useDuplicateExcludeIds();

  const stats = useMemo(() => {
    // Helper: get refund-adjusted amount
    const netAmount = (t: { id: string; amount: number | string }) => {
      const refund = refundTotals[t.id] || 0;
      return Math.max(Number(t.amount) - refund, 0);
    };

    // Drop the "duplicate" side of any confirmed duplicate pair so they
    // don't double-count in spend/income totals.
    const thisMonthDeduped = duplicateExcludeIds.size > 0
      ? thisMonthTxns.filter(t => !duplicateExcludeIds.has(t.id))
      : thisMonthTxns;
    const lastMonthDeduped = duplicateExcludeIds.size > 0
      ? lastMonthTxns.filter(t => !duplicateExcludeIds.has(t.id))
      : lastMonthTxns;

    // Calculate this month's spending (only transactions marked as expense)
    const thisMonthSpent = thisMonthDeduped
      .filter(t => t.is_expense)
      .reduce((sum, t) => sum + netAmount(t), 0);

    // Calculate last month's spending
    const lastMonthSpent = lastMonthDeduped
      .filter(t => t.is_expense)
      .reduce((sum, t) => sum + netAmount(t), 0);

    // Calculate month-over-month change
    const monthChange = lastMonthSpent > 0
      ? ((thisMonthSpent - lastMonthSpent) / lastMonthSpent) * 100
      : 0;

    // Calculate income this month (only transactions marked as income)
    const thisMonthIncome = thisMonthDeduped
      .filter(t => t.is_income)
      .reduce((sum, t) => sum + Number(t.amount), 0);

    // Spending by category
    const categorySpending = thisMonthDeduped
      .filter(t => t.is_expense)
      .reduce((acc, t) => {
        const catId = t.category_id || 'uncategorized';
        acc[catId] = (acc[catId] || 0) + netAmount(t);
        return acc;
      }, {} as Record<string, number>);

    // Build chart data
    const chartData = Object.entries(categorySpending)
      .map(([catId, value]) => {
        const category = categories.find(c => c.id === catId);
        return {
          name: category?.name || 'Uncategorized',
          value,
          color: category?.color || '#9CA3AF',
          icon: category?.icon || '📦',
        };
      })
      .sort((a, b) => b.value - a.value)
      .slice(0, 6); // Top 6 categories

    // Recent transactions (last 5) — keep duplicates here; the activity feed
    // is a "what happened" log, not a spend tally.
    const recentTxns = thisMonthTxns.slice(0, 5);

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
  }, [thisMonthTxns, lastMonthTxns, categories, refundTotals, duplicateExcludeIds]);

  return {
    ...stats,
    isLoading: thisMonthLoading || lastMonthLoading || refundTotalsLoading,
  };
}
