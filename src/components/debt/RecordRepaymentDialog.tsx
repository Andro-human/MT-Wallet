import { useEffect, useState } from 'react';
import { format } from 'date-fns';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { useRecordRepayment } from '@/hooks/useRecordRepayment';
import { checkRepayment } from '@/lib/repaymentProgress';
import { formatINR } from '@/lib/formatCurrency';

export interface RepaymentTarget {
  transactionId: string;
  label: string;
  counterparty: string;
  lent: number;
  repaid: number;
  outstanding: number;
}

export function RecordRepaymentDialog({
  target,
  onOpenChange,
}: {
  target: RepaymentTarget | null;
  onOpenChange: (open: boolean) => void;
}) {
  const { toast } = useToast();
  const record = useRecordRepayment();

  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [note, setNote] = useState('');

  // Prefilled with the full outstanding balance, since settling in full is the
  // common case and a partial is the edit.
  useEffect(() => {
    if (target) {
      setAmount(String(target.outstanding));
      setDate(format(new Date(), 'yyyy-MM-dd'));
      setNote('');
    }
  }, [target]);

  if (!target) return null;

  const check = checkRepayment(amount, target.outstanding);
  const remaining = check.ok ? target.outstanding - check.amount : target.outstanding;

  const save = async () => {
    if (!check.ok) {
      toast({ title: check.error, variant: 'destructive' });
      return;
    }
    try {
      await record.mutateAsync({
        loanTransactionId: target.transactionId,
        counterparty: target.counterparty,
        amount: check.amount,
        date,
        note: note.trim() || null,
      });
      toast({
        title: check.settlesInFull
          ? `${target.counterparty} settled up`
          : `${formatINR(check.amount)} back from ${target.counterparty}`,
      });
      onOpenChange(false);
    } catch (e) {
      toast({
        title: 'Could not record that',
        description: (e as Error).message,
        variant: 'destructive',
      });
    }
  };

  return (
    <Dialog open={!!target} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100%-2rem)] sm:max-w-[440px] rounded-2xl">
        <DialogHeader>
          <DialogTitle className="font-heading font-normal text-2xl">
            Money back from {target.counterparty}
          </DialogTitle>
          {/* Doubles as the dialog's accessible description, which Radix warns
              about when absent. */}
          <DialogDescription asChild>
            <div className="flex items-baseline justify-between gap-3 pt-1">
              <span className="text-sm text-foreground truncate min-w-0">{target.label}</span>
              <span className="amount text-sm text-muted-foreground shrink-0">
                {formatINR(target.outstanding)} due
              </span>
            </div>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label className="text-sm text-muted-foreground">Amount (₹) *</Label>
              <Input
                autoFocus
                type="number"
                step="0.01"
                min="0"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') void save();
                }}
              />
            </div>
            <div className="space-y-2">
              <Label className="text-sm text-muted-foreground">Date</Label>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
          </div>

          {!check.ok ? (
            <p className="text-xs text-warning">{check.error}</p>
          ) : (
            <p className="text-xs text-muted-foreground">
              {check.settlesInFull ? (
                <>Settles this loan in full.</>
              ) : (
                <>
                  <span className="amount">{formatINR(remaining)}</span> would still be due.
                </>
              )}
            </p>
          )}

          <div className="space-y-2">
            <Label className="text-sm text-muted-foreground">Note</Label>
            <Textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="How did they pay it back? (optional)"
              className="text-sm min-h-[56px] resize-none"
              rows={2}
            />
          </div>

          <p className="text-xs text-muted-foreground">
            This creates a credit for the amount and links it to the loan, so it counts
            against what is owed without counting as income.
          </p>

          <Button
            onClick={save}
            disabled={!check.ok || record.isPending}
            className="w-full"
          >
            {record.isPending ? 'Recording…' : 'Record repayment'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
