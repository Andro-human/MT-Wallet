import { useMemo } from 'react';
import { useTransactions } from '@/hooks/useTransactions';
import { useFinanceContext } from '@/hooks/useFinanceData';
import { useEnrichmentMap } from '@/hooks/useTxnEnrichment';
import { detectSubscriptions, type DetectedSubscription } from '@/lib/subscriptionDetect';

// For these enrichment labels the payment rail hides the payee (insurance paid
// via Amazon Pay, YouTube via assorted UPI handles), so the note is the real
// identity — cluster by it instead of the merchant.
export const NOTE_CLUSTERED_LABELS = new Set(['insurance', 'subscriptions', 'dating-apps', 'cloud-and-api']);

export function noteClusterKey(notes: string | null): string | null {
  const cleaned = (notes ?? '')
    .toLowerCase()
    .replace(/^#\w+\s*\|\s*/, '')
    .trim();
  return cleaned || null;
}

/**
 * Detection runs over FULL history (not any selected range) — cadence needs
 * every occurrence — minus duplicate-marked txns.
 */
export function useDetectedSubscriptions() {
  const { data: allTxns = [], isLoading } = useTransactions({});
  const { duplicateExcludeIds } = useFinanceContext();
  const { data: enrichmentMap } = useEnrichmentMap();

  const detected = useMemo(() => {
    if (allTxns.length === 0) return [] as DetectedSubscription[];
    return detectSubscriptions(
      allTxns.map((t) => {
        const label = enrichmentMap?.get(t.id)?.item_label;
        const clusterByNote = label && NOTE_CLUSTERED_LABELS.has(label);
        const merchant = clusterByNote
          ? (noteClusterKey((t as any).notes) ?? t.merchant)
          : t.merchant;
        return {
          id: t.id,
          merchant,
          amount: Number(t.amount),
          transacted_at: t.transacted_at,
          direction: (t as any).direction === 'credit' ? ('credit' as const) : ('debit' as const),
          category_slug: t.categories?.slug ?? null,
        };
      }),
      { excludeIds: duplicateExcludeIds },
    );
  }, [allTxns, duplicateExcludeIds, enrichmentMap]);

  return { detected, isLoading };
}
