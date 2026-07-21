import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { format } from 'date-fns';
import { Plus, X, Repeat, ChevronRight, Sparkles } from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { useSubscriptions, subscriptionMonthly, type Subscription } from '@/hooks/useSubscriptions';
import { useDetectedSubscriptions } from '@/hooks/useDetectedSubscriptions';
import { useSubscriptionOverrides, useSetSubscriptionOverride } from '@/hooks/useSubscriptionOverrides';
import { CreateSubscriptionDialog, type CreateSeed } from '@/components/subscriptions/CreateSubscriptionDialog';
import { formatINR, formatINRCompact } from '@/lib/formatCurrency';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

function isSnoozeActive(until: string | null): boolean {
  return !!until && new Date(until) > new Date();
}

function normalize(s: string | null | undefined): string {
  return (s ?? '').toLowerCase().trim();
}

function isOverdue(s: Subscription): boolean {
  if (!s.predicted_next) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return new Date(s.predicted_next) < today;
}

export default function SubscriptionsPage() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { data: subs = [], isLoading } = useSubscriptions();
  const { detected } = useDetectedSubscriptions();
  const { data: overrides } = useSubscriptionOverrides();
  const setOverride = useSetSubscriptionOverride();
  const [createOpen, setCreateOpen] = useState(false);
  const [seed, setSeed] = useState<CreateSeed | undefined>(undefined);

  const active = useMemo(() => subs.filter((s) => s.status === 'active'), [subs]);
  const committed = useMemo(
    () => active.reduce((sum, s) => sum + subscriptionMonthly(s), 0),
    [active],
  );

  const trackedKeys = useMemo(() => {
    const keys = new Set<string>();
    for (const s of subs) {
      keys.add(normalize(s.label));
      if (s.match_note) keys.add(normalize(s.match_note));
      if (s.identity) keys.add(normalize(s.identity));
    }
    return keys;
  }, [subs]);

  const suggestions = useMemo(() => {
    return detected.filter((d) => {
      if (d.cadence === 'irregular') return false;
      if (d.band !== 'high' && d.band !== 'medium') return false;
      if (d.state !== 'active') return false;
      const ov = overrides?.get(d.clusterKey);
      if (ov?.status === 'confirmed' || ov?.status === 'ignored') return false;
      if (ov?.status === 'snoozed' && isSnoozeActive(ov.snoozed_until)) return false;
      const label = normalize(d.label);
      const key = normalize(d.clusterKey);
      if (trackedKeys.has(label) || trackedKeys.has(key)) return false;
      return true;
    });
  }, [detected, overrides, trackedKeys]);

  const openCreate = (s?: CreateSeed) => {
    setSeed(s);
    setCreateOpen(true);
  };

  const dismiss = async (clusterKey: string) => {
    try {
      await setOverride.mutateAsync({ clusterKey, status: 'ignored', snoozedUntil: null });
    } catch {
      toast({ title: 'Failed to dismiss', variant: 'destructive' });
    }
  };

  return (
    <AppLayout>
      <div className="sticky top-0 z-10 backdrop-blur-xl bg-background/80 border-b border-border/30 safe-area-top">
        <div className="flex items-center justify-between px-5 py-3 gap-3">
          <h1 className="text-lg font-semibold flex items-center gap-2">
            <Repeat className="w-4 h-4" /> Subscriptions
          </h1>
          {committed > 0 && (
            <span className="font-mono text-sm">
              ~{formatINRCompact(committed)}<span className="text-muted-foreground">/mo</span>
            </span>
          )}
        </div>
      </div>

      <div className="px-4 pb-28 pt-5 max-w-lg mx-auto">
        {suggestions.length > 0 && (
          <div className="mb-6">
            <div className="flex items-center gap-2 mb-3 px-1">
              <Sparkles className="w-4 h-4 text-primary" />
              <h2 className="text-xs font-mono uppercase tracking-wider text-muted-foreground">
                Detected from your spending
              </h2>
              <span className="text-xs text-muted-foreground/60">({suggestions.length})</span>
            </div>
            <div className="space-y-3">
              <AnimatePresence mode="popLayout">
                {suggestions.map((d) => (
                  <motion.div
                    key={d.clusterKey}
                    layout
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, x: -60 }}
                    className="neo-card p-4 rounded-xl border border-dashed border-border/60"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="font-bold truncate">{d.label}</div>
                        <div className="text-xs text-muted-foreground mt-0.5">
                          {formatINR(d.amount)} · {d.cadence} · next ~{format(new Date(`${d.nextExpected}T12:00:00`), 'MMM d')}
                        </div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          onClick={() => openCreate({ label: d.label, note: d.clusterKey, merchant: d.clusterKey })}
                          className="flex items-center gap-1 px-3 h-9 rounded-lg bg-primary text-primary-foreground text-xs font-medium"
                        >
                          <Plus className="w-3.5 h-3.5" /> Add
                        </button>
                        <button
                          onClick={() => dismiss(d.clusterKey)}
                          aria-label="Dismiss"
                          className="h-9 w-9 grid place-items-center rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          </div>
        )}

        {isLoading ? (
          <div className="space-y-3">
            <div className="neo-card h-20 rounded-xl bg-muted/10" />
            <div className="neo-card h-20 rounded-xl bg-muted/10" />
          </div>
        ) : active.length === 0 && suggestions.length === 0 ? (
          <div className="text-center py-16">
            <Repeat className="w-10 h-10 mx-auto mb-4 text-muted-foreground/30" />
            <p className="font-medium">No subscriptions yet</p>
            <p className="text-sm text-muted-foreground mt-1 max-w-xs mx-auto">
              Create one from a note or merchant, and we'll keep matching new transactions to it as you spend.
            </p>
            <button
              onClick={() => openCreate(undefined)}
              className="mt-5 inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium"
            >
              <Plus className="w-4 h-4" /> New subscription
            </button>
          </div>
        ) : (
          active.length > 0 && (
            <>
              <div className="flex items-center gap-2 mb-3 px-1">
                <span className="text-primary text-xs">●</span>
                <h2 className="text-xs font-mono uppercase tracking-wider text-muted-foreground">Active</h2>
                <span className="text-xs text-muted-foreground/60">({active.length})</span>
              </div>
              <div className="space-y-3">
                {active.map((s) => {
                  const overdue = isOverdue(s);
                  const variable = s.amount_min != null && s.amount_max != null && s.amount_min !== s.amount_max;
                  return (
                    <button
                      key={s.id}
                      onClick={() => navigate(`/subscriptions/${s.id}`)}
                      className="w-full text-left neo-card p-4 rounded-xl"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-bold truncate">{s.label}</span>
                            {s.cadence && (
                              <span className="text-[9px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded-full border border-border text-muted-foreground">
                                {s.cadence}
                              </span>
                            )}
                            {overdue && (
                              <span className="text-[9px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded-full border border-orange-500/40 text-orange-500">
                                overdue
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-muted-foreground mt-1">
                            {s.predicted_next && <>next ~{format(new Date(`${s.predicted_next}T12:00:00`), 'MMM d')}</>}
                            {variable && (
                              <span className="font-mono"> · {formatINRCompact(s.amount_min!)}–{formatINRCompact(s.amount_max!)}</span>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <span className="font-mono text-sm font-medium">{formatINR(s.median_amount ?? 0)}</span>
                          <ChevronRight className="w-4 h-4 text-muted-foreground" />
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </>
          )
        )}
      </div>

      <motion.button
        className="fixed bottom-24 right-6 z-50 w-14 h-14 rounded-full bg-primary text-primary-foreground shadow-xl flex items-center justify-center"
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => openCreate(undefined)}
        aria-label="New subscription"
      >
        <Plus className="w-6 h-6" />
      </motion.button>

      <CreateSubscriptionDialog open={createOpen} onOpenChange={setCreateOpen} seed={seed} />
    </AppLayout>
  );
}
