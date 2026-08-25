import { useMemo } from 'react';
import { startOfMonth, endOfMonth, subMonths, format, isWeekend } from 'date-fns';
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
  netAmount as computeNetAmount,
  creditNet,
} from '@/lib/transactionMath';
import { assignColors, LONG_TAIL_COLOR } from '@/lib/categoryColors';
import type { TransactionWithCategory } from '@/types/database';

export interface DaySegment {
  categoryId: string;
  name: string;
  color: string;
  value: number;
}

export interface DayLedgerRow {
  key: string;
  date: Date;
  folio: string;
  weekend: boolean;
  spent: number;
  income: number;
  segments: DaySegment[];
  txns: TransactionWithCategory[];
}

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

    const byDay = new Map<string, TransactionWithCategory[]>();
    for (const t of real) {
      const key = format(new Date(t.transacted_at), 'yyyy-MM-dd');
      const bucket = byDay.get(key);
      if (bucket) bucket.push(t as TransactionWithCategory);
      else byDay.set(key, [t as TransactionWithCategory]);
    }

    const dayLedger: DayLedgerRow[] = [...byDay.entries()]
      .sort((a, b) => (a[0] < b[0] ? 1 : -1))
      .map(([key, txns]) => {
        const date = new Date(`${key}T12:00:00`);
        const perCat = new Map<string, number>();
        let spent = 0;
        let income = 0;

        for (const t of txns) {
          if (t.is_expense) {
            const value = computeNetAmount(t as any, refundTotals);
            if (value <= 0) continue;
            spent += value;
            const catId = t.category_id || 'uncategorized';
            perCat.set(catId, (perCat.get(catId) || 0) + value);
          } else if (t.is_income) {
            income += creditNet(t as any, refundAllocations);
          }
        }

        const segments: DaySegment[] = [...perCat.entries()]
          .sort((a, b) => b[1] - a[1])
          .map(([categoryId, value]) => ({
            categoryId,
            value,
            name: categories.find((c) => c.id === categoryId)?.name ?? 'Uncategorized',
            color: monthColors.get(categoryId) ?? LONG_TAIL_COLOR,
          }));

        return {
          key,
          date,
          folio: format(date, 'EEE d'),
          weekend: isWeekend(date),
          spent,
          income,
          segments,
          txns,
        };
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
