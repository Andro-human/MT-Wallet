import { useState, useMemo } from 'react';
import { format } from 'date-fns';
import { Search, Check, X, RefreshCw, Pencil } from 'lucide-react';
import { useTransactions } from '@/hooks/useTransactions';
import {
  useRefundLinksForOriginal,
  useRefundAllocations,
  useCreateRefundLink,
  useUpdateRefundLink,
  useDeleteRefundLink,
  type RefundLinkRow,
} from '@/hooks/useRefundLinks';
import { useDuplicateExcludeIds } from '@/hooks/useDuplicateLinks';
import { useToast } from '@/hooks/use-toast';
import { formatINR } from '@/lib/formatCurrency';
import { cn } from '@/lib/utils';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';

interface LinkRefundDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  transactionId: string;
  transactionAmount: number;
}

function r2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function LinkRefundDialog({
  open,
  onOpenChange,
  transactionId,
  transactionAmount,
}: LinkRefundDialogProps) {
  const { toast } = useToast();
  const [search, setSearch] = useState('');
  const [pickingFor, setPickingFor] = useState<string | null>(null);
  const [splitInput, setSplitInput] = useState<string>('');
  const [editingLinkId, setEditingLinkId] = useState<string | null>(null);
  const [editInput, setEditInput] = useState<string>('');

  const { data: creditTxns = [] } = useTransactions({ direction: 'credit' });
  const { data: existingLinks = [] } = useRefundLinksForOriginal(transactionId);
  const { data: allocations = {}, isLoading: allocationsLoading } = useRefundAllocations();
  // Only exclude the "duplicate" side of a pair (the merged-away copy). The
  // primary/kept transaction is still a valid refund candidate.
  const { data: duplicateLinkedIds = new Set<string>() } = useDuplicateExcludeIds();

  const createLink = useCreateRefundLink();
  const updateLink = useUpdateRefundLink();
  const deleteLink = useDeleteRefundLink();

  const totalRefunded = useMemo(
    () => existingLinks.reduce((s, l) => s + l.linked_amount, 0),
    [existingLinks],
  );
  const outstanding = Math.max(transactionAmount - totalRefunded, 0);

  const linkedRefundIds = useMemo(
    () => new Set(existingLinks.map((l) => l.refund_transaction_id)),
    [existingLinks],
  );

  const filteredCandidates = useMemo(() => {
    return creditTxns
      .filter((t) => t.id !== transactionId)
      .filter((t) => !duplicateLinkedIds.has(t.id))
      .filter((t) => {
        const allocated = allocations[t.id] ?? 0;
        const unallocated = Math.max(Number(t.amount) - allocated, 0);
        return unallocated > 0.001 || linkedRefundIds.has(t.id);
      })
      .filter((t) => {
        if (!search) return true;
        const q = search.toLowerCase().trim();
        const amtStr = String(t.amount);
        const formatted = formatINR(t.amount).replace('₹', '').replace(',', '');
        return (
          amtStr.includes(q) ||
          formatted.includes(q) ||
          t.merchant?.toLowerCase().includes(q)
        );
      });
  }, [creditTxns, transactionId, search, duplicateLinkedIds, allocations, linkedRefundIds]);

  const parsedSplit = (raw: string, candidateUnallocated: number): number | null => {
    const v = parseFloat(raw);
    if (!isFinite(v) || v <= 0) return null;
    const max = Math.min(candidateUnallocated, outstanding);
    if (v > max + 0.001) return null;
    return r2(v);
  };

  const handleStartPicking = (candidateId: string, defaultAmount: number) => {
    setPickingFor(candidateId);
    setSplitInput(String(r2(defaultAmount)));
  };

  const handleConfirmCreate = async (
    candidate: { id: string; amount: number },
    candidateUnallocated: number,
  ) => {
    const amt = parsedSplit(splitInput, candidateUnallocated);
    if (amt == null) {
      toast({ title: 'Enter a positive amount within the available range', variant: 'destructive' });
      return;
    }
    try {
      await createLink.mutateAsync({
        originalTransactionId: transactionId,
        refundTransactionId: candidate.id,
        linkedAmount: amt,
      });
      toast({ title: `Linked ₹${formatINR(amt).replace('₹', '')}` });
      setPickingFor(null);
      setSplitInput('');
    } catch (err) {
      const code = (err as { code?: string } | null)?.code;
      if (code === '23505') {
        toast({ title: 'Already linked — edit the existing split instead', variant: 'destructive' });
      } else {
        toast({ title: 'Failed to link refund', variant: 'destructive' });
      }
    }
  };

  const handleStartEdit = (link: RefundLinkRow) => {
    setEditingLinkId(link.id);
    setEditInput(String(r2(link.linked_amount)));
  };

  const handleConfirmEdit = async (link: RefundLinkRow) => {
    // Cap = refund's unallocated portion (less this link's own allocation)
    // ∩ original's outstanding (less this link's current amount).
    const otherAllocated = (allocations[link.refund_transaction_id] ?? 0) - link.linked_amount;
    const refundUnallocatedForThis = Math.max(link.refund_amount - otherAllocated, 0);
    const otherLinkedForOriginal = totalRefunded - link.linked_amount;
    const outstandingForThis = Math.max(transactionAmount - otherLinkedForOriginal, 0);
    const cap = Math.min(refundUnallocatedForThis, outstandingForThis);

    const v = parseFloat(editInput);
    if (!isFinite(v) || v <= 0 || v > cap + 0.001) {
      toast({ title: `Enter a positive amount up to ₹${formatINR(cap).replace('₹', '')}`, variant: 'destructive' });
      return;
    }

    try {
      await updateLink.mutateAsync({
        linkId: link.id,
        originalTransactionId: transactionId,
        refundTransactionId: link.refund_transaction_id,
        linkedAmount: r2(v),
      });
      toast({ title: 'Split updated' });
      setEditingLinkId(null);
      setEditInput('');
    } catch {
      toast({ title: 'Failed to update split', variant: 'destructive' });
    }
  };

  const handleUnlink = async (link: RefundLinkRow) => {
    try {
      await deleteLink.mutateAsync({
        linkId: link.id,
        originalTransactionId: transactionId,
        refundTransactionId: link.refund_transaction_id,
      });
      toast({ title: 'Refund unlinked' });
    } catch {
      toast({ title: 'Failed to unlink refund', variant: 'destructive' });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="glass-elevated border-border/50 w-[calc(100vw-1rem)] max-w-md h-[90vh] sm:h-[80vh] overflow-hidden flex flex-col gap-3 sm:gap-4 p-4 sm:p-6">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle className="text-lg font-semibold flex items-center gap-2">
            <RefreshCw className="w-5 h-5 text-primary" />
            Link Refunds
          </DialogTitle>
        </DialogHeader>

        {/* Summary */}
        <div className="p-4 rounded-xl bg-muted/30 space-y-2 flex-shrink-0">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Original Amount</span>
            <span className="font-medium amount">₹{formatINR(transactionAmount).replace('₹', '')}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Total Linked</span>
            <span className="font-medium text-gold amount">
              ₹{formatINR(totalRefunded).replace('₹', '')}
            </span>
          </div>
          <div className="border-t border-border/50 pt-2 flex justify-between">
            <span className="text-sm font-medium">Outstanding</span>
            <span className={cn(
              'font-bold',
              outstanding === 0 ? 'text-muted-foreground' : 'text-foreground',
            )}>
              ₹{formatINR(outstanding).replace('₹', '')}
            </span>
          </div>
        </div>

        {/* Linked splits */}
        {existingLinks.length > 0 && (
          <div className="space-y-2 flex-shrink-0">
            <p className="text-sm text-muted-foreground">Linked Refunds</p>
            <ScrollArea className="max-h-[160px]">
              <div className="space-y-1.5 pr-2">
                {existingLinks.map((link) => {
                  const isEditing = editingLinkId === link.id;
                  return (
                    <div
                      key={link.id}
                      className="flex items-center justify-between gap-2 p-3 rounded-xl bg-success/10 border border-success/20"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{link.merchant || 'Refund'}</p>
                        <p className="text-xs text-muted-foreground">
                          {format(new Date(link.transacted_at), 'MMM d, yyyy')}
                          {' · '}of ₹{formatINR(link.refund_amount).replace('₹', '')}
                        </p>
                      </div>
                      <div className="flex items-center gap-1.5">
                        {isEditing ? (
                          <>
                            <Input
                              type="number"
                              inputMode="decimal"
                              value={editInput}
                              onChange={(e) => setEditInput(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') handleConfirmEdit(link);
                                if (e.key === 'Escape') setEditingLinkId(null);
                              }}
                              autoFocus
                              className="w-20 h-8 text-sm text-right no-spinner"
                            />
                            <button
                              onClick={() => handleConfirmEdit(link)}
                              disabled={updateLink.isPending}
                              className="w-7 h-7 rounded-lg bg-success/20 flex items-center justify-center text-success hover:bg-success/30 transition-colors"
                            >
                              <Check className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => setEditingLinkId(null)}
                              className="w-7 h-7 rounded-lg bg-muted/30 flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </>
                        ) : (
                          <>
                            <span className="text-sm font-semibold text-success">
                              +₹{formatINR(link.linked_amount).replace('₹', '')}
                            </span>
                            <button
                              onClick={() => handleStartEdit(link)}
                              className="w-7 h-7 rounded-lg bg-muted/30 flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleUnlink(link)}
                              className="w-7 h-7 rounded-lg bg-destructive/10 flex items-center justify-center text-destructive hover:bg-destructive/20 transition-colors"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
          </div>
        )}

        {/* Search */}
        <div className="relative flex-shrink-0">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search by amount or merchant…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10 bg-muted/30 border-border/50 rounded-xl"
          />
        </div>

        {/* Candidates */}
        <div className="flex-1 min-h-0 overflow-auto">
          <div className="space-y-1.5 pr-2">
            {allocationsLoading ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                Loading available refunds…
              </p>
            ) : filteredCandidates.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                {outstanding === 0
                  ? 'This transaction is fully refunded.'
                  : 'No available credits to link.'}
              </p>
            ) : (
              filteredCandidates.map((tx) => {
                const fullAmount = Number(tx.amount);
                const allocated = allocations[tx.id] ?? 0;
                const unallocated = Math.max(fullAmount - allocated, 0);
                const isPicking = pickingFor === tx.id;
                const isAlreadyLinkedHere = linkedRefundIds.has(tx.id);

                return (
                  <div
                    key={tx.id}
                    className={cn(
                      'rounded-xl border transition-colors',
                      isPicking
                        ? 'bg-primary/5 border-primary/30'
                        : isAlreadyLinkedHere
                          ? 'bg-success/5 border-success/20'
                          : 'bg-muted/30 border-transparent hover:bg-muted/50',
                    )}
                  >
                    <button
                      onClick={() => {
                        if (outstanding <= 0) return;
                        if (isPicking) {
                          setPickingFor(null);
                        } else {
                          handleStartPicking(tx.id, Math.min(unallocated, outstanding));
                        }
                      }}
                      disabled={outstanding <= 0}
                      className="w-full flex items-center justify-between gap-2 p-3 text-left disabled:opacity-50"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">
                          {tx.merchant || 'Unknown'}
                          {isAlreadyLinkedHere && (
                            <span className="ml-1.5 text-[10px] text-success font-mono uppercase">linked</span>
                          )}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {format(new Date(tx.transacted_at), 'MMM d, yyyy h:mm a')}
                          {' · '}₹{formatINR(unallocated).replace('₹', '')} free of ₹{formatINR(fullAmount).replace('₹', '')}
                        </p>
                      </div>
                      {!isPicking && (
                        <span className="text-sm font-semibold text-success">
                          +₹{formatINR(fullAmount).replace('₹', '')}
                        </span>
                      )}
                    </button>

                    {isPicking && (
                      <div className="px-3 pb-3 flex items-center gap-2">
                        <span className="text-xs text-muted-foreground">Split amount</span>
                        <Input
                          type="number"
                          inputMode="decimal"
                          value={splitInput}
                          onChange={(e) => setSplitInput(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleConfirmCreate(tx, unallocated);
                            if (e.key === 'Escape') setPickingFor(null);
                          }}
                          autoFocus
                          max={Math.min(unallocated, outstanding)}
                          min={0}
                          step={0.01}
                          className="w-24 h-8 text-sm text-right no-spinner"
                        />
                        <Button
                          size="sm"
                          onClick={() => handleConfirmCreate(tx, unallocated)}
                          disabled={createLink.isPending}
                          className="h-8 rounded-lg"
                        >
                          Link
                        </Button>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>

        <Button
          variant="outline"
          className="w-full rounded-xl flex-shrink-0"
          onClick={() => onOpenChange(false)}
        >
          Done
        </Button>
      </DialogContent>
    </Dialog>
  );
}
