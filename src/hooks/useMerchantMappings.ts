import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { useToast } from './use-toast';

export interface UserMerchantMapping {
  id: string;
  user_id: string;
  raw_merchant: string;
  mapped_merchant: string;
  default_category_id: string | null;
  default_is_expense: boolean | null;
  default_is_income: boolean | null;
  amount_operator: '<' | '>' | '<=' | '>=' | '=' | null;
  amount_threshold: number | null;
  date_operator: '<' | '>' | '<=' | '>=' | '=' | null;
  date_threshold: number | null;
  match_type: 'exact' | 'contains';
  created_at: string;
  updated_at: string;
}

export function useMerchantMappings() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['merchant-mappings', user?.id],
    queryFn: async (): Promise<UserMerchantMapping[]> => {
      if (!user) return [];
      
      const { data, error } = await (supabase as any)
        .from('user_merchant_mappings')
        .select('*')
        .order('raw_merchant', { ascending: true });

      if (error) throw error;
      return data as UserMerchantMapping[];
    },
    enabled: !!user,
  });
}

export function useDeleteMerchantMapping() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (id: string) => {
      if (!user) throw new Error('Not authenticated');

      const { error } = await (supabase as any)
        .from('user_merchant_mappings')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['merchant-mappings'] });
      toast({ title: 'Automation rule deleted' });
    },
    onError: (error) => {
      console.error('Failed to delete mapping:', error);
      toast({ title: 'Failed to delete rule', variant: 'destructive' });
    },
  });
}

export function useUpdateMerchantMapping() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<UserMerchantMapping> }) => {
      if (!user) throw new Error('Not authenticated');

      const { error } = await (supabase as any)
        .from('user_merchant_mappings')
        .update(updates)
        .eq('id', id)
        .eq('user_id', user.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['merchant-mappings'] });
      toast({ title: 'Automation rule updated successfully' });
    },
    onError: (error) => {
      console.error('Failed to update mapping:', error);
      toast({ title: 'Failed to update rule', variant: 'destructive' });
    },
  });
}
