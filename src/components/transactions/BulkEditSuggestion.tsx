import { useState, useMemo } from 'react';
import { format } from 'date-fns';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, X } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useTransactions, useUpdateTransaction } from '@/hooks/useTransactions';
import { formatINR } from '@/lib/formatCurrency';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { useQueryClient } from '@tanstack/react-query';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

interface BulkEditSuggestionProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The merchant name to find related transactions */
  merchantName: string;
  /** The transaction ID that was just edited (to exclude from list) */
  currentTransactionId: string;
  /** The field that was changed */
  field: 'category_id' | 'group_id' | 'merchant';
  /** The new value */
  newValue: string | null;
  /** Human-readable label for the change */
  changeLabel: string;
}

export function BulkEditSuggestion({
  open,
  onOpenChange,
  merchantName,
  currentTransactionId,
  field,
  newValue,
  changeLabel,
}: BulkEditSuggestionProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isApplying, setIsApplying] = useState(false);

  // Fetch transactions with the same merchant
  const { data: allTransactions = [] } = useTransactions({
    search: merchantName,
  });

  const relatedTransactions = useMemo(() => {
    return allTransactions
      .filter(t => t.id !== currentTransactionId)
      .filter(t => {
        // Only show transactions where the field differs from the new value
        if (field === 'category_id') return t.category_id !== newValue;
        if (field === 'group_id') return (t as any).group_id !== newValue;
        if (field === 'merchant') return t.merchant !== newValue;
        return false;
      })
      .slice(0, 20);
  }, [allTransactions, currentTransactionId, field, newValue]);

  const toggleTransaction = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAll = () => {
    setSelectedIds(new Set(relatedTransactions.map(t => t.id)));
  };

  const handleApply = async () => {
    if (selectedIds.size === 0) return;
    
    setIsApplying(true);
    try {
      const updates: Record<string, any> = {};
      if (field === 'category_id') updates.category_id = newValue;
      else if (field === 'group_id') updates.group_id = newValue;
      else if (field === 'merchant') {
        updates.merchant = newValue;
        updates.merchant_normalized = newValue;
      }

      const { error } = await supabase
        .from('transactions')
        .update(updates)
        .in('id', Array.from(selectedIds));

      if (error) throw error;

      toast({ title: `Updated ${selectedIds.size} transaction${selectedIds.size > 1 ? 's' : ''}` });
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      onOpenChange(false);
      setSelectedIds(new Set());
    } catch {
      toast({ title: 'Failed to update transactions', variant: 'destructive' });
    } finally {
      setIsApplying(false);
    }
  };

  if (relatedTransactions.length === 0) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="glass-elevated border-border/50 max-w-md max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="text-base font-semibold">
            Apply to similar transactions?
          </DialogTitle>
          <p className="text-sm text-muted-foreground mt-1">
            Set <span className="font-medium text-foreground">{changeLabel}</span> on other "{merchantName}" transactions
          </p>
        </DialogHeader>

        <div className="flex items-center justify-between py-2">
          <span className="text-xs text-muted-foreground">
            {relatedTransactions.length} transaction{relatedTransactions.length > 1 ? 's' : ''} found
          </span>
          <button
            onClick={selectAll}
            className="text-xs text-primary font-medium hover:underline"
          >
            Select all
          </button>
        </div>

        <div className="flex-1 overflow-y-auto -mx-6 px-6 space-y-1.5" style={{ WebkitOverflowScrolling: 'touch', maxHeight: '50vh' }}>
          {relatedTransactions.map((txn) => {
            const isSelected = selectedIds.has(txn.id);
            return (
              <button
                key={txn.id}
                onClick={() => toggleTransaction(txn.id)}
                className={cn(
                  "w-full flex items-center gap-3 p-3 rounded-xl text-left transition-colors",
                  isSelected
                    ? "bg-primary/10 border border-primary/30"
                    : "bg-muted/20 border border-transparent hover:bg-muted/40"
                )}
              >
                <div className={cn(
                  "w-5 h-5 rounded-md border-2 flex items-center justify-center flex-shrink-0 transition-colors",
                  isSelected ? "bg-primary border-primary" : "border-border"
                )}>
                  {isSelected && <Check className="w-3 h-3 text-primary-foreground" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">
                    {txn.merchant || 'Unknown'}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {format(new Date(txn.transacted_at), 'MMM d, yyyy')} · {txn.direction === 'credit' ? '+' : '−'}₹{formatINR(txn.amount).replace('₹', '')}
                  </p>
                </div>
                {txn.categories && (
                  <span className="text-sm flex-shrink-0">{txn.categories.icon}</span>
                )}
              </button>
            );
          })}
        </div>

        <div className="flex gap-3 pt-3 border-t border-border/30">
          <Button
            variant="outline"
            className="flex-1 rounded-xl border-border/50"
            onClick={() => onOpenChange(false)}
          >
            Skip
          </Button>
          <Button
            className="flex-1 rounded-xl"
            onClick={handleApply}
            disabled={selectedIds.size === 0 || isApplying}
          >
            {isApplying ? 'Applying...' : `Apply to ${selectedIds.size}`}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
