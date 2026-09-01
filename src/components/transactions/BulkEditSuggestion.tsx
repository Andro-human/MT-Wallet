import { useState, useMemo } from 'react';
import { format } from 'date-fns';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, X } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useTransactions, useUpdateTransaction } from '@/hooks/useTransactions';
import { useAuth } from '@/hooks/useAuth';
import { formatINR } from '@/lib/formatCurrency';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { useQueryClient } from '@tanstack/react-query';
import { useMerchantMappings } from '@/hooks/useMerchantMappings';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';

interface BulkEditSuggestionProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The merchant name to find related transactions */
  merchantName: string;
  /** The transaction ID that was just edited (to exclude from list) */
  currentTransactionId: string;
  /** The field that was changed */
  field: 'category_id' | 'group_id' | 'merchant' | 'is_expense' | 'is_income';
  /** The new value */
  newValue: string | boolean | null;
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
  const { user } = useAuth();
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isApplying, setIsApplying] = useState(false);
  const [applyToFuture, setApplyToFuture] = useState(false);

  // Fetch saved mapping rules
  const { data: mappings = [] } = useMerchantMappings();

  const ruleFieldColumn =
    field === 'category_id' ? 'default_category_id'
      : field === 'is_expense' ? 'default_is_expense'
        : field === 'is_income' ? 'default_is_income'
          : null;

  /** The rule this save would replace. Rules are bound to the raw merchant string
   *  and nothing stops two rows sharing one, so prefer the row that already sets
   *  this field: that is the one actually deciding the outcome today. */
  const existingRule = useMemo(() => {
    const mine = mappings.filter(
      (m) => (m.raw_merchant ?? '').toLowerCase() === merchantName.toLowerCase(),
    );
    if (mine.length === 0) return null;
    if (!ruleFieldColumn) return mine[0];
    return mine.find((m) => (m as any)[ruleFieldColumn] !== null) ?? mine[0];
  }, [mappings, merchantName, ruleFieldColumn]);

  const ruleAlreadySetsField =
    !!existingRule && !!ruleFieldColumn && (existingRule as any)[ruleFieldColumn] !== null;

  const currentRuleReads = useMemo(() => {
    if (!ruleAlreadySetsField || !ruleFieldColumn) return null;
    const v = (existingRule as any)[ruleFieldColumn];
    if (field === 'is_expense') return v ? 'count as expense' : 'not count as expense';
    if (field === 'is_income') return v ? 'count as income' : 'not count as income';
    return null;
  }, [ruleAlreadySetsField, ruleFieldColumn, existingRule, field]);

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
        if (field === 'is_expense') return t.is_expense !== newValue;
        if (field === 'is_income') return t.is_income !== newValue;
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
    if (selectedIds.size === 0 && !applyToFuture) return;

    setIsApplying(true);
    try {
      const updates: Record<string, any> = {};
      if (field === 'category_id') updates.category_id = newValue;
      else if (field === 'group_id') updates.group_id = newValue;
      else if (field === 'merchant') {
        updates.merchant = newValue;
      }
      else if (field === 'is_expense') updates.is_expense = newValue;
      else if (field === 'is_income') updates.is_income = newValue;

      if (selectedIds.size > 0) {
        const { error } = await supabase
          .from('transactions')
          .update(updates)
          .in('id', Array.from(selectedIds));

        if (error) throw error;
      }

      if (applyToFuture && user) {
        const ruleData: any = {
          mapped_merchant: field === 'merchant' ? (newValue || merchantName) : merchantName,
        };
        if (field === 'category_id') ruleData.default_category_id = newValue;
        if (field === 'is_expense') ruleData.default_is_expense = newValue;
        if (field === 'is_income') ruleData.default_is_income = newValue;

        // Update the rule already deciding this field rather than inserting beside
        // it. Nothing in the schema stops two rows sharing a raw_merchant, and when
        // they disagree the winner is whichever the query happens to return first.
        const { error: ruleError } = existingRule
          ? await (supabase as any)
              .from('user_merchant_mappings')
              .update(ruleData)
              .eq('id', existingRule.id)
          : await (supabase as any)
              .from('user_merchant_mappings')
              .insert({ ...ruleData, user_id: user.id, raw_merchant: merchantName });

        if (ruleError) {
          console.error('Failed to save rule:', ruleError);
          toast({ title: 'Failed to save future rule', variant: 'destructive' });
        } else {
          queryClient.invalidateQueries({ queryKey: ['merchant-mappings'] });
          toast({ title: existingRule ? 'Rule updated' : 'Rule saved for future' });
        }
      }

      if (selectedIds.size > 0) {
        toast({ title: `Updated ${selectedIds.size} transaction${selectedIds.size > 1 ? 's' : ''}` });
      } else if (!applyToFuture) {
        // Nothing selected and no rule applied
        return;
      }

      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      onOpenChange(false);
      setSelectedIds(new Set());
      setApplyToFuture(false);
    } catch {
      toast({ title: 'Failed to update transactions', variant: 'destructive' });
    } finally {
      setIsApplying(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="glass-elevated border-border/50 max-w-md max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="text-base font-semibold">
            {relatedTransactions.length > 0 ? 'Apply to similar transactions?' : 'Create automation rule?'}
          </DialogTitle>
          <p className="text-sm text-muted-foreground mt-1">
            {relatedTransactions.length > 0 
              ? <>Set <span className="font-medium text-foreground">{changeLabel}</span> on other "{merchantName}" transactions</>
              : <>We couldn't find past transactions from "{merchantName}". Would you like to save this as a rule for all future transactions?</>}
          </p>
        </DialogHeader>

        {relatedTransactions.length > 0 && (
          <div className="flex items-center justify-between py-2 mt-2">
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
        )}

        {relatedTransactions.length > 0 && (
          <div className="flex-1 overflow-y-auto -mx-6 px-6 space-y-1.5 mb-4" style={{ WebkitOverflowScrolling: 'touch', maxHeight: '40vh' }}>
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
        )}

        <div className={cn(
          "px-6 py-4 border-t border-border/30 bg-muted/10",
          relatedTransactions.length === 0 && "mt-4 border-t-0 bg-muted/20 rounded-xl mx-6 mb-4"
        )}>
          <div className="flex items-center space-x-3">
            <Checkbox
              id="apply-future"
              checked={applyToFuture}
              onCheckedChange={(checked) => setApplyToFuture(checked as boolean)}
            />
            <Label
              htmlFor="apply-future"
              className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer text-foreground"
            >
              {ruleAlreadySetsField
                ? 'Update the saved rule for future transactions'
                : 'Remember this for all future transactions'}
            </Label>
          </div>
          {ruleAlreadySetsField && (
            <p className="text-xs text-muted-foreground mb-2.5">
              A rule already says {merchantName} should{' '}
              <span className="text-foreground">{currentRuleReads ?? 'something else'}</span>. Saving
              replaces it.
            </p>
          )}
          <p className="text-xs text-muted-foreground mt-1.5 ml-7">
            Automatically applies this exact {changeLabel} mapping to any new SMS from {merchantName}.
          </p>
        </div>

        <div className="flex gap-3 pt-3 p-6 pt-0">
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
            disabled={(selectedIds.size === 0 && !applyToFuture) || isApplying}
          >
            {isApplying ? 'Applying...' :
              applyToFuture && selectedIds.size === 0 ? 'Save Rule Only' :
                `Apply to ${selectedIds.size}`}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
