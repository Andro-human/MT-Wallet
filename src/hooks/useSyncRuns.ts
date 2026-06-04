import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

export interface SyncRunMessage {
  id: number;
  sender: string;
  body: string;
  timestamp: string | null;
  /** Email subject. Present for email-source messages, absent for SMS. */
  subject?: string;
}

export interface SyncRunDetail {
  sms_id: number;
  status: 'inserted' | 'skipped' | 'error';
  ai_model?: string;
  reason?: string;
  transaction?: {
    amount: number;
    direction: 'credit' | 'debit';
    merchant: string | null;
    category: string | null;
  };
}

export type SyncRunUsage = Record<string, { input: number; output: number }>;

export interface SyncRun {
  id: string;
  user_id: string;
  started_at: string;
  completed_at: string | null;
  duration_ms: number | null;
  status: 'success' | 'partial' | 'failed' | 'no_messages';
  total_messages: number;
  inserted: number;
  skipped: number;
  errors: number;
  messages: SyncRunMessage[] | null;
  details: SyncRunDetail[] | null;
  error_message: string | null;
  source: string;
  rowid_range: { from: number; to: number } | null;
  usage: SyncRunUsage | null;
  created_at: string;
}

export function useSyncRuns() {
  const { user } = useAuth();
  const PAGE_SIZE = 50;

  return useInfiniteQuery({
    queryKey: ['sync-runs', user?.id],
    queryFn: async ({ pageParam = 0 }) => {
      const start = pageParam * PAGE_SIZE;
      const end = start + PAGE_SIZE - 1;

      const { data, error } = await (supabase as any)
        .from('sync_runs')
        .select('id, started_at, completed_at, duration_ms, status, total_messages, inserted, skipped, errors, error_message, source, rowid_range, created_at')
        .order('started_at', { ascending: false })
        .range(start, end);

      if (error) throw error;
      
      let totalCount: number | null = null;
      let successCount: number | null = null;
      
      // Only fetch the global totals on the first page load
      if (pageParam === 0 && user?.id) {
        const { count: total, error: countErr } = await (supabase as any)
          .from('sync_runs')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', user.id);
          
        const { count: success, error: successErr } = await (supabase as any)
          .from('sync_runs')
          .select('*', { count: 'exact', head: true })
          .eq('status', 'success')
          .eq('user_id', user.id);
          
        if (!countErr && total !== null) totalCount = total;
        if (!successErr && success !== null) successCount = success;
      }
      
      const runs = (data || []) as SyncRun[];
      return {
        runs,
        totalCount,
        successCount,
        nextCursor: runs.length === PAGE_SIZE ? pageParam + 1 : undefined,
      };
    },
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    initialPageParam: 0,
    enabled: !!user,
  });
}

export function useSyncRun(id: string | undefined) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['sync-run', id],
    queryFn: async () => {
      if (!id) throw new Error('No run ID');

      const { data, error } = await (supabase as any)
        .from('sync_runs')
        .select('*')
        .eq('id', id)
        .single();

      if (error) throw error;
      return data as SyncRun;
    },
    enabled: !!user && !!id,
  });
}
