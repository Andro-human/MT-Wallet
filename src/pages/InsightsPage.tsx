import { useState, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link, useSearchParams } from 'react-router-dom';
import { ComposedChart, Bar, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { startOfMonth, endOfMonth, subMonths, format, eachMonthOfInterval, startOfDay, endOfDay, setMonth, setYear, getYear, getMonth } from 'date-fns';
import { ChevronRight, ChevronLeft, Folder, Calendar, CreditCard, X, Filter, BarChart3, Layers } from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { useTransactions } from '@/hooks/useTransactions';
import { useCategories } from '@/hooks/useCategories';
import { useTransactionGroups } from '@/hooks/useTransactionGroups';
import { usePaymentMethods } from '@/hooks/usePaymentMethods';
import { formatINR, formatINRCompact } from '@/lib/formatCurrency';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
type TimeRange = '1-month' | '3-months' | '6-months' | 'custom';
type ChartMode = 'total' | 'by-group';

// Helper to persist state in URL search params
function useInsightParam(key: string, defaultValue: string) {
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

// ─── Custom Month/Year Picker ────────────────────────────────────────────────
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
      {/* Year selector */}
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
      {/* Month grid */}
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

// ─── Main Component ──────────────────────────────────────────────────────────
export default function InsightsPage() {
  // Persist key filters in URL so they survive navigation
  const [timeRange, setTimeRange] = useInsightParam('range', '6-months');
  const [chartModeParam, setChartModeParam] = useInsightParam('mode', 'total');
  const chartMode = chartModeParam as ChartMode;
  const setChartMode = setChartModeParam;

  // Custom date range stored in URL
  const [searchParams, setSearchParams] = useSearchParams();
  const customStartStr = searchParams.get('from');
  const customEndStr = searchParams.get('to');
  const [customStart, setCustomStartState] = useState<Date>(
    customStartStr ? new Date(customStartStr) : startOfMonth(subMonths(new Date(), 5))
  );
  const [customEnd, setCustomEndState] = useState<Date>(
    customEndStr ? new Date(customEndStr) : new Date()
  );
  
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

  const [showCustomPicker, setShowCustomPicker] = useState(timeRange === 'custom');
  const [excludedGroups, setExcludedGroups] = useState<Set<string>>(new Set());
  const [selectedPaymentMethods, setSelectedPaymentMethods] = useState<Set<string>>(new Set());
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [hiddenGroupsInChart, setHiddenGroupsInChart] = useState<Set<string>>(new Set());

  const { data: categories = [] } = useCategories();
  const { data: groups = [] } = useTransactionGroups();
  const { data: paymentMethods = [] } = usePaymentMethods();

  const now = new Date();
  const dateRange = useMemo(() => {
    switch (timeRange as TimeRange) {
      case '1-month':
        return { startDate: startOfMonth(now), endDate: endOfMonth(now) };
      case '3-months':
        return { startDate: startOfMonth(subMonths(now, 2)), endDate: endOfMonth(now) };
      case '6-months':
        return { startDate: startOfMonth(subMonths(now, 5)), endDate: endOfMonth(now) };
      case 'custom':
        return {
          startDate: startOfMonth(customStart),
          endDate: endOfMonth(customEnd),
        };
      default:
        return { startDate: startOfMonth(subMonths(now, 5)), endDate: endOfMonth(now) };
    }
  }, [timeRange, customStart, customEnd]);

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

  // ─── Chart Data ────────────────────────────────────────────────────────────

  // Get unique groups that have spending data (for chart legend)
  const activeGroups = useMemo(() => {
    const groupIds = new Set<string>();
    transactions.filter(t => t.is_expense && t.group_id).forEach(t => groupIds.add(t.group_id!));
    return groups.filter(g => groupIds.has(g.id));
  }, [transactions, groups]);

  // Monthly trend: bars for spending, line for income (like Axio screenshot)
  const monthlyTrend = useMemo(() => {
    const start = dateRange.startDate || startOfMonth(subMonths(now, 5));
    const end = dateRange.endDate || endOfMonth(now);

    const monthIntervals = eachMonthOfInterval({ start, end });
    const months: Record<string, Record<string, any>> = {};

    monthIntervals.forEach(d => {
      const key = format(d, 'yyyy-MM');
      const label = format(d, "MMM''yy");
      months[key] = { label, expense: 0, income: 0 };
      
      // Initialize group columns
      if (chartMode === 'by-group') {
        activeGroups.forEach(g => {
          months[key][`group_${g.id}`] = 0;
        });
        months[key]['group_ungrouped'] = 0;
      }
    });

    transactions.forEach(t => {
      const key = format(new Date(t.transacted_at), 'yyyy-MM');
      if (!months[key]) return;

      if (t.is_expense) {
        months[key].expense += Number(t.amount);
        
        if (chartMode === 'by-group') {
          const groupKey = t.group_id ? `group_${t.group_id}` : 'group_ungrouped';
          if (months[key][groupKey] !== undefined) {
            months[key][groupKey] += Number(t.amount);
          }
        }
      }
      if (t.is_income) {
        months[key].income += Number(t.amount);
      }
    });

    return Object.values(months);
  }, [transactions, dateRange, chartMode, activeGroups]);

  // Category breakdown
  const categoryBreakdown = useMemo(() => {
    const breakdown: Record<string, number> = {};
    
    transactions
      .filter(t => t.is_expense)
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
      .filter(t => t.is_expense && t.group_id)
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
      .filter(t => t.is_expense && t.merchant)
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
    .filter(t => t.is_income)
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

  const toggleChartGroup = (groupId: string) => {
    setHiddenGroupsInChart(prev => {
      const next = new Set(prev);
      if (next.has(groupId)) next.delete(groupId);
      else next.add(groupId);
      return next;
    });
  };

  const clearAdvancedFilters = () => {
    setExcludedGroups(new Set());
    setSelectedPaymentMethods(new Set());
  };

  // Group bar colors
  const GROUP_COLORS = [
    '#8B5CF6', '#EC4899', '#F97316', '#06B6D4', '#22C55E', 
    '#EAB308', '#6366F1', '#F43F5E', '#14B8A6', '#A855F7',
  ];

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="glass-card px-3 py-2 text-xs">
          <p className="font-semibold mb-1">{payload[0].payload.label}</p>
          {payload.map((p: any) => {
            if (p.value === 0) return null;
            let label = p.dataKey;
            if (label === 'expense') label = 'Spent';
            else if (label === 'income') label = 'Income';
            else if (label === 'group_ungrouped') label = 'Ungrouped';
            else if (label.startsWith('group_')) {
              const gId = label.replace('group_', '');
              const g = groups.find(g => g.id === gId);
              label = g?.name || 'Group';
            }
            return (
              <p key={p.dataKey} className="text-muted-foreground mt-0.5" style={{ color: p.stroke || p.fill }}>
                {label}: {formatINR(p.value)}
              </p>
            );
          })}
        </div>
      );
    }
    return null;
  };

  const timeRangeOptions = [
    { value: '1-month', label: '1M' },
    { value: '3-months', label: '3M' },
    { value: '6-months', label: '6M' },
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
          className="flex gap-2 mb-4 p-1 bg-card/50 rounded-xl w-fit"
        >
          {timeRangeOptions.map((range) => (
            <button
              key={range.value}
              onClick={() => {
                setTimeRange(range.value);
                if (range.value === 'custom') setShowCustomPicker(true);
                else setShowCustomPicker(false);
              }}
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

        {/* Custom Date Range Picker - Month/Year based */}
        <AnimatePresence>
          {timeRange === 'custom' && showCustomPicker && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.2 }}
              className="mb-4 overflow-hidden"
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
        {timeRange === 'custom' && !showCustomPicker && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="mb-4"
          >
            <button
              onClick={() => setShowCustomPicker(true)}
              className="flex items-center gap-2 px-3 py-2 rounded-xl bg-card/60 border border-border/50 text-sm hover:bg-card transition-colors"
            >
              <Calendar className="w-4 h-4 text-primary" />
              <span className="text-foreground">
                {format(customStart, 'MMM yyyy')} – {format(customEnd, 'MMM yyyy')}
              </span>
            </button>
          </motion.div>
        )}

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

        {/* Monthly Trend Chart — Bars for spending + Line for income */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15, duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
          className="glass-card p-5 mb-4"
        >
          <div className="flex items-center justify-between mb-1">
            <h3 className="font-semibold text-foreground">Trends</h3>
            {/* Chart mode toggle: Total vs By Group */}
            {groups.length > 0 && (
              <div className="flex gap-1 p-0.5 bg-muted/30 rounded-lg">
                <button
                  onClick={() => setChartMode('total')}
                  className={cn(
                    'px-2.5 py-1 rounded-md text-2xs font-medium transition-all flex items-center gap-1',
                    chartMode === 'total' 
                      ? 'bg-card text-foreground shadow-sm' 
                      : 'text-muted-foreground hover:text-foreground'
                  )}
                >
                  <BarChart3 className="w-3 h-3" />
                  Total
                </button>
                <button
                  onClick={() => setChartMode('by-group')}
                  className={cn(
                    'px-2.5 py-1 rounded-md text-2xs font-medium transition-all flex items-center gap-1',
                    chartMode === 'by-group' 
                      ? 'bg-card text-foreground shadow-sm' 
                      : 'text-muted-foreground hover:text-foreground'
                  )}
                >
                  <Layers className="w-3 h-3" />
                  Groups
                </button>
              </div>
            )}
          </div>
          <p className="text-xs text-muted-foreground mb-5">
            {chartMode === 'total' ? 'Spending (bars) vs Income (line)' : 'Spending breakdown by groups'}
          </p>
          
          {isLoading ? (
            <Skeleton className="h-52" />
          ) : monthlyTrend.length > 0 ? (
            <>
              <div className="h-52">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={monthlyTrend} barCategoryGap="20%">
                    <defs>
                      <linearGradient id="expenseBarGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="hsl(252 87% 64%)" stopOpacity={0.9} />
                        <stop offset="100%" stopColor="hsl(252 87% 64%)" stopOpacity={0.4} />
                      </linearGradient>
                    </defs>
                    <XAxis
                      dataKey="label"
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: 'hsl(240 5% 55%)', fontSize: 10, fontWeight: 500 }}
                      dy={8}
                    />
                    <YAxis 
                      hide 
                    />
                    <Tooltip content={<CustomTooltip />} cursor={false} />

                    {/* Bars: spending */}
                    {chartMode === 'total' ? (
                      <Bar 
                        dataKey="expense" 
                        radius={[6, 6, 0, 0]} 
                        fill="url(#expenseBarGrad)"
                        maxBarSize={40}
                      />
                    ) : (
                      <>
                        {/* Stacked bars by group */}
                        {activeGroups
                          .filter(g => !hiddenGroupsInChart.has(g.id))
                          .map((g, i) => (
                            <Bar
                              key={g.id}
                              dataKey={`group_${g.id}`}
                              stackId="groups"
                              radius={i === activeGroups.filter(g => !hiddenGroupsInChart.has(g.id)).length - 1 ? [6, 6, 0, 0] : [0, 0, 0, 0]}
                              fill={g.color || GROUP_COLORS[i % GROUP_COLORS.length]}
                              maxBarSize={40}
                            />
                          ))}
                        {!hiddenGroupsInChart.has('ungrouped') && (
                          <Bar
                            dataKey="group_ungrouped"
                            stackId="groups"
                            radius={activeGroups.filter(g => !hiddenGroupsInChart.has(g.id)).length === 0 ? [6, 6, 0, 0] : [0, 0, 0, 0]}
                            fill="#6B7280"
                            maxBarSize={40}
                          />
                        )}
                      </>
                    )}

                    {/* Line: income overlay */}
                    <Line
                      type="monotone"
                      dataKey="income"
                      stroke="hsl(160 84% 39%)"
                      strokeWidth={2.5}
                      dot={{ r: 4, fill: 'hsl(160 84% 39%)', strokeWidth: 2, stroke: 'hsl(var(--background))' }}
                      activeDot={{ r: 6 }}
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>

              {/* Legend */}
              <div className="flex items-center justify-center gap-4 mt-3 pt-3 border-t border-border/30 flex-wrap">
                {chartMode === 'total' ? (
                  <>
                    <div className="flex items-center gap-1.5">
                      <div className="w-3 h-3 rounded-sm" style={{ background: 'hsl(252 87% 64%)' }} />
                      <span className="text-xs text-muted-foreground">Expenses</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <div className="w-4 h-0.5 rounded-full bg-success" />
                      <span className="text-xs text-muted-foreground">Income</span>
                    </div>
                  </>
                ) : (
                  <>
                    {activeGroups.map((g, i) => (
                      <button
                        key={g.id}
                        onClick={() => toggleChartGroup(g.id)}
                        className={cn(
                          "flex items-center gap-1.5 transition-opacity",
                          hiddenGroupsInChart.has(g.id) && "opacity-30 line-through"
                        )}
                      >
                        <div 
                          className="w-3 h-3 rounded-sm" 
                          style={{ backgroundColor: g.color || GROUP_COLORS[i % GROUP_COLORS.length] }} 
                        />
                        <span className="text-xs text-muted-foreground">{g.name}</span>
                      </button>
                    ))}
                    <button
                      onClick={() => toggleChartGroup('ungrouped')}
                      className={cn(
                        "flex items-center gap-1.5 transition-opacity",
                        hiddenGroupsInChart.has('ungrouped') && "opacity-30 line-through"
                      )}
                    >
                      <div className="w-3 h-3 rounded-sm bg-gray-500" />
                      <span className="text-xs text-muted-foreground">Ungrouped</span>
                    </button>
                    <div className="flex items-center gap-1.5">
                      <div className="w-4 h-0.5 rounded-full bg-success" />
                      <span className="text-xs text-muted-foreground">Income</span>
                    </div>
                  </>
                )}
              </div>
            </>
          ) : (
            <p className="text-center text-muted-foreground py-8">No data available</p>
          )}
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
