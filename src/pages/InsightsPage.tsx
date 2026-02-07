import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link } from 'react-router-dom';
import { BarChart, Bar, AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { startOfMonth, endOfMonth, subMonths, format, eachMonthOfInterval, startOfDay, endOfDay } from 'date-fns';
import { ChevronRight, Folder, Calendar, CreditCard, X, Filter } from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { useTransactions } from '@/hooks/useTransactions';
import { useCategories } from '@/hooks/useCategories';
import { useTransactionGroups } from '@/hooks/useTransactionGroups';
import { usePaymentMethods } from '@/hooks/usePaymentMethods';
import { formatINR, formatINRCompact } from '@/lib/formatCurrency';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';
import type { DateRange } from 'react-day-picker';

type TimeRange = 'this-month' | 'last-3-months' | 'this-year' | 'custom';

export default function InsightsPage() {
  const [timeRange, setTimeRange] = useState<TimeRange>('this-month');
  const [customRange, setCustomRange] = useState<DateRange | undefined>();
  const [excludedGroups, setExcludedGroups] = useState<Set<string>>(new Set());
  const [selectedPaymentMethods, setSelectedPaymentMethods] = useState<Set<string>>(new Set());
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);

  const { data: categories = [] } = useCategories();
  const { data: groups = [] } = useTransactionGroups();
  const { data: paymentMethods = [] } = usePaymentMethods();

  const now = new Date();
  const dateRange = useMemo(() => {
    switch (timeRange) {
      case 'this-month':
        return { startDate: startOfMonth(now), endDate: endOfMonth(now) };
      case 'last-3-months':
        return { startDate: startOfMonth(subMonths(now, 2)), endDate: endOfMonth(now) };
      case 'this-year':
        return { startDate: new Date(now.getFullYear(), 0, 1), endDate: endOfMonth(now) };
      case 'custom':
        return {
          startDate: customRange?.from ? startOfDay(customRange.from) : startOfMonth(now),
          endDate: customRange?.to ? endOfDay(customRange.to) : endOfMonth(now),
        };
    }
  }, [timeRange, customRange]);

  const { data: allTransactions = [], isLoading } = useTransactions(dateRange);

  // Apply advanced filters (group exclusion + payment method selection)
  const transactions = useMemo(() => {
    let filtered = allTransactions;

    if (excludedGroups.size > 0) {
      filtered = filtered.filter(t => !t.group_id || !excludedGroups.has(t.group_id));
    }

    if (selectedPaymentMethods.size > 0) {
      filtered = filtered.filter(t => t.payment_method && selectedPaymentMethods.has(t.payment_method));
    }

    return filtered;
  }, [allTransactions, excludedGroups, selectedPaymentMethods]);

  const hasAdvancedFilters = excludedGroups.size > 0 || selectedPaymentMethods.size > 0;

  // Monthly spending trend (last 6 months or within range)
  const monthlyTrend = useMemo(() => {
    const start = dateRange.startDate || startOfMonth(subMonths(now, 5));
    const end = dateRange.endDate || endOfMonth(now);

    const monthIntervals = eachMonthOfInterval({ start, end });
    const months: Record<string, { expense: number; income: number; label: string }> = {};

    monthIntervals.forEach(d => {
      const key = format(d, 'yyyy-MM');
      months[key] = { expense: 0, income: 0, label: format(d, 'MMM') };
    });

    transactions.forEach(t => {
      const key = format(new Date(t.transacted_at), 'yyyy-MM');
      if (months[key]) {
        if (t.direction === 'debit' && !t.is_excluded) {
          months[key].expense += Number(t.amount);
        } else if (t.direction === 'credit') {
          months[key].income += Number(t.amount);
        }
      }
    });

    return Object.values(months);
  }, [transactions, dateRange]);

  // Category breakdown
  const categoryBreakdown = useMemo(() => {
    const breakdown: Record<string, number> = {};
    
    transactions
      .filter(t => t.direction === 'debit' && !t.is_excluded)
      .forEach(t => {
        const catId = t.category_id || 'uncategorized';
        breakdown[catId] = (breakdown[catId] || 0) + Number(t.amount);
      });

    return Object.entries(breakdown)
      .map(([catId, amount]) => {
        const category = categories.find(c => c.id === catId);
        return {
          id: catId,
          name: category?.name || 'Uncategorized',
          icon: category?.icon || '📦',
          color: category?.color || '#6B7280',
          amount,
        };
      })
      .sort((a, b) => b.amount - a.amount);
  }, [transactions, categories]);

  // Group breakdown
  const groupBreakdown = useMemo(() => {
    const breakdown: Record<string, number> = {};
    
    transactions
      .filter(t => t.direction === 'debit' && !t.is_excluded && t.group_id)
      .forEach(t => {
        breakdown[t.group_id!] = (breakdown[t.group_id!] || 0) + Number(t.amount);
      });

    return Object.entries(breakdown)
      .map(([groupId, amount]) => {
        const group = groups.find(g => g.id === groupId);
        return {
          id: groupId,
          name: group?.name || 'Unknown Group',
          icon: group?.icon || '📁',
          color: group?.color || '#8B5CF6',
          amount,
        };
      })
      .sort((a, b) => b.amount - a.amount);
  }, [transactions, groups]);

  // Top merchants
  const topMerchants = useMemo(() => {
    const merchants: Record<string, number> = {};
    
    transactions
      .filter(t => t.direction === 'debit' && !t.is_excluded && t.merchant)
      .forEach(t => {
        const merchant = t.merchant_normalized || t.merchant!;
        merchants[merchant] = (merchants[merchant] || 0) + Number(t.amount);
      });

    return Object.entries(merchants)
      .map(([name, amount]) => ({ name, amount }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 5);
  }, [transactions]);

  // Summary stats
  const totalSpent = categoryBreakdown.reduce((sum, c) => sum + c.amount, 0);
  const totalIncome = transactions
    .filter(t => t.direction === 'credit')
    .reduce((sum, t) => sum + Number(t.amount), 0);
  const totalGroupSpent = groupBreakdown.reduce((sum, g) => sum + g.amount, 0);

  const toggleGroup = (groupId: string) => {
    setExcludedGroups(prev => {
      const next = new Set(prev);
      if (next.has(groupId)) next.delete(groupId);
      else next.add(groupId);
      return next;
    });
  };

  const togglePaymentMethod = (method: string) => {
    setSelectedPaymentMethods(prev => {
      const next = new Set(prev);
      if (next.has(method)) next.delete(method);
      else next.add(method);
      return next;
    });
  };

  const clearAdvancedFilters = () => {
    setExcludedGroups(new Set());
    setSelectedPaymentMethods(new Set());
  };

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="glass-card px-3 py-2">
          <p className="text-sm font-semibold">{payload[0].payload.label || payload[0].payload.name}</p>
          {payload.map((p: any) => (
            <p key={p.dataKey} className="text-xs text-muted-foreground mt-0.5" style={{ color: p.stroke || p.fill }}>
              {p.dataKey === 'expense' ? 'Spent' : p.dataKey === 'income' ? 'Income' : ''}: {formatINR(p.value)}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  const timeRangeOptions = [
    { value: 'this-month', label: 'This Month' },
    { value: 'last-3-months', label: '3 Months' },
    { value: 'this-year', label: 'This Year' },
    { value: 'custom', label: 'Custom' },
  ];

  return (
    <AppLayout>
      <div className="px-5 pt-8 pb-4 safe-area-top">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
          className="mb-6"
        >
          <h1 className="text-2xl font-bold text-foreground">Insights</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Deep dive into your spending patterns
          </p>
        </motion.div>

        {/* Time Range Toggle */}
        <motion.div 
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1, duration: 0.3 }}
          className="flex gap-2 mb-4 p-1 bg-card/50 rounded-xl w-fit flex-wrap"
        >
          {timeRangeOptions.map((range) => (
            <button
              key={range.value}
              onClick={() => setTimeRange(range.value as TimeRange)}
              className={cn(
                'px-4 py-2 text-sm font-medium rounded-lg transition-all duration-200',
                timeRange === range.value 
                  ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/25' 
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              {range.label}
            </button>
          ))}
        </motion.div>

        {/* Custom Date Range Picker */}
        <AnimatePresence>
          {timeRange === 'custom' && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.2 }}
              className="mb-4"
            >
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-2 rounded-xl border-border/50 bg-card/60 w-full justify-start text-sm"
                  >
                    <Calendar className="w-4 h-4 text-primary" />
                    {customRange?.from ? (
                      customRange.to ? (
                        <span>
                          {format(customRange.from, 'MMM d, yyyy')} – {format(customRange.to, 'MMM d, yyyy')}
                        </span>
                      ) : (
                        <span>{format(customRange.from, 'MMM d, yyyy')} – Select end date</span>
                      )
                    ) : (
                      <span className="text-muted-foreground">Select date range</span>
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0 glass-card border-border/50" align="start">
                  <CalendarComponent
                    mode="range"
                    selected={customRange}
                    onSelect={setCustomRange}
                    numberOfMonths={1}
                    disabled={{ after: new Date() }}
                  />
                </PopoverContent>
              </Popover>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Advanced Filters Toggle */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.12, duration: 0.3 }}
          className="flex items-center gap-2 mb-5"
        >
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
            className={cn(
              'gap-2 rounded-xl border-border/50',
              showAdvancedFilters || hasAdvancedFilters
                ? 'bg-primary/10 border-primary/30 text-primary'
                : ''
            )}
          >
            <Filter className="w-4 h-4" />
            Filters
            {hasAdvancedFilters && (
              <span className="w-5 h-5 rounded-full bg-primary text-primary-foreground text-xs flex items-center justify-center">
                {excludedGroups.size + selectedPaymentMethods.size}
              </span>
            )}
          </Button>

          {hasAdvancedFilters && (
            <Button
              variant="ghost"
              size="sm"
              onClick={clearAdvancedFilters}
              className="text-muted-foreground hover:text-foreground"
            >
              Clear
            </Button>
          )}
        </motion.div>

        {/* Advanced Filters Panel */}
        <AnimatePresence>
          {showAdvancedFilters && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
              className="mb-5 space-y-4"
            >
              {/* Payment Methods */}
              {paymentMethods.length > 0 && (
                <div className="glass-card p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <CreditCard className="w-4 h-4 text-muted-foreground" />
                    <h4 className="text-sm font-medium text-foreground">Payment Methods</h4>
                    <span className="text-2xs text-muted-foreground ml-auto">
                      {selectedPaymentMethods.size === 0 ? 'All' : `${selectedPaymentMethods.size} selected`}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {paymentMethods.map(method => (
                      <button
                        key={method}
                        onClick={() => togglePaymentMethod(method)}
                        className={cn(
                          'px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200 border',
                          selectedPaymentMethods.has(method)
                            ? 'bg-primary/15 border-primary/30 text-primary'
                            : 'bg-muted/30 border-border/50 text-muted-foreground hover:text-foreground'
                        )}
                      >
                        {method}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Exclude Groups */}
              {groups.length > 0 && (
                <div className="glass-card p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <Folder className="w-4 h-4 text-muted-foreground" />
                    <h4 className="text-sm font-medium text-foreground">Exclude Groups</h4>
                    <span className="text-2xs text-muted-foreground ml-auto">
                      {excludedGroups.size === 0 ? 'None excluded' : `${excludedGroups.size} excluded`}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {groups.map(group => (
                      <button
                        key={group.id}
                        onClick={() => toggleGroup(group.id)}
                        className={cn(
                          'px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200 border flex items-center gap-1.5',
                          excludedGroups.has(group.id)
                            ? 'bg-destructive/10 border-destructive/30 text-destructive line-through'
                            : 'bg-muted/30 border-border/50 text-muted-foreground hover:text-foreground'
                        )}
                      >
                        <span>{group.icon}</span>
                        {group.name}
                        {excludedGroups.has(group.id) && <X className="w-3 h-3" />}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Summary Stats */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.14, duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
          className="grid grid-cols-2 gap-3 mb-4"
        >
          <div className="glass-card p-4 text-center">
            <p className="text-2xs text-muted-foreground uppercase tracking-wider font-medium">Total Spent</p>
            <p className="text-xl font-bold text-foreground currency-display mt-1">
              {isLoading ? '...' : formatINRCompact(totalSpent)}
            </p>
          </div>
          <div className="glass-card p-4 text-center">
            <p className="text-2xs text-muted-foreground uppercase tracking-wider font-medium">Total Income</p>
            <p className="text-xl font-bold text-success currency-display mt-1">
              {isLoading ? '...' : formatINRCompact(totalIncome)}
            </p>
          </div>
        </motion.div>

        {/* Monthly Trend - Spending vs Income */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15, duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
          className="glass-card p-5 mb-4"
        >
          <h3 className="font-semibold text-foreground mb-1">Spending vs Income</h3>
          <p className="text-xs text-muted-foreground mb-5">Monthly comparison</p>
          
          {isLoading ? (
            <Skeleton className="h-44" />
          ) : monthlyTrend.length > 0 ? (
            <div className="h-44">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={monthlyTrend} barCategoryGap="20%">
                  <defs>
                    <linearGradient id="expenseBarGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="hsl(0 72% 51%)" stopOpacity={0.9} />
                      <stop offset="100%" stopColor="hsl(0 72% 51%)" stopOpacity={0.5} />
                    </linearGradient>
                    <linearGradient id="incomeBarGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="hsl(160 84% 39%)" stopOpacity={0.9} />
                      <stop offset="100%" stopColor="hsl(160 84% 39%)" stopOpacity={0.5} />
                    </linearGradient>
                  </defs>
                  <XAxis
                    dataKey="label"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: 'hsl(240 5% 55%)', fontSize: 11, fontWeight: 500 }}
                    dy={8}
                  />
                  <YAxis hide />
                  <Tooltip content={<CustomTooltip />} cursor={false} />
                  <Bar dataKey="expense" radius={[6, 6, 0, 0]} fill="url(#expenseBarGrad)" />
                  <Bar dataKey="income" radius={[6, 6, 0, 0]} fill="url(#incomeBarGrad)" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <p className="text-center text-muted-foreground py-8">No data available</p>
          )}

          {/* Legend */}
          <div className="flex items-center justify-center gap-6 mt-3 pt-3 border-t border-border/30">
            <div className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-sm bg-destructive" />
              <span className="text-xs text-muted-foreground">Expenses</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-sm bg-success" />
              <span className="text-xs text-muted-foreground">Income</span>
            </div>
          </div>
        </motion.div>

        {/* Category Breakdown */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
          className="glass-card p-5 mb-4"
        >
          <h3 className="font-semibold text-foreground mb-1">By Category</h3>
          <p className="text-xs text-muted-foreground mb-5">Spending breakdown</p>
          
          {isLoading ? (
            <div className="space-y-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-14" />
              ))}
            </div>
          ) : categoryBreakdown.length > 0 ? (
            <div className="space-y-4">
              {categoryBreakdown.map((cat, i) => {
                const percentage = totalSpent > 0 ? (cat.amount / totalSpent) * 100 : 0;
                return (
                  <Link
                    key={cat.id}
                    to={cat.id !== 'uncategorized' ? `/transactions?category=${cat.id}` : '/transactions'}
                  >
                    <motion.div
                      initial={{ opacity: 0, x: -12 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.04, duration: 0.3 }}
                      className="space-y-2 group cursor-pointer"
                    >
                      <div className="flex items-center justify-between text-sm">
                        <span className="flex items-center gap-2.5">
                          <span className="text-base">{cat.icon}</span>
                          <span className="text-foreground font-medium group-hover:text-primary transition-colors">{cat.name}</span>
                        </span>
                        <span className="flex items-center gap-2">
                          <span className="text-xs text-muted-foreground">{percentage.toFixed(0)}%</span>
                          <span className="text-foreground font-semibold currency-display">
                            {formatINRCompact(cat.amount)}
                          </span>
                          <ChevronRight className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                        </span>
                      </div>
                      <div className="h-2 bg-muted/50 rounded-full overflow-hidden">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${percentage}%` }}
                          transition={{ delay: i * 0.04 + 0.2, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
                          className="h-full rounded-full"
                          style={{ 
                            backgroundColor: cat.color,
                            boxShadow: `0 0 12px ${cat.color}50`,
                          }}
                        />
                      </div>
                    </motion.div>
                  </Link>
                );
              })}
            </div>
          ) : (
            <p className="text-center text-muted-foreground py-8">No data available</p>
          )}
        </motion.div>

        {/* Group Breakdown */}
        {groupBreakdown.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.22, duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
            className="glass-card p-5 mb-4"
          >
            <div className="flex items-center gap-2 mb-1">
              <Folder className="w-4 h-4 text-muted-foreground" />
              <h3 className="font-semibold text-foreground">By Group</h3>
            </div>
            <p className="text-xs text-muted-foreground mb-5">Spending by transaction groups</p>
            
            <div className="space-y-4">
              {groupBreakdown.map((grp, i) => {
                const percentage = totalGroupSpent > 0 ? (grp.amount / totalGroupSpent) * 100 : 0;
                return (
                  <Link
                    key={grp.id}
                    to={`/transactions?group=${grp.id}`}
                  >
                    <motion.div
                      initial={{ opacity: 0, x: -12 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.04, duration: 0.3 }}
                      className="space-y-2 group cursor-pointer"
                    >
                      <div className="flex items-center justify-between text-sm">
                        <span className="flex items-center gap-2.5">
                          <span 
                            className="w-7 h-7 rounded-lg flex items-center justify-center text-sm"
                            style={{ backgroundColor: grp.color + '20' }}
                          >
                            {grp.icon}
                          </span>
                          <span className="text-foreground font-medium group-hover:text-primary transition-colors">{grp.name}</span>
                        </span>
                        <span className="flex items-center gap-2">
                          <span className="text-foreground font-semibold currency-display">
                            {formatINRCompact(grp.amount)}
                          </span>
                          <ChevronRight className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                        </span>
                      </div>
                      <div className="h-2 bg-muted/50 rounded-full overflow-hidden">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${percentage}%` }}
                          transition={{ delay: i * 0.04 + 0.2, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
                          className="h-full rounded-full"
                          style={{ 
                            backgroundColor: grp.color,
                            boxShadow: `0 0 12px ${grp.color}50`,
                          }}
                        />
                      </div>
                    </motion.div>
                  </Link>
                );
              })}
            </div>
          </motion.div>
        )}

        {/* Top Merchants */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25, duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
          className="glass-card p-5"
        >
          <h3 className="font-semibold text-foreground mb-1">Top Merchants</h3>
          <p className="text-xs text-muted-foreground mb-5">Where you spend most</p>
          
          {isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-12" />
              ))}
            </div>
          ) : topMerchants.length > 0 ? (
            <div className="space-y-3">
              {topMerchants.map((merchant, i) => (
                <Link
                  key={merchant.name}
                  to={`/transactions?merchant=${encodeURIComponent(merchant.name)}`}
                >
                  <motion.div
                    initial={{ opacity: 0, x: -12 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.04, duration: 0.3 }}
                    className="flex items-center justify-between p-3 rounded-xl bg-muted/30 hover:bg-muted/50 transition-colors group cursor-pointer"
                  >
                    <div className="flex items-center gap-3">
                      <span 
                        className="w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold"
                        style={{
                          background: i === 0 
                            ? 'linear-gradient(135deg, hsl(252 87% 64%), hsl(280 85% 55%))'
                            : 'hsl(var(--muted))',
                          color: i === 0 ? 'white' : 'hsl(var(--muted-foreground))',
                        }}
                      >
                        {i + 1}
                      </span>
                      <span className="text-foreground text-sm font-medium truncate max-w-[140px] group-hover:text-primary transition-colors">
                        {merchant.name}
                      </span>
                    </div>
                    <span className="flex items-center gap-2">
                      <span className="text-foreground font-semibold text-sm currency-display">
                        {formatINR(merchant.amount)}
                      </span>
                      <ChevronRight className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                    </span>
                  </motion.div>
                </Link>
              ))}
            </div>
          ) : (
            <p className="text-center text-muted-foreground py-8">No data available</p>
          )}
        </motion.div>
      </div>
    </AppLayout>
  );
}
