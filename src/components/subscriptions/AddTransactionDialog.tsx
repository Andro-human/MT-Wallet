import { useMemo, useState } from 'react';
import { format } from 'date-fns';
import { Search } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { useTransactions } from '@/hooks/useTransactions';
import { useLinkTransaction, useLinkedTransactionIds } from '@/hooks/useSubscriptions';
import { formatINR } from '@/lib/formatCurrency';
import { useToast } from '@/hooks/use-toast';

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
  const link = useLinkTransaction();
  const [q, setQ] = useState('');

  const results = useMemo(() => {
    const term = q.trim().toLowerCase();
    return allTxns
      .filter((t) => t.direction === 'debit' && !linkedIds?.has(t.id))
      .filter((t) =>
        !term
          ? true
          : (t.merchant?.toLowerCase().includes(term) ?? false) ||
            (t.notes?.toLowerCase().includes(term) ?? false) ||
            String(t.amount).includes(term),
      )
      .slice(0, 40);
  }, [allTxns, linkedIds, q]);

  const add = async (t: { id: string; amount: number; transacted_at: string; merchant: string | null }) => {
    try {
      await link.mutateAsync({
        subscriptionId,
        txn: { id: t.id, amount: Number(t.amount), transacted_at: t.transacted_at },
      });
      toast({ title: `Linked ${t.merchant ?? 'transaction'}` });
      onOpenChange(false);
    } catch (e) {
      toast({ title: 'Could not link', description: (e as Error).message, variant: 'destructive' });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100%-2rem)] sm:max-w-[440px] max-h-[85vh] overflow-hidden rounded-2xl flex flex-col">
        <DialogHeader>
          <DialogTitle>Add a transaction</DialogTitle>
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
        <div className="overflow-y-auto -mx-1 mt-1">
          {results.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">
              {q ? 'No matching unlinked transactions.' : 'Start typing to find a transaction.'}
            </p>
          ) : (
            results.map((t) => (
              <button
                key={t.id}
                onClick={() => add(t)}
                disabled={link.isPending}
                className="w-full flex items-center justify-between gap-3 px-1 py-2.5 text-left hover:bg-muted/20 rounded-lg transition-colors disabled:opacity-50"
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
      </DialogContent>
    </Dialog>
  );
}
