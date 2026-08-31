import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

const KEY = 'monthly-summary';

export interface CategoryGroup {
  label: string;
  amount: number;
  count: number;
}
export interface CategoryBreakdown {
  category: string;
  name: string;
  total: number;
  one_liner: string | null;
  groups: CategoryGroup[];
  reconciled: boolean;
}

// A month-global partition of ALL spend transactions by meaning (cross-category),
// reconciled in code: slice amounts are ordinal sums and total exactly the month's
// spend. Drives the "where it went" donut.
export interface SpendSlice {
  label: string;
  amount: number;
  count: number;
  /** Where the theme's money actually went, at the granularity of the things
   *  bought. Absent on rows written before slice one-liners existed. */
  one_liner?: string | null;
}

export interface MonthlySummary {
  month: string;
  highlights: string[];
  category_breakdowns: CategoryBreakdown[];
  spend_slices: SpendSlice[];
  generated_at: string;
}

export function useMonthlySummary(month: string | null) {
  const { user } = useAuth();
  return useQuery({
    queryKey: [KEY, user?.id, month],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('monthly_summaries')
        .select('month, highlights, category_breakdowns, spend_slices, generated_at')
        .eq('user_id', user!.id)
        .eq('month', month)
        .maybeSingle();
      if (error) throw error;
      if (!data) return null;
      return {
        ...data,
        category_breakdowns: data.category_breakdowns ?? [],
        spend_slices: data.spend_slices ?? [],
      } as MonthlySummary;
    },
    enabled: !!user && !!month,
  });
}

