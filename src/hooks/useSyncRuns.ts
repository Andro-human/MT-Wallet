import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

export interface SyncRunMessage {
  id: number;
  sender: string;
  body: string;
  timestamp: string | null;
}

export interface SyncRunDetail {
  sms_id: number;
  status: 'inserted' | 'skipped' | 'error';
  reason?: string;
  transaction?: {
    amount: number;
    direction: 'credit' | 'debit';
    merchant: string | null;
    category: string | null;
  };
}

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
  created_at: string;
}

export function useSyncRuns() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['sync-runs', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('sync_runs')
        .select('id, started_at, completed_at, duration_ms, status, total_messages, inserted, skipped, errors, error_message, source, rowid_range, created_at')
        .order('started_at', { ascending: false })
        .limit(100);

      if (error) throw error;
      return (data || []) as SyncRun[];
    },
    enabled: !!user,
  });
}

export function useSyncRun(id: string | undefined) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['sync-run', id],
    queryFn: async () => {
      if (!id) throw new Error('No run ID');

      const { data, error } = await supabase
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
