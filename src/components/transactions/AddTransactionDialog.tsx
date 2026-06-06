import { useState, useMemo, useEffect } from 'react';
import { format } from 'date-fns';
import { CalendarIcon, Plus, Clock, Wallet, Banknote } from 'lucide-react';
import { useCategories } from '@/hooks/useCategories';
import { useTransactionGroups } from '@/hooks/useTransactionGroups';
import { useBankAccounts, parseBankAccount } from '@/hooks/useBankAccounts';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { useProfile } from '@/hooks/useProfile';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { cn } from '@/lib/utils';
import { canonicalMerchantCasing, normalizeMerchant } from '@/lib/merchantCanonical';
import { visibleGroups } from '@/lib/visibleGroups';
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
import { CreateBankAccountDialog } from './CreateBankAccountDialog';
import { AlertTriangle, Loader2 } from 'lucide-react';
import { useMarkAsTransaction } from '@/hooks/useReclassify';

/**
 * Optional SMS context. When present the dialog:
 *  - shows the SMS body in a callout
 *  - asks the backend to AI-extract fields to prefill the form
 *  - on save, hits the backend reclassify endpoint instead of doing a direct
 *    Supabase insert (so the sync_run's per-message detail is also patched)
 */
export interface SmsContext {
  runId: string;
  smsId: number;
  sender: string;
  body: string;
  timestamp: string | null;
}

interface AddTransactionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  smsContext?: SmsContext;
}

export function AddTransactionDialog({ open, onOpenChange, smsContext }: AddTransactionDialogProps) {
  const { toast } = useToast();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { data: categories = [] } = useCategories();
  const { data: groups = [] } = useTransactionGroups();
  const { data: bankAccounts = [] } = useBankAccounts();
  const { data: profile } = useProfile();

  const [merchant, setMerchant] = useState('');
  const [amount, setAmount] = useState('');
  const [direction, setDirection] = useState<'credit' | 'debit'>('debit');
  const [transactedAt, setTransactedAt] = useState<Date>(new Date());
  const [timeValue, setTimeValue] = useState(format(new Date(), 'HH:mm'));
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
  const [showCreateBank, setShowCreateBank] = useState(false);

  // Fetch existing merchants for autocomplete, sorted by frequency (most used first)
  const { data: existingMerchants = [] } = useQuery({
    queryKey: ['merchants-autocomplete', user?.id],
    enabled: !!user && open,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from('transactions')
        .select('merchant')
        .eq('user_id', user.id)
        .not('merchant', 'is', null);
      if (error) return [];
      // Case-fold + count frequency so "Swiggy" and "swiggy" collapse into
      // one autocomplete entry. Display the most-common casing for each key.
      const byKey = new Map<string, Map<string, number>>();
      for (const t of data) {
        if (!t.merchant) continue;
        const key = normalizeMerchant(t.merchant);
        const casings = byKey.get(key) ?? new Map<string, number>();
        casings.set(t.merchant, (casings.get(t.merchant) ?? 0) + 1);
        byKey.set(key, casings);
      }
      const ranked: { display: string; total: number }[] = [];
      for (const casings of byKey.values()) {
        let total = 0;
        let best = '';
        let bestCount = -1;
        for (const [casing, count] of casings) {
          total += count;
          if (count > bestCount) {
            best = casing;
            bestCount = count;
          }
        }
        ranked.push({ display: best, total });
      }
      return ranked.sort((a, b) => b.total - a.total).map((r) => r.display);
    },
    enabled: !!user,
  });

  const filteredMerchants = useMemo(() => {
    if (!merchantSearch.trim()) return existingMerchants.slice(0, 8);
    const q = merchantSearch.toLowerCase();
    return existingMerchants.filter(m => m.toLowerCase().includes(q)).slice(0, 8);
  }, [merchantSearch, existingMerchants]);

  // ── SMS context: fetch AI preview, prefill form ────────────────────────────
  const reclassify = useMarkAsTransaction(smsContext?.runId);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewWarning, setPreviewWarning] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !smsContext) {
      setPreviewWarning(null);
      return;
    }
    // Seed timestamp from the SMS immediately so the date/time inputs show
    // something sensible even before the AI call returns.
    if (smsContext.timestamp) {
      const d = new Date(smsContext.timestamp);
      setTransactedAt(d);
      setTimeValue(format(d, 'HH:mm'));
    }
    setPreviewLoading(true);
    setPreviewWarning(null);
    reclassify
      .mutateAsync({ smsId: smsContext.smsId })
      .then((res) => {
        if (res.committed) return;
        const previewRes = res as Extract<typeof res, { committed: false }>;
        const p = previewRes.preview;

        if (p.amount != null) setAmount(String(p.amount));
        if (p.direction) setDirection(p.direction);
        if (p.merchant) setMerchant(p.merchant);
        if (p.bank_name || p.account_last4) {
          const bank = p.bank_name ?? '';
          const last4 = p.account_last4 ?? '';
          setBankAccount(last4 ? `${bank} ••${last4}`.trim() : bank);
        }
        if (p.category_slug) {
          const match = categories.find((c) => c.slug === p.category_slug);
          if (match) setCategoryId(match.id);
        }

        const missing: string[] = [];
        if (p.amount == null) missing.push('amount');
        if (p.direction == null) missing.push('direction');
        if (missing.length) {
          setPreviewWarning(
            `Couldn't extract ${missing.join(' or ')} from this SMS — fill in manually if it really is a transaction.`,
          );
        }
        if (previewRes.extract_error) setPreviewWarning(previewRes.extract_error);
      })
      .catch((err) => setPreviewWarning(err?.message ?? 'Failed to load preview'))
      .finally(() => setPreviewLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, smsContext?.smsId]);

  const resetForm = () => {
    setMerchant('');
    setMerchantSearch('');
    setAmount('');
    setDirection('debit');
    setTransactedAt(new Date());
    setTimeValue(format(new Date(), 'HH:mm'));
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
      const canonicalMerchant = canonicalMerchantCasing(merchant, existingMerchants);
      const resolvedCategorySlug =
        categoryId !== 'none'
          ? categories.find((c) => c.id === categoryId)?.slug ?? null
          : null;

      if (smsContext) {
        // SMS-backed save: go through the backend so the sync_run details get
        // patched and the badge flips from "skipped" to "inserted".
        await reclassify.mutateAsync({
          smsId: smsContext.smsId,
          fields: {
            amount: parsedAmount,
            direction,
            merchant: canonicalMerchant,
            account_last4: accountLast4 || null,
            bank_name: bankName || null,
            category_slug: resolvedCategorySlug,
            transacted_at: transactedAt.toISOString(),
            notes: notes.trim() || null,
            group_id: groupId === 'none' ? null : groupId,
            is_expense: direction === 'debit' ? isExpense : false,
            is_income: direction === 'credit' ? isIncome : false,
          },
        });
      } else {
        const { error } = await supabase
          .from('transactions')
          .insert({
            user_id: user.id,
            merchant: canonicalMerchant,
            amount: parsedAmount,
            direction,
            transacted_at: transactedAt.toISOString(),
            bank_name: bankName || null,
            account_last4: accountLast4 || null,
            category_id: categoryId === 'none' ? null : categoryId,
            group_id: groupId === 'none' ? null : groupId,
            is_expense: direction === 'debit' ? isExpense : false,
            is_income: direction === 'credit' ? isIncome : false,
            notes: notes.trim() || null,
            needs_review: profile?.enable_review_mode ? true : false,
          } as any);

        if (error) throw error;
      }

      toast({ title: 'Transaction added' });
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      queryClient.invalidateQueries({ queryKey: ['bank-accounts'] });
      resetForm();
      onOpenChange(false);
    } catch (err: any) {
      console.error('Error adding transaction:', err);
      toast({
        title: 'Failed to add transaction',
        description: err?.message,
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
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
            <DialogTitle className="text-lg font-semibold">
              {smsContext ? 'Add transaction from SMS' : 'Add Transaction'}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* SMS context: show the message body + AI preview status */}
            {smsContext && (
              <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  From {smsContext.sender}
                </p>
                <p className="text-xs font-mono text-muted-foreground bg-muted/30 rounded-lg p-3 whitespace-pre-wrap break-all max-h-28 overflow-y-auto">
                  {smsContext.body}
                </p>
                {previewLoading && (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Loader2 className="w-3 h-3 animate-spin" />
                    Extracting fields…
                  </div>
                )}
                {previewWarning && (
                  <div className="flex items-start gap-2 p-2.5 rounded-lg bg-yellow-400/10 border border-yellow-400/30 text-xs text-yellow-200">
                    <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                    <span>{previewWarning}</span>
                  </div>
                )}
              </div>
            )}

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
                  ...visibleGroups(groups, groupId === 'none' ? null : groupId).map(grp => ({
                    value: grp.id,
                    label: grp.name,
                    icon: grp.icon,
                  })),
                ]}
                placeholder="Select group"
              />
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
              disabled={isSubmitting || previewLoading}
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

      <CreateBankAccountDialog
        open={showCreateBank}
        onOpenChange={setShowCreateBank}
        onCreated={(display) => setBankAccount(display)}
      />
    </>
  );
}
