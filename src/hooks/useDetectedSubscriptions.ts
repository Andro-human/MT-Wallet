import { useMemo } from 'react';
import { useTransactions } from '@/hooks/useTransactions';
import { useFinanceContext } from '@/hooks/useFinanceData';
import { useEnrichmentMap } from '@/hooks/useTxnEnrichment';
import { detectSubscriptions, type DetectedSubscription } from '@/lib/subscriptionDetect';

// The payment rail hides the payee: insurance billed through Amazon Pay,
// YouTube through assorted UPI handles. service_identity names the service
// rather than the rail, so it is the cluster key whenever enrichment found one,
// with raw note text as the fallback.

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
        const identity = enrichmentMap?.get(t.id)?.service_identity?.trim();
        const merchant = identity || t.merchant;
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
