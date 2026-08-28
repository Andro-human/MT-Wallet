import { useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import type { BudgetDef } from '@/lib/budgetMath';

const KEY = 'budgets';

// The budgets tables are absent from the generated Supabase types, as
// subscriptions is. One named cast beats the same cast repeated at ten call
// sites; regenerating the types is the real fix.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

interface BudgetRow {
  id: string;
  name: string;
  amount: string | number;
  weekly_amount: string | number | null;
  weekly_count: number | null;
  carryover: boolean;
  is_remainder: boolean;
  active_from: string;
  archived_at: string | null;
}

/** Active budgets with their category and group bindings, shaped for
 *  budgetMath. The three tables are fetched together because a budget without
 *  its bindings would silently attribute nothing. */
export function useBudgets() {
  const { user } = useAuth();

  return useQuery({
    queryKey: [KEY, user?.id],
    queryFn: async (): Promise<BudgetDef[]> => {
      if (!user) return [];
      const [budgets, cats, groups] = await Promise.all([
        db
          .from('budgets')
          .select('id, name, amount, weekly_amount, weekly_count, carryover, is_remainder, active_from, archived_at')
          .eq('user_id', user.id)
          .is('archived_at', null)
          .order('amount', { ascending: false }),
        db.from('budget_categories').select('budget_id, category_id').eq('user_id', user.id),
        db.from('budget_groups').select('budget_id, group_id').eq('user_id', user.id),
      ]);

      if (budgets.error) throw budgets.error;
      if (cats.error) throw cats.error;
      if (groups.error) throw groups.error;

      const byBudgetCats = new Map<string, string[]>();
      for (const r of (cats.data ?? []) as { budget_id: string; category_id: string }[]) {
        byBudgetCats.set(r.budget_id, [...(byBudgetCats.get(r.budget_id) ?? []), r.category_id]);
      }
      const byBudgetGroups = new Map<string, string[]>();
      for (const r of (groups.data ?? []) as { budget_id: string; group_id: string }[]) {
        byBudgetGroups.set(r.budget_id, [...(byBudgetGroups.get(r.budget_id) ?? []), r.group_id]);
      }

      return ((budgets.data ?? []) as BudgetRow[]).map((b) => ({
        id: b.id,
        name: b.name,
        amount: Number(b.amount),
        weeklyAmount: b.weekly_amount == null ? null : Number(b.weekly_amount),
        weeklyCount: b.weekly_count ?? null,
        carryover: b.carryover,
        isRemainder: b.is_remainder,
        activeFrom: b.active_from,
        categoryIds: byBudgetCats.get(b.id) ?? [],
        groupIds: byBudgetGroups.get(b.id) ?? [],
      }));
    },
    enabled: !!user,
    staleTime: 60_000,
  });
}

/** Categories and groups already claimed by another budget. The DB enforces
 *  one budget per category and per group; surfacing it in the picker means the
 *  user finds out before the write fails. */
export function useClaimedTargets(excludeBudgetId?: string) {
  const { data: budgets = [] } = useBudgets();
  return useMemo(() => {
    const categories = new Set<string>();
    const groups = new Set<string>();
    for (const b of budgets) {
      if (b.id === excludeBudgetId) continue;
      b.categoryIds.forEach((c) => categories.add(c));
      b.groupIds.forEach((g) => groups.add(g));
    }
    return { categories, groups };
  }, [budgets, excludeBudgetId]);
}

export interface BudgetInput {
  name: string;
  amount: number;
  weeklyAmount: number | null;
  weeklyCount: number | null;
  carryover: boolean;
  isRemainder: boolean;
  categoryIds: string[];
  groupIds: string[];
}

async function writeBindings(
  budgetId: string,
  userId: string,
  categoryIds: string[],
  groupIds: string[],
) {
  // Replace rather than diff: the sets are tiny and a partial diff that fails
  // halfway would leave a category attributed to nothing.
  await db.from('budget_categories').delete().eq('budget_id', budgetId);
  await db.from('budget_groups').delete().eq('budget_id', budgetId);

  if (categoryIds.length > 0) {
    const { error } = await db.from('budget_categories').insert(
      categoryIds.map((category_id) => ({ budget_id: budgetId, category_id, user_id: userId })),
    );
    if (error) throw error;
  }
  if (groupIds.length > 0) {
    const { error } = await db.from('budget_groups').insert(
      groupIds.map((group_id) => ({ budget_id: budgetId, group_id, user_id: userId })),
    );
    if (error) throw error;
  }
}

export function useCreateBudget() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: BudgetInput) => {
      const { data, error } = await db
        .from('budgets')
        .insert({
          user_id: user!.id,
          name: input.name.trim(),
          amount: input.amount,
          weekly_amount: input.weeklyAmount,
          weekly_count: input.weeklyCount,
          carryover: input.carryover,
          is_remainder: input.isRemainder,
        })
        .select('id')
        .single();
      if (error) throw error;
      await writeBindings(data.id, user!.id, input.categoryIds, input.groupIds);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  });
}

export function useUpdateBudget() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: BudgetInput & { id: string }) => {
      const { error } = await db
        .from('budgets')
        .update({
          name: input.name.trim(),
          amount: input.amount,
          weekly_amount: input.weeklyAmount,
          weekly_count: input.weeklyCount,
          carryover: input.carryover,
          is_remainder: input.isRemainder,
          updated_at: new Date().toISOString(),
        })
        .eq('id', input.id)
        .eq('user_id', user!.id);
      if (error) throw error;
      await writeBindings(input.id, user!.id, input.categoryIds, input.groupIds);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  });
}

export function useDeleteBudget() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      // Archive rather than delete: active_from means past months are computed
      // from the amount that was in force then, and a hard delete would rewrite
      // that history.
      const { error } = await db
        .from('budgets')
        .update({ archived_at: new Date().toISOString() })
        .eq('id', id)
        .eq('user_id', user!.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  });
}
