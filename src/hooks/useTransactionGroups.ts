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
  created_at: string;
  updated_at: string;
}

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
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as TransactionGroup[];
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
