import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

export interface CombineMemberLite {
  transaction_id: string;
  amount: number;
  direction: 'credit' | 'debit' | null;
  merchant: string | null;
  transacted_at: string;
}

export interface CombineMaps {
  // transaction_id -> combine_id
  combineByTxnId: Record<string, string>;
  // combine_id -> member rows (lite, from the join)
  membersByCombineId: Record<string, CombineMemberLite[]>;
}

const EMPTY: CombineMaps = { combineByTxnId: {}, membersByCombineId: {} };

export function useCombineMaps() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['combine-maps', user?.id],
    queryFn: async (): Promise<CombineMaps> => {
      if (!user) return EMPTY;

      const { data, error } = await (supabase as any)
        .from('combined_transactions')
        .select(
          'combine_id, transaction_id, txn:transaction_id(amount, direction, merchant, transacted_at)'
        )
        .eq('user_id', user.id);

      if (error) throw error;

      const combineByTxnId: Record<string, string> = {};
      const membersByCombineId: Record<string, CombineMemberLite[]> = {};

      for (const row of (data ?? []) as any[]) {
        combineByTxnId[row.transaction_id] = row.combine_id;
        const member: CombineMemberLite = {
          transaction_id: row.transaction_id,
          amount: Number(row.txn?.amount ?? 0),
          direction: row.txn?.direction ?? null,
          merchant: row.txn?.merchant ?? null,
          transacted_at: row.txn?.transacted_at ?? '',
        };
        (membersByCombineId[row.combine_id] ??= []).push(member);
      }

      return { combineByTxnId, membersByCombineId };
    },
    enabled: !!user,
    staleTime: 30_000,
    initialData: !user ? EMPTY : undefined,
  });
}

// If any selected txn is already combined, all are merged into that combine_id.
// Display overlay only — no transaction fields are mutated.
export function useCreateCombine() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({ transactionIds }: { transactionIds: string[] }) => {
      if (!user) throw new Error('Not authenticated');
      const ids = Array.from(new Set(transactionIds));
      if (ids.length < 2) throw new Error('Pick at least two transactions to combine');

      const { data: existing, error: e1 } = await (supabase as any)
        .from('combined_transactions')
        .select('combine_id, transaction_id')
        .eq('user_id', user.id)
        .in('transaction_id', ids);
      if (e1) throw e1;

      const existingCombineIds = Array.from(
        new Set(((existing ?? []) as any[]).map((r) => r.combine_id))
      );
      const targetCombineId: string =
        existingCombineIds[0] ?? crypto.randomUUID();

      // Re-point any other pre-existing combines into the target.
      const otherCombineIds = existingCombineIds.filter((c) => c !== targetCombineId);
      if (otherCombineIds.length > 0) {
        const { error: eRepoint } = await (supabase as any)
          .from('combined_transactions')
          .update({ combine_id: targetCombineId })
          .eq('user_id', user.id)
          .in('combine_id', otherCombineIds);
        if (eRepoint) throw eRepoint;
      }

      // Upsert every selected id onto the target combine. unique(transaction_id)
      // makes this idempotent — re-combining a member is a no-op update.
      const rows = ids.map((transaction_id) => ({
        user_id: user.id,
        transaction_id,
        combine_id: targetCombineId,
      }));
      const { error: e2 } = await (supabase as any)
        .from('combined_transactions')
        .upsert(rows, { onConflict: 'transaction_id' });
      if (e2) throw e2;

      return { combineId: targetCombineId };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['combine-maps'] });
    },
  });
}

export function useUncombine() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({ combineId }: { combineId: string }) => {
      if (!user) throw new Error('Not authenticated');
      const { error } = await supabase
        .from('combined_transactions' as any)
        .delete()
        .eq('user_id', user.id)
        .eq('combine_id', combineId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['combine-maps'] });
    },
  });
}
