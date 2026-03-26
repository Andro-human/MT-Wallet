import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import { Search, SlidersHorizontal, X, ChevronDown, ChevronLeft, ChevronRight, ArrowLeft, Plus, Calendar as CalendarIcon, Trash2, Building2, Inbox, CheckCheck } from 'lucide-react';
import { format, startOfMonth, endOfMonth, subMonths, setMonth, setYear, getYear, getMonth } from 'date-fns';
import { AppLayout } from '@/components/layout/AppLayout';
import { TransactionCard } from '@/components/transactions/TransactionCard';
import { ActivitySummary } from '@/components/transactions/ActivitySummary';
import { AddTransactionDialog } from '@/components/transactions/AddTransactionDialog';
import { DuplicateSuggestionsCard } from '@/components/transactions/DuplicateSuggestionsCard';
import { SpendingDonut } from '@/components/dashboard/SpendingDonut';
import { useTransactions } from '@/hooks/useTransactions';
import { useCategories } from '@/hooks/useCategories';
import { useTransactionGroups } from '@/hooks/useTransactionGroups';
import { useBankAccounts } from '@/hooks/useBankAccounts';
import { useRefundTotals } from '@/hooks/useRefundLinks';
import { usePotentialDuplicatesList } from '@/hooks/usePotentialDuplicates';
import { formatINR } from '@/lib/formatCurrency';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { SearchableSelect } from '@/components/ui/SearchableSelect';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useQueryClient } from '@tanstack/react-query';
import { cn } from '@/lib/utils';
import { useProfile } from '@/hooks/useProfile';

type DateFilter = 'this-month' | 'last-month' | 'last-3-months' | 'custom' | 'all';
type DirectionFilter = 'all' | 'credit' | 'debit';
type SortMode = 'recent' | 'amount';

// Helper to update search params without losing existing ones
function useParamState(key: string, defaultValue: string) {
  const [searchParams, setSearchParams] = useSearchParams();
  const value = searchParams.get(key) || defaultValue;

  const setValue = useCallback((newValue: string) => {
    setSearchParams(prev => {
      const next = new URLSearchParams(prev);
      if (newValue === defaultValue) {
        next.delete(key);
      } else {
        next.set(key, newValue);
      }
      return next;
    }, { replace: true });
  }, [key, defaultValue, setSearchParams]);

  return [value, setValue] as const;
}

// ─── Month/Year Picker (reused from InsightsPage) ────────────────────────────
function MonthYearPicker({
  value,
  onChange,
  label,
  maxDate,
}: {
  value: Date;
  onChange: (d: Date) => void;
  label: string;
  maxDate?: Date;
}) {
  const year = getYear(value);
  const month = getMonth(value);
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  const changeYear = (delta: number) => {
    const newDate = setYear(value, year + delta);
    if (maxDate && newDate > maxDate) return;
    onChange(newDate);
  };

  const selectMonth = (m: number) => {
    let newDate = setMonth(value, m);
    if (maxDate && newDate > maxDate) {
      newDate = maxDate;
    }
    onChange(newDate);
  };

  const isMonthDisabled = (m: number) => {
    if (!maxDate) return false;
    const candidate = setMonth(setYear(new Date(), year), m);
    return candidate > maxDate;
  };

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">{label}</p>
      <div className="flex items-center justify-between">
        <button
          onClick={() => changeYear(-1)}
          className="w-8 h-8 rounded-lg bg-muted/50 flex items-center justify-center hover:bg-muted transition-colors"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
        <span className="text-sm font-bold text-foreground">{year}</span>
        <button
          onClick={() => changeYear(1)}
          className={cn(
            "w-8 h-8 rounded-lg bg-muted/50 flex items-center justify-center transition-colors",
            maxDate && year >= getYear(maxDate) ? "opacity-30 cursor-not-allowed" : "hover:bg-muted"
          )}
          disabled={maxDate ? year >= getYear(maxDate) : false}
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
      <div className="grid grid-cols-4 gap-1.5">
        {months.map((m, i) => (
          <button
            key={m}
            onClick={() => selectMonth(i)}
            disabled={isMonthDisabled(i)}
            className={cn(
              'py-2 rounded-lg text-xs font-medium transition-all duration-200',
              month === i
                ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/25'
                : isMonthDisabled(i)
                  ? 'text-muted-foreground/30 cursor-not-allowed'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
            )}
          >
            {m}
          </button>
        ))}
      </div>
    </div>
  );
}

export default function TransactionsPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();

  // All filter state lives in URL search params — survives navigation
  const [search, setSearch] = useParamState('search', '');
  const merchant = searchParams.get('merchant') || '';
  const bankNameParam = searchParams.get('bank') || '';
  const accountLast4Param = searchParams.get('account') || '';
  const [categoryFilter, setCategoryFilter] = useParamState('category', 'all');
  const [groupFilter, setGroupFilter] = useParamState('group', 'all');
  const [directionFilter, setDirectionFilter] = useParamState('direction', 'all');
  const [sortMode, setSortMode] = useParamState('sort', 'recent');

  // Date filter: default to 'all' when viewing a filtered entity, otherwise 'this-month'
  const isBankFiltered = !!bankNameParam || !!accountLast4Param;
  const isFilteredView = !!merchant || categoryFilter !== 'all' || groupFilter !== 'all' || isBankFiltered;
  const defaultDateFilter = isFilteredView ? 'all' : 'this-month';
  const [dateFilter, setDateFilter] = useParamState('date', defaultDateFilter);

  // Custom date range stored in URL
  const customStartStr = searchParams.get('from');
  const customEndStr = searchParams.get('to');
  const [customStart, setCustomStartState] = useState<Date>(
    customStartStr ? new Date(customStartStr) : startOfMonth(subMonths(new Date(), 5))
  );
  const [customEnd, setCustomEndState] = useState<Date>(
    customEndStr ? new Date(customEndStr) : new Date()
  );
  const [showCustomPicker, setShowCustomPicker] = useState(dateFilter === 'custom');

  const setCustomStart = useCallback((d: Date) => {
    setCustomStartState(d);
    setSearchParams(prev => {
      const next = new URLSearchParams(prev);
      next.set('from', format(d, 'yyyy-MM-dd'));
      return next;
    }, { replace: true });
  }, [setSearchParams]);

  const setCustomEnd = useCallback((d: Date) => {
    setCustomEndState(d);
    setSearchParams(prev => {
      const next = new URLSearchParams(prev);
      next.set('to', format(d, 'yyyy-MM-dd'));
      return next;
    }, { replace: true });
  }, [setSearchParams]);

  const effectiveSearch = merchant || search;

  // Local search input state for responsive typing, synced to URL param
  const [searchInput, setSearchInput] = useState(effectiveSearch);
  const [showFilters, setShowFilters] = useState(isFilteredView || categoryFilter !== 'all' || groupFilter !== 'all' || directionFilter !== 'all');
  const [showAddDialog, setShowAddDialog] = useState(false);

  // Multi-select mode
  const [isSelectMode, setIsSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isDeleting, setIsDeleting] = useState(false);

  // Debounce search input → URL param (300ms)
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();
  useEffect(() => {
    // Don't override merchant param with typed search
    if (merchant) return;
    debounceRef.current = setTimeout(() => {
      setSearch(searchInput);
    }, 300);
    return () => clearTimeout(debounceRef.current);
  }, [searchInput, merchant, setSearch]);

  const { data: categories = [] } = useCategories();
  const { data: groups = [] } = useTransactionGroups();
  const { data: bankAccountsList = [] } = useBankAccounts();

  const activeCategory = categories.find(c => c.id === categoryFilter);

  // Find the matching bank account (with nickname) for the filtered view
  const activeBankAccount = isBankFiltered
    ? bankAccountsList.find(
      (a) => a.bankName === bankNameParam && a.accountLast4 === accountLast4Param
    )
    : undefined;

  const dateRange = useMemo(() => {
    const now = new Date();
    switch (dateFilter as DateFilter) {
      case 'this-month':
        return { startDate: startOfMonth(now), endDate: endOfMonth(now) };
      case 'last-month':
        return { startDate: startOfMonth(subMonths(now, 1)), endDate: endOfMonth(subMonths(now, 1)) };
      case 'last-3-months':
        return { startDate: startOfMonth(subMonths(now, 2)), endDate: endOfMonth(now) };
      case 'custom':
        return { startDate: startOfMonth(customStart), endDate: endOfMonth(customEnd) };
      default:
        return {};
    }
  }, [dateFilter, customStart, customEnd]);

  const { data: transactions = [], isLoading, refetch } = useTransactions({
    ...dateRange,
    categoryId: categoryFilter !== 'all' ? categoryFilter : undefined,
    direction: (directionFilter !== 'all' ? directionFilter : undefined) as 'credit' | 'debit' | undefined,
    search: effectiveSearch || undefined,
    groupId: groupFilter !== 'all' ? groupFilter : undefined,
    bankName: bankNameParam || undefined,
    accountLast4: accountLast4Param || undefined,
  });

  // Sort transactions
  const sortedTransactions = useMemo(() => {
    if ((sortMode as SortMode) === 'amount') {
      return [...transactions].sort((a, b) => Number(b.amount) - Number(a.amount));
    }
    return transactions; // already sorted by date from query
  }, [transactions, sortMode]);

  // Batch-fetch refund totals for all debit transactions on screen
  const debitTxnIds = useMemo(() =>
    sortedTransactions.filter(t => t.direction === 'debit').map(t => t.id),
    [sortedTransactions]
  );
  const { data: refundTotals = {}, isLoading: refundTotalsLoading } = useRefundTotals(debitTxnIds);
  const isRefundReady = !refundTotalsLoading || debitTxnIds.length === 0;

  // Detect potential duplicate pairs across loaded transactions
  const { pairs: duplicatePairs, dismiss: dismissDuplicatePair } = usePotentialDuplicatesList(sortedTransactions);

  // Review Mode (Inbox)
  const { data: profile } = useProfile();
  const reviewEnabled = profile?.enable_review_mode ?? false;
  const [reviewMode, setReviewMode] = useParamState('inbox', 'false');
  const isInboxMode = reviewMode === 'true' && reviewEnabled;

  const groupedTransactions = useMemo(() => {
    // When inbox mode, filter to only unreviewed
    const txns = isInboxMode 
      ? sortedTransactions.filter(t => (t as any).needs_review)
      : sortedTransactions;

    if ((sortMode as SortMode) === 'amount') {
      return { _all: txns };
    }
    const grouped: Record<string, typeof txns> = {};
    txns.forEach(txn => {
      const date = format(new Date(txn.transacted_at), 'yyyy-MM-dd');
      if (!grouped[date]) grouped[date] = [];
      grouped[date].push(txn);
    });
    return grouped;
  }, [sortedTransactions, sortMode, isInboxMode]);

  const clearFilters = () => {
    setSearchInput('');
    setSearchParams({}, { replace: true });
  };

  const handleApproveAll = async () => {
    if (!user) return;
    try {
      const unreviewedIds = sortedTransactions
        .filter(t => (t as any).needs_review)
        .map(t => t.id);
      if (unreviewedIds.length === 0) return;

      const { error } = await supabase
        .from('transactions')
        .update({ needs_review: false } as any)
        .in('id', unreviewedIds);

      if (error) throw error;
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      toast({ title: 'All Approved', description: `${unreviewedIds.length} transactions approved.` });
    } catch {
      toast({ title: 'Error', description: 'Failed to approve.', variant: 'destructive' });
    }
  };

  const hasActiveFilters = (dateFilter !== defaultDateFilter) || directionFilter !== 'all' || categoryFilter !== 'all' || groupFilter !== 'all' || effectiveSearch || searchInput;

  const activeGroup = groups.find(g => g.id === groupFilter);

  // Multi-select handlers
  const toggleSelectId = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAll = () => {
    setSelectedIds(new Set(sortedTransactions.map(t => t.id)));
  };

  const deselectAll = () => {
    setSelectedIds(new Set());
  };

  const handleDeleteSelected = async () => {
    if (!user || selectedIds.size === 0) return;

    const confirmed = window.confirm(`Delete ${selectedIds.size} transaction${selectedIds.size > 1 ? 's' : ''}? This cannot be undone.`);
    if (!confirmed) return;

    setIsDeleting(true);
    try {
      const { error } = await supabase
        .from('transactions')
        .delete()
        .in('id', Array.from(selectedIds))
        .eq('user_id', user.id);

      if (error) throw error;

      toast({ title: `${selectedIds.size} transaction${selectedIds.size > 1 ? 's' : ''} deleted` });
      setSelectedIds(new Set());
      setIsSelectMode(false);
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
    } catch (err) {
      console.error('Error deleting transactions:', err);
      toast({ title: 'Failed to delete transactions', variant: 'destructive' });
    } finally {
      setIsDeleting(false);
    }
  };

  const exitSelectMode = () => {
    setIsSelectMode(false);
    setSelectedIds(new Set());
  };

  const handleSwipeApprove = async (txnId: string) => {
    try {
      const { error } = await supabase
        .from('transactions')
        .update({ needs_review: false } as any)
        .eq('id', txnId);
      if (error) throw error;
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      toast({ title: 'Approved' });
    } catch {
      toast({ title: 'Failed to approve', variant: 'destructive' });
    }
  };

  return (
    <AppLayout>
      <div className="px-4 sm:px-5 pt-6 md:pt-12 pb-24 safe-area-top">
        {/* Back Button for Filtered Views */}
        {isFilteredView && !isSelectMode && (
          <motion.button
            initial={{ opacity: 0, x: -12 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.3 }}
            onClick={() => navigate(-1)}
            className="flex items-center gap-2 text-muted-foreground hover:text-foreground mb-4 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="text-sm">Back</span>
          </motion.button>
        )}

        {/* Multi-select toolbar */}
        <AnimatePresence>
          {isSelectMode && (
            <motion.div
              initial={{ opacity: 0, y: -12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              className="flex items-center justify-between mb-4 p-3 glass-card rounded-xl"
            >
              <div className="flex items-center gap-3">
                <button onClick={exitSelectMode} className="text-muted-foreground hover:text-foreground">
                  <X className="w-5 h-5" />
                </button>
                <span className="text-sm font-medium">
                  {selectedIds.size} selected
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={selectedIds.size === sortedTransactions.length ? deselectAll : selectAll}
                  className="text-xs"
                >
                  {selectedIds.size === sortedTransactions.length ? 'Deselect All' : 'Select All'}
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={handleDeleteSelected}
                  disabled={selectedIds.size === 0 || isDeleting}
                  className="gap-1.5"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  {isDeleting ? 'Deleting...' : 'Delete'}
                </Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Header */}
        {!isSelectMode && (
          <motion.div
            initial={{ opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
            className="mb-6"
          >
            {activeGroup ? (
              <>
                <div className="flex items-center gap-3 mb-1">
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center text-lg"
                    style={{ backgroundColor: activeGroup.color + '20' }}
                  >
                    {activeGroup.icon}
                  </div>
                  <div>
                    <h1 className="text-2xl font-bold text-foreground">{activeGroup.name}</h1>
                    {activeGroup.description && (
                      <p className="text-sm text-muted-foreground">{activeGroup.description}</p>
                    )}
                  </div>
                </div>
                <p className="text-sm text-muted-foreground mt-2">
                  {transactions.length} transactions
                </p>
              </>
            ) : activeCategory && categoryFilter !== 'all' ? (
              <>
                <div className="flex items-center gap-3 mb-1">
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center text-lg"
                    style={{ backgroundColor: activeCategory.color + '20' }}
                  >
                    {activeCategory.icon}
                  </div>
                  <div>
                    <h1 className="text-2xl font-bold text-foreground">{activeCategory.name}</h1>
                    <p className="text-sm text-muted-foreground">Category</p>
                  </div>
                </div>
                <p className="text-sm text-muted-foreground mt-2">
                  {transactions.length} transactions
                </p>
              </>
            ) : isBankFiltered ? (
              <>
                <div className="flex items-center gap-3 mb-1">
                  <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center">
                    <Building2 className="w-5 h-5 text-blue-400" />
                  </div>
                  <div>
                    <h1 className="text-2xl font-bold text-foreground">
                      {activeBankAccount?.display
                        ?? (bankNameParam && accountLast4Param
                          ? `${bankNameParam} ••${accountLast4Param}`
                          : bankNameParam || `••${accountLast4Param}`)}
                    </h1>
                    {activeBankAccount?.nickname && (
                      <p className="text-sm text-muted-foreground">{activeBankAccount.technicalDisplay}</p>
                    )}
                    {!activeBankAccount?.nickname && (
                      <p className="text-sm text-muted-foreground">Bank Account</p>
                    )}
                  </div>
                </div>
                <p className="text-sm text-muted-foreground mt-2">
                  {transactions.length} transactions
                </p>
              </>
            ) : merchant ? (
              <>
                <h1 className="text-2xl font-bold text-foreground">{merchant}</h1>
                <p className="text-sm text-muted-foreground mt-0.5">
                  {transactions.length} transactions
                </p>
              </>
            ) : (
              <>
                <h1 className="text-2xl font-bold text-foreground">Activity</h1>
                <p className="text-sm text-muted-foreground mt-0.5">
                  {transactions.length} transactions found
                </p>
              </>
            )}
          </motion.div>
        )}

        {/* Activity Summary Chart (default view) */}
        {!isFilteredView && !isSelectMode && (
          <ActivitySummary
            transactions={transactions}
            dateRange={dateRange}
            isLoading={isLoading || !isRefundReady}
            refundTotals={refundTotals}
          />
        )}

        {/* Filtered View Spending Summary (category / merchant / group pages) */}
        {isFilteredView && transactions.length > 0 && !isSelectMode && isRefundReady && (
          <FilteredViewSummary
            transactions={transactions}
            categories={categories}
            refundTotals={refundTotals}
          />
        )}

        {/* Duplicate Suggestions */}
        {!isSelectMode && (
          <DuplicateSuggestionsCard
            pairs={duplicatePairs}
            onDismiss={dismissDuplicatePair}
          />
        )}

        {/* Search */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1, duration: 0.3 }}
          className="relative mb-4"
        >
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search merchants or amount..."
            className="pl-11 h-12 bg-card/60 border-border/50 rounded-xl text-sm placeholder:text-muted-foreground/60 focus:bg-card focus:border-primary/30"
          />
          {searchInput && (
            <button
              onClick={() => { setSearchInput(''); setSearch(''); }}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </motion.div>

        {/* Filter Toggle + Select Mode Toggle */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15, duration: 0.3 }}
          className="flex items-center gap-2 mb-4 overflow-x-auto pb-1 -mx-1 px-1"
        >
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowFilters(!showFilters)}
            className={cn(
              'gap-2 rounded-xl border-border/50 flex-shrink-0',
              showFilters ? 'bg-primary/10 border-primary/30 text-primary' : ''
            )}
          >
            <SlidersHorizontal className="w-4 h-4" />
            Filters
            <ChevronDown className={cn('w-3.5 h-3.5 transition-transform duration-200', showFilters && 'rotate-180')} />
          </Button>

          {/* Inbox toggle */}
          {reviewEnabled && !isSelectMode && (
            <Button
              variant={isInboxMode ? 'default' : 'outline'}
              size="sm"
              onClick={() => setReviewMode(isInboxMode ? 'false' : 'true')}
              className={cn(
                'gap-1.5 rounded-xl border-border/50 flex-shrink-0',
                isInboxMode && 'bg-orange-500 hover:bg-orange-600 border-orange-600'
              )}
            >
              <Inbox className="w-3.5 h-3.5" />
              Inbox
              {sortedTransactions.filter(t => (t as any).needs_review).length > 0 && (
                <span className="ml-0.5 text-xs bg-white/20 px-1.5 rounded-full">
                  {sortedTransactions.filter(t => (t as any).needs_review).length}
                </span>
              )}
            </Button>
          )}

          {/* Approve All */}
          {isInboxMode && (
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 rounded-xl border-green-500/40 text-green-400 hover:bg-green-500/10 flex-shrink-0"
              onClick={handleApproveAll}
            >
              <CheckCheck className="w-3.5 h-3.5" />
              Approve All
            </Button>
          )}

          {!isSelectMode && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsSelectMode(true)}
              className="gap-2 rounded-xl border-border/50 flex-shrink-0"
            >
              Select
            </Button>
          )}

          {hasActiveFilters && (
            <Button
              variant="ghost"
              size="sm"
              onClick={clearFilters}
              className="text-muted-foreground hover:text-foreground ml-auto flex-shrink-0"
            >
              Clear all
            </Button>
          )}
        </motion.div>

        {/* Filters */}
        <AnimatePresence>
          {showFilters && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
              className="space-y-3 mb-5"
            >
              {/* Row 1: Date, Type, Sort */}
              <div className="grid grid-cols-3 gap-2">
                <SearchableSelect
                  value={dateFilter}
                  onValueChange={(v) => {
                    setDateFilter(v);
                    if (v === 'custom') setShowCustomPicker(true);
                    else setShowCustomPicker(false);
                  }}
                  options={[
                    { value: 'this-month', label: 'This Month' },
                    { value: 'last-month', label: 'Last Month' },
                    { value: 'last-3-months', label: '3 Months' },
                    { value: 'custom', label: 'Custom' },
                    { value: 'all', label: 'All Time' },
                  ]}
                  placeholder="Date"
                  triggerClassName="bg-card/60 text-xs h-10"
                />

                <SearchableSelect
                  value={directionFilter}
                  onValueChange={setDirectionFilter}
                  options={[
                    { value: 'all', label: 'All Types' },
                    { value: 'debit', label: 'Expenses' },
                    { value: 'credit', label: 'Income' },
                  ]}
                  placeholder="Type"
                  triggerClassName="bg-card/60 text-xs h-10"
                />

                <SearchableSelect
                  value={sortMode}
                  onValueChange={setSortMode}
                  options={[
                    { value: 'recent', label: 'Most Recent' },
                    { value: 'amount', label: 'Highest Amount' },
                  ]}
                  placeholder="Sort"
                  triggerClassName="bg-card/60 text-xs h-10"
                />
              </div>

              {/* Row 2: Category, Group */}
              <div className="grid grid-cols-2 gap-2">
                <SearchableSelect
                  value={categoryFilter}
                  onValueChange={setCategoryFilter}
                  options={[
                    { value: 'all', label: 'All Categories' },
                    ...categories.map(cat => ({
                      value: cat.id,
                      label: cat.name,
                      icon: cat.icon,
                    })),
                  ]}
                  placeholder="Category"
                  triggerClassName="bg-card/60 text-xs h-10"
                />

                <SearchableSelect
                  value={groupFilter}
                  onValueChange={setGroupFilter}
                  options={[
                    { value: 'all', label: 'All Groups' },
                    ...groups.map(grp => ({
                      value: grp.id,
                      label: grp.name,
                      icon: grp.icon,
                    })),
                  ]}
                  placeholder="Group"
                  triggerClassName="bg-card/60 text-xs h-10"
                />
              </div>

              {/* Custom Date Range Picker */}
              <AnimatePresence>
                {dateFilter === 'custom' && showCustomPicker && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.2 }}
                    className="overflow-hidden"
                  >
                    <div className="glass-card p-4 space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <MonthYearPicker
                          value={customStart}
                          onChange={setCustomStart}
                          label="From"
                          maxDate={customEnd}
                        />
                        <MonthYearPicker
                          value={customEnd}
                          onChange={setCustomEnd}
                          label="To"
                          maxDate={new Date()}
                        />
                      </div>
                      <div className="flex items-center justify-between pt-2 border-t border-border/30">
                        <p className="text-xs text-muted-foreground">
                          {format(startOfMonth(customStart), 'MMM yyyy')} – {format(endOfMonth(customEnd), 'MMM yyyy')}
                        </p>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setShowCustomPicker(false)}
                          className="text-xs"
                        >
                          Done
                        </Button>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Custom range summary (when picker is closed) */}
              {dateFilter === 'custom' && !showCustomPicker && (
                <button
                  onClick={() => setShowCustomPicker(true)}
                  className="flex items-center gap-2 px-3 py-2 rounded-xl bg-card/60 border border-border/50 text-sm hover:bg-card transition-colors"
                >
                  <CalendarIcon className="w-4 h-4 text-primary" />
                  <span className="text-foreground">
                    {format(customStart, 'MMM yyyy')} – {format(customEnd, 'MMM yyyy')}
                  </span>
                </button>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Transaction List */}
        <div className="space-y-5">
          {isLoading ? (
            Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-[72px] rounded-2xl" />
            ))
          ) : Object.keys(groupedTransactions).length > 0 ? (
            Object.entries(groupedTransactions).map(([date, txns], groupIndex) => (
              <motion.div
                key={date}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: groupIndex * 0.05, duration: 0.3 }}
              >
                {date !== '_all' && (
                  <p className="text-2xs text-muted-foreground uppercase tracking-extra-wide font-medium mb-2.5 px-1">
                    {format(new Date(date), 'EEEE, MMM d')}
                  </p>
                )}
                <div className="flex flex-col gap-3">
                  {txns.map((txn, i) => {
                    const refundTotal = isRefundReady ? refundTotals[txn.id] : undefined;
                    const net = refundTotal ? Number(txn.amount) - refundTotal : undefined;
                    const isSelected = selectedIds.has(txn.id);

                    if (isSelectMode) {
                      return (
                        <div
                          key={txn.id}
                          onClick={() => toggleSelectId(txn.id)}
                          className="flex items-center gap-3 cursor-pointer"
                        >
                          <div className={cn(
                            "w-6 h-6 rounded-md border-2 flex items-center justify-center flex-shrink-0 transition-colors",
                            isSelected
                              ? "bg-primary border-primary"
                              : "border-muted-foreground/30"
                          )}>
                            {isSelected && (
                              <svg className="w-4 h-4 text-primary-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                              </svg>
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <TransactionCard transaction={txn} index={i} netAmount={net} />
                          </div>
                        </div>
                      );
                    }

                    return (
                      <Link key={txn.id} to={`/transactions/${txn.id}`} className="block">
                        <TransactionCard
                          transaction={txn}
                          index={i}
                          netAmount={net}
                          onSwipeApprove={reviewEnabled ? handleSwipeApprove : undefined}
                        />
                      </Link>
                    );
                  })}
                </div>
              </motion.div>
            ))
          ) : (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-center py-16"
            >
              <p className="text-muted-foreground">No transactions found</p>
              <p className="text-sm text-muted-foreground/70 mt-1">Try adjusting your filters</p>
            </motion.div>
          )}
        </div>

        {/* FAB - Add Transaction */}
        {!isSelectMode && (
          <motion.button
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.3, type: 'spring', stiffness: 260, damping: 20 }}
            onClick={() => setShowAddDialog(true)}
            className="fixed bottom-24 right-5 w-14 h-14 rounded-full bg-primary text-primary-foreground shadow-lg shadow-primary/30 flex items-center justify-center hover:bg-primary/90 transition-colors z-20"
          >
            <Plus className="w-6 h-6" />
          </motion.button>
        )}
      </div>

      {/* Add Transaction Dialog */}
      <AddTransactionDialog
        open={showAddDialog}
        onOpenChange={setShowAddDialog}
      />
    </AppLayout>
  );
}

// ─── Filtered View Summary (Category / Merchant / Group page) ────────────────
function FilteredViewSummary({
  transactions,
  categories,
  refundTotals = {}
}: {
  transactions: any[];
  categories: any[];
  refundTotals?: Record<string, number>;
}) {
  const stats = useMemo(() => {
    const netAmount = (t: any) => {
      const refund = refundTotals[t.id] || 0;
      return Math.max(Number(t.amount) - refund, 0);
    };

    const totalSpent = transactions
      .filter(t => t.is_expense)
      .reduce((sum: number, t: any) => sum + netAmount(t), 0);

    const totalIncome = transactions
      .filter((t: any) => t.is_income)
      .reduce((sum: number, t: any) => sum + Number(t.amount), 0);

    const txnCount = transactions.length;

    // Category breakdown for the donut
    const catBreakdown: Record<string, number> = {};
    transactions
      .filter((t: any) => t.is_expense)
      .forEach((t: any) => {
        const catId = t.category_id || 'uncategorized';
        catBreakdown[catId] = (catBreakdown[catId] || 0) + netAmount(t);
      });

    const donutData = Object.entries(catBreakdown)
      .map(([catId, amount]) => {
        const cat = categories.find((c: any) => c.id === catId);
        return {
          name: cat?.name || 'Uncategorized',
          value: amount,
          color: cat?.color || '#6B7280',
          icon: cat?.icon || '📦',
        };
      })
      .sort((a, b) => b.value - a.value);

    return { totalSpent, totalIncome, txnCount, donutData };
  }, [transactions, categories, refundTotals]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
      className="glass-card p-5 mb-5"
    >
      {/* Donut Chart */}
      {stats.donutData.length > 0 && (
        <SpendingDonut data={stats.donutData} totalSpent={stats.totalSpent} />
      )}

      {/* Stats Row */}
      <div className="grid grid-cols-2 gap-px mt-4">
        <div className="text-center py-3 border-r border-border/30">
          <p className="text-2xs text-muted-foreground uppercase tracking-wider font-medium mb-1">
            Spent
          </p>
          <p className="text-sm font-bold text-foreground currency-display">
            {formatINR(stats.totalSpent)}
          </p>
        </div>
        <div className="text-center py-3">
          <p className="text-2xs text-muted-foreground uppercase tracking-wider font-medium mb-1">
            Received
          </p>
          <p className="text-sm font-bold text-success currency-display">
            {formatINR(stats.totalIncome)}
          </p>
        </div>
      </div>
    </motion.div>
  );
}
