import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import {
  summarizeOccurrences,
  monthlyNormalized as monthlyNorm,
  type Cadence,
  type Occurrence,
} from '@/lib/subscriptionCompute';
import { scoreMatch, bandFor } from '@/lib/subscriptionMatch';

export interface Subscription {
  id: string;
  user_id: string;
  label: string;
  match_note: string | null;
  match_merchant: string | null;
  identity: string | null;
  cadence: Cadence | null;
  predicted_next: string | null;
  median_amount: number | null;
  amount_min: number | null;
  amount_max: number | null;
  last_amount: number | null;
  status: 'active' | 'paused' | 'cancelled';
  confidence: number | null;
  source: 'detected' | 'manual';
  created_at: string;
  updated_at: string;
}

export interface LinkedTxn {
  transaction_id: string;
  amount: number;
  transacted_at: string;
  linked_by: 'auto' | 'manual';
  merchant: string | null;
  notes: string | null;
}

const KEY = 'subscriptions';

export function subscriptionMonthly(s: Subscription): number {
  return monthlyNorm(s.median_amount, (s.cadence ?? 'irregular') as Cadence, null);
}

export function useSubscriptions() {
  const { user } = useAuth();
  return useQuery({
    queryKey: [KEY, user?.id],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('subscriptions')
        .select('*')
        .eq('user_id', user!.id)
        .order('status', { ascending: true })
        .order('updated_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as Subscription[];
    },
    enabled: !!user,
    staleTime: 30_000,
  });
}

export function useSubscriptionTransactions(subscriptionId: string | undefined) {
  const { user } = useAuth();
  return useQuery({
    queryKey: [KEY, 'txns', subscriptionId],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('subscription_transactions')
        .select('transaction_id, amount, transacted_at, linked_by, transactions(merchant, notes)')
        .eq('subscription_id', subscriptionId!)
        .order('transacted_at', { ascending: false });
      if (error) throw error;
      return ((data ?? []) as any[]).map((r) => ({
        transaction_id: r.transaction_id,
        amount: Number(r.amount),
        transacted_at: r.transacted_at,
        linked_by: r.linked_by,
        merchant: r.transactions?.merchant ?? null,
        notes: r.transactions?.notes ?? null,
      })) as LinkedTxn[];
    },
    enabled: !!user && !!subscriptionId,
  });
}

export async function recomputeSubscription(subscriptionId: string) {
  const { data, error } = await (supabase as any)
    .from('subscription_transactions')
    .select('amount, transacted_at')
    .eq('subscription_id', subscriptionId);
  if (error) throw error;
  const occ = ((data ?? []) as Occurrence[]).map((o) => ({ amount: Number(o.amount), transacted_at: o.transacted_at }));
  const s = summarizeOccurrences(occ);
  const { error: upErr } = await (supabase as any)
    .from('subscriptions')
    .update({
      cadence: s.cadence,
      predicted_next: s.predictedNext,
      median_amount: s.medianAmount,
      amount_min: s.amountMin,
      amount_max: s.amountMax,
      last_amount: s.lastAmount,
      confidence: s.confidence,
      updated_at: new Date().toISOString(),
    })
    .eq('id', subscriptionId);
  if (upErr) throw upErr;
}

export interface CreateSubscriptionInput {
  label: string;
  matchNote: string | null;
  matchMerchant: string | null;
  identity?: string | null;
  transactions: { id: string; amount: number; transacted_at: string }[];
}

export function useCreateSubscription() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateSubscriptionInput) => {
      const summary = summarizeOccurrences(
        input.transactions.map((t) => ({ amount: t.amount, transacted_at: t.transacted_at })),
      );
      const { data: sub, error } = await (supabase as any)
        .from('subscriptions')
        .insert({
          user_id: user!.id,
          label: input.label,
          match_note: input.matchNote,
          match_merchant: input.matchMerchant,
          identity: input.identity ?? null,
          cadence: summary.cadence,
          predicted_next: summary.predictedNext,
          median_amount: summary.medianAmount,
          amount_min: summary.amountMin,
          amount_max: summary.amountMax,
          last_amount: summary.lastAmount,
          confidence: summary.confidence,
          status: 'active',
          source: 'manual',
        })
        .select('id')
        .single();
      if (error) throw error;
      if (input.transactions.length > 0) {
        const rows = input.transactions.map((t) => ({
          subscription_id: sub.id,
          transaction_id: t.id,
          user_id: user!.id,
          amount: t.amount,
          transacted_at: t.transacted_at,
          linked_by: 'manual',
        }));
        const { error: linkErr } = await (supabase as any)
          .from('subscription_transactions')
          .upsert(rows, { onConflict: 'transaction_id' });
        if (linkErr) throw linkErr;
      }
      return sub.id as string;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  });
}

// All transaction_ids already linked to any of the user's subscriptions — used to
// keep the manual "add transaction" picker from offering (and silently stealing) a
// transaction that already belongs to another subscription.
export function useLinkedTransactionIds() {
  const { user } = useAuth();
  return useQuery({
    queryKey: [KEY, 'linked-ids', user?.id],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('subscription_transactions')
        .select('transaction_id')
        .eq('user_id', user!.id);
      if (error) throw error;
      return new Set<string>((data ?? []).map((r: any) => r.transaction_id));
    },
    enabled: !!user,
    staleTime: 30_000,
  });
}

export function useLinkTransaction() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      subscriptionId,
      txn,
    }: {
      subscriptionId: string;
      txn: { id: string; amount: number; transacted_at: string };
    }) => {
      const { error } = await (supabase as any).from('subscription_transactions').upsert(
        {
          subscription_id: subscriptionId,
          transaction_id: txn.id,
          user_id: user!.id,
          amount: txn.amount,
          transacted_at: txn.transacted_at,
          linked_by: 'manual',
        },
        { onConflict: 'transaction_id' },
      );
      if (error) throw error;
      await recomputeSubscription(subscriptionId);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  });
}

export function useLinkTransactions() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      subscriptionId,
      txns,
    }: {
      subscriptionId: string;
      txns: { id: string; amount: number; transacted_at: string }[];
    }) => {
      if (txns.length === 0) return;
      const rows = txns.map((t) => ({
        subscription_id: subscriptionId,
        transaction_id: t.id,
        user_id: user!.id,
        amount: t.amount,
        transacted_at: t.transacted_at,
        linked_by: 'manual',
      }));
      const { error } = await (supabase as any)
        .from('subscription_transactions')
        .upsert(rows, { onConflict: 'transaction_id' });
      if (error) throw error;
      await recomputeSubscription(subscriptionId);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  });
}

export function useUnlinkTransaction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ subscriptionId, transactionId }: { subscriptionId: string; transactionId: string }) => {
      const { error } = await (supabase as any)
        .from('subscription_transactions')
        .delete()
        .eq('subscription_id', subscriptionId)
        .eq('transaction_id', transactionId);
      if (error) throw error;
      await recomputeSubscription(subscriptionId);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  });
}

// Auto-satisfy: when a transaction's note is set/edited, try to match it to an active
// subscription (deterministic note + merchant, no AI) and link it if the match is HIGH
// confidence. Only links a transaction not already linked. Returns the matched label.
export function useAutoLinkSubscription() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (txn: {
      id: string;
      merchant: string | null;
      notes: string | null;
      amount: number;
      transacted_at: string;
      serviceIdentity?: string | null;
    }) => {
      if (!txn.notes && !txn.merchant) return null;
      const { data: existing } = await (supabase as any)
        .from('subscription_transactions')
        .select('subscription_id')
        .eq('transaction_id', txn.id)
        .maybeSingle();
      if (existing) return null;

      const { data: subs, error } = await (supabase as any)
        .from('subscriptions')
        .select('*')
        .eq('user_id', user!.id)
        .eq('status', 'active');
      if (error) throw error;

      let best: Subscription | null = null;
      let bestScore = 0;
      for (const s of (subs ?? []) as Subscription[]) {
        const score = scoreMatch(
          { id: txn.id, merchant: txn.merchant, notes: txn.notes, amount: txn.amount, serviceIdentity: txn.serviceIdentity ?? null },
          { matchNote: s.match_note, matchMerchant: s.match_merchant, identity: s.identity, medianAmount: s.median_amount },
        );
        if (score > bestScore) {
          bestScore = score;
          best = s;
        }
      }
      if (!best || bandFor(bestScore) !== 'high') return null;

      const { error: linkErr } = await (supabase as any).from('subscription_transactions').upsert(
        {
          subscription_id: best.id,
          transaction_id: txn.id,
          user_id: user!.id,
          amount: txn.amount,
          transacted_at: txn.transacted_at,
          linked_by: 'auto',
        },
        { onConflict: 'transaction_id' },
      );
      if (linkErr) throw linkErr;
      await recomputeSubscription(best.id);
      return { subscriptionLabel: best.label };
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  });
}

export function useSetSubscriptionStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: Subscription['status'] }) => {
      const { error } = await (supabase as any)
        .from('subscriptions')
        .update({ status, updated_at: new Date().toISOString() })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  });
}

export function useDeleteSubscription() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any).from('subscriptions').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  });
}
