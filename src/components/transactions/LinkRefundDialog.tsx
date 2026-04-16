import { useState, useMemo } from 'react';
import { format } from 'date-fns';
import { Search, Check, X, RefreshCw } from 'lucide-react';
import { useTransactions } from '@/hooks/useTransactions';
import { useRefundTransactions, useCreateRefundLink, useDeleteRefundLink, useAllLinkedRefundIds } from '@/hooks/useRefundLinks';
import { useAllLinkedTransactionIds } from '@/hooks/useDuplicateLinks';
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

export function LinkRefundDialog({
  open,
  onOpenChange,
  transactionId,
  transactionAmount,
}: LinkRefundDialogProps) {
  const { toast } = useToast();
  const [search, setSearch] = useState('');
  
  // Fetch all credit transactions (potential refunds)
  const { data: allTransactions = [] } = useTransactions({ direction: 'credit' });
  const { data: linkedRefunds = [] } = useRefundTransactions(transactionId);
  const { data: duplicateLinkedIds = new Set<string>() } = useAllLinkedTransactionIds();
  const { data: allLinkedRefundIds = new Set<string>() } = useAllLinkedRefundIds();
  const createLink = useCreateRefundLink();
  const deleteLink = useDeleteRefundLink();

  const linkedRefundIds = useMemo(() => 
    new Set(linkedRefunds.map(r => r.id)), 
    [linkedRefunds]
  );

  const totalRefunded = useMemo(() => 
    linkedRefunds.reduce((sum, r) => sum + Number(r.amount), 0),
    [linkedRefunds]
  );

  const netAmount = transactionAmount - totalRefunded;

  const filteredTransactions = useMemo(() => {
    return allTransactions
      .filter(t => t.id !== transactionId)
      .filter(t => !duplicateLinkedIds.has(t.id))
      // Exclude refunds already linked to a different original (one refund → one original)
      .filter(t => !allLinkedRefundIds.has(t.id) || linkedRefundIds.has(t.id))
      .filter(t => {
        if (!search) return true;
        const searchLower = search.toLowerCase().trim();
        const amountStr = t.amount.toString();
        const formattedAmount = formatINR(t.amount).replace('₹', '').replace(',', '');
        
        return (
          amountStr.includes(searchLower) ||
          formattedAmount.includes(searchLower) ||
          t.merchant?.toLowerCase().includes(searchLower)
        );
      });
  }, [allTransactions, transactionId, search, duplicateLinkedIds, allLinkedRefundIds, linkedRefundIds]);

  const handleLink = async (refundId: string) => {
    try {
      await createLink.mutateAsync({
        originalTransactionId: transactionId,
        refundTransactionId: refundId,
      });
      toast({ title: 'Refund linked' });
    } catch (error) {
      // Postgres unique_violation = 23505
      const code = (error as { code?: string } | null)?.code;
      if (code === '23505') {
        toast({ title: 'Already linked as a refund elsewhere', variant: 'destructive' });
      } else {
        toast({ title: 'Failed to link refund', variant: 'destructive' });
      }
    }
  };

  const handleUnlink = async (refundId: string) => {
    try {
      await deleteLink.mutateAsync({
        originalTransactionId: transactionId,
        refundTransactionId: refundId,
      });
      toast({ title: 'Refund unlinked' });
    } catch (error) {
      toast({ title: 'Failed to unlink refund', variant: 'destructive' });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="glass-elevated border-border/50 max-w-md max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="text-lg font-semibold flex items-center gap-2">
            <RefreshCw className="w-5 h-5 text-primary" />
            Link Refunds
          </DialogTitle>
        </DialogHeader>

        {/* Summary */}
        <div className="p-4 rounded-xl bg-muted/30 space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Original Amount</span>
            <span className="font-medium">₹{formatINR(transactionAmount).replace('₹', '')}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Total Refunded</span>
            <span className="font-medium text-success">₹{formatINR(totalRefunded).replace('₹', '')}</span>
          </div>
          <div className="border-t border-border/50 pt-2 flex justify-between">
            <span className="text-sm font-medium">Net Contribution</span>
            <span className={cn(
              "font-bold",
              netAmount === 0 ? "text-muted-foreground" : "text-foreground"
            )}>
              ₹{formatINR(netAmount).replace('₹', '')}
            </span>
          </div>
        </div>

        {/* Linked refunds */}
        {linkedRefunds.length > 0 && (
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">Linked Refunds</p>
            <ScrollArea className="max-h-[120px]">
              <div className="space-y-1.5 pr-2">
                {linkedRefunds.map((refund) => (
                  <div
                    key={refund.id}
                    className="flex items-center justify-between p-3 rounded-xl bg-success/10 border border-success/20"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{refund.merchant || 'Refund'}</p>
                      <p className="text-xs text-muted-foreground">
                        {format(new Date(refund.transacted_at), 'MMM d, yyyy')}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-success">
                        +₹{formatINR(Number(refund.amount)).replace('₹', '')}
                      </span>
                      <button
                        onClick={() => handleUnlink(refund.id)}
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

        {/* Search - search by amount */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search by amount (e.g., 100) or merchant..."
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
                No credit transactions found
              </p>
            ) : (
              filteredTransactions.map((tx) => {
                const isLinked = linkedRefundIds.has(tx.id);
                return (
                  <button
                    key={tx.id}
                    onClick={() => isLinked ? handleUnlink(tx.id) : handleLink(tx.id)}
                    disabled={createLink.isPending || deleteLink.isPending}
                    className={cn(
                      "w-full flex items-center justify-between p-3 rounded-xl transition-colors text-left",
                      isLinked
                        ? "bg-success/10 border border-success/20"
                        : "bg-muted/30 hover:bg-muted/50"
                    )}
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{tx.merchant || 'Unknown'}</p>
                      <p className="text-xs text-muted-foreground">
                        {format(new Date(tx.transacted_at), 'MMM d, yyyy h:mm a')}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-success">
                        +₹{formatINR(tx.amount).replace('₹', '')}
                      </span>
                      {isLinked && (
                        <Check className="w-4 h-4 text-success" />
                      )}
                    </div>
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
