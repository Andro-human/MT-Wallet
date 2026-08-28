import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

const KEY = 'subscription-proposals';

/** A recurring cost the nightly discovery run found in your history and you do
 *  not yet track. Every figure here was computed server-side from the named
 *  transactions; the agent chose only which rows belong together. */
export interface SubscriptionProposal {
  id: string;
  label: string;
  cadence: 'weekly' | 'monthly' | 'quarterly' | 'annual' | 'irregular';
  median_amount: number;
  amount_min: number;
  amount_max: number;
  monthly_normalized: number;
  occurrences: number;
  first_seen: string;
  last_seen: string;
  predicted_next: string | null;
  confidence: number;
  rationale: string | null;
  transaction_ids: string[];
}

export function useSubscriptionProposals() {
  const { user } = useAuth();
  return useQuery({
    queryKey: [KEY, user?.id],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('subscription_proposals')
        .select(
          'id, label, cadence, median_amount, amount_min, amount_max, monthly_normalized, occurrences, first_seen, last_seen, predicted_next, confidence, rationale, transaction_ids',
        )
        .eq('user_id', user!.id)
        .eq('status', 'pending')
        .order('monthly_normalized', { ascending: false });
      if (error) throw error;
      return (data ?? []).map((p: any) => ({
        ...p,
        median_amount: Number(p.median_amount),
        amount_min: Number(p.amount_min),
        amount_max: Number(p.amount_max),
        monthly_normalized: Number(p.monthly_normalized),
        confidence: Number(p.confidence),
      })) as SubscriptionProposal[];
    },
    enabled: !!user,
  });
}

/** Dismissal is kept, not deleted: the discovery run reads dismissed labels as a
 *  do-not-propose list, so forgetting one means being offered it every week. */
export function useDismissProposal() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any)
        .from('subscription_proposals')
        .update({ status: 'dismissed' })
        .eq('id', id)
        .eq('user_id', user!.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  });
}

/** Accepting links the exact transactions the proposal names. Seeding a merchant
 *  string and re-matching would reintroduce the spelling problem the agent just
 *  solved — "policy bazar" and "policybazzar" are one service only because
 *  something looked at the rows, not the text. */
export function useAcceptProposal() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (p: SubscriptionProposal) => {
      const { data: txns, error: txnErr } = await (supabase as any)
        .from('transactions')
        .select('id, amount, transacted_at, merchant')
        .eq('user_id', user!.id)
        .in('id', p.transaction_ids);
      if (txnErr) throw txnErr;
      if (!txns?.length) throw new Error('The transactions behind this proposal are gone');

      const { data: sub, error } = await (supabase as any)
        .from('subscriptions')
        .insert({
          user_id: user!.id,
          label: p.label,
          match_merchant: null,
          match_note: null,
          cadence: p.cadence,
          predicted_next: p.predicted_next,
          median_amount: p.median_amount,
          amount_min: p.amount_min,
          amount_max: p.amount_max,
          last_amount: Number(
            [...txns].sort((a: any, b: any) => (a.transacted_at < b.transacted_at ? 1 : -1))[0]
              .amount,
          ),
          confidence: p.confidence,
          status: 'active',
          source: 'detected',
        })
        .select('id')
        .single();
      if (error) throw error;

      const { error: linkErr } = await (supabase as any)
        .from('subscription_transactions')
        .upsert(
          txns.map((t: any) => ({
            subscription_id: sub.id,
            transaction_id: t.id,
            user_id: user!.id,
            amount: Number(t.amount),
            transacted_at: t.transacted_at,
            linked_by: 'manual',
          })),
          { onConflict: 'transaction_id' },
        );
      if (linkErr) throw linkErr;

      const { error: delErr } = await (supabase as any)
        .from('subscription_proposals')
        .delete()
        .eq('id', p.id)
        .eq('user_id', user!.id);
      if (delErr) throw delErr;

      return sub.id as string;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [KEY] });
      qc.invalidateQueries({ queryKey: ['subscriptions'] });
    },
  });
}
