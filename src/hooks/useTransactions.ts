import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { TransactionWithCategory, Transaction, BankAccountAlias } from '@/types/database';

export function useTransactions(filters?: {
  startDate?: Date;
  endDate?: Date;
  categoryId?: string;
  direction?: 'credit' | 'debit';
  search?: string;
  limit?: number;
  groupId?: string;
  bankName?: string;
  accountLast4?: string;
}) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['transactions', filters, user?.id],
    queryFn: async () => {
      if (!user) return [];

      const isBankFiltered = !!(filters?.bankName || filters?.accountLast4);

      // If filtering by bank account, fetch aliases so we include aliased source accounts too
      let aliases: BankAccountAlias[] = [];
      if (isBankFiltered) {
        const { data: aliasData } = await supabase
          .from('bank_account_aliases')
          .select('*')
          .eq('user_id', user.id)
          .eq('target_bank_name', filters?.bankName ?? '')
          .eq('target_account_last4', filters?.accountLast4 ?? '');
        aliases = (aliasData ?? []) as BankAccountAlias[];
      }

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
        const searchTerm = filters.search.trim();
        const numericSearch = parseFloat(searchTerm.replace(/,/g, ''));
        if (!isNaN(numericSearch) && /^[\d,.\s]+$/.test(searchTerm)) {
          query = query.or(`amount.eq.${numericSearch},merchant.ilike.%${searchTerm}%`);
        } else {
          query = query.ilike('merchant', `%${searchTerm}%`);
        }
      }
      if (filters?.groupId) {
        query = query.eq('group_id', filters.groupId);
      }

      // Bank account filter — alias-aware
      if (isBankFiltered) {
        // Build an OR condition that matches the target account + all aliased source accounts
        const bankName = filters?.bankName ?? '';
        const accountLast4 = filters?.accountLast4 ?? '';

        const conditions: string[] = [];

        // Target account itself
        const targetParts: string[] = [];
        if (bankName) targetParts.push(`bank_name.eq.${bankName}`);
        if (accountLast4) targetParts.push(`account_last4.eq.${accountLast4}`);
        if (targetParts.length > 0) {
          conditions.push(`and(${targetParts.join(',')})`);
        }

        // Aliased source accounts
        for (const alias of aliases) {
          const parts: string[] = [];
          if (alias.source_bank_name) {
            parts.push(`bank_name.eq.${alias.source_bank_name}`);
          } else {
            parts.push(`bank_name.is.null`);
          }
          if (alias.source_account_last4) {
            parts.push(`account_last4.eq.${alias.source_account_last4}`);
          } else {
            parts.push(`account_last4.is.null`);
          }
          conditions.push(`and(${parts.join(',')})`);
        }

        if (conditions.length > 0) {
          query = query.or(conditions.join(','));
        }
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
