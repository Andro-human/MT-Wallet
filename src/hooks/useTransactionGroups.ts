import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

export interface TransactionGroup {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  color: string;
  icon: string;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
}

export type TransactionGroupUpdate = Partial<
  Pick<TransactionGroup, 'name' | 'description' | 'color' | 'icon' | 'archived_at'>
>;

export function useTransactionGroups() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['transaction-groups', user?.id],
    queryFn: async () => {
      if (!user) return [];

      const { data, error } = await supabase
        .from('transaction_groups')
        .select('*')
        .eq('user_id', user.id)
        .order('archived_at', { ascending: true, nullsFirst: true })
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as TransactionGroup[];
    },
    enabled: !!user,
  });
}

export function useUpdateTransactionGroup() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: TransactionGroupUpdate }) => {
      const { data, error } = await supabase
        .from('transaction_groups')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data as TransactionGroup;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transaction-groups'] });
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
    },
  });
}

export function useArchiveTransactionGroup() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (groupId: string) => {
      const { data, error } = await supabase
        .from('transaction_groups')
        .update({ archived_at: new Date().toISOString() })
        .eq('id', groupId)
        .select()
        .single();

      if (error) throw error;
      return data as TransactionGroup;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transaction-groups'] });
    },
  });
}

export function useUnarchiveTransactionGroup() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (groupId: string) => {
      const { data, error } = await supabase
        .from('transaction_groups')
        .update({ archived_at: null })
        .eq('id', groupId)
        .select()
        .single();

      if (error) throw error;
      return data as TransactionGroup;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transaction-groups'] });
    },
  });
}

export function useTransactionCountsByGroup() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['transaction-counts-by-group', user?.id],
    queryFn: async () => {
      if (!user) return {} as Record<string, number>;

      const { data, error } = await supabase
        .from('transactions')
        .select('group_id')
        .eq('user_id', user.id)
        .not('group_id', 'is', null);

      if (error) throw error;

      const counts: Record<string, number> = {};
      for (const row of (data ?? []) as { group_id: string | null }[]) {
        if (!row.group_id) continue;
        counts[row.group_id] = (counts[row.group_id] ?? 0) + 1;
      }
      return counts;
    },
    enabled: !!user,
  });
}

export function useCreateTransactionGroup() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (group: Pick<TransactionGroup, 'name' | 'description' | 'color' | 'icon'>) => {
      if (!user) throw new Error('Not authenticated');

      const { data, error } = await supabase
        .from('transaction_groups')
        .insert({
          ...group,
          user_id: user.id,
        })
        .select()
        .single();

      if (error) throw error;
      return data as TransactionGroup;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transaction-groups'] });
    },
  });
}

export function useDeleteTransactionGroup() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (groupId: string) => {
      const { error } = await supabase
        .from('transaction_groups')
        .delete()
        .eq('id', groupId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transaction-groups'] });
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
    },
  });
}
