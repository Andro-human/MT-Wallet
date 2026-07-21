import { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { format } from 'date-fns';
import { Sparkles, Plus, X } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useReminders } from '@/hooks/useReminders';
import { useDetectedSubscriptions } from '@/hooks/useDetectedSubscriptions';
import { useSubscriptionOverrides, useSetSubscriptionOverride } from '@/hooks/useSubscriptionOverrides';
import { useToast } from '@/components/ui/use-toast';
import type { DetectedSubscription } from '@/lib/subscriptionDetect';
import type { Reminder, RecurrenceUnit } from '@/types/database';

const CADENCE_TO_RECURRENCE: Record<
  Exclude<DetectedSubscription['cadence'], 'irregular'>,
  { value: number; unit: RecurrenceUnit }
> = {
  weekly: { value: 1, unit: 'week' },
  monthly: { value: 1, unit: 'month' },
  quarterly: { value: 3, unit: 'month' },
  annual: { value: 1, unit: 'year' },
};

function isSnoozeActive(snoozedUntil: string | null): boolean {
  return !!snoozedUntil && new Date(snoozedUntil) > new Date();
}

function normalize(s: string | null | undefined): string {
  return (s ?? '').toLowerCase().trim();
}

// A detected sub is already tracked if an open reminder's title or merchant
// matches its human label or its cluster key.
function isAlreadyTracked(sub: DetectedSubscription, reminders: Reminder[]): boolean {
  const label = normalize(sub.label);
  const key = normalize(sub.clusterKey);
  return reminders.some((r) => {
    if (r.is_completed) return false;
    const t = normalize(r.title);
    const m = normalize(r.merchant);
    return t === label || m === label || t === key || m === key || (label.length > 3 && t.includes(label));
  });
}

export function DetectedSubscriptions() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { detected } = useDetectedSubscriptions();
  const { data: reminders = [] } = useReminders();
  const { data: overrides } = useSubscriptionOverrides();
  const setOverride = useSetSubscriptionOverride();
  const [addingKey, setAddingKey] = useState<string | null>(null);

  const suggestions = useMemo(() => {
    return detected.filter((sub) => {
      if (sub.cadence === 'irregular') return false;
      if (sub.band !== 'high' && sub.band !== 'medium') return false;
      if (sub.state !== 'active') return false;
      const ov = overrides?.get(sub.clusterKey);
      if (ov?.status === 'confirmed' || ov?.status === 'ignored') return false;
      if (ov?.status === 'snoozed' && isSnoozeActive(ov.snoozed_until)) return false;
      if (isAlreadyTracked(sub, reminders)) return false;
      return true;
    });
  }, [detected, reminders, overrides]);

  const add = async (sub: DetectedSubscription) => {
    if (!user || sub.cadence === 'irregular') return;
    setAddingKey(sub.clusterKey);
    try {
      const rec = CADENCE_TO_RECURRENCE[sub.cadence];
      const due = new Date(`${sub.nextExpected}T12:00:00`);
      const { error } = await supabase.from('reminders').insert({
        user_id: user.id,
        title: sub.label,
        merchant: sub.label,
        amount: sub.amount,
        currency: 'INR',
        type: 'subscription',
        custom_type_label: null,
        due_date: due.toISOString(),
        is_recurring: true,
        recurrence_value: rec.value,
        recurrence_unit: rec.unit,
        is_completed: false,
      } as any);
      if (error) throw error;
      // Confirm so it drops out of suggestions even before the reminders list refetches.
      await setOverride.mutateAsync({ clusterKey: sub.clusterKey, status: 'confirmed', snoozedUntil: null });
      queryClient.invalidateQueries({ queryKey: ['reminders'] });
      toast({ title: `Reminder added for ${sub.label}` });
    } catch (e) {
      toast({ title: 'Could not add reminder', description: (e as Error).message, variant: 'destructive' });
    } finally {
      setAddingKey(null);
    }
  };

  const dismiss = async (sub: DetectedSubscription) => {
    try {
      await setOverride.mutateAsync({ clusterKey: sub.clusterKey, status: 'ignored', snoozedUntil: null });
    } catch {
      toast({ title: 'Failed to dismiss', variant: 'destructive' });
    }
  };

  if (suggestions.length === 0) return null;

  return (
    <div className="mb-6">
      <div className="flex items-center gap-2 mb-3 px-1">
        <Sparkles className="w-4 h-4 text-primary" />
        <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Detected from your spending
        </h2>
        <span className="text-xs text-muted-foreground/60">({suggestions.length})</span>
      </div>
      <div className="space-y-3">
        <AnimatePresence mode="popLayout">
          {suggestions.map((sub) => (
            <motion.div
              key={sub.clusterKey}
              layout
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, x: -60 }}
              className="neo-card p-4 rounded-xl border border-dashed border-border/60"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <h3 className="font-semibold text-base truncate">{sub.label}</h3>
                  <p className="text-lg font-bold text-foreground">
                    {new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(sub.amount)}
                    <span className="text-xs font-normal text-muted-foreground"> · {sub.cadence}</span>
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    next ~{format(new Date(`${sub.nextExpected}T12:00:00`), 'MMM d')} · seen {sub.occurrences}×
                  </p>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  <button
                    onClick={() => add(sub)}
                    disabled={addingKey === sub.clusterKey}
                    className="flex items-center gap-1 px-2.5 h-8 rounded-lg bg-primary text-primary-foreground text-xs font-medium disabled:opacity-50"
                  >
                    <Plus className="w-3.5 h-3.5" /> Add
                  </button>
                  <button
                    onClick={() => dismiss(sub)}
                    aria-label="Dismiss suggestion"
                    className="h-8 w-8 flex items-center justify-center rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
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
  );
}
