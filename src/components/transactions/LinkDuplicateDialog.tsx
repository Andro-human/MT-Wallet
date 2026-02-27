import { useState, useMemo } from 'react';
import { format } from 'date-fns';
import { Search, Check, X, Copy } from 'lucide-react';
import { useTransactions } from '@/hooks/useTransactions';
import { useDuplicateTransactions, useCreateDuplicateLink, useDeleteDuplicateLink } from '@/hooks/useDuplicateLinks';
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

interface LinkDuplicateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  transactionId: string;
  transactionAmount: number;
  transactionMerchant: string | null;
  transactionDate: string;
  transactionDirection: 'credit' | 'debit';
}

export function LinkDuplicateDialog({
  open,
  onOpenChange,
  transactionId,
  transactionAmount,
  transactionMerchant,
  transactionDate,
  transactionDirection,
}: LinkDuplicateDialogProps) {
  const { toast } = useToast();
  const [search, setSearch] = useState('');

  // Fetch all transactions with the same direction (most likely candidates)
  const { data: allTransactions = [] } = useTransactions({ direction: transactionDirection });
  const { data: linkedDuplicates = [] } = useDuplicateTransactions(transactionId);
  const createLink = useCreateDuplicateLink();
  const deleteLink = useDeleteDuplicateLink();

  const linkedDuplicateIds = useMemo(() =>
    new Set(linkedDuplicates.map(r => r.id)),
    [linkedDuplicates]
  );

  // Sort candidates: exact amount + same merchant first, then exact amount, then rest
  const filteredTransactions = useMemo(() => {
    const candidates = allTransactions
      .filter(t => t.id !== transactionId) // Exclude current transaction
      .filter(t => !linkedDuplicateIds.has(t.id)); // Exclude already linked

    // If searching, filter by search term
    let filtered = candidates;
    if (search) {
      const searchLower = search.toLowerCase().trim();
      const numericSearch = parseFloat(searchLower.replace(/,/g, ''));

      filtered = candidates.filter(t => {
        const amountStr = t.amount.toString();
        const merchantMatch = t.merchant?.toLowerCase().includes(searchLower);
        const amountMatch = !isNaN(numericSearch) && amountStr.includes(searchLower);
        return merchantMatch || amountMatch;
      });
    }

    // Score and sort by similarity
    return filtered.sort((a, b) => {
      const scoreA = getDuplicateScore(a);
      const scoreB = getDuplicateScore(b);
      return scoreB - scoreA;
    });

    function getDuplicateScore(t: typeof candidates[0]): number {
      let score = 0;
      // Same amount = strong signal
      if (Number(t.amount) === transactionAmount) score += 100;
      // Same merchant = strong signal
      if (t.merchant && transactionMerchant &&
        t.merchant.toLowerCase() === transactionMerchant.toLowerCase()) score += 50;
      // Close in time = strong signal (within 5 minutes)
      const timeDiff = Math.abs(
        new Date(t.transacted_at).getTime() - new Date(transactionDate).getTime()
      );
      if (timeDiff < 5 * 60 * 1000) score += 30;
      else if (timeDiff < 60 * 60 * 1000) score += 10;
      else if (timeDiff < 24 * 60 * 60 * 1000) score += 5;
      return score;
    }
  }, [allTransactions, transactionId, search, transactionAmount, transactionMerchant, transactionDate, linkedDuplicateIds]);

  const handleLink = async (duplicateId: string) => {
    try {
      await createLink.mutateAsync({
        primaryTransactionId: transactionId,
        duplicateTransactionId: duplicateId,
      });
      toast({ title: 'Duplicate linked' });
    } catch {
      toast({ title: 'Failed to link duplicate', variant: 'destructive' });
    }
  };

  const handleUnlink = async (duplicateId: string) => {
    try {
      await deleteLink.mutateAsync({
        primaryTransactionId: transactionId,
        duplicateTransactionId: duplicateId,
      });
      toast({ title: 'Duplicate unlinked' });
    } catch {
      toast({ title: 'Failed to unlink duplicate', variant: 'destructive' });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="glass-elevated border-border/50 max-w-md max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="text-lg font-semibold flex items-center gap-2">
            <Copy className="w-5 h-5 text-primary" />
            Link Duplicates
          </DialogTitle>
        </DialogHeader>

        {/* Current transaction summary */}
        <div className="p-4 rounded-xl bg-muted/30 space-y-1">
          <p className="text-sm font-medium">{transactionMerchant || 'Unknown'}</p>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">
              {format(new Date(transactionDate), 'MMM d, yyyy h:mm a')}
            </span>
            <span className={cn(
              "font-semibold",
              transactionDirection === 'credit' ? 'text-success' : 'text-foreground'
            )}>
              {transactionDirection === 'credit' ? '+' : ''}₹{formatINR(transactionAmount).replace('₹', '')}
            </span>
          </div>
        </div>

        {/* Already linked duplicates */}
        {linkedDuplicates.length > 0 && (
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">Linked Duplicates</p>
            <ScrollArea className="max-h-[120px]">
              <div className="space-y-1.5 pr-2">
                {linkedDuplicates.map((dup) => (
                  <div
                    key={dup.id}
                    className="flex items-center justify-between p-3 rounded-xl bg-amber-500/10 border border-amber-500/20"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{dup.merchant || 'Unknown'}</p>
                      <p className="text-xs text-muted-foreground">
                        {format(new Date(dup.transacted_at), 'MMM d, yyyy h:mm a')}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-amber-500">
                        ₹{formatINR(Number(dup.amount)).replace('₹', '')}
                      </span>
                      <button
                        onClick={() => handleUnlink(dup.id)}
                        className="w-7 h-7 rounded-lg bg-destructive/10 flex items-center justify-center text-destructive hover:bg-destructive/20 transition-colors"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </div>
        )}

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search by amount or merchant..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10 bg-muted/30 border-border/50 rounded-xl"
          />
        </div>

        {/* Available transactions */}
        <ScrollArea className="flex-1 min-h-[200px]">
          <div className="space-y-1.5 pr-2">
            {filteredTransactions.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                No matching transactions found
              </p>
            ) : (
              filteredTransactions.slice(0, 50).map((tx) => {
                const isExactMatch = Number(tx.amount) === transactionAmount;
                const isSameMerchant = tx.merchant && transactionMerchant &&
                  tx.merchant.toLowerCase() === transactionMerchant.toLowerCase();

                return (
                  <button
                    key={tx.id}
                    onClick={() => handleLink(tx.id)}
                    disabled={createLink.isPending || deleteLink.isPending}
                    className={cn(
                      "w-full flex items-center justify-between p-3 rounded-xl transition-colors text-left",
                      isExactMatch && isSameMerchant
                        ? "bg-amber-500/10 border border-amber-500/20"
                        : "bg-muted/30 hover:bg-muted/50"
                    )}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium truncate">{tx.merchant || 'Unknown'}</p>
                        {isExactMatch && isSameMerchant && (
                          <span className="text-2xs bg-amber-500/20 text-amber-600 dark:text-amber-400 px-1.5 py-0.5 rounded-full font-medium">
                            Likely match
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {format(new Date(tx.transacted_at), 'MMM d, yyyy h:mm a')}
                      </p>
                    </div>
                    <span className={cn(
                      "text-sm font-semibold",
                      tx.direction === 'credit' ? 'text-success' : 'text-foreground'
                    )}>
                      {tx.direction === 'credit' ? '+' : ''}₹{formatINR(tx.amount).replace('₹', '')}
                    </span>
                  </button>
                );
              })
            )}
          </div>
        </ScrollArea>

        <Button
          variant="outline"
          className="w-full rounded-xl"
          onClick={() => onOpenChange(false)}
        >
          Done
        </Button>
      </DialogContent>
    </Dialog>
  );
}
