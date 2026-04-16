import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

export interface RefundLink {
  id: string;
  user_id: string;
  original_transaction_id: string;
  refund_transaction_id: string;
  created_at: string;
}

/**
 * All refund_transaction_ids the user has already linked somewhere.
 * Used to filter candidates in LinkRefundDialog so the same refund
 * can't be linked to a second original.
 */
export function useAllLinkedRefundIds() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['all-refund-links', user?.id],
    queryFn: async () => {
      if (!user) return new Set<string>();

      const { data, error } = await supabase
        .from('refund_links')
        .select('refund_transaction_id')
        .eq('user_id', user.id);

      if (error) throw error;

      const linkedIds = new Set<string>();
      for (const row of data || []) {
        linkedIds.add(row.refund_transaction_id);
      }
      return linkedIds;
    },
    enabled: !!user,
  });
}

export function useRefundLinks(transactionId: string) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['refund-links', transactionId],
    queryFn: async () => {
      if (!user) return [];

      const { data, error } = await supabase
        .from('refund_links')
        .select('*')
        .eq('original_transaction_id', transactionId);

      if (error) throw error;
      return data as RefundLink[];
    },
    enabled: !!user && !!transactionId,
  });
}

export function useRefundTransactions(transactionId: string) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['refund-transactions', transactionId],
    queryFn: async () => {
      if (!user) return [];

      // Get linked refund transaction IDs
      const { data: links, error: linksError } = await supabase
        .from('refund_links')
        .select('refund_transaction_id')
        .eq('original_transaction_id', transactionId);

      if (linksError) throw linksError;
      if (!links || links.length === 0) return [];

      const refundIds = links.map(l => l.refund_transaction_id);

      // Get the actual transactions
      const { data: transactions, error: txError } = await supabase
        .from('transactions')
        .select('*')
        .in('id', refundIds);

      if (txError) throw txError;
      return transactions || [];
    },
    enabled: !!user && !!transactionId,
  });
}

/**
 * Batch fetch refund totals for a list of transaction IDs.
 * Returns a map of originalTransactionId → total refunded amount.
 */
export function useRefundTotals(transactionIds: string[]) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['refund-totals', transactionIds.sort().join(',')],
    queryFn: async () => {
      if (!user || transactionIds.length === 0) return {};

      // Get all refund links for these transactions
      const { data: links, error: linksError } = await supabase
        .from('refund_links')
        .select('original_transaction_id, refund_transaction_id')
        .in('original_transaction_id', transactionIds);

      if (linksError) throw linksError;
      if (!links || links.length === 0) return {};

      // Get refund transaction amounts
      const refundIds = links.map(l => l.refund_transaction_id);
      const { data: refundTxns, error: txError } = await supabase
        .from('transactions')
        .select('id, amount')
        .in('id', refundIds);

      if (txError) throw txError;

      // Build amount lookup
      const amountMap: Record<string, number> = {};
      for (const t of refundTxns || []) {
        amountMap[t.id] = Number(t.amount);
      }

      // Sum refunds per original transaction
      const totals: Record<string, number> = {};
      for (const link of links) {
        const amt = amountMap[link.refund_transaction_id] || 0;
        totals[link.original_transaction_id] = (totals[link.original_transaction_id] || 0) + amt;
      }

      return totals;
    },
    enabled: !!user && transactionIds.length > 0,
    staleTime: 30_000,
  });
}

export function useCreateRefundLink() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({
      originalTransactionId,
      refundTransactionId,
    }: {
      originalTransactionId: string;
      refundTransactionId: string;
    }) => {
      if (!user) throw new Error('Not authenticated');

      // Create the refund link
      const { data, error } = await supabase
        .from('refund_links')
        .insert({
          user_id: user.id,
          original_transaction_id: originalTransactionId,
          refund_transaction_id: refundTransactionId,
        })
        .select()
        .single();

      if (error) throw error;

      // Mark the refund transaction as NOT income (it's a reversal, not real income)
      await supabase
        .from('transactions')
        .update({ is_income: false } as any)
        .eq('id', refundTransactionId);

      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['refund-links', variables.originalTransactionId] });
      queryClient.invalidateQueries({ queryKey: ['refund-transactions', variables.originalTransactionId] });
      queryClient.invalidateQueries({ queryKey: ['refund-totals'] });
      queryClient.invalidateQueries({ queryKey: ['all-refund-links'] });
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      queryClient.invalidateQueries({ queryKey: ['transaction', variables.originalTransactionId] });
      queryClient.invalidateQueries({ queryKey: ['transaction', variables.refundTransactionId] });
    },
  });
}

export function useDeleteRefundLink() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      originalTransactionId,
      refundTransactionId,
    }: {
      originalTransactionId: string;
      refundTransactionId: string;
    }) => {
      const { error } = await supabase
        .from('refund_links')
        .delete()
        .eq('original_transaction_id', originalTransactionId)
        .eq('refund_transaction_id', refundTransactionId);

      if (error) throw error;

      // Only restore is_income if:
      //   1. The refund direction is 'credit' (debit-direction refunds never had is_income=true)
      //   2. No remaining refund_links point at this refund txn
      const [{ data: refundTxn }, { data: remainingLinks }] = await Promise.all([
        supabase
          .from('transactions')
          .select('direction')
          .eq('id', refundTransactionId)
          .single(),
        supabase
          .from('refund_links')
          .select('id')
          .eq('refund_transaction_id', refundTransactionId)
          .limit(1),
      ]);

      const shouldRestore =
        refundTxn?.direction === 'credit' && (remainingLinks?.length ?? 0) === 0;

      if (shouldRestore) {
        await supabase
          .from('transactions')
          .update({ is_income: true } as any)
          .eq('id', refundTransactionId);
      }
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['refund-links', variables.originalTransactionId] });
      queryClient.invalidateQueries({ queryKey: ['refund-transactions', variables.originalTransactionId] });
      queryClient.invalidateQueries({ queryKey: ['refund-totals'] });
      queryClient.invalidateQueries({ queryKey: ['all-refund-links'] });
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      queryClient.invalidateQueries({ queryKey: ['transaction', variables.originalTransactionId] });
      queryClient.invalidateQueries({ queryKey: ['transaction', variables.refundTransactionId] });
    },
  });
}
