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
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['refund-links', variables.originalTransactionId] });
      queryClient.invalidateQueries({ queryKey: ['refund-transactions', variables.originalTransactionId] });
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
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
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['refund-links', variables.originalTransactionId] });
      queryClient.invalidateQueries({ queryKey: ['refund-transactions', variables.originalTransactionId] });
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
    },
  });
}
