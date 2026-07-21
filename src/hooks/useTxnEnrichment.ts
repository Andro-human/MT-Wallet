import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

export interface TxnEnrichment {
  transaction_id: string;
  item_label: string;
  lending: { counterparty: string; type: 'lent' | 'repayment' } | null;
  category_suggestion: string | null;
}

const KEY = 'txn-enrichment';

const PAGE = 1000;

/** All enrichment rows for the user, as transaction_id -> row. Paged because
 *  PostgREST caps a single response at 1000 rows and a user can exceed that. */
export function useEnrichmentMap() {
  const { user } = useAuth();
  return useQuery({
    queryKey: [KEY, user?.id],
    queryFn: async () => {
      const map = new Map<string, TxnEnrichment>();
      for (let from = 0; ; from += PAGE) {
        const { data, error } = await (supabase as any)
          .from('txn_enrichment')
          .select('transaction_id, item_label, lending, category_suggestion')
          .eq('user_id', user!.id)
          .order('transaction_id', { ascending: true })
          .range(from, from + PAGE - 1);
        if (error) throw error;
        const rows = (data ?? []) as TxnEnrichment[];
        for (const row of rows) map.set(row.transaction_id, row);
        if (rows.length < PAGE) break;
      }
      return map;
    },
    enabled: !!user,
    staleTime: 30_000,
  });
}

export function useEnrichmentFor(transactionId: string | undefined) {
  const map = useEnrichmentMap();
  return {
    ...map,
    data: transactionId ? (map.data?.get(transactionId) ?? null) : null,
  };
}

async function sha256Hex(text: string): Promise<string> {
  const bytes = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Manual writes to txn_enrichment: dismiss/clear a category suggestion, or
 * mark/unmark a transaction as a loan. Upserts carry the note's real hash so
 * the nightly job doesn't see the row as stale and overwrite the manual edit.
 */
export function useUpdateEnrichment() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      transactionId: string;
      notes: string | null;
      existing: TxnEnrichment | null;
      lending?: TxnEnrichment['lending'];
      categorySuggestion?: string | null;
    }) => {
      const row = {
        transaction_id: input.transactionId,
        user_id: user!.id,
        item_label: input.existing?.item_label ?? 'loan',
        lending: input.lending !== undefined ? input.lending : (input.existing?.lending ?? null),
        category_suggestion:
          input.categorySuggestion !== undefined
            ? input.categorySuggestion
            : (input.existing?.category_suggestion ?? null),
        note_hash: await sha256Hex((input.notes ?? '').trim()),
        model: 'manual',
      };
      const { error } = await (supabase as any)
        .from('txn_enrichment')
        .upsert(row, { onConflict: 'transaction_id' });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [KEY] });
    },
  });
}
