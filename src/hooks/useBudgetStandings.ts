import { useMemo } from 'react';
import { format, startOfMonth, startOfWeek } from 'date-fns';
import { useTransactions } from './useTransactions';
import { useFinanceContext } from './useFinanceData';
import { useBudgets } from './useBudgets';
import { useProfile } from './useProfile';
import { classifyTransaction, netAmount } from '@/lib/transactionMath';
import {
  buildBudgetIndex,
  attributeTo,
  standingForMonth,
  monthlyCeiling,
  weeklyPace,
  type BudgetDef,
  type MonthStanding,
} from '@/lib/budgetMath';

export interface BudgetStanding extends MonthStanding {
  budget: BudgetDef;
  /** Spent inside the current calendar week, for budgets with a weekly target. */
  spentThisWeek: number;
  /** Fraction of the weekly target used, or null when no target is set. */
  pace: number | null;
}

export interface BudgetStandings {
  standings: BudgetStanding[];
  /** Sum of active base amounts, or profiles.monthly_budget while no budget
   *  exists so nothing renders as zero on a fresh install. */
  ceiling: number;
  ceilingIsFallback: boolean;
  isLoading: boolean;
}

/** Budget standings for a month, computed from transactions that COUNT.
 *
 *  Carry needs history, so this loads every transaction rather than the month
 *  in view: standingForMonth walks from each budget's active_from. The query is
 *  the same unfiltered useTransactions that useEntityTotals uses, so it is
 *  shared cache, not a second fetch.
 */
export function useBudgetStandings(month?: string): BudgetStandings {
  const monthKey = month ?? format(startOfMonth(new Date()), 'yyyy-MM');
  const { data: budgets = [], isLoading: budgetsLoading } = useBudgets();
  const { data: txns = [], isLoading: txnsLoading } = useTransactions();
  const { data: profile } = useProfile();
  const { refundTotals, refundAllocations, duplicateExcludeIds, isReady } = useFinanceContext();

  return useMemo(() => {
    const isLoading = budgetsLoading || txnsLoading || !isReady;
    const fallback = profile?.monthly_budget ?? 0;

    if (isLoading || budgets.length === 0) {
      return {
        standings: [],
        ceiling: budgets.length === 0 ? fallback : 0,
        ceilingIsFallback: budgets.length === 0,
        isLoading,
      };
    }

    const index = buildBudgetIndex(budgets);
    const weekStart = format(startOfWeek(new Date(), { weekStartsOn: 1 }), 'yyyy-MM-dd');

    // budgetId -> month -> spend, plus a separate this-week tally.
    const byBudgetMonth = new Map<string, Map<string, number>>();
    const weekSpend = new Map<string, number>();

    for (const t of txns) {
      if (
        classifyTransaction(t as never, { duplicateExcludeIds, refundTotals, refundAllocations }) !==
        'real'
      ) {
        continue;
      }
      const row = t as { direction?: string | null; transacted_at: string };
      // Budgets cap outgoings. A credit is not a negative expense here.
      if (row.direction === 'credit') continue;

      const id = attributeTo(t as never, index);
      if (!id) continue;

      const day = format(new Date(row.transacted_at), 'yyyy-MM-dd');
      const m = day.slice(0, 7);
      const amount = netAmount(t as never, refundTotals);

      let months = byBudgetMonth.get(id);
      if (!months) {
        months = new Map();
        byBudgetMonth.set(id, months);
      }
      months.set(m, (months.get(m) ?? 0) + amount);

      if (day >= weekStart) weekSpend.set(id, (weekSpend.get(id) ?? 0) + amount);
    }

    const standings = budgets.map((b) => {
      const months = byBudgetMonth.get(b.id);
      const spentIn = (m: string) => months?.get(m) ?? 0;
      const standing = standingForMonth(b, monthKey, spentIn);
      const spentThisWeek = weekSpend.get(b.id) ?? 0;
      return { budget: b, ...standing, spentThisWeek, pace: weeklyPace(b, spentThisWeek) };
    });

    return {
      standings,
      ceiling: monthlyCeiling(budgets, monthKey),
      ceilingIsFallback: false,
      isLoading,
    };
  }, [
    budgets,
    budgetsLoading,
    txns,
    txnsLoading,
    isReady,
    profile,
    monthKey,
    refundTotals,
    refundAllocations,
    duplicateExcludeIds,
  ]);
}
