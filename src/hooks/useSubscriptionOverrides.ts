import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

export interface SubscriptionOverride {
  cluster_key: string;
  status: 'confirmed' | 'ignored' | 'snoozed';
  snoozed_until: string | null;
}

const KEY = 'subscription-overrides';

export function useSubscriptionOverrides() {
  const { user } = useAuth();
  return useQuery({
    queryKey: [KEY, user?.id],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('subscription_overrides')
        .select('cluster_key, status, snoozed_until')
        .eq('user_id', user!.id);
      if (error) throw error;
      const map = new Map<string, SubscriptionOverride>();
      for (const row of (data ?? []) as SubscriptionOverride[]) map.set(row.cluster_key, row);
      return map;
    },
    enabled: !!user,
    staleTime: 30_000,
  });
}

export function useSetSubscriptionOverride() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      clusterKey: string;
      status: SubscriptionOverride['status'] | null;
      snoozedUntil?: string | null;
    }) => {
      if (input.status === null) {
        const { error } = await (supabase as any)
          .from('subscription_overrides')
          .delete()
          .eq('user_id', user!.id)
          .eq('cluster_key', input.clusterKey);
        if (error) throw error;
        return;
      }
      const { error } = await (supabase as any).from('subscription_overrides').upsert(
        {
          user_id: user!.id,
          cluster_key: input.clusterKey,
          status: input.status,
          snoozed_until: input.snoozedUntil ?? null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id,cluster_key' },
      );
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [KEY] });
    },
  });
}
