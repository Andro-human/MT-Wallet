import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { useFinanceContext } from './useFinanceData';
import { sumCashback } from '@/lib/transactionMath';

/** Cashback attributed to the months inside [startDate, endDate].
 *
 *  Queried by cashback_month rather than read off the range's transactions: a
 *  cashback usually arrives the month after the one it lowers, so it is rarely
 *  among them. Keyed under 'transactions' so marking a credit refreshes it. */
export function useCashbackTotal(startDate: Date | undefined, endDate: Date | undefined) {
  const { user } = useAuth();
  const { duplicateExcludeIds } = useFinanceContext();
  const startKey = startDate ? format(startDate, 'yyyy-MM-dd') : undefined;
  const endKey = endDate ? format(endDate, 'yyyy-MM-dd') : undefined;

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ['transactions', 'cashback', user?.id, startKey, endKey],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('transactions')
        .select('id, amount, is_expense, is_income, category_id, cashback_month')
        .eq('user_id', user!.id)
        .gte('cashback_month', startKey!)
        .lte('cashback_month', endKey!);
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!user && !!startKey && !!endKey,
    staleTime: 30_000,
  });

  return { total: sumCashback(rows as any, duplicateExcludeIds), isLoading };
}
