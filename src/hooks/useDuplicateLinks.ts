import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { TransactionWithCategory } from '@/types/database';

export interface DuplicateLink {
  id: string;
  user_id: string;
  primary_transaction_id: string;
  duplicate_transaction_id: string;
  auto_detected: boolean;
  created_at: string;
}

/**
 * Fetch duplicate links where this transaction is the primary.
 */
export function useDuplicateLinks(transactionId: string) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['duplicate-links', transactionId],
    queryFn: async () => {
      if (!user) return [];

      // Fetch links where this transaction is either primary or duplicate
      const { data: asPrimary, error: e1 } = await supabase
        .from('duplicate_links' as any)
        .select('*')
        .eq('primary_transaction_id', transactionId);

      const { data: asDuplicate, error: e2 } = await supabase
        .from('duplicate_links' as any)
        .select('*')
        .eq('duplicate_transaction_id', transactionId);

      if (e1) throw e1;
      if (e2) throw e2;

      return [...(asPrimary || []), ...(asDuplicate || [])] as unknown as DuplicateLink[];
    },
    enabled: !!user && !!transactionId,
  });
}

/**
 * Fetch the actual duplicate transactions linked to this one (bidirectional).
 */
export function useDuplicateTransactions(transactionId: string) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['duplicate-transactions', transactionId],
    queryFn: async () => {
      if (!user) return [];

      // Get links in both directions
      const { data: asPrimary, error: e1 } = await supabase
        .from('duplicate_links' as any)
        .select('duplicate_transaction_id')
        .eq('primary_transaction_id', transactionId);

      const { data: asDuplicate, error: e2 } = await supabase
        .from('duplicate_links' as any)
        .select('primary_transaction_id')
        .eq('duplicate_transaction_id', transactionId);

      if (e1) throw e1;
      if (e2) throw e2;

      const linkedIds = [
        ...(asPrimary || []).map((l: any) => l.duplicate_transaction_id),
        ...(asDuplicate || []).map((l: any) => l.primary_transaction_id),
      ];

      if (linkedIds.length === 0) return [];

      const { data: transactions, error: txError } = await supabase
        .from('transactions')
        .select(`*, categories (*)`)
        .in('id', linkedIds);

      if (txError) throw txError;
      return (transactions || []) as TransactionWithCategory[];
    },
    enabled: !!user && !!transactionId,
  });
}

export function useCreateDuplicateLink() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({
      primaryTransactionId,
      duplicateTransactionId,
    }: {
      primaryTransactionId: string;
      duplicateTransactionId: string;
    }) => {
      if (!user) throw new Error('Not authenticated');

      const { data, error } = await supabase
        .from('duplicate_links' as any)
        .insert({
          user_id: user.id,
          primary_transaction_id: primaryTransactionId,
          duplicate_transaction_id: duplicateTransactionId,
        })
        .select()
        .single();

      if (error) throw error;

      // Mark the duplicate as NOT expense/income so it doesn't double-count
      await supabase
        .from('transactions')
        .update({ is_expense: false, is_income: false } as any)
        .eq('id', duplicateTransactionId);

      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['duplicate-links', variables.primaryTransactionId] });
      queryClient.invalidateQueries({ queryKey: ['duplicate-links', variables.duplicateTransactionId] });
      queryClient.invalidateQueries({ queryKey: ['duplicate-transactions', variables.primaryTransactionId] });
      queryClient.invalidateQueries({ queryKey: ['duplicate-transactions', variables.duplicateTransactionId] });
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      queryClient.invalidateQueries({ queryKey: ['transaction', variables.duplicateTransactionId] });
    },
  });
}

export function useDeleteDuplicateLink() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      primaryTransactionId,
      duplicateTransactionId,
    }: {
      primaryTransactionId: string;
      duplicateTransactionId: string;
    }) => {
      // Try deleting in both directions (since user might unlink from either side)
      const { error: e1 } = await supabase
        .from('duplicate_links' as any)
        .delete()
        .eq('primary_transaction_id', primaryTransactionId)
        .eq('duplicate_transaction_id', duplicateTransactionId);

      if (e1) {
        // Try reverse direction
        const { error: e2 } = await supabase
          .from('duplicate_links' as any)
          .delete()
          .eq('primary_transaction_id', duplicateTransactionId)
          .eq('duplicate_transaction_id', primaryTransactionId);

        if (e2) throw e2;
      }

      // Restore the duplicate's expense/income flags
      await supabase
        .from('transactions')
        .update({ is_expense: true, is_income: true } as any)
        .eq('id', duplicateTransactionId);
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['duplicate-links', variables.primaryTransactionId] });
      queryClient.invalidateQueries({ queryKey: ['duplicate-links', variables.duplicateTransactionId] });
      queryClient.invalidateQueries({ queryKey: ['duplicate-transactions', variables.primaryTransactionId] });
      queryClient.invalidateQueries({ queryKey: ['duplicate-transactions', variables.duplicateTransactionId] });
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      queryClient.invalidateQueries({ queryKey: ['transaction', variables.duplicateTransactionId] });
    },
  });
}
