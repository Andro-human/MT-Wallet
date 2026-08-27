import { useMemo } from 'react';
import { format } from 'date-fns';
import { useBudgets } from './useBudgets';
import { useProfile } from './useProfile';
import { monthlyCeiling } from '@/lib/budgetMath';

export interface MonthlyCeiling {
  ceiling: number;
  /** True while no budget exists and profiles.monthly_budget is standing in. */
  usingFallback: boolean;
  isLoading: boolean;
}

/** The month's spending ceiling: the sum of the active budgets' base amounts.
 *
 *  Falls back to profiles.monthly_budget while no budget exists, so a fresh
 *  install shows its single budget rather than zero. Deliberately lighter than
 *  useBudgetStandings: the ceiling needs no transactions, only the budgets, and
 *  the Home ring should not wait on a full transaction load to render.
 */
export function useMonthlyCeiling(month?: string): MonthlyCeiling {
  const { data: budgets = [], isLoading } = useBudgets();
  const { data: profile } = useProfile();
  const monthKey = month ?? format(new Date(), 'yyyy-MM');

  return useMemo(() => {
    const usingFallback = budgets.length === 0;
    return {
      ceiling: usingFallback ? (profile?.monthly_budget ?? 0) : monthlyCeiling(budgets, monthKey),
      usingFallback,
      isLoading,
    };
  }, [budgets, profile, monthKey, isLoading]);
}
