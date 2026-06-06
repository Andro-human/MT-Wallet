import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

export interface MonthSummary {
  spent: number;
  income: number;
  txn_count: number;
}

const EMPTY: MonthSummary = { spent: 0, income: 0, txn_count: 0 };

export function useMonthSummary(startDate: Date | undefined, endDate: Date | undefined) {
  const { user } = useAuth();
  const startISO = startDate?.toISOString();
  const endISO = endDate?.toISOString();

  return useQuery<MonthSummary>({
    queryKey: ['month-summary', user?.id, startISO, endISO],
    queryFn: async () => {
      if (!user || !startISO || !endISO) return EMPTY;

      const { data, error } = await (supabase as any).rpc('month_summary', {
        p_start: startISO,
        p_end: endISO,
      });

      if (error) throw error;
      const row = (data ?? [])[0];
      if (!row) return EMPTY;
      return {
        spent: Number(row.spent ?? 0),
        income: Number(row.income ?? 0),
        txn_count: Number(row.txn_count ?? 0),
      };
    },
    enabled: !!user && !!startISO && !!endISO,
    staleTime: 30_000,
  });
}
