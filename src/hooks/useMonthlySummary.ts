import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { useProfile } from './useProfile';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL;
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
}

export interface MonthlySummary {
  month: string;
  summary: string;
  highlights: string[];
  category_breakdowns: CategoryBreakdown[];
  spend_slices: SpendSlice[];
  generated_at: string;
}

// Per-category transactions sent for grouping. Amounts are refund-netted by
// transactionMath; `n` is a month-unique ordinal so the AI never echoes a UUID.
export interface MonthlyCategoryInput {
  category: string;
  name: string;
  total: number;
  items: { n: number; merchant: string | null; note: string | null; amount: number }[];
}

/** Aggregates are computed client-side by transactionMath-owned code; the
 *  backend only turns them into prose. */
export interface MonthlyAggregates {
  month: string;
  total_spent: number;
  total_income: number;
  allocations: { name: string; amount: number; type: 'group' | 'category' }[];
  top_sub_themes: { context: string; label: string; amount: number }[];
  recurring_monthly_committed: number | null;
  loans_outstanding: number | null;
}

export function useMonthlySummary(month: string | null) {
  const { user } = useAuth();
  return useQuery({
    queryKey: [KEY, user?.id, month],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('monthly_summaries')
        .select('month, summary, highlights, category_breakdowns, spend_slices, generated_at')
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

export function useGenerateMonthlySummary() {
  const { data: profile } = useProfile();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: { aggregates: MonthlyAggregates; categories: MonthlyCategoryInput[] }) => {
      if (!BACKEND_URL) throw new Error('VITE_BACKEND_URL is not configured');
      if (!profile?.api_key) throw new Error('No API key on profile');
      const res = await fetch(`${BACKEND_URL}/api/insights/monthly-summary`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': profile.api_key },
        body: JSON.stringify(payload),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.success) {
        throw new Error(json.error || `Summary request failed (${res.status})`);
      }
      return json as { summary: string; highlights: string[]; category_breakdowns: CategoryBreakdown[] };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [KEY] });
    },
  });
}
