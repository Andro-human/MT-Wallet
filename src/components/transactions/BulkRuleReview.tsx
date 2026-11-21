import { useMemo, useState } from 'react';
import { AlertTriangle, X, Plus } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { useCategories } from '@/hooks/useCategories';
import { ruleWrite, type RuleEffect, type RuleProposal, type RuleWrite } from '@/lib/bulkRules';
import { cn } from '@/lib/utils';
import { DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { ToastAction } from '@/components/ui/toast';

const EFFECT_ORDER: RuleEffect[] = ['category', 'expense', 'income', 'rename'];

const rules = () => (supabase as any).from('user_merchant_mappings');

interface BulkRuleReviewProps {
  proposals: RuleProposal[];
  onDone: () => void;
}

export function BulkRuleReview({ proposals, onDone }: BulkRuleReviewProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: categories = [] } = useCategories();
  const [included, setIncluded] = useState(() => new Set(proposals.map((p) => p.key)));
  const [kept, setKept] = useState<Record<string, Set<RuleEffect>>>(() =>
    Object.fromEntries(proposals.map((p) => [p.key, new Set(Object.keys(p.effects) as RuleEffect[])])),
  );
  const [isSaving, setIsSaving] = useState(false);

  const categoryName = (id: string) => categories.find((c) => c.id === id)?.name ?? 'a category';

  const label = (p: RuleProposal, e: RuleEffect): string => {
    const fx = p.effects;
    if (e === 'category') return `Category → ${categoryName(fx.category!)}`;
    if (e === 'expense') return fx.expense ? 'Count as spending' : 'Don’t count as spending';
    if (e === 'income') return fx.income ? 'Count as income' : 'Don’t count as income';
    return `Rename → ${fx.rename}`;
  };

  const writes = useMemo(
    () =>
      proposals
        .filter((p) => included.has(p.key))
        .map((p) => ruleWrite(p, EFFECT_ORDER.filter((e) => kept[p.key]?.has(e))))
        .filter((w): w is RuleWrite => w !== null),
    [proposals, included, kept],
  );

  const toggleRow = (key: string) =>
    setIncluded((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  const toggleEffect = (key: string, effect: RuleEffect) =>
    setKept((prev) => {
      const next = new Set(prev[key]);
      if (next.has(effect)) next.delete(effect);
      else next.add(effect);
      return { ...prev, [key]: next };
    });

  const allIncluded = included.size === proposals.length;

  const handleSave = async () => {
    if (!user || writes.length === 0) return;
    const userId = user.id;
    const undoUpdates: { id: string; previous: Record<string, unknown> }[] = [];
    const insertedIds: string[] = [];

    setIsSaving(true);
    try {
      for (const w of writes) {
        if (w.kind === 'update') {
          const { error } = await rules().update(w.values).eq('id', w.id).eq('user_id', userId);
          if (error) throw error;
          undoUpdates.push({ id: w.id, previous: w.previous });
        } else {
          const { data, error } = await rules().insert({ ...w.values, user_id: userId }).select('id').single();
          if (error) throw error;
          insertedIds.push(data.id);
        }
      }
      const saved = writes.length;
      toast({
        title: `Saved ${saved} rule${saved === 1 ? '' : 's'} for future transactions`,
        action: (
          <ToastAction
            altText="Undo"
            onClick={async () => {
              try {
                for (const u of undoUpdates) {
                  const { error } = await rules().update(u.previous).eq('id', u.id).eq('user_id', userId);
                  if (error) throw error;
                }
                if (insertedIds.length) {
                  const { error } = await rules().delete().in('id', insertedIds).eq('user_id', userId);
                  if (error) throw error;
                }
                queryClient.invalidateQueries({ queryKey: ['merchant-mappings'] });
                toast({ title: 'Rules undone' });
              } catch {
                toast({ title: 'Could not undo the rules', variant: 'destructive' });
              }
            }}
          >
            Undo
          </ToastAction>
        ),
      });
      onDone();
    } catch {
      toast({
        title: 'Could not save every rule',
        description: 'Check Merchant rules in Settings for what was saved.',
        variant: 'destructive',
      });
    } finally {
      queryClient.invalidateQueries({ queryKey: ['merchant-mappings'] });
      setIsSaving(false);
    }
  };

  return (
    <>
      <DialogHeader>
        <DialogTitle className="text-lg font-semibold">Remember for future?</DialogTitle>
        <DialogDescription className="text-xs">
          Tick the merchants that should get a rule, and tap a part to leave it out. New transactions from them
          arrive already set. You can change these later in Merchant rules.
        </DialogDescription>
      </DialogHeader>

      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>
          {included.size} of {proposals.length} merchant{proposals.length === 1 ? '' : 's'}
        </span>
        <button
          type="button"
          onClick={() => setIncluded(allIncluded ? new Set() : new Set(proposals.map((p) => p.key)))}
          className="text-primary hover:underline"
        >
          {allIncluded ? 'Select none' : 'Select all'}
        </button>
      </div>

      <div className="divide-y divide-border/50 border-y border-border/50">
        {proposals.map((p) => {
          const on = included.has(p.key);
          const keptHere = kept[p.key] ?? new Set<RuleEffect>();
          const shadowedKept = p.shadowed.filter((e) => keptHere.has(e));
          return (
            <div key={p.key} className={cn('py-3 space-y-2', !on && 'opacity-55')}>
              <label className="flex items-start gap-3 cursor-pointer">
                <Checkbox checked={on} onCheckedChange={() => toggleRow(p.key)} className="mt-0.5" aria-label={p.merchant} />
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium truncate">{p.merchant}</span>
                  <span className="block text-2xs text-muted-foreground">
                    {p.txnCount} selected transaction{p.txnCount === 1 ? '' : 's'} ·{' '}
                    {p.target ? 'updates your existing rule' : 'new rule'}
                  </span>
                </span>
              </label>

              <div className="flex flex-wrap gap-1.5 pl-7">
                {EFFECT_ORDER.filter((e) => p.effects[e] !== undefined).map((e) => {
                  const active = keptHere.has(e);
                  return (
                    <button
                      key={e}
                      type="button"
                      disabled={!on}
                      aria-pressed={active}
                      onClick={() => toggleEffect(p.key, e)}
                      className={cn(
                        'inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs transition-colors',
                        active
                          ? 'border-border/60 bg-muted text-foreground'
                          : 'border-dashed border-border/50 text-muted-foreground line-through',
                      )}
                    >
                      {label(p, e)}
                      {active ? <X className="w-3 h-3" /> : <Plus className="w-3 h-3" />}
                    </button>
                  );
                })}
              </div>

              {on && shadowedKept.length > 0 && (
                <p className="pl-7 flex items-start gap-1.5 text-2xs text-warning">
                  <AlertTriangle className="w-3 h-3 mt-0.5 shrink-0" />
                  An older rule already decides {shadowedKept.map((e) => (e === 'rename' ? 'the name' : e === 'category' ? 'the category' : 'counting')).join(' and ')} for
                  this merchant, so that part won’t take effect.
                </p>
              )}
            </div>
          );
        })}
      </div>

      <div className="flex gap-3 pt-2">
        <Button variant="outline" className="flex-1 rounded-xl border-border/50" onClick={onDone} disabled={isSaving}>
          Skip
        </Button>
        <Button className="flex-1 rounded-xl" onClick={handleSave} disabled={isSaving || writes.length === 0}>
          {isSaving ? 'Saving...' : `Save ${writes.length} rule${writes.length === 1 ? '' : 's'}`}
        </Button>
      </div>
    </>
  );
}
