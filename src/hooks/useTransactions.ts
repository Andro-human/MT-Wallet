import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { TransactionWithCategory, Transaction } from '@/types/database';

export function useTransactions(filters?: {
  startDate?: Date;
  endDate?: Date;
  categoryId?: string;
  direction?: 'credit' | 'debit';
  search?: string;
  limit?: number;
}) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['transactions', filters, user?.id],
    queryFn: async () => {
      if (!user) return [];

      let query = supabase
        .from('transactions')
        .select(`
          *,
          categories (*)
        `)
        .eq('user_id', user.id)
        .order('transacted_at', { ascending: false });

      if (filters?.startDate) {
        query = query.gte('transacted_at', filters.startDate.toISOString());
      }
      if (filters?.endDate) {
        query = query.lte('transacted_at', filters.endDate.toISOString());
      }
      if (filters?.categoryId) {
        query = query.eq('category_id', filters.categoryId);
      }
      if (filters?.direction) {
        query = query.eq('direction', filters.direction);
      }
      if (filters?.search) {
        query = query.ilike('merchant', `%${filters.search}%`);
      }
      if (filters?.limit) {
        query = query.limit(filters.limit);
      }

      const { data, error } = await query;
      
      if (error) throw error;
      return data as TransactionWithCategory[];
    },
    enabled: !!user,
  });
}

export function useTransaction(id: string) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['transaction', id],
    queryFn: async () => {
      if (!user) return null;

      const { data, error } = await supabase
        .from('transactions')
        .select(`
          *,
          categories (*)
        `)
        .eq('id', id)
        .eq('user_id', user.id)
        .single();

      if (error) throw error;
      return data as TransactionWithCategory;
    },
    enabled: !!user && !!id,
  });
}

export function useUpdateTransaction() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ 
      id, 
      updates 
    }: { 
      id: string; 
      updates: Partial<Transaction> 
    }) => {
      const { data, error } = await supabase
        .from('transactions')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      queryClient.invalidateQueries({ queryKey: ['transaction'] });
    },
  });
}
