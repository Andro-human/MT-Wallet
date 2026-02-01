import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { CalendarIcon } from 'lucide-react';
import { TransactionWithCategory } from '@/types/database';
import { useCategories } from '@/hooks/useCategories';
import { useUpdateTransaction } from '@/hooks/useTransactions';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Calendar } from '@/components/ui/calendar';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';

interface EditTransactionDialogProps {
  transaction: TransactionWithCategory;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function EditTransactionDialog({ 
  transaction, 
  open, 
  onOpenChange 
}: EditTransactionDialogProps) {
  const { toast } = useToast();
  const { data: categories = [] } = useCategories();
  const updateMutation = useUpdateTransaction();

  const [merchant, setMerchant] = useState(transaction.merchant || '');
  const [amount, setAmount] = useState(transaction.amount.toString());
  const [direction, setDirection] = useState<'credit' | 'debit'>(transaction.direction);
  const [transactedAt, setTransactedAt] = useState<Date>(new Date(transaction.transacted_at));
  const [paymentMethod, setPaymentMethod] = useState(transaction.payment_method || '');
  const [bankName, setBankName] = useState(transaction.bank_name || '');
  const [accountLast4, setAccountLast4] = useState(transaction.account_last4 || '');
  const [categoryId, setCategoryId] = useState(transaction.category_id || 'none');

  useEffect(() => {
    if (open) {
      setMerchant(transaction.merchant || '');
      setAmount(transaction.amount.toString());
      setDirection(transaction.direction);
      setTransactedAt(new Date(transaction.transacted_at));
      setPaymentMethod(transaction.payment_method || '');
      setBankName(transaction.bank_name || '');
      setAccountLast4(transaction.account_last4 || '');
      setCategoryId(transaction.category_id || 'none');
    }
  }, [open, transaction]);

  const handleSave = async () => {
    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      toast({ title: 'Please enter a valid amount', variant: 'destructive' });
      return;
    }

    try {
      await updateMutation.mutateAsync({
        id: transaction.id,
        updates: {
          merchant: merchant.trim() || null,
          amount: parsedAmount,
          direction,
          transacted_at: transactedAt.toISOString(),
          payment_method: paymentMethod.trim() || null,
          bank_name: bankName.trim() || null,
          account_last4: accountLast4.trim() || null,
          category_id: categoryId === 'none' ? null : categoryId,
        },
      });
      toast({ title: 'Transaction updated' });
      onOpenChange(false);
    } catch {
      toast({ title: 'Failed to update transaction', variant: 'destructive' });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="glass-elevated border-border/50 max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-lg font-semibold">Edit Transaction</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Merchant */}
          <div className="space-y-2">
            <Label htmlFor="merchant" className="text-sm text-muted-foreground">Merchant</Label>
            <Input
              id="merchant"
              value={merchant}
              onChange={(e) => setMerchant(e.target.value)}
              placeholder="Enter merchant name"
              className="bg-muted/30 border-border/50 rounded-xl"
            />
          </div>

          {/* Amount & Direction */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="amount" className="text-sm text-muted-foreground">Amount (₹)</Label>
              <Input
                id="amount"
                type="number"
                step="0.01"
                min="0"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="bg-muted/30 border-border/50 rounded-xl"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-sm text-muted-foreground">Type</Label>
              <Select value={direction} onValueChange={(v) => setDirection(v as 'credit' | 'debit')}>
                <SelectTrigger className="bg-muted/30 border-border/50 rounded-xl">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="glass-card border-border/50">
                  <SelectItem value="debit">
                    <span className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-foreground" />
                      Debit (Spent)
                    </span>
                  </SelectItem>
                  <SelectItem value="credit">
                    <span className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-success" />
                      Credit (Received)
                    </span>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Date */}
          <div className="space-y-2">
            <Label className="text-sm text-muted-foreground">Date & Time</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-left font-normal bg-muted/30 border-border/50 rounded-xl",
                    !transactedAt && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {transactedAt ? format(transactedAt, "PPP p") : "Pick a date"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0 glass-card border-border/50" align="start">
                <Calendar
                  mode="single"
                  selected={transactedAt}
                  onSelect={(date) => date && setTransactedAt(date)}
                  initialFocus
                  className="p-3 pointer-events-auto"
                />
              </PopoverContent>
            </Popover>
          </div>

          {/* Category */}
          <div className="space-y-2">
            <Label className="text-sm text-muted-foreground">Category</Label>
            <Select value={categoryId} onValueChange={setCategoryId}>
              <SelectTrigger className="bg-muted/30 border-border/50 rounded-xl">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="glass-card border-border/50">
                <SelectItem value="none">No category</SelectItem>
                {categories.map(cat => (
                  <SelectItem key={cat.id} value={cat.id}>
                    {cat.icon} {cat.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Payment Method */}
          <div className="space-y-2">
            <Label htmlFor="paymentMethod" className="text-sm text-muted-foreground">Payment Method</Label>
            <Input
              id="paymentMethod"
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value)}
              placeholder="e.g., UPI, Card, Cash"
              className="bg-muted/30 border-border/50 rounded-xl"
            />
          </div>

          {/* Bank Name */}
          <div className="space-y-2">
            <Label htmlFor="bankName" className="text-sm text-muted-foreground">Bank Name</Label>
            <Input
              id="bankName"
              value={bankName}
              onChange={(e) => setBankName(e.target.value)}
              placeholder="e.g., HDFC, ICICI"
              className="bg-muted/30 border-border/50 rounded-xl"
            />
          </div>

          {/* Account Last 4 */}
          <div className="space-y-2">
            <Label htmlFor="accountLast4" className="text-sm text-muted-foreground">Account Last 4 Digits</Label>
            <Input
              id="accountLast4"
              value={accountLast4}
              onChange={(e) => setAccountLast4(e.target.value.slice(0, 4))}
              placeholder="e.g., 1234"
              maxLength={4}
              className="bg-muted/30 border-border/50 rounded-xl"
            />
          </div>
        </div>

        <div className="flex gap-3 pt-2">
          <Button
            variant="outline"
            className="flex-1 rounded-xl border-border/50"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            className="flex-1 rounded-xl"
            onClick={handleSave}
            disabled={updateMutation.isPending}
          >
            {updateMutation.isPending ? 'Saving...' : 'Save Changes'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
