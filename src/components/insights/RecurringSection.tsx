import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { format } from 'date-fns';
import { Check, Clock, X, RotateCcw, Repeat } from 'lucide-react';
import { useTransactions } from '@/hooks/useTransactions';
import { useFinanceContext } from '@/hooks/useFinanceData';
import { useSubscriptionOverrides, useSetSubscriptionOverride } from '@/hooks/useSubscriptionOverrides';
import { detectSubscriptions, type DetectedSubscription } from '@/lib/subscriptionDetect';
import { formatINR, formatINRCompact } from '@/lib/formatCurrency';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';

/**
 * Detection runs over FULL history (not the page's selected range) — cadence
 * needs every occurrence — minus duplicate-marked txns.
 */
export function useDetectedSubscriptions() {
  const { data: allTxns = [], isLoading } = useTransactions({});
  const { duplicateExcludeIds } = useFinanceContext();

  const detected = useMemo(() => {
    if (allTxns.length === 0) return [] as DetectedSubscription[];
    return detectSubscriptions(
      allTxns.map((t) => ({
        id: t.id,
        merchant: t.merchant,
        amount: Number(t.amount),
        transacted_at: t.transacted_at,
        direction: (t as any).direction === 'credit' ? 'credit' as const : 'debit' as const,
        category_slug: t.categories?.slug ?? null,
      })),
      { excludeIds: duplicateExcludeIds },
    );
  }, [allTxns, duplicateExcludeIds]);

  return { detected, isLoading };
}

function isSnoozeActive(snoozedUntil: string | null): boolean {
  return !!snoozedUntil && new Date(snoozedUntil) > new Date();
}

export function RecurringSection() {
  const { toast } = useToast();
  const { detected, isLoading } = useDetectedSubscriptions();
  const { data: overrides } = useSubscriptionOverrides();
  const setOverride = useSetSubscriptionOverride();
  const [showHidden, setShowHidden] = useState(false);

  const { visible, hidden, committedMonthly } = useMemo(() => {
    const visible: DetectedSubscription[] = [];
    const hidden: DetectedSubscription[] = [];
    for (const sub of detected) {
      const ov = overrides?.get(sub.clusterKey);
      const suppressed =
        ov?.status === 'ignored' || (ov?.status === 'snoozed' && isSnoozeActive(ov.snoozed_until));
      const confirmed = ov?.status === 'confirmed';
      if (suppressed) hidden.push(sub);
      else if (confirmed || sub.band === 'high' || sub.band === 'medium') visible.push(sub);
      else hidden.push(sub);
    }
    const committedMonthly = visible
      .filter((s) => s.state === 'active')
      .reduce((sum, s) => sum + s.monthlyNormalized, 0);
    return { visible, hidden, committedMonthly };
  }, [detected, overrides]);

  const act = async (
    sub: DetectedSubscription,
    status: 'confirmed' | 'ignored' | 'snoozed' | null,
  ) => {
    try {
      const snoozedUntil =
        status === 'snoozed' ? new Date(Date.now() + 30 * 86_400_000).toISOString() : null;
      await setOverride.mutateAsync({ clusterKey: sub.clusterKey, status, snoozedUntil });
      if (status === 'ignored') toast({ title: `${sub.label} hidden` });
      if (status === 'snoozed') toast({ title: `${sub.label} snoozed for 30 days` });
    } catch {
      toast({ title: 'Failed to update', variant: 'destructive' });
    }
  };

  if (isLoading || detected.length === 0) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.25 }}
      className="neo-card p-6 mb-6"
    >
      <div className="flex items-center justify-between mb-1 gap-3">
        <h3 className="font-heading font-bold text-foreground flex items-center gap-2">
          <Repeat className="w-4 h-4" /> Recurring
        </h3>
        <span className="font-mono text-sm text-foreground font-medium">
          ~{formatINRCompact(committedMonthly)}<span className="text-muted-foreground">/mo</span>
        </span>
      </div>
      <p className="text-xs text-muted-foreground mb-4">
        Detected from payment cadence. Committed monthly spend across active ones.
      </p>

      <div className="space-y-4">
        {visible.map((sub) => {
          const ov = overrides?.get(sub.clusterKey);
          const confirmed = ov?.status === 'confirmed';
          return (
            <div key={sub.clusterKey} className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2 text-sm">
                  <span className="font-bold text-foreground truncate">{sub.label}</span>
                  <span
                    className={cn(
                      'text-[9px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded-full border',
                      confirmed
                        ? 'border-primary/40 text-primary'
                        : sub.band === 'high'
                          ? 'border-border text-muted-foreground'
                          : 'border-border/50 text-muted-foreground/70',
                    )}
                  >
                    {confirmed ? 'confirmed' : sub.band}
                  </span>
                  {sub.state === 'possibly_cancelled' && (
                    <span className="text-[9px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded-full border border-orange-500/40 text-orange-500">
                      overdue
                    </span>
                  )}
                </div>
                <div className="text-xs text-muted-foreground mt-0.5">
                  {formatINR(sub.amount)} {sub.cadence}
                  {sub.isVariable && ` (${formatINRCompact(sub.amountMin)}–${formatINRCompact(sub.amountMax)})`}
                  {' · next ~'}
                  {format(new Date(sub.nextExpected), 'MMM d')}
                </div>
              </div>
              <div className="flex items-center gap-0.5 shrink-0">
                {confirmed ? (
                  <button
                    onClick={() => act(sub, null)}
                    aria-label="Undo confirm"
                    className="p-1.5 rounded-lg text-muted-foreground hover:bg-muted/30 transition-colors"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                  </button>
                ) : (
                  <button
                    onClick={() => act(sub, 'confirmed')}
                    aria-label="Confirm subscription"
                    className="p-1.5 rounded-lg text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
                  >
                    <Check className="w-3.5 h-3.5" />
                  </button>
                )}
                <button
                  onClick={() => act(sub, 'snoozed')}
                  aria-label="Snooze 30 days"
                  className="p-1.5 rounded-lg text-muted-foreground hover:bg-muted/30 transition-colors"
                >
                  <Clock className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => act(sub, 'ignored')}
                  aria-label="Ignore"
                  className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          );
        })}
        {visible.length === 0 && (
          <div className="text-sm text-muted-foreground">Nothing recurring detected yet.</div>
        )}
      </div>

      {hidden.length > 0 && (
        <button
          onClick={() => setShowHidden(!showHidden)}
          className="mt-4 text-xs font-mono uppercase tracking-wider text-muted-foreground hover:text-foreground transition-colors"
        >
          {showHidden ? 'Hide' : `Show ${hidden.length} low-confidence / hidden`}
        </button>
      )}
      {showHidden && (
        <div className="mt-3 space-y-2">
          {hidden.map((sub) => {
            const ov = overrides?.get(sub.clusterKey);
            return (
              <div key={sub.clusterKey} className="flex items-center justify-between text-xs text-muted-foreground">
                <span className="truncate">
                  {sub.label} · {formatINR(sub.amount)} {sub.cadence}
                  {ov?.status && ` · ${ov.status}`}
                </span>
                <span className="flex items-center gap-0.5 shrink-0">
                  {ov?.status ? (
                    <button
                      onClick={() => act(sub, null)}
                      aria-label="Restore"
                      className="p-1 rounded hover:bg-muted/30"
                    >
                      <RotateCcw className="w-3 h-3" />
                    </button>
                  ) : (
                    <button
                      onClick={() => act(sub, 'confirmed')}
                      aria-label="Confirm"
                      className="p-1 rounded hover:bg-muted/30"
                    >
                      <Check className="w-3 h-3" />
                    </button>
                  )}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </motion.div>
  );
}
