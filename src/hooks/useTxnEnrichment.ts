import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

export interface TxnEnrichment {
  transaction_id: string;
  item_label: string;
  lending: { counterparty: string; type: 'lent' | 'repayment' } | null;
  category_suggestion: string | null;
  /** A one-off no budget should count: a laptop, a big trip. Still counted in
   *  total spend; only budget attribution skips it. */
  budget_excluded: boolean;
  /** Normalized name of a recurring service, naming the service rather than the
   *  payment rail it went out on. Null when not a recurring service. */
  service_identity: string | null;
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
      // Newer columns are requested optionally. A column that has not been
      // migrated yet makes PostgREST reject the whole select (42703), and this
      // map gates the Debt page and subscription detection, so one missing
      // column would empty both rather than degrade one feature.
      const BASE = 'transaction_id, item_label, lending, category_suggestion';
      const OPTIONAL = ['budget_excluded', 'service_identity'];
      let columns = [BASE, ...OPTIONAL].join(', ');

      for (let from = 0; ; from += PAGE) {
        let res = await (supabase as any)
          .from('txn_enrichment')
          .select(columns)
          .eq('user_id', user!.id)
          .order('transaction_id', { ascending: true })
          .range(from, from + PAGE - 1);

        if (res.error?.code === '42703' && columns !== BASE) {
          console.warn('[enrichment] a column is not migrated yet, falling back:', res.error.message);
          columns = BASE;
          res = await (supabase as any)
            .from('txn_enrichment')
            .select(columns)
            .eq('user_id', user!.id)
            .order('transaction_id', { ascending: true })
            .range(from, from + PAGE - 1);
        }
        if (res.error) throw res.error;

        const rows = (res.data ?? []) as Partial<TxnEnrichment>[];
        for (const row of rows) {
          map.set(row.transaction_id!, {
            transaction_id: row.transaction_id!,
            item_label: row.item_label ?? '',
            lending: row.lending ?? null,
            category_suggestion: row.category_suggestion ?? null,
            budget_excluded: row.budget_excluded ?? false,
            service_identity: row.service_identity ?? null,
          });
        }
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
      budgetExcluded?: boolean;
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
        budget_excluded:
          input.budgetExcluded !== undefined
            ? input.budgetExcluded
            : (input.existing?.budget_excluded ?? false),
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

/** Mark several transactions as lent to one counterparty in a single upsert. */
export function useMarkLentBulk() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      counterparty: string;
      transactions: { id: string; notes: string | null; existing: TxnEnrichment | null }[];
    }) => {
      const rows = await Promise.all(
        input.transactions.map(async (t) => ({
          transaction_id: t.id,
          user_id: user!.id,
          item_label: t.existing?.item_label ?? 'loan',
          lending: { counterparty: input.counterparty, type: 'lent' as const },
          category_suggestion: t.existing?.category_suggestion ?? null,
          budget_excluded: t.existing?.budget_excluded ?? false,
          note_hash: await sha256Hex((t.notes ?? '').trim()),
          model: 'manual',
        })),
      );
      const { error } = await (supabase as any)
        .from('txn_enrichment')
        .upsert(rows, { onConflict: 'transaction_id' });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [KEY] });
    },
  });
}
