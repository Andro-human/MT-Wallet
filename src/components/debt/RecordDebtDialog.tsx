import { useMemo, useState } from 'react';
import { format } from 'date-fns';
import { Search, ArrowLeft, Check, PenLine } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useTransactions } from '@/hooks/useTransactions';
import { useEnrichmentMap, useUpdateEnrichment, useMarkLentBulk } from '@/hooks/useTxnEnrichment';
import { formatINR } from '@/lib/formatCurrency';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

interface PickedTxn {
  id: string;
  merchant: string | null;
  notes: string | null;
  amount: number;
  transacted_at: string;
}

type Mode = 'pick' | 'name' | 'manual';

export function RecordDebtDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const { toast } = useToast();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { data: allTxns = [] } = useTransactions({});
  const { data: enrichmentMap } = useEnrichmentMap();
  const updateEnrichment = useUpdateEnrichment();
  const markLentBulk = useMarkLentBulk();

  const [mode, setMode] = useState<Mode>('pick');
  const [q, setQ] = useState('');
  const [selected, setSelected] = useState<Map<string, PickedTxn>>(new Map());
  const [counterparty, setCounterparty] = useState('');

  const [mAmount, setMAmount] = useState('');
  const [mDate, setMDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [mNote, setMNote] = useState('');
  const [savingManual, setSavingManual] = useState(false);

  const reset = () => {
    setMode('pick');
    setQ('');
    setSelected(new Map());
    setCounterparty('');
    setMAmount('');
    setMDate(format(new Date(), 'yyyy-MM-dd'));
    setMNote('');
  };

  const close = (o: boolean) => {
    if (!o) reset();
    onOpenChange(o);
  };

  const results = useMemo(() => {
    const term = q.trim().toLowerCase();
    return allTxns
      .filter((t) => t.direction === 'debit' && !enrichmentMap?.get(t.id)?.lending)
      .filter((t) =>
        !term
          ? true
          : (t.merchant?.toLowerCase().includes(term) ?? false) ||
            (t.notes?.toLowerCase().includes(term) ?? false) ||
            String(t.amount).includes(term),
      )
      .slice(0, 60);
  }, [allTxns, enrichmentMap, q]);

  const toggle = (t: PickedTxn) => {
    setSelected((prev) => {
      const next = new Map(prev);
      if (next.has(t.id)) next.delete(t.id);
      else next.set(t.id, t);
      return next;
    });
  };

  const allSelected = results.length > 0 && results.every((t) => selected.has(t.id));

  const toggleAll = () => {
    setSelected((prev) => {
      const next = new Map(prev);
      if (allSelected) {
        for (const t of results) next.delete(t.id);
      } else {
        for (const t of results) {
          next.set(t.id, {
            id: t.id,
            merchant: t.merchant,
            notes: t.notes,
            amount: Number(t.amount),
            transacted_at: t.transacted_at,
          });
        }
      }
      return next;
    });
  };

  const saveLinked = async () => {
    const picks = [...selected.values()];
    if (picks.length === 0 || !counterparty.trim()) return;
    try {
      await markLentBulk.mutateAsync({
        counterparty: counterparty.trim(),
        transactions: picks.map((p) => ({ id: p.id, notes: p.notes, existing: enrichmentMap?.get(p.id) ?? null })),
      });
      toast({ title: `Added ${picks.length} to debt tracker` });
      close(false);
    } catch (e) {
      toast({ title: 'Could not record', description: (e as Error).message, variant: 'destructive' });
    }
  };

  const saveManual = async () => {
    if (!user) return;
    const amount = parseFloat(mAmount);
    if (isNaN(amount) || amount <= 0) {
      toast({ title: 'Enter a valid amount', variant: 'destructive' });
      return;
    }
    if (!counterparty.trim()) {
      toast({ title: 'Who did you lend to?', variant: 'destructive' });
      return;
    }
    setSavingManual(true);
    try {
      const transactedAt = new Date(`${mDate}T12:00:00`).toISOString();
      const { data, error } = await supabase
        .from('transactions')
        .insert({
          user_id: user.id,
          merchant: counterparty.trim(),
          amount,
          direction: 'debit',
          transacted_at: transactedAt,
          notes: mNote.trim() || null,
          is_expense: false,
        } as any)
        .select('id')
        .single();
      if (error) throw error;
      await updateEnrichment.mutateAsync({
        transactionId: (data as { id: string }).id,
        notes: mNote.trim() || null,
        existing: null,
        lending: { counterparty: counterparty.trim(), type: 'lent' },
      });
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      toast({ title: 'Added to debt tracker' });
      close(false);
    } catch (e) {
      toast({ title: 'Could not record', description: (e as Error).message, variant: 'destructive' });
    } finally {
      setSavingManual(false);
    }
  };

  const title =
    mode === 'manual' ? 'Record a debt manually' : mode === 'name' ? 'Who did you lend to?' : 'Record a debt';

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="w-[calc(100%-2rem)] sm:max-w-[440px] max-h-[85vh] overflow-hidden rounded-2xl flex flex-col">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>

        {mode === 'pick' && (
          <>
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                autoFocus
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Find the transactions you lent"
                className="pl-9"
              />
            </div>
            {results.length > 0 && (
              <div className="flex items-center justify-between px-1 mt-1">
                <span className="text-xs text-muted-foreground">{selected.size} selected</span>
                <button onClick={toggleAll} className="text-xs font-medium text-primary hover:opacity-80">
                  {allSelected ? 'Clear all' : 'Select all'}
                </button>
              </div>
            )}
            <div className="overflow-y-auto -mx-1 mt-1 flex-1">
              {results.length === 0 ? (
                <p className="text-sm text-muted-foreground py-6 text-center">
                  {q ? 'No matching transactions.' : 'Search for the debits you lent out.'}
                </p>
              ) : (
                results.map((t) => {
                  const pick: PickedTxn = {
                    id: t.id,
                    merchant: t.merchant,
                    notes: t.notes,
                    amount: Number(t.amount),
                    transacted_at: t.transacted_at,
                  };
                  const on = selected.has(t.id);
                  return (
                    <button
                      key={t.id}
                      onClick={() => toggle(pick)}
                      className="w-full flex items-center gap-3 px-1 py-2.5 text-left hover:bg-muted/20 rounded-lg transition-colors"
                    >
                      <span
                        className={cn(
                          'w-5 h-5 rounded-md border grid place-items-center shrink-0 transition-colors',
                          on ? 'bg-primary border-primary text-primary-foreground' : 'border-border',
                        )}
                      >
                        {on && <Check className="w-3.5 h-3.5" />}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="text-sm block truncate">{t.notes?.trim() || t.merchant || 'Transaction'}</span>
                        <span className="text-xs text-muted-foreground">{format(new Date(t.transacted_at), 'MMM d, yyyy')}</span>
                      </span>
                      <span className="font-mono text-sm shrink-0">{formatINR(Number(t.amount))}</span>
                    </button>
                  );
                })
              )}
            </div>
            <div className="space-y-2 mt-1">
              <Button onClick={() => setMode('name')} disabled={selected.size === 0} className="w-full">
                {selected.size === 0
                  ? 'Select transactions to record'
                  : `Continue with ${selected.size}`}
              </Button>
              <button
                onClick={() => setMode('manual')}
                className="w-full flex items-center justify-center gap-1.5 text-xs text-muted-foreground hover:text-foreground py-1"
              >
                <PenLine className="w-3.5 h-3.5" /> No transaction for it? Add manually
              </button>
            </div>
          </>
        )}

        {mode === 'name' && (
          <div className="space-y-4">
            <button onClick={() => setMode('pick')} className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground">
              <ArrowLeft className="w-3.5 h-3.5" /> Back to selection
            </button>
            <div className="text-sm text-muted-foreground">
              Recording <b className="text-foreground">{selected.size}</b> transaction{selected.size > 1 ? 's' : ''} as lent.
            </div>
            <Input
              autoFocus
              value={counterparty}
              onChange={(e) => setCounterparty(e.target.value)}
              placeholder="Who did you lend to?"
              onKeyDown={(e) => { if (e.key === 'Enter') saveLinked(); }}
            />
            <p className="text-xs text-muted-foreground">
              They'll show on the Debt page until credits linked to them cover the amount.
            </p>
            <Button onClick={saveLinked} disabled={!counterparty.trim() || markLentBulk.isPending} className="w-full">
              {markLentBulk.isPending ? 'Saving…' : 'Add to debt tracker'}
            </Button>
          </div>
        )}

        {mode === 'manual' && (
          <div className="space-y-4">
            <button onClick={() => setMode('pick')} className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground">
              <ArrowLeft className="w-3.5 h-3.5" /> Back
            </button>
            <div className="space-y-2">
              <Label className="text-sm text-muted-foreground">Who did you lend to? *</Label>
              <Input
                autoFocus
                value={counterparty}
                onChange={(e) => setCounterparty(e.target.value)}
                placeholder="e.g., Rahul"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label className="text-sm text-muted-foreground">Amount (₹) *</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={mAmount}
                  onChange={(e) => setMAmount(e.target.value)}
                  placeholder="0.00"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-sm text-muted-foreground">Date</Label>
                <Input type="date" value={mDate} onChange={(e) => setMDate(e.target.value)} />
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-sm text-muted-foreground">Note</Label>
              <Textarea
                value={mNote}
                onChange={(e) => setMNote(e.target.value)}
                placeholder="What was it for? (optional)"
                className="text-sm min-h-[56px] resize-none"
                rows={2}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              This creates a transaction for the loan (not counted as spending) so you can link repayments to it later.
            </p>
            <Button onClick={saveManual} disabled={savingManual || !counterparty.trim() || !mAmount} className="w-full">
              {savingManual ? 'Saving…' : 'Add to debt tracker'}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
