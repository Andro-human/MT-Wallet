import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { useProfile } from './useProfile';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL;
const KEY = 'monthly-summary';

export interface MonthlySummary {
  month: string;
  summary: string;
  highlights: string[];
  generated_at: string;
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
        .select('month, summary, highlights, generated_at')
        .eq('user_id', user!.id)
        .eq('month', month)
        .maybeSingle();
      if (error) throw error;
      return (data as MonthlySummary | null) ?? null;
    },
    enabled: !!user && !!month,
  });
}

export function useGenerateMonthlySummary() {
  const { data: profile } = useProfile();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (aggregates: MonthlyAggregates) => {
      if (!BACKEND_URL) throw new Error('VITE_BACKEND_URL is not configured');
      if (!profile?.api_key) throw new Error('No API key on profile');
      const res = await fetch(`${BACKEND_URL}/api/insights/monthly-summary`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': profile.api_key },
        body: JSON.stringify({ aggregates }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.success) {
        throw new Error(json.error || `Summary request failed (${res.status})`);
      }
      return json as { summary: string; highlights: string[] };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [KEY] });
    },
  });
}
