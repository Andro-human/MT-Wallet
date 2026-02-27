import { useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { useDuplicateTransactions } from './useDuplicateLinks';
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
        const [a, b] = makePairKey(row.transaction_id_1, row.transaction_id_2);
        set.add(`${a}|${b}`);
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
export function usePotentialDuplicates(transaction: TransactionWithCategory | null | undefined) {
  const { data: alreadyLinked = [] } = useDuplicateTransactions(transaction?.id || '');
  const { data: dismissed = new Set<string>() } = useDismissedDuplicates();

  // We need nearby transactions — use the ones passed in or skip
  return { dismissed, alreadyLinkedIds: new Set(alreadyLinked.map(t => t.id)) };
}

/**
 * Detect potential duplicate PAIRS across a list of transactions (list page).
 */
export function usePotentialDuplicatesList(transactions: TransactionWithCategory[]) {
  const { data: dismissed = new Set<string>() } = useDismissedDuplicates();
  const dismissMutation = useDismissDuplicate();

  const pairs = useMemo(() => {
    if (transactions.length === 0) return [];

    const result: DuplicatePair[] = [];
    const seen = new Set<string>();

    for (let i = 0; i < transactions.length; i++) {
      for (let j = i + 1; j < transactions.length; j++) {
        const a = transactions[i];
        const b = transactions[j];

        if (Number(a.amount) !== Number(b.amount)) continue;
        if (a.direction !== b.direction) continue;

        const timeDiff = Math.abs(
          new Date(a.transacted_at).getTime() - new Date(b.transacted_at).getTime()
        );
        if (timeDiff > 10 * 60 * 1000) continue;

        const [sortedA, sortedB] = makePairKey(a.id, b.id);
        const pairKey = `${sortedA}|${sortedB}`;

        if (dismissed.has(pairKey)) continue;
        if (seen.has(pairKey)) continue;
        seen.add(pairKey);

        result.push({ transactionA: a, transactionB: b, pairKey });
      }
    }

    return result;
  }, [transactions, dismissed]);

  const dismiss = (pairKey: string) => {
    const [id1, id2] = pairKey.split('|');
    dismissMutation.mutate({ id1, id2 });
  };

  return { pairs, dismiss };
}
