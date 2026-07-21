import { useMemo, useState } from 'react';
import { format } from 'date-fns';
import { Search, ArrowLeft } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useTransactions } from '@/hooks/useTransactions';
import { useEnrichmentMap, useUpdateEnrichment } from '@/hooks/useTxnEnrichment';
import { formatINR } from '@/lib/formatCurrency';
import { useToast } from '@/hooks/use-toast';

interface PickedTxn {
  id: string;
  merchant: string | null;
  notes: string | null;
  amount: number;
  transacted_at: string;
}

export function RecordDebtDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const { toast } = useToast();
  const { data: allTxns = [] } = useTransactions({});
  const { data: enrichmentMap } = useEnrichmentMap();
  const updateEnrichment = useUpdateEnrichment();

  const [q, setQ] = useState('');
  const [picked, setPicked] = useState<PickedTxn | null>(null);
  const [counterparty, setCounterparty] = useState('');

  const reset = () => {
    setQ('');
    setPicked(null);
    setCounterparty('');
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
      .slice(0, 40);
  }, [allTxns, enrichmentMap, q]);

  const save = async () => {
    if (!picked || !counterparty.trim()) return;
    try {
      await updateEnrichment.mutateAsync({
        transactionId: picked.id,
        notes: picked.notes,
        existing: enrichmentMap?.get(picked.id) ?? null,
        lending: { counterparty: counterparty.trim(), type: 'lent' },
      });
      toast({ title: `Added to debt tracker` });
      reset();
      onOpenChange(false);
    } catch (e) {
      toast({ title: 'Could not record', description: (e as Error).message, variant: 'destructive' });
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) reset(); onOpenChange(o); }}>
      <DialogContent className="w-[calc(100%-2rem)] sm:max-w-[440px] max-h-[85vh] overflow-hidden rounded-2xl flex flex-col">
        <DialogHeader>
          <DialogTitle>{picked ? 'Who did you lend to?' : 'Record a debt'}</DialogTitle>
        </DialogHeader>

        {!picked ? (
          <>
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                autoFocus
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Find the transaction you lent"
                className="pl-9"
              />
            </div>
            <div className="overflow-y-auto -mx-1 mt-1">
              {results.length === 0 ? (
                <p className="text-sm text-muted-foreground py-6 text-center">
                  {q ? 'No matching transactions.' : 'Search for the debit you lent out.'}
                </p>
              ) : (
                results.map((t) => (
                  <button
                    key={t.id}
                    onClick={() =>
                      setPicked({ id: t.id, merchant: t.merchant, notes: t.notes, amount: Number(t.amount), transacted_at: t.transacted_at })
                    }
                    className="w-full flex items-center justify-between gap-3 px-1 py-2.5 text-left hover:bg-muted/20 rounded-lg transition-colors"
                  >
                    <span className="min-w-0">
                      <span className="text-sm block truncate">{t.notes?.trim() || t.merchant || 'Transaction'}</span>
                      <span className="text-xs text-muted-foreground">{format(new Date(t.transacted_at), 'MMM d, yyyy')}</span>
                    </span>
                    <span className="font-mono text-sm shrink-0">{formatINR(Number(t.amount))}</span>
                  </button>
                ))
              )}
            </div>
          </>
        ) : (
          <div className="space-y-4">
            <button onClick={() => setPicked(null)} className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground">
              <ArrowLeft className="w-3.5 h-3.5" /> Pick a different transaction
            </button>
            <div className="neo-card rounded-xl p-3 flex items-center justify-between gap-3">
              <span className="min-w-0">
                <span className="text-sm block truncate">{picked.notes?.trim() || picked.merchant || 'Transaction'}</span>
                <span className="text-xs text-muted-foreground">{format(new Date(picked.transacted_at), 'MMM d, yyyy')}</span>
              </span>
              <span className="font-mono text-sm shrink-0">{formatINR(picked.amount)}</span>
            </div>
            <Input
              autoFocus
              value={counterparty}
              onChange={(e) => setCounterparty(e.target.value)}
              placeholder="Who did you lend to?"
              onKeyDown={(e) => { if (e.key === 'Enter') save(); }}
            />
            <p className="text-xs text-muted-foreground">
              It'll show on the Debt page until credits linked to it cover the amount.
            </p>
            <Button onClick={save} disabled={!counterparty.trim() || updateEnrichment.isPending} className="w-full">
              {updateEnrichment.isPending ? 'Saving…' : 'Add to debt tracker'}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
