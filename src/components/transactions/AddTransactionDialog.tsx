import { useState, useMemo } from 'react';
import { format } from 'date-fns';
import { CalendarIcon, Plus, Clock, Wallet, Banknote } from 'lucide-react';
import { useCategories } from '@/hooks/useCategories';
import { useTransactionGroups } from '@/hooks/useTransactionGroups';
import { usePaymentMethods } from '@/hooks/usePaymentMethods';
import { useBankAccounts, parseBankAccount } from '@/hooks/useBankAccounts';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { cn } from '@/lib/utils';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
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
import { SearchableSelect } from '@/components/ui/SearchableSelect';
import { CreateCategoryDialog } from './CreateCategoryDialog';
import { CreateGroupDialog } from './CreateGroupDialog';

interface AddTransactionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AddTransactionDialog({ open, onOpenChange }: AddTransactionDialogProps) {
  const { toast } = useToast();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { data: categories = [] } = useCategories();
  const { data: groups = [] } = useTransactionGroups();
  const { data: paymentMethods = [] } = usePaymentMethods();
  const { data: bankAccounts = [] } = useBankAccounts();

  const [merchant, setMerchant] = useState('');
  const [amount, setAmount] = useState('');
  const [direction, setDirection] = useState<'credit' | 'debit'>('debit');
  const [transactedAt, setTransactedAt] = useState<Date>(new Date());
  const [timeValue, setTimeValue] = useState(format(new Date(), 'HH:mm'));
  const [paymentMethod, setPaymentMethod] = useState('');
  const [bankAccount, setBankAccount] = useState('');
  const [categoryId, setCategoryId] = useState('none');
  const [groupId, setGroupId] = useState('none');
  const [isExpense, setIsExpense] = useState(true);
  const [isIncome, setIsIncome] = useState(true);
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const [merchantSearch, setMerchantSearch] = useState('');
  const [showMerchantSuggestions, setShowMerchantSuggestions] = useState(false);
  
  const [showCreateCategory, setShowCreateCategory] = useState(false);
  const [showCreateGroup, setShowCreateGroup] = useState(false);

  // Fetch existing merchants for autocomplete, sorted by frequency (most used first)
  const { data: existingMerchants = [] } = useQuery({
    queryKey: ['merchants-autocomplete', user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from('transactions')
        .select('merchant')
        .eq('user_id', user.id)
        .not('merchant', 'is', null);
      if (error) return [];
      // Count frequency of each merchant
      const freq: Record<string, number> = {};
      for (const t of data) {
        if (t.merchant) {
          freq[t.merchant] = (freq[t.merchant] || 0) + 1;
        }
      }
      // Sort by frequency (most used first)
      return Object.entries(freq)
        .sort((a, b) => b[1] - a[1])
        .map(([name]) => name);
    },
    enabled: !!user,
  });

  const filteredMerchants = useMemo(() => {
    if (!merchantSearch.trim()) return existingMerchants.slice(0, 8);
    const q = merchantSearch.toLowerCase();
    return existingMerchants.filter(m => m.toLowerCase().includes(q)).slice(0, 8);
  }, [merchantSearch, existingMerchants]);

  const resetForm = () => {
    setMerchant('');
    setMerchantSearch('');
    setAmount('');
    setDirection('debit');
    setTransactedAt(new Date());
    setTimeValue(format(new Date(), 'HH:mm'));
    setPaymentMethod('');
    setBankAccount('');
    setCategoryId('none');
    setGroupId('none');
    setIsExpense(true);
    setIsIncome(true);
    setNotes('');
  };

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
    if (!user) {
      toast({ title: 'Please log in', variant: 'destructive' });
      return;
    }

    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      toast({ title: 'Please enter a valid amount', variant: 'destructive' });
      return;
    }

    if (!merchant.trim()) {
      toast({ title: 'Please enter a merchant name', variant: 'destructive' });
      return;
    }

    // Parse combined bank account field
    const { bankName, accountLast4 } = parseBankAccount(bankAccount);

    setIsSubmitting(true);
    try {
      const { error } = await supabase
        .from('transactions')
        .insert({
          user_id: user.id,
          merchant: merchant.trim(),
          amount: parsedAmount,
          direction,
          transacted_at: transactedAt.toISOString(),
          payment_method: paymentMethod.trim() || null,
          bank_name: bankName || null,
          account_last4: accountLast4 || null,
          category_id: categoryId === 'none' ? null : categoryId,
          group_id: groupId === 'none' ? null : groupId,
          is_expense: direction === 'debit' ? isExpense : false,
          is_income: direction === 'credit' ? isIncome : false,
          notes: notes.trim() || null,
        } as any);

      if (error) throw error;

      toast({ title: 'Transaction added' });
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      queryClient.invalidateQueries({ queryKey: ['payment-methods'] });
      queryClient.invalidateQueries({ queryKey: ['bank-accounts'] });
      resetForm();
      onOpenChange(false);
    } catch (err) {
      console.error('Error adding transaction:', err);
      toast({ title: 'Failed to add transaction', variant: 'destructive' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const bankAccountOptions = bankAccounts.map(a => a.display);

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="glass-elevated border-border/50 max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-lg font-semibold">Add Transaction</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Merchant with autocomplete */}
            <div className="space-y-2 relative">
              <Label htmlFor="merchant" className="text-sm text-muted-foreground">Merchant *</Label>
              <Input
                id="merchant"
                value={merchant}
                onChange={(e) => {
                  setMerchant(e.target.value);
                  setMerchantSearch(e.target.value);
                  setShowMerchantSuggestions(true);
                }}
                onFocus={() => setShowMerchantSuggestions(true)}
                onBlur={() => setTimeout(() => setShowMerchantSuggestions(false), 200)}
                placeholder="e.g., Swiggy, Amazon"
                className="bg-muted/30 border-border/50 rounded-xl"
                autoComplete="off"
              />
              {showMerchantSuggestions && filteredMerchants.length > 0 && (
                <div className="absolute left-0 right-0 top-full mt-1 z-50 bg-popover border border-border/50 rounded-xl shadow-lg max-h-40 overflow-y-auto" style={{ WebkitOverflowScrolling: 'touch' }}>
                  {filteredMerchants.map((m) => (
                    <button
                      key={m}
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => {
                        setMerchant(m);
                        setMerchantSearch('');
                        setShowMerchantSuggestions(false);
                      }}
                      className="w-full text-left px-3 py-2 text-sm hover:bg-muted/50 transition-colors first:rounded-t-xl last:rounded-b-xl"
                    >
                      {m}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Amount & Direction */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="amount" className="text-sm text-muted-foreground">Amount (₹) *</Label>
                <Input
                  id="amount"
                  type="number"
                  step="0.01"
                  min="0"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0.00"
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
                  <input
                    type="time"
                    value={timeValue}
                    onChange={handleTimeChange}
                    className="flex h-10 w-full rounded-xl border border-border/50 bg-muted/30 px-3 pl-10 text-sm text-foreground ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 appearance-none [-webkit-appearance:none] [&::-webkit-date-and-time-value]:text-left [&::-webkit-calendar-picker-indicator]:hidden"
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
              <SearchableSelect
                value={categoryId}
                onValueChange={setCategoryId}
                options={[
                  { value: 'none', label: 'No category' },
                  ...categories.map(cat => ({
                    value: cat.id,
                    label: cat.name,
                    icon: cat.icon,
                  })),
                ]}
                placeholder="Select category"
              />
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
              <SearchableSelect
                value={groupId}
                onValueChange={setGroupId}
                options={[
                  { value: 'none', label: 'No group' },
                  ...groups.map(grp => ({
                    value: grp.id,
                    label: grp.name,
                    icon: grp.icon,
                  })),
                ]}
                placeholder="Select group"
              />
            </div>

            {/* Payment Method */}
            <div className="space-y-2">
              <Label className="text-sm text-muted-foreground">Payment Method</Label>
              <ComboboxSelect
                value={paymentMethod}
                onChange={setPaymentMethod}
                options={paymentMethods}
                placeholder="Select or add..."
                allowCustom
              />
            </div>

            {/* Bank Account (combined) */}
            <div className="space-y-2">
              <Label className="text-sm text-muted-foreground">Bank Account</Label>
              <ComboboxSelect
                value={bankAccount}
                onChange={setBankAccount}
                options={bankAccountOptions}
                placeholder="e.g., HDFC ••1234"
                allowCustom
              />
            </div>

            {/* Count as Expense/Income toggle */}
            {direction === 'debit' ? (
              <button
                type="button"
                onClick={() => setIsExpense(!isExpense)}
                className={cn(
                  "w-full flex items-center justify-between gap-3 h-11 px-4 rounded-xl border transition-colors",
                  isExpense
                    ? "border-destructive/30 bg-destructive/5"
                    : "border-border/50 bg-muted/20"
                )}
              >
                <div className="flex items-center gap-2.5">
                  <Wallet className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm">Count as Expense</span>
                </div>
                <div className={cn(
                  "w-9 h-5 rounded-full relative transition-colors duration-200",
                  isExpense ? "bg-destructive" : "bg-muted"
                )}>
                  <div className={cn(
                    "absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform duration-200",
                    isExpense ? "translate-x-4" : "translate-x-0.5"
                  )} />
                </div>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setIsIncome(!isIncome)}
                className={cn(
                  "w-full flex items-center justify-between gap-3 h-11 px-4 rounded-xl border transition-colors",
                  isIncome
                    ? "border-success/30 bg-success/5"
                    : "border-border/50 bg-muted/20"
                )}
              >
                <div className="flex items-center gap-2.5">
                  <Banknote className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm">Count as Income</span>
                </div>
                <div className={cn(
                  "w-9 h-5 rounded-full relative transition-colors duration-200",
                  isIncome ? "bg-success" : "bg-muted"
                )}>
                  <div className={cn(
                    "absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform duration-200",
                    isIncome ? "translate-x-4" : "translate-x-0.5"
                  )} />
                </div>
              </button>
            )}

            {/* Notes */}
            <div className="space-y-2">
              <Label className="text-sm text-muted-foreground">Notes</Label>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Add a note..."
                className="bg-muted/30 border-border/50 rounded-xl text-sm min-h-[60px] resize-none"
                rows={2}
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
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Adding...' : 'Add Transaction'}
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
    </>
  );
}
