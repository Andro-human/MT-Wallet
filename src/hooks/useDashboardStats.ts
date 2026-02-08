import { useMemo } from 'react';
import { startOfMonth, endOfMonth, subMonths } from 'date-fns';
import { useTransactions } from './useTransactions';
import { useCategories } from './useCategories';

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

  const stats = useMemo(() => {
    // Calculate this month's spending (only transactions marked as expense)
    const thisMonthSpent = thisMonthTxns
      .filter(t => t.is_expense)
      .reduce((sum, t) => sum + Number(t.amount), 0);

    // Calculate last month's spending
    const lastMonthSpent = lastMonthTxns
      .filter(t => t.is_expense)
      .reduce((sum, t) => sum + Number(t.amount), 0);

    // Calculate month-over-month change
    const monthChange = lastMonthSpent > 0
      ? ((thisMonthSpent - lastMonthSpent) / lastMonthSpent) * 100
      : 0;

    // Calculate income this month (only transactions marked as income)
    const thisMonthIncome = thisMonthTxns
      .filter(t => t.is_income)
      .reduce((sum, t) => sum + Number(t.amount), 0);

    // Spending by category
    const categorySpending = thisMonthTxns
      .filter(t => t.is_expense)
      .reduce((acc, t) => {
        const catId = t.category_id || 'uncategorized';
        acc[catId] = (acc[catId] || 0) + Number(t.amount);
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

    // Recent transactions (last 5)
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
  }, [thisMonthTxns, lastMonthTxns, categories]);

  return {
    ...stats,
    isLoading: thisMonthLoading || lastMonthLoading,
  };
}
