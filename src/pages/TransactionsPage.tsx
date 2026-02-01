import { useState, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link } from 'react-router-dom';
import { Search, Filter, X, ChevronDown } from 'lucide-react';
import { format, startOfMonth, endOfMonth, subMonths } from 'date-fns';
import { AppLayout } from '@/components/layout/AppLayout';
import { TransactionCard } from '@/components/transactions/TransactionCard';
import { useTransactions } from '@/hooks/useTransactions';
import { useCategories } from '@/hooks/useCategories';
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
  const [search, setSearch] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [dateFilter, setDateFilter] = useState<DateFilter>('this-month');
  const [directionFilter, setDirectionFilter] = useState<DirectionFilter>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');

  const { data: categories = [] } = useCategories();

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
  });

  const handlePullRefresh = useCallback(() => {
    refetch();
  }, [refetch]);

  const groupedTransactions = useMemo(() => {
    const groups: Record<string, typeof transactions> = {};
    transactions.forEach(txn => {
      const date = format(new Date(txn.transacted_at), 'yyyy-MM-dd');
      if (!groups[date]) groups[date] = [];
      groups[date].push(txn);
    });
    return groups;
  }, [transactions]);

  const clearFilters = () => {
    setDateFilter('this-month');
    setDirectionFilter('all');
    setCategoryFilter('all');
    setSearch('');
  };

  const hasActiveFilters = dateFilter !== 'this-month' || directionFilter !== 'all' || categoryFilter !== 'all' || search;

  return (
    <AppLayout>
      <div className="px-4 pt-6 pb-4 safe-area-top">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-4"
        >
          <h1 className="text-2xl font-bold text-foreground">Transactions</h1>
          <p className="text-sm text-muted-foreground">
            {transactions.length} transactions found
          </p>
        </motion.div>

        {/* Search */}
        <div className="relative mb-3">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search merchants..."
            className="pl-10 bg-card border-border"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Filter Toggle */}
        <div className="flex items-center gap-2 mb-4">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowFilters(!showFilters)}
            className="gap-2"
          >
            <Filter className="w-4 h-4" />
            Filters
            <ChevronDown className={`w-4 h-4 transition-transform ${showFilters ? 'rotate-180' : ''}`} />
          </Button>
          
          {hasActiveFilters && (
            <Button
              variant="ghost"
              size="sm"
              onClick={clearFilters}
              className="text-muted-foreground"
            >
              Clear all
            </Button>
          )}
        </div>

        {/* Filters */}
        <AnimatePresence>
          {showFilters && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="grid grid-cols-3 gap-2 mb-4"
            >
              <Select value={dateFilter} onValueChange={(v) => setDateFilter(v as DateFilter)}>
                <SelectTrigger className="bg-card text-sm">
                  <SelectValue placeholder="Date" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="this-month">This Month</SelectItem>
                  <SelectItem value="last-month">Last Month</SelectItem>
                  <SelectItem value="last-3-months">Last 3 Months</SelectItem>
                  <SelectItem value="all">All Time</SelectItem>
                </SelectContent>
              </Select>

              <Select value={directionFilter} onValueChange={(v) => setDirectionFilter(v as DirectionFilter)}>
                <SelectTrigger className="bg-card text-sm">
                  <SelectValue placeholder="Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="debit">Expenses</SelectItem>
                  <SelectItem value="credit">Income</SelectItem>
                </SelectContent>
              </Select>

              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger className="bg-card text-sm">
                  <SelectValue placeholder="Category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  {categories.map(cat => (
                    <SelectItem key={cat.id} value={cat.id}>
                      {cat.icon} {cat.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Transaction List */}
        <div className="space-y-4">
          {isLoading ? (
            Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-16 rounded-xl" />
            ))
          ) : Object.keys(groupedTransactions).length > 0 ? (
            Object.entries(groupedTransactions).map(([date, txns]) => (
              <div key={date}>
                <p className="text-xs text-muted-foreground uppercase tracking-wider mb-2 px-1">
                  {format(new Date(date), 'EEEE, MMM d')}
                </p>
                <div className="space-y-2">
                  {txns.map((txn, i) => (
                    <Link key={txn.id} to={`/transactions/${txn.id}`}>
                      <TransactionCard transaction={txn} index={i} />
                    </Link>
                  ))}
                </div>
              </div>
            ))
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              <p>No transactions found</p>
              <p className="text-sm mt-1">Try adjusting your filters</p>
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
