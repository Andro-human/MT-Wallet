import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useProfile } from './useProfile';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL;

export interface ExtractedPreview {
  amount: number | null;
  currency: string | null;
  direction: 'credit' | 'debit' | null;
  merchant: string | null;
  account_last4: string | null;
  bank_name: string | null;
  reference_id: string | null;
  category_slug: string | null;
}

export interface ManualFields {
  amount: number;
  direction: 'credit' | 'debit';
  merchant?: string | null;
  account_last4?: string | null;
  bank_name?: string | null;
  category_slug?: string | null;
  transacted_at?: string;
  notes?: string | null;
  group_id?: string | null;
  is_expense?: boolean;
  is_income?: boolean;
}

interface PreviewResponse {
  success: true;
  committed: false;
  preview: ExtractedPreview;
  ai_model: string | null;
  extract_error?: string;
}

interface CommitResponse {
  success: true;
  committed: true;
}

async function callBackend<T>(
  path: string,
  apiKey: string,
  body?: unknown
): Promise<T> {
  if (!BACKEND_URL) {
    throw new Error('VITE_BACKEND_URL is not configured');
  }
  const res = await fetch(`${BACKEND_URL}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || !json.success) {
    throw new Error(json.error || `Backend request failed (${res.status})`);
  }
  return json as T;
}

/**
 * Two-step mark-as-transaction:
 *   - call with no fields  -> backend returns AI-extracted preview
 *   - call with fields     -> backend commits override + inserts transaction
 */
export function useMarkAsTransaction(runId: string | undefined) {
  const queryClient = useQueryClient();
  const { data: profile } = useProfile();

  return useMutation({
    mutationFn: async (args: { smsId: number; fields?: ManualFields }) => {
      const apiKey = profile?.api_key;
      if (!apiKey) throw new Error('Missing API key — set one in Settings.');
      if (!runId) throw new Error('Missing sync-run id');

      const path = `/api/sync-runs/${runId}/messages/${args.smsId}/mark-transaction`;
      if (!args.fields) {
        return callBackend<PreviewResponse>(path, apiKey);
      }
      return callBackend<CommitResponse>(path, apiKey, args.fields);
    },
    onSuccess: (data) => {
      // Only invalidate on commit; preview shouldn't refresh anything.
      if ('committed' in data && data.committed) {
        queryClient.invalidateQueries({ queryKey: ['sync-run', runId] });
        queryClient.invalidateQueries({ queryKey: ['sync-runs'] });
        queryClient.invalidateQueries({ queryKey: ['transactions'] });
      }
    },
  });
}

export function useMarkAsNotTransaction(runId: string | undefined) {
  const queryClient = useQueryClient();
  const { data: profile } = useProfile();

  return useMutation({
    mutationFn: async (smsId: number) => {
      const apiKey = profile?.api_key;
      if (!apiKey) throw new Error('Missing API key — set one in Settings.');
      if (!runId) throw new Error('Missing sync-run id');

      return callBackend<CommitResponse>(
        `/api/sync-runs/${runId}/messages/${smsId}/mark-not-transaction`,
        apiKey,
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sync-run', runId] });
      queryClient.invalidateQueries({ queryKey: ['sync-runs'] });
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
    },
  });
}
