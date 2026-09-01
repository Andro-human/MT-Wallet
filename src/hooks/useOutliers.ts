import { useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { monthOutliers, EVERY_MONTH, type SliceRow } from '@/lib/outliers';

const KEY = 'outliers';

/** Every month's slices and total in one read. Nineteen rows today, so there is
 *  no reason to page or to add an endpoint: the maths is arithmetic over data
 *  the review pipeline already stored. */
function useSliceHistory() {
  const { user } = useAuth();
  return useQuery({
    queryKey: [KEY, 'slices', user?.id],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('monthly_summaries')
        .select('month, spend_slices, aggregates')
        .eq('user_id', user!.id)
        .order('month', { ascending: false });
      if (error) throw error;
      const rows: SliceRow[] = [];
      const totals = new Map<string, number>();
      for (const r of data ?? []) {
        for (const s of r.spend_slices ?? []) {
          rows.push({
            month: r.month,
            label: s.label,
            amount: Number(s.amount),
            one_liner: s.one_liner ?? null,
          });
        }
        // aggregates.total_spent is rounded; the slices sum to the exact figure,
        // and they must, because the server refused the review otherwise.
        totals.set(r.month, (r.spend_slices ?? []).reduce((sum: number, s: any) => sum + Number(s.amount), 0));
      }
      return { rows, totals };
    },
    enabled: !!user,
  });
}

/** The monthly ceiling, plus the month it started applying. The ceiling is drawn
 *  on every month so history can be read against one fixed line; `from` is only
 *  used to tell the reader which months predate it. */
function useBudgetCeiling() {
  const { user } = useAuth();
  return useQuery({
    queryKey: [KEY, 'budget', user?.id],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('budgets')
        .select('amount, active_from, archived_at')
        .eq('user_id', user!.id)
        .is('archived_at', null);
      if (error) throw error;
      const live = data ?? [];
      if (live.length === 0) return { monthly: null as number | null, from: null as string | null };
      const monthly = live.reduce((s: number, b: any) => s + Number(b.amount ?? 0), 0);
      const from = live
        .map((b: any) => String(b.active_from ?? '').slice(0, 7))
        .filter(Boolean)
        .sort()[0] ?? null;
      return { monthly, from };
    },
    enabled: !!user,
  });
}

export function useDismissedOutliers() {
  const { user } = useAuth();
  return useQuery({
    queryKey: [KEY, 'dismissed', user?.id],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('outlier_dismissals')
        .select('month, label')
        .eq('user_id', user!.id);
      if (error) throw error;
      return new Set<string>((data ?? []).map((r: any) => `${r.month}|${r.label}`));
    },
    enabled: !!user,
  });
}

export function useDismissLabelEverywhere() {
  const dismiss = useDismissOutlier();
  return {
    ...dismiss,
    mutate: ({ label }: { label: string }) => dismiss.mutate({ month: EVERY_MONTH, label }),
  };
}

export function useDismissOutlier() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ month, label }: { month: string; label: string }) => {
      const { error } = await (supabase as any)
        .from('outlier_dismissals')
        .upsert({ user_id: user!.id, month, label }, { onConflict: 'user_id,month,label' });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY, 'dismissed'] }),
  });
}

export function useRestoreOutlier() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ month, label }: { month: string; label: string }) => {
      const { error } = await (supabase as any)
        .from('outlier_dismissals')
        .delete()
        .eq('user_id', user!.id)
        .eq('month', month)
        .eq('label', label);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY, 'dismissed'] }),
  });
}

/** `only` narrows what is shown, never what is measured: rarity is "3 of 19
 *  months", and recomputing it over a 6-month view would relabel a staple as a
 *  one-off. Classification always sees the whole history. */
export function useOutliers(only?: string[]) {
  const history = useSliceHistory();
  const budget = useBudgetCeiling();
  const dismissed = useDismissedOutliers();

  const all = useMemo(() => {
    if (!history.data) return [];
    return monthOutliers(
      history.data.rows,
      history.data.totals,
      dismissed.data ?? new Set(),
      budget.data?.monthly ?? null,
    );
  }, [history.data, dismissed.data, budget.data]);

  const months = useMemo(() => {
    if (!only) return all;
    const want = new Set(only);
    return all.filter((m) => want.has(m.month));
  }, [all, only]);

  return {
    months,
    monthsMeasured: all.length,
    dismissedCount: dismissed.data?.size ?? 0,
    budget: budget.data?.monthly ?? null,
    budgetFrom: budget.data?.from ?? null,
    isLoading: history.isLoading || budget.isLoading || dismissed.isLoading,
  };
}
