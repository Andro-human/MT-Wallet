import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

const DEFAULT_PAYMENT_METHODS = ['UPI', 'Card', 'Cash'];

export function usePaymentMethods() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['payment-methods', user?.id],
    queryFn: async () => {
      if (!user) return DEFAULT_PAYMENT_METHODS;

      // Get unique payment methods from user's transactions
      const { data, error } = await supabase
        .from('transactions')
        .select('payment_method')
        .eq('user_id', user.id)
        .not('payment_method', 'is', null);

      if (error) throw error;

      const userMethods = [...new Set(
        data
          .map(t => t.payment_method)
          .filter((m): m is string => !!m)
      )];

      // Combine defaults with user's custom methods, deduped
      const allMethods = [...new Set([...DEFAULT_PAYMENT_METHODS, ...userMethods])];
      return allMethods;
    },
    enabled: !!user,
  });
}

export function useBankNames() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['bank-names', user?.id],
    queryFn: async () => {
      if (!user) return [];

      // Get unique bank names from user's transactions
      const { data, error } = await supabase
        .from('transactions')
        .select('bank_name')
        .eq('user_id', user.id)
        .not('bank_name', 'is', null);

      if (error) throw error;

      const bankNames = [...new Set(
        data
          .map(t => t.bank_name)
          .filter((b): b is string => !!b)
      )];

      return bankNames;
    },
    enabled: !!user,
  });
}
