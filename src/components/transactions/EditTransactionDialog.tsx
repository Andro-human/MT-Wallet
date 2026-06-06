import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { CalendarIcon, Plus, Clock } from 'lucide-react';
import { TransactionWithCategory } from '@/types/database';
import { useCategories } from '@/hooks/useCategories';
import { useTransactionGroups } from '@/hooks/useTransactionGroups';
import { useBankAccounts, parseBankAccount } from '@/hooks/useBankAccounts';
import { useUpdateTransaction } from '@/hooks/useTransactions';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
import { cn } from '@/lib/utils';
import { canonicalMerchantCasing } from '@/lib/merchantCanonical';
import { visibleGroups } from '@/lib/visibleGroups';
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
import { ComboboxSelect } from '@/components/ui/ComboboxSelect';
import { CreateCategoryDialog } from './CreateCategoryDialog';
import { CreateGroupDialog } from './CreateGroupDialog';
import { CreateBankAccountDialog } from './CreateBankAccountDialog';

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
  const { data: groups = [] } = useTransactionGroups();
  const { data: bankAccounts = [] } = useBankAccounts();
  const updateMutation = useUpdateTransaction();
  const { user } = useAuth();

  // Raw merchants (with duplicates) for canonical-casing resolution on save.
  const { data: existingMerchants = [] } = useQuery({
    queryKey: ['merchants-raw', user?.id],
    queryFn: async () => {
      if (!user) return [] as string[];
      const { data } = await supabase
        .from('transactions')
        .select('merchant')
        .eq('user_id', user.id)
        .not('merchant', 'is', null);
      return (data ?? [])
        .map((t) => t.merchant)
        .filter((m): m is string => !!m);
    },
    enabled: !!user && open,
    staleTime: 5 * 60 * 1000,
  });

  const [merchant, setMerchant] = useState(transaction.merchant || '');
  const [amount, setAmount] = useState(transaction.amount.toString());
  const [direction, setDirection] = useState<'credit' | 'debit'>(transaction.direction as 'credit' | 'debit');
  const [transactedAt, setTransactedAt] = useState<Date>(new Date(transaction.transacted_at));
  const [timeValue, setTimeValue] = useState(format(new Date(transaction.transacted_at), 'HH:mm'));
  const [bankAccount, setBankAccount] = useState('');
  const [categoryId, setCategoryId] = useState(transaction.category_id || 'none');
  const [groupId, setGroupId] = useState((transaction as any).group_id || 'none');
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  
  const [showCreateCategory, setShowCreateCategory] = useState(false);
  const [showCreateGroup, setShowCreateGroup] = useState(false);
  const [showCreateBank, setShowCreateBank] = useState(false);

  useEffect(() => {
    if (open) {
      const date = new Date(transaction.transacted_at);
      setMerchant(transaction.merchant || '');
      setAmount(transaction.amount.toString());
      setDirection(transaction.direction as 'credit' | 'debit');
      setTransactedAt(date);
      setTimeValue(format(date, 'HH:mm'));
      // Combine bank name and account for display
      let combined = '';
      if (transaction.bank_name && transaction.account_last4) {
        combined = `${transaction.bank_name} ••${transaction.account_last4}`;
      } else if (transaction.bank_name) {
        combined = transaction.bank_name;
      } else if (transaction.account_last4) {
        combined = `••${transaction.account_last4}`;
      }
      setBankAccount(combined);
      
      setCategoryId(transaction.category_id || 'none');
      setGroupId((transaction as any).group_id || 'none');
    }
  }, [open, transaction]);

  const handleDateSelect = (date: Date | undefined) => {
    if (date) {
      const [hours, minutes] = timeValue.split(':').map(Number);
      date.setHours(hours, minutes);
      setTransactedAt(date);
      setDatePickerOpen(false);
    }
  };

  const handleTimeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setTimeValue(e.target.value);
    const [hours, minutes] = e.target.value.split(':').map(Number);
    const newDate = new Date(transactedAt);
    newDate.setHours(hours, minutes);
    setTransactedAt(newDate);
  };

  const handleSave = async () => {
    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      toast({ title: 'Please enter a valid amount', variant: 'destructive' });
      return;
    }

    // Parse combined bank account field
    const { bankName, accountLast4 } = parseBankAccount(bankAccount);

    try {
      const canonicalMerchant = merchant.trim()
        ? canonicalMerchantCasing(merchant, existingMerchants)
        : null;

      const directionChanged = direction !== transaction.direction;
      const updates: Record<string, unknown> = {
        merchant: canonicalMerchant,
        amount: parsedAmount,
        direction,
        transacted_at: transactedAt.toISOString(),
        bank_name: bankName || null,
        account_last4: accountLast4 || null,
        category_id: categoryId === 'none' ? null : categoryId,
        group_id: groupId === 'none' ? null : groupId,
      };
      if (directionChanged) {
        updates.is_expense = direction === 'debit';
        updates.is_income = direction === 'credit';
      }

      await updateMutation.mutateAsync({
        id: transaction.id,
        updates: updates as any,
      });
      toast({ title: 'Transaction updated' });
      onOpenChange(false);
    } catch {
      toast({ title: 'Failed to update transaction', variant: 'destructive' });
    }
  };

  const bankAccountOptions = bankAccounts.map(a => ({
    value: a.technicalDisplay,
    label: a.display,
  }));

  return (
    <>
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
                        Debit
                      </span>
                    </SelectItem>
                    <SelectItem value="credit">
                      <span className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-success" />
                        Credit
                      </span>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Date & Time */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label className="text-sm text-muted-foreground">Date</Label>
                <Popover open={datePickerOpen} onOpenChange={setDatePickerOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal bg-muted/30 border-border/50 rounded-xl",
                        !transactedAt && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {format(transactedAt, "MMM d, yyyy")}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0 glass-card border-border/50" align="start">
                    <Calendar
                      mode="single"
                      selected={transactedAt}
                      onSelect={handleDateSelect}
                      initialFocus
                      className="p-3 pointer-events-auto"
                    />
                  </PopoverContent>
                </Popover>
              </div>
              <div className="space-y-2">
                <Label className="text-sm text-muted-foreground">Time</Label>
                <div className="relative">
                  <Clock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-foreground pointer-events-none z-10" />
                  <Input
                    type="time"
                    value={timeValue}
                    onChange={handleTimeChange}
                    className="bg-muted/30 border-border/50 rounded-xl pl-10 [&::-webkit-calendar-picker-indicator]:hidden"
                  />
                </div>
              </div>
            </div>

            {/* Category */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-sm text-muted-foreground">Category</Label>
                <button
                  type="button"
                  onClick={() => setShowCreateCategory(true)}
                  className="text-xs text-primary hover:underline flex items-center gap-1"
                >
                  <Plus className="w-3 h-3" />
                  New
                </button>
              </div>
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

            {/* Group */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-sm text-muted-foreground">Group</Label>
                <button
                  type="button"
                  onClick={() => setShowCreateGroup(true)}
                  className="text-xs text-primary hover:underline flex items-center gap-1"
                >
                  <Plus className="w-3 h-3" />
                  New
                </button>
              </div>
              <Select value={groupId} onValueChange={setGroupId}>
                <SelectTrigger className="bg-muted/30 border-border/50 rounded-xl">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="glass-card border-border/50">
                  <SelectItem value="none">No group</SelectItem>
                  {visibleGroups(groups, groupId === 'none' ? null : groupId).map(grp => (
                    <SelectItem key={grp.id} value={grp.id}>
                      {grp.icon} {grp.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Bank Account (combined) */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-sm text-muted-foreground">Bank Account</Label>
                <button
                  type="button"
                  onClick={() => setShowCreateBank(true)}
                  className="text-xs text-primary hover:underline flex items-center gap-1"
                >
                  <Plus className="w-3 h-3" />
                  New
                </button>
              </div>
              <ComboboxSelect
                value={bankAccount}
                onChange={setBankAccount}
                options={bankAccountOptions}
                placeholder="e.g., HDFC ••1234"
                allowCustom
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

      <CreateCategoryDialog
        open={showCreateCategory}
        onOpenChange={setShowCreateCategory}
        onCreated={(id) => setCategoryId(id)}
      />

      <CreateGroupDialog
        open={showCreateGroup}
        onOpenChange={setShowCreateGroup}
        onCreated={(id) => setGroupId(id)}
      />

      <CreateBankAccountDialog
        open={showCreateBank}
        onOpenChange={setShowCreateBank}
        onCreated={(display) => setBankAccount(display)}
      />
    </>
  );
}
