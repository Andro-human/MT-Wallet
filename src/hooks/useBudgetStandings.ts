import { useMemo } from 'react';
import { format, startOfMonth, endOfMonth, startOfWeek, addWeeks, isBefore } from 'date-fns';
import { useTransactions } from './useTransactions';
import { useFinanceContext } from './useFinanceData';
import { useBudgets } from './useBudgets';
import { useProfile } from './useProfile';
import { useCombineMaps } from './useCombinedTransactions';
import { classifyTransaction, netAmount } from '@/lib/transactionMath';
import {
  buildBudgetIndex,
  attributeTo,
  standingForMonth,
  monthlyCeiling,
  weeklyPace,
  countOrders,
  type BudgetDef,
  type MonthStanding,
} from '@/lib/budgetMath';

export interface BudgetStanding extends MonthStanding {
  budget: BudgetDef;
  /** Spent inside the current calendar week, for budgets with a weekly target. */
  spentThisWeek: number;
  /** Fraction of the weekly target used, or null when no target is set. */
  pace: number | null;
  /** Orders this week, using the Activity page's combine feature: transactions
   *  combined by the user count once. Null when the budget sets no order cap. */
  ordersThisWeek: number | null;
  /** Every week overlapping the month being viewed, oldest first. Present for
   *  all budgets so a weekly rhythm can be read even without a weekly target. */
  weeks: WeekStanding[];
}

export interface WeekStanding {
  /** Monday, yyyy-MM-dd. */
  start: string;
  spent: number;
  /** Combines folded, so this is purchases rather than rows. */
  orders: number;
  /** True for the week containing today. */
  isCurrent: boolean;
  /** What made up the week, newest first. Combined rows share combineId, so the
   *  list can show one purchase billed twice as one line. */
  txns: WeekTxn[];
}

export interface WeekTxn {
  id: string;
  merchant: string | null;
  note: string | null;
  amount: number;
  day: string;
  combineId: string | null;
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
  const { data: combineMaps } = useCombineMaps();
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
    const wkOf = (day: string) =>
      format(startOfWeek(new Date(`${day}T12:00:00`), { weekStartsOn: 1 }), 'yyyy-MM-dd');
    const currentWeek = wkOf(format(new Date(), 'yyyy-MM-dd'));

    // budgetId -> month -> spend, and budgetId -> weekStart -> {spend, txns}.
    const byBudgetMonth = new Map<string, Map<string, number>>();
    const byBudgetWeek = new Map<string, Map<string, { spent: number; txns: WeekTxn[] }>>();

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

      const wk = wkOf(day);
      let weeks = byBudgetWeek.get(id);
      if (!weeks) {
        weeks = new Map();
        byBudgetWeek.set(id, weeks);
      }
      const slot = weeks.get(wk) ?? { spent: 0, txns: [] };
      const full = t as { id: string; merchant?: string | null; notes?: string | null };
      slot.spent += amount;
      slot.txns.push({
        id: full.id,
        merchant: full.merchant ?? null,
        note: full.notes ?? null,
        amount,
        day,
        combineId: (combineMaps?.combineByTxnId ?? {})[full.id] ?? null,
      });
      weeks.set(wk, slot);
    }

    // Every Monday that overlaps the viewed month, so a straddling week still
    // appears rather than being dropped for belonging to neither month.
    const monthStart = new Date(`${monthKey}-01T12:00:00`);
    const weekStarts: string[] = [];
    for (
      let w = startOfWeek(monthStart, { weekStartsOn: 1 });
      isBefore(w, endOfMonth(monthStart));
      w = addWeeks(w, 1)
    ) {
      weekStarts.push(format(w, 'yyyy-MM-dd'));
    }

    const combineByTxnId = combineMaps?.combineByTxnId ?? {};

    const standings = budgets.map((b) => {
      const months = byBudgetMonth.get(b.id);
      const spentIn = (m: string) => months?.get(m) ?? 0;
      const standing = standingForMonth(b, monthKey, spentIn);

      const weekMap = byBudgetWeek.get(b.id);
      const weeks = weekStarts.map((start) => {
        const slot = weekMap?.get(start);
        const txns = [...(slot?.txns ?? [])].sort((a, b) => (a.day < b.day ? 1 : -1));
        return {
          start,
          spent: slot?.spent ?? 0,
          orders: countOrders(txns, combineByTxnId),
          isCurrent: start === currentWeek,
          txns,
        };
      });

      const thisWeek = weekMap?.get(currentWeek);
      const spentThisWeek = thisWeek?.spent ?? 0;
      return {
        budget: b,
        ...standing,
        spentThisWeek,
        pace: weeklyPace(b, spentThisWeek),
        ordersThisWeek: b.weeklyCount
          ? countOrders(thisWeek?.txns ?? [], combineByTxnId)
          : null,
        weeks,
      };
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
    combineMaps,
  ]);
}
