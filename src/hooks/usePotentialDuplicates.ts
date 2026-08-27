import { useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { useAllLinkedTransactionIds } from './useDuplicateLinks';
import { TransactionWithCategory } from '@/types/database';

function makePairKey(id1: string, id2: string): [string, string] {
  return id1 < id2 ? [id1, id2] : [id2, id1];
}

export interface DuplicatePair {
  transactionA: TransactionWithCategory;
  transactionB: TransactionWithCategory;
  pairKey: string;
}

/**
 * Fetch dismissed duplicate pairs from DB.
 */
function useDismissedDuplicates() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['dismissed-duplicates', user?.id],
    queryFn: async () => {
      if (!user) return new Set<string>();

      const { data, error } = await supabase
        .from('dismissed_duplicates' as any)
        .select('transaction_id_1, transaction_id_2')
        .eq('user_id', user.id);

      if (error) return new Set<string>();

      const set = new Set<string>();
      for (const row of (data || []) as any[]) {
        if (row.transaction_id_1 && row.transaction_id_2) {
          const [a, b] = makePairKey(row.transaction_id_1, row.transaction_id_2);
          set.add(`${a}|${b}`);
        }
      }
      return set;
    },
    enabled: !!user,
    staleTime: 60_000,
  });
}

/**
 * Dismiss a duplicate suggestion (persist to DB).
 */
export function useDismissDuplicate() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id1, id2 }: { id1: string; id2: string }) => {
      if (!user) throw new Error('Not authenticated');
      const [a, b] = makePairKey(id1, id2);

      const { error } = await supabase
        .from('dismissed_duplicates' as any)
        .insert({
          user_id: user.id,
          transaction_id_1: a,
          transaction_id_2: b,
        });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dismissed-duplicates'] });
    },
  });
}

/**
 * Detect potential duplicate transactions for a given transaction (detail page).
 */
const NEAR_MS = 30 * 60 * 1000;

export function usePotentialDuplicates(
  transaction: TransactionWithCategory | null | undefined,
): TransactionWithCategory[] {
  const { user } = useAuth();
  const { data: dismissed = new Set<string>() } = useDismissedDuplicates();
  const { data: allLinkedIds = new Set<string>() } = useAllLinkedTransactionIds();

  // Same match as usePotentialDuplicatesList: identical amount and direction
  // within half an hour. Scoped to that window in SQL rather than pulling a
  // page of rows to filter in the client.
  const { data: nearby = [] } = useQuery({
    queryKey: ['potential-duplicates', transaction?.id],
    queryFn: async () => {
      if (!user || !transaction) return [];
      const at = new Date(transaction.transacted_at).getTime();

      const { data, error } = await supabase
        .from('transactions')
        .select('*, categories(*)')
        .eq('user_id', user.id)
        .eq('amount', transaction.amount)
        .eq('direction', transaction.direction)
        .neq('id', transaction.id)
        .gte('transacted_at', new Date(at - NEAR_MS).toISOString())
        .lte('transacted_at', new Date(at + NEAR_MS).toISOString());

      if (error) throw error;
      return (data ?? []) as unknown as TransactionWithCategory[];
    },
    enabled: !!user && !!transaction,
    staleTime: 60_000,
  });

  return useMemo(() => {
    if (!transaction) return [];
    if (allLinkedIds.has(transaction.id)) return [];

    return nearby.filter((candidate) => {
      if (allLinkedIds.has(candidate.id)) return false;
      const [a, b] = makePairKey(transaction.id, candidate.id);
      return !dismissed.has(`${a}|${b}`);
    });
  }, [transaction, nearby, dismissed, allLinkedIds]);
}

/**
 * Detect potential duplicate PAIRS across a list of transactions (list page).
 */
export function usePotentialDuplicatesList(transactions: TransactionWithCategory[]) {
  const { data: dismissed = new Set<string>() } = useDismissedDuplicates();
  const { data: allLinkedIds = new Set<string>() } = useAllLinkedTransactionIds();
  const dismissMutation = useDismissDuplicate();

  const pairs = useMemo(() => {
    if (transactions.length === 0) return [];

    const result: DuplicatePair[] = [];
    const seen = new Set<string>();

    for (let i = 0; i < transactions.length; i++) {
      for (let j = i + 1; j < transactions.length; j++) {
        const a = transactions[i];
        const b = transactions[j];

        // Skip if either is already verified as a duplicate
        if (allLinkedIds.has(a.id) || allLinkedIds.has(b.id)) continue;

        if (Number(a.amount) !== Number(b.amount)) continue;
        if (a.direction !== b.direction) continue;

        const timeDiff = Math.abs(
          new Date(a.transacted_at).getTime() - new Date(b.transacted_at).getTime()
        );
        if (timeDiff > 30 * 60 * 1000) continue;

        const [sortedA, sortedB] = makePairKey(a.id, b.id);
        const pairKey = `${sortedA}|${sortedB}`;

        if (dismissed.has(pairKey)) continue;
        if (seen.has(pairKey)) continue;
        seen.add(pairKey);

        result.push({ transactionA: a, transactionB: b, pairKey });
      }
    }

    return result;
  }, [transactions, dismissed, allLinkedIds]);

  const dismiss = (pairKey: string) => {
    const [id1, id2] = pairKey.split('|');
    dismissMutation.mutate({ id1, id2 });
  };

  return { pairs, dismiss };
}
