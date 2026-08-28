import { useMemo, useState } from 'react';
import { format } from 'date-fns';
import { Search, Check } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useTransactions } from '@/hooks/useTransactions';
import { useLinkTransactions, useLinkedTransactionIds } from '@/hooks/useSubscriptions';
import { formatINR } from '@/lib/formatCurrency';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

interface PickTxn {
  id: string;
  amount: number;
  transacted_at: string;
  merchant: string | null;
  notes: string | null;
  direction: string | null;
}

export function AddTransactionDialog({
  open,
  onOpenChange,
  subscriptionId,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  subscriptionId: string;
}) {
  const { toast } = useToast();
  const { data: allTxns = [] } = useTransactions({});
  const { data: linkedIds } = useLinkedTransactionIds();
  const link = useLinkTransactions();
  const [q, setQ] = useState('');
  const [selected, setSelected] = useState<Map<string, PickTxn>>(new Map());

  const results = useMemo(() => {
    const term = q.trim().toLowerCase();
    return allTxns
      .filter((t) => !linkedIds?.has(t.id))
      .filter((t) =>
        !term
          ? true
          : (t.merchant?.toLowerCase().includes(term) ?? false) ||
            (t.notes?.toLowerCase().includes(term) ?? false) ||
            String(t.amount).includes(term),
      )
      .slice(0, 60);
  }, [allTxns, linkedIds, q]);

  const toggle = (t: PickTxn) => {
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
            amount: Number(t.amount),
            transacted_at: t.transacted_at,
            merchant: t.merchant,
            notes: t.notes,
            direction: t.direction ?? null,
          });
        }
      }
      return next;
    });
  };

  const close = (o: boolean) => {
    if (!o) {
      setQ('');
      setSelected(new Map());
    }
    onOpenChange(o);
  };

  const linkSelected = async () => {
    const txns = [...selected.values()].map((t) => ({
      id: t.id,
      amount: Number(t.amount),
      transacted_at: t.transacted_at,
      direction: t.direction,
    }));
    if (txns.length === 0) return;
    try {
      await link.mutateAsync({ subscriptionId, txns });
      toast({ title: `Linked ${txns.length} transaction${txns.length > 1 ? 's' : ''}` });
      close(false);
    } catch (e) {
      toast({ title: 'Could not link', description: (e as Error).message, variant: 'destructive' });
    }
  };

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="w-[calc(100%-2rem)] sm:max-w-[440px] max-h-[85vh] overflow-hidden rounded-2xl flex flex-col">
        <DialogHeader>
          <DialogTitle>Add transactions</DialogTitle>
        </DialogHeader>
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search by merchant, note, or amount"
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
              {q ? 'No matching unlinked transactions.' : 'Start typing to find transactions.'}
            </p>
          ) : (
            results.map((t) => {
              const on = selected.has(t.id);
              return (
                <button
                  key={t.id}
                  onClick={() =>
                    toggle({ id: t.id, amount: Number(t.amount), transacted_at: t.transacted_at, merchant: t.merchant, notes: t.notes, direction: t.direction ?? null })
                  }
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
                  <span className="shrink-0 text-right">
                    <span className={cn('font-mono text-sm block', t.direction === 'credit' && 'text-gold')}>
                      {formatINR(Number(t.amount))}
                    </span>
                    {t.direction === 'credit' && (
                      <span className="text-[9px] font-mono uppercase tracking-wider text-muted-foreground">
                        contribution
                      </span>
                    )}
                  </span>
                </button>
              );
            })
          )}
        </div>
        <Button onClick={linkSelected} disabled={selected.size === 0 || link.isPending} className="w-full mt-1">
          {link.isPending
            ? 'Linking…'
            : selected.size === 0
              ? 'Select transactions to link'
              : `Link ${selected.size} transaction${selected.size > 1 ? 's' : ''}`}
        </Button>
      </DialogContent>
    </Dialog>
  );
}
