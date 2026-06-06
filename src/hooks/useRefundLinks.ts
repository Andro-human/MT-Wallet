import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

export interface RefundLink {
  id: string;
  user_id: string;
  original_transaction_id: string;
  refund_transaction_id: string;
  linked_amount: number;
  created_at: string;
}

interface RefundMaps {
  totals: Record<string, number>;       // original_transaction_id -> sum(linked_amount)
  allocations: Record<string, number>;  // refund_transaction_id   -> sum(linked_amount)
}

const EMPTY_MAPS: RefundMaps = { totals: {}, allocations: {} };

// Shared key: useRefundTotals / useRefundAllocations dedupe through this.
function refundMapsQueryKey(userId: string | undefined) {
  return ['refund-links-all', userId] as const;
}

async function fetchRefundMaps(userId: string): Promise<RefundMaps> {
  const { data, error } = await (supabase as any)
    .from('refund_links')
    .select('original_transaction_id, refund_transaction_id, linked_amount')
    .eq('user_id', userId);

  if (error) throw error;

  const totals: Record<string, number> = {};
  const allocations: Record<string, number> = {};
  for (const row of (data ?? []) as {
    original_transaction_id: string;
    refund_transaction_id: string;
    linked_amount: number | string;
  }[]) {
    const amt = Number(row.linked_amount ?? 0);
    if (!amt) continue;
    totals[row.original_transaction_id] = (totals[row.original_transaction_id] || 0) + amt;
    allocations[row.refund_transaction_id] = (allocations[row.refund_transaction_id] || 0) + amt;
  }
  return { totals, allocations };
}

export function useRefundAllocations() {
  const { user } = useAuth();

  return useQuery({
    queryKey: refundMapsQueryKey(user?.id),
    queryFn: () => fetchRefundMaps(user!.id),
    select: (d: RefundMaps) => d.allocations,
    enabled: !!user,
    staleTime: 30_000,
    initialData: !user ? EMPTY_MAPS : undefined,
  });
}

export interface RefundLinkRow {
  id: string;
  refund_transaction_id: string;
  linked_amount: number;
  refund_amount: number;
  merchant: string | null;
  transacted_at: string;
  direction: 'debit' | 'credit' | null;
}

export function useRefundLinksForOriginal(originalTransactionId: string) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['refund-links-for-original', originalTransactionId],
    queryFn: async (): Promise<RefundLinkRow[]> => {
      if (!user) return [];

      const { data, error } = await (supabase as any)
        .from('refund_links')
        .select(
          'id, refund_transaction_id, linked_amount, refund_transaction:refund_transaction_id(amount, merchant, transacted_at, direction)'
        )
        .eq('original_transaction_id', originalTransactionId);

      if (error) throw error;

      return ((data ?? []) as any[]).map((row) => ({
        id: row.id,
        refund_transaction_id: row.refund_transaction_id,
        linked_amount: Number(row.linked_amount ?? 0),
        refund_amount: Number(row.refund_transaction?.amount ?? 0),
        merchant: row.refund_transaction?.merchant ?? null,
        transacted_at: row.refund_transaction?.transacted_at,
        direction: row.refund_transaction?.direction ?? null,
      }));
    },
    enabled: !!user && !!originalTransactionId,
  });
}

export function useRefundTotals() {
  const { user } = useAuth();

  return useQuery({
    queryKey: refundMapsQueryKey(user?.id),
    queryFn: () => fetchRefundMaps(user!.id),
    select: (d: RefundMaps) => d.totals,
    enabled: !!user,
    staleTime: 30_000,
    initialData: !user ? EMPTY_MAPS : undefined,
  });
}

export function useCreateRefundLink() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({
      originalTransactionId,
      refundTransactionId,
      linkedAmount,
    }: {
      originalTransactionId: string;
      refundTransactionId: string;
      linkedAmount: number;
    }) => {
      if (!user) throw new Error('Not authenticated');
      if (!(linkedAmount > 0)) throw new Error('linked amount must be positive');

      const { data, error } = await (supabase as any)
        .from('refund_links')
        .insert({
          user_id: user.id,
          original_transaction_id: originalTransactionId,
          refund_transaction_id: refundTransactionId,
          linked_amount: linkedAmount,
        })
        .select()
        .single();

      if (error) throw error;

      // Don't flip is_income: creditNet() handles partial allocation.
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['refund-links-for-original', variables.originalTransactionId] });
      queryClient.invalidateQueries({ queryKey: ['refund-links-all'] });
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      queryClient.invalidateQueries({ queryKey: ['transaction', variables.originalTransactionId] });
      queryClient.invalidateQueries({ queryKey: ['transaction', variables.refundTransactionId] });
    },
  });
}

export function useUpdateRefundLink() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      linkId,
      linkedAmount,
    }: {
      linkId: string;
      originalTransactionId: string;
      refundTransactionId: string;
      linkedAmount: number;
    }) => {
      if (!(linkedAmount > 0)) throw new Error('linked amount must be positive');

      const { error } = await (supabase as any)
        .from('refund_links')
        .update({ linked_amount: linkedAmount })
        .eq('id', linkId);

      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['refund-links-for-original', variables.originalTransactionId] });
      queryClient.invalidateQueries({ queryKey: ['refund-links-all'] });
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
      linkId,
      refundTransactionId,
    }: {
      linkId: string;
      originalTransactionId: string;
      refundTransactionId: string;
    }) => {
      const { error } = await supabase
        .from('refund_links')
        .delete()
        .eq('id', linkId);

      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['refund-links-for-original', variables.originalTransactionId] });
      queryClient.invalidateQueries({ queryKey: ['refund-links-all'] });
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      queryClient.invalidateQueries({ queryKey: ['transaction', variables.originalTransactionId] });
      queryClient.invalidateQueries({ queryKey: ['transaction', variables.refundTransactionId] });
    },
  });
}
