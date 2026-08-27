import { useMemo, useState, useEffect } from 'react';
import { format } from 'date-fns';
import { Repeat, Check } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { useTransactions } from '@/hooks/useTransactions';
import { useCreateSubscription } from '@/hooks/useSubscriptions';
import { searchByExample } from '@/lib/subscriptionMatch';
import { formatINR } from '@/lib/formatCurrency';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

export interface CreateSeed {
  label?: string;
  note?: string;
  merchant?: string;
  identity?: string | null;
}

export function CreateSubscriptionDialog({
  open,
  onOpenChange,
  seed,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  seed?: CreateSeed;
}) {
  const { toast } = useToast();
  const { data: allTxns = [] } = useTransactions({});
  const create = useCreateSubscription();

  const [label, setLabel] = useState('');
  const [note, setNote] = useState('');
  const [merchant, setMerchant] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [touchedSelection, setTouchedSelection] = useState(false);

  useEffect(() => {
    if (open) {
      setLabel(seed?.label ?? '');
      setNote(seed?.note ?? '');
      setMerchant(seed?.merchant ?? '');
      setSelected(new Set());
      setTouchedSelection(false);
    }
  }, [open, seed]);

  const candidates = useMemo(
    () =>
      allTxns
        .filter((t) => t.direction === 'debit')
        .map((t) => ({
          id: t.id,
          merchant: t.merchant,
          notes: t.notes,
          amount: Number(t.amount),
          transacted_at: t.transacted_at,
        })),
    [allTxns],
  );

  const matches = useMemo(
    () => searchByExample(candidates, { note, merchant }),
    [candidates, note, merchant],
  );

  // Default-select high-confidence (note) matches; leave merchant-only (mid) unchecked
  // until the user opts in. Once they touch the selection we stop overriding it.
  const effectiveSelected = useMemo(() => {
    if (touchedSelection) return selected;
    return new Set(matches.filter((m) => m.band === 'high').map((m) => m.txn.id));
  }, [matches, selected, touchedSelection]);

  const toggle = (id: string) => {
    const next = new Set(touchedSelection ? selected : effectiveSelected);
    next.has(id) ? next.delete(id) : next.add(id);
    setSelected(next);
    setTouchedSelection(true);
  };

  const chosen = matches.filter((m) => effectiveSelected.has(m.txn.id));

  const submit = async () => {
    const finalLabel = label.trim() || merchant.trim() || note.trim();
    if (!finalLabel) {
      toast({ title: 'Give it a name', variant: 'destructive' });
      return;
    }
    try {
      await create.mutateAsync({
        label: finalLabel,
        matchNote: note.trim() || null,
        matchMerchant: merchant.trim() || null,
        identity: seed?.identity ?? null,
        transactions: chosen.map((m) => ({
          id: m.txn.id,
          amount: m.txn.amount,
          transacted_at: (m.txn as any).transacted_at,
        })),
      });
      toast({ title: `Now tracking ${finalLabel}` });
      onOpenChange(false);
    } catch (e) {
      toast({ title: 'Could not create', description: (e as Error).message, variant: 'destructive' });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100%-2rem)] sm:max-w-[440px] max-h-[90vh] overflow-y-auto rounded-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Repeat className="w-5 h-5" /> New subscription
          </DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground -mt-2">
          Type a note or merchant. We'll find matching transactions and keep monitoring for new ones.
        </p>

        <div className="space-y-3 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="s-note" className="text-xs font-mono uppercase tracking-wider text-muted-foreground">Note contains</Label>
            <Input id="s-note" value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. netflix, insurance" autoFocus />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="s-merch" className="text-xs font-mono uppercase tracking-wider text-muted-foreground">Merchant (optional)</Label>
            <Input id="s-merch" value={merchant} onChange={(e) => setMerchant(e.target.value)} placeholder="e.g. Netflix, a UPI handle" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="s-label" className="text-xs font-mono uppercase tracking-wider text-muted-foreground">Name (optional)</Label>
            <Input id="s-label" value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Defaults to the note/merchant" />
          </div>
        </div>

        {(note.trim() || merchant.trim()) && (
          <div className="border-t border-border/50 pt-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-mono text-primary">
                {matches.length} matching {matches.length === 1 ? 'transaction' : 'transactions'}
              </span>
            </div>
            <div className="max-h-56 overflow-y-auto space-y-0.5">
              {matches.map((m) => {
                const on = effectiveSelected.has(m.txn.id);
                return (
                  <button
                    key={m.txn.id}
                    onClick={() => toggle(m.txn.id)}
                    className="w-full flex items-center gap-3 py-2 text-left"
                  >
                    <span className={cn('w-[18px] h-[18px] rounded border grid place-items-center shrink-0',
                      on ? 'bg-primary border-primary text-primary-foreground' : 'border-border')}>
                      {on && <Check className="w-3 h-3" />}
                    </span>
                    <span className="flex-1 min-w-0 text-sm truncate">
                      {m.txn.merchant || 'Transaction'}
                      <span className="text-muted-foreground text-xs ml-1">
                        · {format(new Date((m.txn as any).transacted_at), 'MMM d')}
                        {m.txn.notes ? ` · "${m.txn.notes.trim()}"` : ' · no note'}
                      </span>
                    </span>
                    <span className="font-mono text-xs text-muted-foreground shrink-0">{formatINR(m.txn.amount)}</span>
                  </button>
                );
              })}
              {matches.length === 0 && (
                <p className="text-sm text-muted-foreground py-3">No matching transactions yet.</p>
              )}
            </div>
          </div>
        )}

        <DialogFooter className="flex-col-reverse sm:flex-row gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} className="w-full sm:w-auto">Cancel</Button>
          <Button onClick={submit} disabled={create.isPending} className="w-full sm:flex-1">
            {create.isPending ? 'Creating…' : `Create & link ${chosen.length}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
