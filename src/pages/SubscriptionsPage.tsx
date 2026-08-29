import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { format } from 'date-fns';
import { Plus, X, Repeat, ChevronRight, Sparkles } from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { useSubscriptions, subscriptionMonthly, type Subscription } from '@/hooks/useSubscriptions';
import { useDetectedSubscriptions } from '@/hooks/useDetectedSubscriptions';
import {
  useSubscriptionProposals,
  useAcceptProposal,
  useDismissProposal,
  type SubscriptionProposal,
} from '@/hooks/useSubscriptionProposals';
import { useSubscriptionOverrides, useSetSubscriptionOverride } from '@/hooks/useSubscriptionOverrides';
import { CreateSubscriptionDialog, type CreateSeed } from '@/components/subscriptions/CreateSubscriptionDialog';
import { formatINR, formatINRCompact } from '@/lib/formatCurrency';
import { entityColor } from '@/lib/categoryColors';
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
  const { data: proposals = [] } = useSubscriptionProposals();
  const acceptProposal = useAcceptProposal();
  const dismissProposal = useDismissProposal();
  const [createOpen, setCreateOpen] = useState(false);
  const [seed, setSeed] = useState<CreateSeed | undefined>(undefined);

  const active = useMemo(() => subs.filter((s) => s.status === 'active'), [subs]);
  // monthlyNormalized() returns 0 for irregular cadence, so those rows carry no
  // share and must stay out of both the total and the bars.
  const committed = useMemo(
    () => active.reduce((sum, s) => sum + subscriptionMonthly(s), 0),
    [active],
  );
  const varying = useMemo(
    () => active.filter((s) => subscriptionMonthly(s) === 0).length,
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

  // The routine and the client-side detector can land on the same service. One
  // section, one entry per service — a second "we also found" block would be
  // the same finding wearing a different hat.
  const openProposals = useMemo(
    () =>
      proposals.filter(
        (p) => !trackedKeys.has(normalize(p.label)) && !suggestions.some((s) => normalize(s.label) === normalize(p.label)),
      ),
    [proposals, suggestions, trackedKeys],
  );

  const acceptProposalRow = async (p: SubscriptionProposal) => {
    try {
      await acceptProposal.mutateAsync(p);
      toast({ title: `${p.label} is now tracked`, description: `${p.occurrences} charges linked.` });
    } catch (e) {
      toast({ title: 'Could not add it', description: (e as Error).message, variant: 'destructive' });
    }
  };

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
      <div className="sticky top-0 z-10 backdrop-blur-xl bg-background/95 border-b border-border/30 safe-area-top">
        <div className="flex items-center justify-between px-5 py-3 gap-3 page-shell">
          <h1 className="text-lg font-semibold flex items-center gap-2">
            <Repeat className="w-4 h-4" /> Subscriptions
          </h1>
          {committed > 0 && (
            <span className="font-mono text-sm">
              ~{formatINRCompact(committed)}<span className="text-muted-foreground">/mo</span>
              {varying > 0 && (
                <span className="text-muted-foreground"> + {varying} varying</span>
              )}
            </span>
          )}
        </div>
      </div>

      <div className="px-4 pb-28 pt-5 page-shell">
        {suggestions.length + openProposals.length > 0 && (
          <div className="mb-6">
            <div className="flex items-center gap-2 mb-3 px-1">
              <Sparkles className="w-4 h-4 text-primary" />
              <h2 className="text-xs font-mono uppercase tracking-wider text-muted-foreground">
                Detected from your spending
              </h2>
              <span className="text-xs text-muted-foreground">
                ({suggestions.length + openProposals.length})
              </span>
            </div>
            <div className="space-y-3">
              <AnimatePresence mode="popLayout">
                {openProposals.map((p) => (
                  <motion.div
                    key={p.id}
                    layout
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, x: -60 }}
                    className="neo-card p-4 rounded-xl border border-dashed border-border/60"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="font-bold truncate">{p.label}</div>
                        <div className="text-xs text-muted-foreground mt-0.5 amount">
                          {formatINR(p.median_amount)} · {p.cadence} ·{' '}
                          {p.occurrences} charges since{' '}
                          {format(new Date(`${p.first_seen}T12:00:00`), 'MMM yyyy')}
                        </div>
                        {p.rationale && (
                          <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">
                            {p.rationale}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          onClick={() => acceptProposalRow(p)}
                          disabled={acceptProposal.isPending}
                          className="flex items-center gap-1 px-3 h-9 rounded-lg bg-primary text-primary-foreground text-xs font-medium disabled:opacity-50"
                        >
                          <Plus className="w-3.5 h-3.5" /> Add
                        </button>
                        <button
                          onClick={() => dismissProposal.mutate(p.id)}
                          aria-label="Dismiss"
                          className="h-9 w-9 grid place-items-center rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </motion.div>
                ))}
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
                        <div className="text-xs text-muted-foreground mt-0.5 amount">
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
        ) : active.length === 0 && suggestions.length === 0 && openProposals.length === 0 ? (
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
                <span className="text-xs text-muted-foreground">({active.length})</span>
              </div>
              <div>
                {active.map((s) => {
                  const overdue = isOverdue(s);
                  const variable = s.amount_min != null && s.amount_max != null && s.amount_min !== s.amount_max;
                  const perMonth = subscriptionMonthly(s);
                  const share = committed > 0 ? (perMonth / committed) * 100 : 0;
                  return (
                    <button
                      key={s.id}
                      onClick={() => navigate(`/subscriptions/${s.id}`)}
                      className="group w-full text-left py-3.5 border-b border-border/50 last:border-b-0"
                    >
                      <div className="flex items-baseline justify-between gap-3">
                        <span className="flex items-baseline gap-2 min-w-0">
                          <span className="font-heading text-lg font-normal truncate group-hover:text-primary transition-colors">
                            {s.label}
                          </span>
                          {overdue && (
                            <span className="text-2xs font-mono uppercase tracking-wider text-warning shrink-0">
                              overdue
                            </span>
                          )}
                        </span>
                        <span className="flex items-baseline gap-2 shrink-0">
                          <span className="amount text-sm">{formatINR(s.median_amount ?? 0)}</span>
                          <ChevronRight className="w-4 h-4 text-muted-foreground" />
                        </span>
                      </div>

                      <div className="mt-1 flex items-baseline justify-between gap-3 text-2xs text-muted-foreground">
                        <span className="truncate">
                          {s.cadence}
                          {s.cadence !== 'monthly' &&
                            (perMonth > 0 ? (
                              <span className="amount">
                                {'  ·  '}
                                {formatINRCompact(perMonth)}/mo
                              </span>
                            ) : (
                              <span>{'  ·  '}no fixed monthly</span>
                            ))}
                          {variable && (
                            <span className="amount">
                              {'  ·  '}
                              {formatINRCompact(s.amount_min!)}–{formatINRCompact(s.amount_max!)}
                            </span>
                          )}
                        </span>
                        {s.predicted_next && (
                          <span className="shrink-0 amount">
                            next ~{format(new Date(`${s.predicted_next}T12:00:00`), 'MMM d')}
                          </span>
                        )}
                      </div>

                      {perMonth > 0 && (
                        <div className="mt-2 h-1 w-full rounded-full bg-muted/30 overflow-hidden">
                          <div
                            className="h-full rounded-full"
                            style={{
                              width: `${Math.max(share, 1)}%`,
                              background: entityColor(s.label),
                            }}
                          />
                        </div>
                      )}
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
