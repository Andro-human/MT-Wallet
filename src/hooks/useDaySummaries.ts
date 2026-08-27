import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

// Keyed by 'yyyy-MM-dd' in local time, matching how the day ledger groups rows.
export type DaySummaryMap = Record<string, string>;

const EMPTY: DaySummaryMap = {};

export function useDaySummaries(start: Date, end: Date) {
  const { user } = useAuth();
  const from = format(start, 'yyyy-MM-dd');
  const to = format(end, 'yyyy-MM-dd');

  return useQuery({
    queryKey: ['day-summaries', user?.id, from, to],
    queryFn: async (): Promise<DaySummaryMap> => {
      if (!user) return EMPTY;
      const { data, error } = await (supabase as any)
        .from('day_summaries')
        .select('day, summary')
        .eq('user_id', user.id)
        .gte('day', from)
        .lte('day', to);

      if (error) throw error;

      const map: DaySummaryMap = {};
      for (const row of (data ?? []) as { day: string; summary: string }[]) {
        map[row.day] = row.summary;
      }
      return map;
    },
    enabled: !!user,
    staleTime: 5 * 60 * 1000,
  });
}
