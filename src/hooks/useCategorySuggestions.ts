import { useMemo, useSyncExternalStore } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { noteHash } from '@/lib/noteHash';
import { useAuth } from './useAuth';
import { useTransactions } from './useTransactions';
import { useCategories } from './useCategories';
import { useFinanceContext } from './useFinanceData';
import { useEnrichmentMap, type TxnEnrichment } from './useTxnEnrichment';
import {
  groupByMove,
  indexCategories,
  resolveMove,
  type MoveGroup,
  type SuggestionCategory,
} from '@/lib/suggestionMath';
import {
  dropUndo,
  getUndoEntries,
  groupByPrevCategory,
  pushUndo,
  subscribeUndo,
  type UndoEntry,
  type UndoItem,
} from '@/lib/undoStore';

export type { SuggestionCategory };

export interface CategorySuggestion {
  transactionId: string;
  merchant: string | null;
  notes: string | null;
  amount: number;
  transactedAt: string;
  from: SuggestionCategory | null;
  to: SuggestionCategory;
  existing: TxnEnrichment | null;
}

/** One proposed move, e.g. Shopping -> Groceries, with every transaction on it. */
export type SuggestionMove = MoveGroup<CategorySuggestion>;

/** Category suggestions the nightly agent wrote, resolved and ready to act on.
 *
 *  Same admissibility rule the transaction detail page uses: the slug has to
 *  resolve to a real category AND differ from the one the transaction already
 *  sits in. A suggestion naming the current category is not a suggestion.
 *
 *  Confirmed duplicates are dropped. They are excluded from every total in the
 *  app, so relabelling one changes nothing and it would only pad the inbox.
 */
export function useCategorySuggestions() {
  const { data: allTxns = [], isLoading: txnsLoading } = useTransactions({});
  const { data: categories = [], isLoading: catsLoading } = useCategories();
  const { data: enrichmentMap, isLoading: enrichLoading } = useEnrichmentMap();
  const { duplicateExcludeIds } = useFinanceContext();

  const suggestions = useMemo<CategorySuggestion[]>(() => {
    if (!enrichmentMap || categories.length === 0) return [];
    const index = indexCategories(categories);

    const out: CategorySuggestion[] = [];
    for (const t of allTxns) {
      if (duplicateExcludeIds.has(t.id)) continue;
      const existing = enrichmentMap.get(t.id) ?? null;
      const move = resolveMove(t.category_id, existing?.category_suggestion, index);
      if (!move) continue;
      out.push({
        transactionId: t.id,
        merchant: t.merchant,
        notes: t.notes,
        amount: Number(t.amount),
        transactedAt: t.transacted_at,
        from: move.from,
        to: move.to,
        existing,
      });
    }
    return out;
  }, [allTxns, categories, enrichmentMap, duplicateExcludeIds]);

  const moves = useMemo(() => groupByMove(suggestions), [suggestions]);

  return {
    suggestions,
    moves,
    count: suggestions.length,
    isLoading: txnsLoading || catsLoading || enrichLoading,
  };
}

/** Apply or dismiss a batch of suggestions in two requests, not two per row.
 *
 *  Every row in one call must share the same target category, which the move
 *  grouping already guarantees.
 *
 *  Both outcomes write model 'manual'. That is load-bearing: the nightly agent's
 *  backfill re-offers rows by enrichment date but never touches a manual row, so
 *  a dismissal sticks instead of coming back tomorrow night.
 */
export function useResolveSuggestions() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: {
      mode: 'apply' | 'dismiss';
      categoryId?: string;
      items: CategorySuggestion[];
      /** Category name for the undo label. */
      toName?: string;
    }) => {
      if (input.items.length === 0) return;

      // Captured before the write, since afterwards the old values are gone.
      // Only rows carrying a full enrichment row can be restored, which is all
      // of them here: the suggestion came from one.
      const undoItems: UndoItem[] = input.items
        .filter((i) => i.existing)
        .map((i) => ({
          transactionId: i.transactionId,
          prevCategoryId: i.from?.id ?? null,
          prevEnrichment: {
            lending: i.existing!.lending,
            category_suggestion: i.existing!.category_suggestion,
            service_identity: i.existing!.service_identity,
            budget_excluded: i.existing!.budget_excluded,
            model: i.existing!.model,
            enriched_at: i.existing!.enriched_at,
            note_hash: i.existing!.note_hash,
          },
        }));

      if (input.mode === 'apply') {
        if (!input.categoryId) throw new Error('apply needs a target category');
        const { error } = await supabase
          .from('transactions')
          .update({ category_id: input.categoryId })
          .in(
            'id',
            input.items.map((i) => i.transactionId),
          )
          .eq('user_id', user!.id);
        if (error) throw error;
      }

      const rows = await Promise.all(
        input.items.map(async (i) => ({
          transaction_id: i.transactionId,
          user_id: user!.id,
          lending: i.existing?.lending ?? null,
          category_suggestion: null,
          service_identity: i.existing?.service_identity ?? null,
          budget_excluded: i.existing?.budget_excluded ?? false,
          note_hash: await noteHash(i.notes),
          model: 'manual',
          enriched_at: new Date().toISOString(),
        })),
      );
      const { error } = await (supabase as any)
        .from('txn_enrichment')
        .upsert(rows, { onConflict: 'transaction_id' });
      if (error) throw error;

      // Only after both writes land, so a failed action leaves nothing to undo.
      return pushUndo({
        mode: input.mode,
        toName: input.mode === 'apply' ? (input.toName ?? null) : null,
        items: undoItems,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['txn-enrichment'] });
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      queryClient.invalidateQueries({ queryKey: ['transaction'] });
    },
  });
}

/** Put a suggestion action back, restoring both the category and the enrichment
 *  row as the agent left it.
 *
 *  Last-write-wins by design: if the transaction was recategorised by hand in
 *  between, undo overwrites that. Acceptable for a recover-from-misclick window
 *  measured in seconds, and the alternative is the audit trail the user
 *  explicitly did not want.
 */
export function useUndoResolve() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (entry: UndoEntry) => {
      for (const [categoryId, ids] of groupByPrevCategory(entry.items)) {
        const { error } = await supabase
          .from('transactions')
          .update({ category_id: categoryId })
          .in('id', ids)
          .eq('user_id', user!.id);
        if (error) throw error;
      }

      const rows = entry.items.map((i) => ({
        transaction_id: i.transactionId,
        user_id: user!.id,
        ...i.prevEnrichment,
      }));
      const { error } = await (supabase as any)
        .from('txn_enrichment')
        .upsert(rows, { onConflict: 'transaction_id' });
      if (error) throw error;

      dropUndo(entry.id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['txn-enrichment'] });
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      queryClient.invalidateQueries({ queryKey: ['transaction'] });
    },
  });
}

/** The session's undo stack. Empty after a reload, by design. */
export function useUndoStack(): UndoEntry[] {
  return useSyncExternalStore(subscribeUndo, getUndoEntries, getUndoEntries);
}
