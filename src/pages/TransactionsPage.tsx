import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import { Search, SlidersHorizontal, X, ChevronDown, ChevronRight, ChevronLeft, ArrowLeft, Plus, Calendar as CalendarIcon, Trash2, Building2, Inbox, CheckCheck, RotateCcw, Layers, Eye, EyeOff } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { format, startOfMonth, endOfMonth, subMonths, addMonths, isSameMonth } from 'date-fns';
import { AppLayout } from '@/components/layout/AppLayout';
import { TransactionCard } from '@/components/transactions/TransactionCard';
import { useBankDisplayMap, lookupBankDisplay } from '@/hooks/useBankDisplayMap';
import { ActivitySummary } from '@/components/transactions/ActivitySummary';
import { AddTransactionDialog } from '@/components/transactions/AddTransactionDialog';
import { DuplicateSuggestionsCard } from '@/components/transactions/DuplicateSuggestionsCard';
import { SpendingDonut } from '@/components/dashboard/SpendingDonut';
import { useTransactions } from '@/hooks/useTransactions';
import { useCategories } from '@/hooks/useCategories';
import { useTransactionGroups } from '@/hooks/useTransactionGroups';
import { useBankAccounts } from '@/hooks/useBankAccounts';
import { useFinanceContext } from '@/hooks/useFinanceData';
import { usePotentialDuplicatesList } from '@/hooks/usePotentialDuplicates';
import { useCombineMaps, useCreateCombine, useUncombine } from '@/hooks/useCombinedTransactions';
import { CombinedTransactionCard } from '@/components/transactions/CombinedTransactionCard';
import { TransactionWithCategory } from '@/types/database';
import {
  netAmount as computeNetAmount,
  creditNet,
  sumSpent,
  sumIncome,
  categoryChartData,
  classifyTransaction,
} from '@/lib/transactionMath';
import { MonthYearPicker } from '@/components/ui/MonthYearPicker';
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
import { useReviewBookmark, useSetReviewBookmark } from '@/hooks/useReviewBookmark';
import { countNewSince } from '@/lib/countNewSince';
import { ReviewResumeBanner } from '@/components/transactions/ReviewResumeBanner';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
  DropdownMenuCheckboxItem,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { BookmarkPlus } from 'lucide-react';
import { entityColor } from '@/lib/categoryColors';

type DateFilter = 'this-month' | 'last-month' | 'last-3-months' | 'custom' | 'all';
type DirectionFilter = 'all' | 'credit' | 'debit';
type SortMode = 'recent' | 'amount';

// A row in the activity list is either a standalone transaction or a collapsed
// "combined" cluster (split-tender: one purchase paid across instruments).
type DisplayUnit =
  | { kind: 'single'; txn: TransactionWithCategory }
  | { kind: 'combined'; combineId: string; members: TransactionWithCategory[] };

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

export default function TransactionsPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const bankDisplayMap = useBankDisplayMap();
  const reviewBookmark = useReviewBookmark();
  const setReviewBookmark = useSetReviewBookmark();
  const firstNewerRef = useRef<HTMLDivElement | null>(null);

  // All filter state lives in URL search params — survives navigation
  const [search, setSearch] = useParamState('search', '');
  const merchant = searchParams.get('merchant') || '';
  const bankNameParam = searchParams.get('bank') || '';
  const accountLast4Param = searchParams.get('account') || '';
  const ungroupedParam = searchParams.get('ungrouped') === '1';
  const uncategorizedParam = searchParams.get('uncat') === '1';
  const [categoryFilter, setCategoryFilter] = useParamState('category', 'all');
  const [groupFilter, setGroupFilter] = useParamState('group', 'all');
  const [directionFilter, setDirectionFilter] = useParamState('direction', 'all');
  const [sortMode, setSortMode] = useParamState('sort', 'recent');

  // Date filter: default to 'all' when viewing a filtered entity, otherwise 'this-month'
  const isBankFiltered = !!bankNameParam || !!accountLast4Param;
  const isFilteredView = !!merchant || categoryFilter !== 'all' || groupFilter !== 'all' || isBankFiltered || ungroupedParam || uncategorizedParam;
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

  // Single-month view detection — drives the ◀ ▶ month strip.
  const viewingMonth = useMemo(() => {
    const s = dateRange.startDate;
    const e = dateRange.endDate;
    if (!s || !e) return null;
    return isSameMonth(s, e) ? startOfMonth(s) : null;
  }, [dateRange]);

  const goToMonth = useCallback((month: Date) => {
    const mStart = startOfMonth(month);
    const mEnd = endOfMonth(month);
    const now = new Date();
    setCustomStart(mStart);
    setCustomEnd(mEnd);
    if (isSameMonth(mStart, now)) {
      setDateFilter('this-month');
    } else if (isSameMonth(mStart, subMonths(now, 1))) {
      setDateFilter('last-month');
    } else {
      setDateFilter('custom');
    }
    setShowCustomPicker(false);
  }, [setCustomStart, setCustomEnd, setDateFilter]);

  const canGoNextMonth = viewingMonth ? !isSameMonth(viewingMonth, new Date()) : false;

  const { data: transactions = [], isLoading, refetch } = useTransactions({
    ...dateRange,
    categoryId: categoryFilter !== 'all' ? categoryFilter : undefined,
    direction: (directionFilter !== 'all' ? directionFilter : undefined) as 'credit' | 'debit' | undefined,
    search: effectiveSearch || undefined,
    groupId: groupFilter !== 'all' ? groupFilter : undefined,
    ungrouped: ungroupedParam || undefined,
    uncategorized: uncategorizedParam || undefined,
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

  const { refundTotals, refundAllocations, duplicateExcludeIds, isReady: financeReady } = useFinanceContext();
  const isRefundReady = financeReady;

  // '1' = hidden (default). Presentation only; Insights/Home already exclude these.
  const [hideDuplicates, setHideDuplicates] = useParamState('hideDup', '1');
  const [hideRefunded, setHideRefunded] = useParamState('hideRef', '1');
  const [hideNonCounted, setHideNonCounted] = useParamState('hideNc', '1');

  // One setSearchParams call — separate setters each read the same stale URL, so
  // only the last would persist.
  const setAllNoise = useCallback((show: boolean) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      for (const key of ['hideDup', 'hideRef', 'hideNc']) {
        if (show) next.set(key, '0');
        else next.delete(key);
      }
      return next;
    }, { replace: true });
  }, [setSearchParams]);

  // Detect potential duplicate pairs across loaded transactions
  const { pairs: duplicatePairs, dismiss: dismissDuplicatePair } = usePotentialDuplicatesList(sortedTransactions);

  // Combined (split-tender) transactions — display-only grouping overlay.
  const { data: combineMaps } = useCombineMaps();
  const combineByTxnId = combineMaps?.combineByTxnId ?? {};
  const membersByCombineId = combineMaps?.membersByCombineId ?? {};
  const createCombine = useCreateCombine();
  const uncombine = useUncombine();

  // Review Mode (Inbox)
  const { data: profile } = useProfile();
  const reviewEnabled = profile?.enable_review_mode ?? false;

  // Banner: count txns newer than the bookmark within the CURRENT filtered view.
  const newSinceBookmark = useMemo(() => {
    if (!reviewBookmark) return 0;
    return countNewSince(sortedTransactions, reviewBookmark);
  }, [sortedTransactions, reviewBookmark]);

  // First txn to land on when the user taps "Catch up":
  // sortedTransactions is DESC by transacted_at, so the OLDEST-among-newer is
  // the last element in the newer-filtered slice — that's where "new" begins
  // visually (scrolling upward from there shows newer activity).
  const firstNewerId = useMemo(() => {
    if (!reviewBookmark) return null;
    const cutoff = reviewBookmark.transactedAt.getTime();
    let lastNewerId: string | null = null;
    for (const t of sortedTransactions) {
      if (new Date(t.transacted_at).getTime() > cutoff) {
        lastNewerId = t.id;
      }
    }
    return lastNewerId;
  }, [sortedTransactions, reviewBookmark]);

  const [highlightTxnId, setHighlightTxnId] = useState<string | null>(null);
  const handleResumeReview = useCallback(() => {
    if (!firstNewerRef.current || !firstNewerId) return;
    firstNewerRef.current.scrollIntoView({ block: 'center', behavior: 'smooth' });
    setHighlightTxnId(firstNewerId);
    window.setTimeout(() => setHighlightTxnId(null), 2500);
  }, [firstNewerId]);

  const handleBookmarkTxn = useCallback(
    (txn: { id: string; transacted_at: string; created_at: string }) => {
      setReviewBookmark.mutate(
        {
          transactionId: txn.id,
          transactedAt: txn.transacted_at,
          createdAt: txn.created_at,
        },
        {
          onSuccess: () => {
            toast({ title: 'Marked as last reviewed' });
          },
          onError: () => {
            toast({ title: 'Failed to mark', variant: 'destructive' });
          },
        }
      );
    },
    [setReviewBookmark, toast]
  );
  const [reviewMode, setReviewMode] = useParamState('inbox', 'false');
  const isInboxMode = reviewMode === 'true' && reviewEnabled;

  const groupedUnits = useMemo(() => {
    // When inbox mode, filter to only unreviewed
    const txns = isInboxMode
      ? sortedTransactions.filter(t => (t as any).needs_review)
      : sortedTransactions;

    // In select mode, never collapse — legs must stay individually selectable.
    const collapse = !isSelectMode;
    const txnById = new Map(txns.map(t => [t.id, t]));
    const handled = new Set<string>();
    const units: DisplayUnit[] = [];

    for (const txn of txns) {
      if (handled.has(txn.id)) continue;
      const combineId = collapse ? combineByTxnId[txn.id] : undefined;
      if (combineId) {
        const memberIds = (membersByCombineId[combineId] ?? []).map(m => m.transaction_id);
        const present = memberIds
          .map(id => txnById.get(id))
          .filter((t): t is TransactionWithCategory => !!t);
        // Only collapse when 2+ members are actually in the current view.
        if (present.length >= 2) {
          present.forEach(m => handled.add(m.id));
          units.push({ kind: 'combined', combineId, members: present });
          continue;
        }
      }
      handled.add(txn.id);
      units.push({ kind: 'single', txn });
    }

    // Inbox reviews all kinds; gate on financeReady so refund/duplicate state is known.
    const applyNoise = !isInboxMode && financeReady;
    const visibleUnits = !applyNoise ? units : units.filter((u) => {
      if (u.kind === 'combined') {
        // Combined parent shows when net > 0; net 0 falls under the refund filter.
        const net = u.members.reduce((s, m) => {
          const isDebit = m.direction !== 'credit';
          return s + (isDebit
            ? computeNetAmount(m as any, refundTotals)
            : creditNet(m as any, refundAllocations));
        }, 0);
        return net > 0 ? true : hideRefunded !== '1';
      }
      const bucket = classifyTransaction(u.txn as any, {
        duplicateExcludeIds,
        refundTotals,
        refundAllocations,
      });
      if (bucket === 'real') return true;
      if (bucket === 'duplicate') return hideDuplicates !== '1';
      if (bucket === 'non-counted') return hideNonCounted !== '1';
      return hideRefunded !== '1'; // 'refunded'
    });

    const mostRecent = (ms: TransactionWithCategory[]) =>
      ms.reduce((a, b) => (new Date(b.transacted_at) > new Date(a.transacted_at) ? b : a));
    const unitDate = (u: DisplayUnit) =>
      u.kind === 'single' ? u.txn.transacted_at : mostRecent(u.members).transacted_at;

    if ((sortMode as SortMode) === 'amount') {
      // Sort on the effective amount (refund-netted), not the raw one, so the
      // order matches the figures shown on the rows.
      const netOf = (m: TransactionWithCategory) =>
        m.direction !== 'credit'
          ? computeNetAmount(m as any, refundTotals)
          : creditNet(m as any, refundAllocations);
      const value = (u: DisplayUnit) =>
        u.kind === 'single' ? netOf(u.txn) : u.members.reduce((s, m) => s + netOf(m), 0);
      return { _all: [...visibleUnits].sort((a, b) => value(b) - value(a)) };
    }

    const grouped: Record<string, DisplayUnit[]> = {};
    for (const u of visibleUnits) {
      const date = format(new Date(unitDate(u)), 'yyyy-MM-dd');
      (grouped[date] ??= []).push(u);
    }
    return grouped;
  }, [sortedTransactions, sortMode, isInboxMode, isSelectMode, combineByTxnId, membersByCombineId,
      financeReady, duplicateExcludeIds, refundTotals, refundAllocations,
      hideDuplicates, hideRefunded, hideNonCounted]);

  // Count of real transactions actually shown (combined units count their legs).
  const visibleTxnCount = useMemo(() => {
    let n = 0;
    for (const units of Object.values(groupedUnits)) {
      for (const u of units) n += u.kind === 'single' ? 1 : u.members.length;
    }
    return n;
  }, [groupedUnits]);

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

  // Re-flag every visible (currently-filtered, loaded) transaction as
  // needs_review = true. Mirrors handleApproveAll's pattern so it respects
  // ALL active filters (date, category, group, merchant, bank, direction),
  // not just the date range.
  const handleReopenForReview = async () => {
    if (!user) return;
    try {
      const idsToFlag = sortedTransactions
        .filter(t => !(t as any).needs_review)
        .map(t => t.id);
      if (idsToFlag.length === 0) {
        toast({ title: 'Nothing to mark', description: 'All visible transactions are already flagged.' });
        return;
      }

      const { error } = await supabase
        .from('transactions')
        .update({ needs_review: true } as any)
        .in('id', idsToFlag);

      if (error) throw error;
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      toast({
        title: 'Marked for review',
        description: `${idsToFlag.length} transaction${idsToFlag.length === 1 ? '' : 's'} flagged.`,
      });
    } catch {
      toast({ title: 'Error', description: 'Failed to mark for review.', variant: 'destructive' });
    }
  };

  const hasActiveFilters = (dateFilter !== defaultDateFilter) || directionFilter !== 'all' || categoryFilter !== 'all' || groupFilter !== 'all' || ungroupedParam || uncategorizedParam || effectiveSearch || searchInput;

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

  const [showBulkDeleteConfirm, setShowBulkDeleteConfirm] = useState(false);

  const handleDeleteSelected = async () => {
    if (!user || selectedIds.size === 0) return;

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

  const handleCombineSelected = async () => {
    if (selectedIds.size < 2) {
      toast({ title: 'Select at least two transactions to combine' });
      return;
    }
    try {
      await createCombine.mutateAsync({ transactionIds: Array.from(selectedIds) });
      toast({ title: `Combined ${selectedIds.size} transactions` });
      setSelectedIds(new Set());
      setIsSelectMode(false);
    } catch (err) {
      console.error('Error combining transactions:', err);
      toast({ title: 'Failed to combine', variant: 'destructive' });
    }
  };

  const handleMarkSelectedForReview = async () => {
    if (!user || selectedIds.size === 0) return;
    try {
      const ids = Array.from(selectedIds);
      const { error } = await supabase
        .from('transactions')
        .update({ needs_review: true } as any)
        .in('id', ids)
        .eq('user_id', user.id);
      if (error) throw error;
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      toast({ title: `Marked ${ids.length} for review` });
      setSelectedIds(new Set());
      setIsSelectMode(false);
    } catch {
      toast({ title: 'Failed to mark for review', variant: 'destructive' });
    }
  };

  // Single cutoff point, so it requires exactly one selected row.
  const handleBookmarkSelected = () => {
    if (selectedIds.size !== 1) return;
    const id = Array.from(selectedIds)[0];
    const txn = sortedTransactions.find((t) => t.id === id);
    if (!txn) return;
    handleBookmarkTxn({ id: txn.id, transacted_at: txn.transacted_at, created_at: txn.created_at });
    setSelectedIds(new Set());
    setIsSelectMode(false);
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
              className="sticky top-0 z-20 -mx-4 sm:-mx-5 px-4 sm:px-5 pt-4 pb-3 bg-background/90 backdrop-blur-xl"
            >
              <div className="flex items-center justify-between p-3 glass-card rounded-xl">
              <div className="flex items-center gap-3 flex-shrink-0">
                <button onClick={exitSelectMode} className="text-muted-foreground hover:text-foreground">
                  <X className="w-5 h-5" />
                </button>
                <span className="text-sm font-medium">
                  {selectedIds.size} selected
                </span>
              </div>
              <div className="flex items-center gap-2 flex-wrap justify-end">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={selectedIds.size === sortedTransactions.length ? deselectAll : selectAll}
                  className="text-xs"
                >
                  {selectedIds.size === sortedTransactions.length ? 'Deselect All' : 'Select All'}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={selectedIds.size < 2 || createCombine.isPending}
                  onClick={handleCombineSelected}
                  className="gap-1.5 rounded-xl border-primary/40 text-primary hover:bg-primary/10"
                >
                  <Layers className="w-3.5 h-3.5" />
                  {createCombine.isPending ? 'Combining...' : 'Combine'}
                </Button>
                <AlertDialog open={showBulkDeleteConfirm} onOpenChange={setShowBulkDeleteConfirm}>
                  <AlertDialogTrigger asChild>
                    <Button
                      variant="destructive"
                      size="sm"
                      disabled={selectedIds.size === 0 || isDeleting}
                      className="gap-1.5"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      {isDeleting ? 'Deleting...' : 'Delete'}
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent className="glass-elevated border-border/50">
                    <AlertDialogHeader>
                      <AlertDialogTitle>
                        Delete {selectedIds.size} transaction{selectedIds.size > 1 ? 's' : ''}?
                      </AlertDialogTitle>
                      <AlertDialogDescription>
                        This action cannot be undone.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel className="rounded-xl">Cancel</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={handleDeleteSelected}
                        disabled={isDeleting}
                        className="rounded-xl bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      >
                        {isDeleting ? 'Deleting...' : 'Delete'}
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>

                {reviewEnabled && (
                  <>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={selectedIds.size === 0}
                      onClick={handleMarkSelectedForReview}
                      className="gap-1.5 rounded-xl border-warning/40 text-warning hover:bg-warning/10"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      Review
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={selectedIds.size !== 1}
                      onClick={handleBookmarkSelected}
                      className="gap-1.5 rounded-xl border-border/50"
                    >
                      <BookmarkPlus className="w-3.5 h-3.5" />
                      Reviewed up to here
                    </Button>
                  </>
                )}
              </div>
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
                    style={{ backgroundColor: entityColor(activeGroup.id) + '20' }}
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
                  {visibleTxnCount} transactions
                </p>
              </>
            ) : activeCategory && categoryFilter !== 'all' ? (
              <>
                <div className="flex items-center gap-3 mb-1">
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center text-lg"
                    style={{ backgroundColor: entityColor(activeCategory.id) + '20' }}
                  >
                    {activeCategory.icon}
                  </div>
                  <div>
                    <h1 className="text-2xl font-bold text-foreground">{activeCategory.name}</h1>
                    <p className="text-sm text-muted-foreground">Category</p>
                  </div>
                </div>
                <p className="text-sm text-muted-foreground mt-2">
                  {visibleTxnCount} transactions
                </p>
              </>
            ) : isBankFiltered ? (
              <>
                <div className="flex items-center gap-3 mb-1">
                  <div className="w-10 h-10 rounded-xl bg-info/10 flex items-center justify-center">
                    <Building2 className="w-5 h-5 text-info" />
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
                  {visibleTxnCount} transactions
                </p>
              </>
            ) : merchant ? (
              <>
                <h1 className="text-2xl font-bold text-foreground">{merchant}</h1>
                <p className="text-sm text-muted-foreground mt-0.5">
                  {visibleTxnCount} transactions
                </p>
              </>
            ) : (
              <>
                <h1 className="text-2xl font-bold text-foreground">Activity</h1>
                <p className="text-sm text-muted-foreground mt-0.5">
                  {visibleTxnCount} transactions found
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

        {/* Month navigator — visible only when viewing a single month */}
        {viewingMonth && !isSelectMode && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05, duration: 0.3 }}
            className="flex items-center justify-center gap-1 mb-3"
          >
            <button
              type="button"
              onClick={() => goToMonth(subMonths(viewingMonth, 1))}
              className="w-11 h-11 rounded-full flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/40 active:bg-muted/60 active:scale-95 transition-all touch-manipulation"
              aria-label="Previous month"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <span className="text-sm font-medium text-foreground min-w-[130px] text-center select-none tabular-nums">
              {format(viewingMonth, 'MMMM yyyy')}
            </span>
            <button
              type="button"
              onClick={() => goToMonth(addMonths(viewingMonth, 1))}
              disabled={!canGoNextMonth}
              className="w-11 h-11 rounded-full flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/40 active:bg-muted/60 active:scale-95 transition-all touch-manipulation disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-transparent disabled:active:scale-100"
              aria-label="Next month"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </motion.div>
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
            placeholder="Search merchant, notes, or amount..."
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
        <div className={cn(!isSelectMode && 'sticky top-0 z-20 -mx-4 sm:-mx-5 px-4 sm:px-5 pt-3 bg-background/90 backdrop-blur-xl')}>
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
                isInboxMode && 'bg-warning hover:bg-warning border-warning'
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
              className="gap-1.5 rounded-xl border-success/40 text-success hover:bg-success/10 flex-shrink-0"
              onClick={handleApproveAll}
            >
              <CheckCheck className="w-3.5 h-3.5" />
              Approve All
            </Button>
          )}

          {/* Mark-for-review (bulk flip needs_review back to true for the
              currently filtered date range — useful for monthly re-audit). */}
          {reviewEnabled && !isInboxMode && !isSelectMode && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5 rounded-xl border-warning/40 text-warning hover:bg-warning/10 flex-shrink-0"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  Review All
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Mark all visible transactions for review?</AlertDialogTitle>
                  <AlertDialogDescription>
                    <strong>{sortedTransactions.filter(t => !(t as any).needs_review).length}</strong>{' '}
                    currently-approved transaction(s) in your filtered view will be flagged
                    for review again. The transaction data itself isn't changed — only the
                    review flag flips. Already-flagged ones are unaffected.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={handleReopenForReview}>
                    Mark for review
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}

          {!isSelectMode && !isInboxMode && (() => {
            const hiddenCount =
              (hideDuplicates === '1' ? 1 : 0) +
              (hideRefunded === '1' ? 1 : 0) +
              (hideNonCounted === '1' ? 1 : 0);
            return (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className={cn(
                      'gap-2 rounded-xl border-border/50 flex-shrink-0',
                      hiddenCount === 0 && 'bg-primary/10 border-primary/30 text-primary'
                    )}
                  >
                    {hiddenCount > 0 ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    {hiddenCount > 0 ? `Hidden (${hiddenCount})` : 'Showing all'}
                    <ChevronDown className="w-3.5 h-3.5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="glass-elevated border-border/50 w-52">
                  <DropdownMenuItem onSelect={(e) => { e.preventDefault(); setAllNoise(true); }}>
                    Show everything
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={(e) => { e.preventDefault(); setAllNoise(false); }}>
                    Hide extras
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuLabel>Show in this list</DropdownMenuLabel>
                  <DropdownMenuCheckboxItem
                    checked={hideDuplicates !== '1'}
                    onSelect={(e) => e.preventDefault()}
                    onCheckedChange={(c) => setHideDuplicates(c ? '0' : '1')}
                  >
                    Duplicates
                  </DropdownMenuCheckboxItem>
                  <DropdownMenuCheckboxItem
                    checked={hideRefunded !== '1'}
                    onSelect={(e) => e.preventDefault()}
                    onCheckedChange={(c) => setHideRefunded(c ? '0' : '1')}
                  >
                    Fully refunded
                  </DropdownMenuCheckboxItem>
                  <DropdownMenuCheckboxItem
                    checked={hideNonCounted !== '1'}
                    onSelect={(e) => e.preventDefault()}
                    onCheckedChange={(c) => setHideNonCounted(c ? '0' : '1')}
                  >
                    Not counted
                  </DropdownMenuCheckboxItem>
                </DropdownMenuContent>
              </DropdownMenu>
            );
          })()}

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
        </div>

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

              {/* Row 3: Bank Account */}
              <SearchableSelect
                value={
                  bankNameParam || accountLast4Param
                    ? `${bankNameParam}|${accountLast4Param}`
                    : 'all'
                }
                onValueChange={(v) => {
                  const next = new URLSearchParams(searchParams);
                  if (v === 'all') {
                    next.delete('bank');
                    next.delete('account');
                  } else {
                    const [bn, last4] = v.split('|');
                    if (bn) next.set('bank', bn);
                    else next.delete('bank');
                    if (last4) next.set('account', last4);
                    else next.delete('account');
                  }
                  setSearchParams(next, { replace: true });
                }}
                options={[
                  { value: 'all', label: 'All Banks' },
                  ...bankAccountsList.map((acc) => ({
                    value: `${acc.bankName}|${acc.accountLast4}`,
                    label: acc.display,
                  })),
                ]}
                placeholder="Bank Account"
                triggerClassName="bg-card/60 text-xs h-10"
              />

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

        {/* Resume review banner (bookmark) */}
        {!isSelectMode && !isInboxMode && reviewBookmark && newSinceBookmark > 0 && (
          <ReviewResumeBanner
            newCount={newSinceBookmark}
            bookmarkDate={reviewBookmark.transactedAt}
            onResume={handleResumeReview}
          />
        )}

        {/* Transaction List */}
        <div className="space-y-5">
          {isLoading ? (
            Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-[72px] rounded-2xl" />
            ))
          ) : Object.keys(groupedUnits).length > 0 ? (
            Object.entries(groupedUnits).map(([date, units], groupIndex) => (
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
                  {units.map((unit, i) => {
                    if (unit.kind === 'combined') {
                      return (
                        <CombinedTransactionCard
                          key={unit.combineId}
                          members={unit.members}
                          index={i}
                          onUngroup={() => {
                            uncombine.mutate(
                              { combineId: unit.combineId },
                              {
                                onSuccess: () => toast({ title: 'Ungrouped' }),
                                onError: () =>
                                  toast({ title: 'Failed to ungroup', variant: 'destructive' }),
                              }
                            );
                          }}
                        />
                      );
                    }
                    const txn = unit.txn;
                    let net: number | undefined;
                    if (isRefundReady) {
                      if (txn.direction === 'credit' && refundAllocations[txn.id]) {
                        net = creditNet(txn as any, refundAllocations);
                      } else if (refundTotals[txn.id]) {
                        net = computeNetAmount(txn as any, refundTotals);
                      }
                    }
                    const bankDisplay = lookupBankDisplay(bankDisplayMap, txn.bank_name, txn.account_last4);
                    const isSelected = selectedIds.has(txn.id);

                    if (isSelectMode) {
                      // Icon onClick stops propagation so it doesn't double-toggle via the row handler.
                      return (
                        <div
                          key={txn.id}
                          onClick={() => toggleSelectId(txn.id)}
                          className="cursor-pointer"
                        >
                          <TransactionCard
                            transaction={txn}
                            index={i}
                            netAmount={net}
                            bankDisplay={bankDisplay}
                            onIconSelect={() => toggleSelectId(txn.id)}
                            isSelected={isSelected}
                          />
                        </div>
                      );
                    }

                    const isFirstNewer = txn.id === firstNewerId;

                    const cardLink = (
                      <Link to={`/transactions/${txn.id}`} className="block">
                        <TransactionCard
                          transaction={txn}
                          index={i}
                          netAmount={net}
                          bankDisplay={bankDisplay}
                          onSwipeApprove={reviewEnabled ? handleSwipeApprove : undefined}
                          onIconSelect={() => { setIsSelectMode(true); toggleSelectId(txn.id); }}
                          isSelected={isSelected}
                        />
                      </Link>
                    );

                    const isHighlighted = txn.id === highlightTxnId;
                    const cardWithRef = isFirstNewer ? (
                      <div
                        ref={firstNewerRef}
                        style={{ scrollMarginTop: '88px', scrollMarginBottom: '88px' }}
                        className={cn(
                          'rounded-xl transition-all duration-500',
                          isHighlighted &&
                            'ring-2 ring-primary ring-offset-2 ring-offset-background bg-primary/5'
                        )}
                      >
                        {cardLink}
                      </div>
                    ) : (
                      cardLink
                    );

                    return <div key={txn.id}>{cardWithRef}</div>;
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
  const { duplicateExcludeIds, refundAllocations } = useFinanceContext();

  const stats = useMemo(() => {
    const totalSpent = sumSpent(transactions, refundTotals, duplicateExcludeIds);
    const totalIncome = sumIncome(transactions, duplicateExcludeIds, refundAllocations);
    const txnCount = transactions.filter((t: any) => !duplicateExcludeIds.has(t.id)).length;
    const donutData = categoryChartData(
      transactions,
      refundTotals,
      duplicateExcludeIds,
      categories,
      Infinity as any,
    );

    return { totalSpent, totalIncome, txnCount, donutData };
  }, [transactions, categories, refundTotals, duplicateExcludeIds, refundAllocations]);

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
          <p className="text-sm font-bold text-gold currency-display">
            {formatINR(stats.totalIncome)}
          </p>
        </div>
      </div>
    </motion.div>
  );
}
