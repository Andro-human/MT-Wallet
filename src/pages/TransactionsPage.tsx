import { useState, useMemo, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import { Search, SlidersHorizontal, X, ChevronDown, ArrowLeft, Plus } from 'lucide-react';
import { format, startOfMonth, endOfMonth, subMonths } from 'date-fns';
import { AppLayout } from '@/components/layout/AppLayout';
import { TransactionCard } from '@/components/transactions/TransactionCard';
import { ActivitySummary } from '@/components/transactions/ActivitySummary';
import { AddTransactionDialog } from '@/components/transactions/AddTransactionDialog';
import { useTransactions } from '@/hooks/useTransactions';
import { useCategories } from '@/hooks/useCategories';
import { useTransactionGroups } from '@/hooks/useTransactionGroups';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

type DateFilter = 'this-month' | 'last-month' | 'last-3-months' | 'all';
type DirectionFilter = 'all' | 'credit' | 'debit';

export default function TransactionsPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  
  // Get initial values from URL params
  const initialMerchant = searchParams.get('merchant') || '';
  const initialCategory = searchParams.get('category') || 'all';
  const initialGroup = searchParams.get('group') || 'all';
  
  const [search, setSearch] = useState(initialMerchant);
  const [showFilters, setShowFilters] = useState(!!initialCategory || !!initialGroup || initialCategory !== 'all' || initialGroup !== 'all');
  const [dateFilter, setDateFilter] = useState<DateFilter>(initialMerchant || initialCategory !== 'all' || initialGroup !== 'all' ? 'all' : 'this-month');
  const [directionFilter, setDirectionFilter] = useState<DirectionFilter>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>(initialCategory);
  const [groupFilter, setGroupFilter] = useState<string>(initialGroup);
  const [showAddDialog, setShowAddDialog] = useState(false);

  const { data: categories = [] } = useCategories();
  const { data: groups = [] } = useTransactionGroups();
  
  // Check if we have a filtered view (from navigation)
  const isFilteredView = initialMerchant || initialCategory !== 'all' || initialGroup !== 'all';
  const activeCategory = categories.find(c => c.id === categoryFilter);

  // Update state when URL params change
  useEffect(() => {
    const merchant = searchParams.get('merchant') || '';
    const category = searchParams.get('category') || 'all';
    const group = searchParams.get('group') || 'all';
    
    if (merchant) {
      setSearch(merchant);
      setDateFilter('all');
    }
    if (category !== 'all') {
      setCategoryFilter(category);
      setDateFilter('all');
      setShowFilters(true);
    }
    if (group !== 'all') {
      setGroupFilter(group);
      setDateFilter('all');
      setShowFilters(true);
    }
  }, [searchParams]);

  const dateRange = useMemo(() => {
    const now = new Date();
    switch (dateFilter) {
      case 'this-month':
        return { startDate: startOfMonth(now), endDate: endOfMonth(now) };
      case 'last-month':
        return { startDate: startOfMonth(subMonths(now, 1)), endDate: endOfMonth(subMonths(now, 1)) };
      case 'last-3-months':
        return { startDate: startOfMonth(subMonths(now, 2)), endDate: endOfMonth(now) };
      default:
        return {};
    }
  }, [dateFilter]);

  const { data: transactions = [], isLoading, refetch } = useTransactions({
    ...dateRange,
    categoryId: categoryFilter !== 'all' ? categoryFilter : undefined,
    direction: directionFilter !== 'all' ? directionFilter : undefined,
    search: search || undefined,
    groupId: groupFilter !== 'all' ? groupFilter : undefined,
  });

  const handlePullRefresh = useCallback(() => {
    refetch();
  }, [refetch]);

  const groupedTransactions = useMemo(() => {
    const grouped: Record<string, typeof transactions> = {};
    transactions.forEach(txn => {
      const date = format(new Date(txn.transacted_at), 'yyyy-MM-dd');
      if (!grouped[date]) grouped[date] = [];
      grouped[date].push(txn);
    });
    return grouped;
  }, [transactions]);

  const clearFilters = () => {
    setDateFilter('this-month');
    setDirectionFilter('all');
    setCategoryFilter('all');
    setGroupFilter('all');
    setSearch('');
    setSearchParams({});
  };

  const hasActiveFilters = dateFilter !== 'this-month' || directionFilter !== 'all' || categoryFilter !== 'all' || groupFilter !== 'all' || search;
  
  const activeGroup = groups.find(g => g.id === groupFilter);

  return (
    <AppLayout>
      <div className="px-5 pt-8 pb-24 safe-area-top">
        {/* Back Button for Filtered Views */}
        {isFilteredView && (
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

        {/* Header */}
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
          ) : initialMerchant ? (
            <>
              <h1 className="text-2xl font-bold text-foreground">{initialMerchant}</h1>
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

        {/* Activity Summary Chart */}
        {!isFilteredView && (
          <ActivitySummary
            transactions={transactions}
            dateRange={dateRange}
            isLoading={isLoading}
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
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search merchants..."
            className="pl-11 h-12 bg-card/60 border-border/50 rounded-xl text-sm placeholder:text-muted-foreground/60 focus:bg-card focus:border-primary/30"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </motion.div>

        {/* Filter Toggle */}
        <motion.div 
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15, duration: 0.3 }}
          className="flex items-center gap-2 mb-4"
        >
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowFilters(!showFilters)}
            className={`gap-2 rounded-xl border-border/50 ${showFilters ? 'bg-primary/10 border-primary/30 text-primary' : ''}`}
          >
            <SlidersHorizontal className="w-4 h-4" />
            Filters
            <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${showFilters ? 'rotate-180' : ''}`} />
          </Button>
          
          {hasActiveFilters && (
            <Button
              variant="ghost"
              size="sm"
              onClick={clearFilters}
              className="text-muted-foreground hover:text-foreground"
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
              className="grid grid-cols-3 gap-2 mb-5"
            >
              <Select value={dateFilter} onValueChange={(v) => setDateFilter(v as DateFilter)}>
                <SelectTrigger className="bg-card/60 border-border/50 rounded-xl text-xs h-10">
                  <SelectValue placeholder="Date" />
                </SelectTrigger>
                <SelectContent className="glass-card border-border/50">
                  <SelectItem value="this-month">This Month</SelectItem>
                  <SelectItem value="last-month">Last Month</SelectItem>
                  <SelectItem value="last-3-months">3 Months</SelectItem>
                  <SelectItem value="all">All Time</SelectItem>
                </SelectContent>
              </Select>

              <Select value={directionFilter} onValueChange={(v) => setDirectionFilter(v as DirectionFilter)}>
                <SelectTrigger className="bg-card/60 border-border/50 rounded-xl text-xs h-10">
                  <SelectValue placeholder="Type" />
                </SelectTrigger>
                <SelectContent className="glass-card border-border/50">
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="debit">Expenses</SelectItem>
                  <SelectItem value="credit">Income</SelectItem>
                </SelectContent>
              </Select>

              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger className="bg-card/60 border-border/50 rounded-xl text-xs h-10">
                  <SelectValue placeholder="Category" />
                </SelectTrigger>
                <SelectContent className="glass-card border-border/50">
                  <SelectItem value="all">All</SelectItem>
                  {categories.map(cat => (
                    <SelectItem key={cat.id} value={cat.id}>
                      {cat.icon} {cat.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={groupFilter} onValueChange={setGroupFilter}>
                <SelectTrigger className="bg-card/60 border-border/50 rounded-xl text-xs h-10 col-span-3">
                  <SelectValue placeholder="Group" />
                </SelectTrigger>
                <SelectContent className="glass-card border-border/50">
                  <SelectItem value="all">All Groups</SelectItem>
                  {groups.map(grp => (
                    <SelectItem key={grp.id} value={grp.id}>
                      {grp.icon} {grp.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
                <p className="text-2xs text-muted-foreground uppercase tracking-extra-wide font-medium mb-2.5 px-1">
                  {format(new Date(date), 'EEEE, MMM d')}
                </p>
                <div className="flex flex-col gap-3">
                  {txns.map((txn, i) => (
                    <Link key={txn.id} to={`/transactions/${txn.id}`} className="block">
                      <TransactionCard transaction={txn} index={i} />
                    </Link>
                  ))}
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
        <motion.button
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.3, type: 'spring', stiffness: 260, damping: 20 }}
          onClick={() => setShowAddDialog(true)}
          className="fixed bottom-24 right-5 w-14 h-14 rounded-full bg-primary text-primary-foreground shadow-lg shadow-primary/30 flex items-center justify-center hover:bg-primary/90 transition-colors z-20"
        >
          <Plus className="w-6 h-6" />
        </motion.button>
      </div>

      {/* Add Transaction Dialog */}
      <AddTransactionDialog 
        open={showAddDialog} 
        onOpenChange={setShowAddDialog} 
      />
    </AppLayout>
  );
}
