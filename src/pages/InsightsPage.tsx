import { useState, useMemo, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import { ComposedChart, Bar, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { startOfMonth, endOfMonth, subMonths, format, eachMonthOfInterval, startOfDay, endOfDay, setMonth, setYear, getYear, getMonth } from 'date-fns';
import { ChevronRight, ChevronLeft, Folder, Calendar, X, Filter, BarChart3, Layers } from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { useTransactions } from '@/hooks/useTransactions';
import { useCategories } from '@/hooks/useCategories';
import { useTransactionGroups } from '@/hooks/useTransactionGroups';
import { useBankAccounts } from '@/hooks/useBankAccounts';
import { useRefundTotals } from '@/hooks/useRefundLinks';
import { formatINR, formatINRCompact } from '@/lib/formatCurrency';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { monthsTouched } from '@/lib/monthsTouched';

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
    let newDate = setYear(value, year + delta);
    if (maxDate && newDate > maxDate) {
      newDate = maxDate;
    }
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
  const lastTappedBarRef = useRef<string | null>(null);
  const navigate = useNavigate();
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
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [hiddenGroupsInChart, setHiddenGroupsInChart] = useState<Set<string>>(new Set());

  const { data: categories = [] } = useCategories();
  const { data: groups = [] } = useTransactionGroups();
  const { data: bankAccounts = [] } = useBankAccounts();

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

  const { data: allTransactions = [], isLoading: txnsLoading } = useTransactions(dateRange);

  // Batch-fetch refund totals for all debit transactions
  const debitTxnIds = useMemo(() =>
    allTransactions.filter(t => t.direction === 'debit').map(t => t.id),
    [allTransactions]
  );
  const { data: refundTotals = {}, isLoading: refundTotalsLoading } = useRefundTotals(debitTxnIds);
  const isRefundReady = !refundTotalsLoading || debitTxnIds.length === 0;
  const isLoading = txnsLoading || !isRefundReady;

  // Helper: get refund-adjusted amount for a transaction
  const netAmount = useCallback((t: { id: string; amount: number | string }) => {
    const refund = refundTotals[t.id] || 0;
    return Math.max(Number(t.amount) - refund, 0);
  }, [refundTotals]);

  // Apply advanced filters (group exclusion)
  const transactions = useMemo(() => {
    let filtered = allTransactions;

    if (excludedGroups.size > 0) {
      filtered = filtered.filter(t => !t.group_id || !excludedGroups.has(t.group_id));
    }

    return filtered;
  }, [allTransactions, excludedGroups]);

  const hasAdvancedFilters = excludedGroups.size > 0;

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
      months[key] = { label, rawDate: d, expense: 0, income: 0 };

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
        months[key].expense += netAmount(t);

        if (chartMode === 'by-group') {
          const groupKey = t.group_id ? `group_${t.group_id}` : 'group_ungrouped';
          if (months[key][groupKey] !== undefined) {
            months[key][groupKey] += netAmount(t);
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
        breakdown[catId] = (breakdown[catId] || 0) + netAmount(t);
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
  }, [transactions, categories, netAmount]);

  // Group breakdown
  const groupBreakdown = useMemo(() => {
    const breakdown: Record<string, number> = {};

    transactions
      .filter(t => t.is_expense && t.group_id)
      .forEach(t => {
        breakdown[t.group_id!] = (breakdown[t.group_id!] || 0) + netAmount(t);
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
  }, [transactions, groups, netAmount]);

  // Raw (bank_name, account_last4) -> resolved account (nickname-aware, alias-aware).
  // Built from the alias chain baked into useBankAccounts().
  const rawToResolved = useMemo(() => {
    const m = new Map<
      string,
      { bankName: string; accountLast4: string; display: string }
    >();
    for (const acc of bankAccounts) {
      for (const raw of acc.rawAccounts) {
        m.set(`${raw.bankName}|${raw.accountLast4}`, {
          bankName: acc.bankName,
          accountLast4: acc.accountLast4,
          display: acc.display,
        });
      }
    }
    return m;
  }, [bankAccounts]);

  // Bank account breakdown. Aliased raw accounts roll up to their resolved target.
  const bankBreakdown = useMemo(() => {
    const byKey = new Map<
      string,
      { bankName: string; accountLast4: string; display: string; amount: number }
    >();

    for (const t of transactions) {
      if (!t.is_expense) continue;
      const rawKey = `${t.bank_name ?? ''}|${t.account_last4 ?? ''}`;
      const resolved = rawToResolved.get(rawKey) ?? {
        bankName: t.bank_name ?? '',
        accountLast4: t.account_last4 ?? '',
        display:
          t.bank_name && t.account_last4
            ? `${t.bank_name} ••${t.account_last4}`
            : t.bank_name || (t.account_last4 ? `••${t.account_last4}` : 'Unknown'),
      };
      const resolvedKey = `${resolved.bankName}|${resolved.accountLast4}`;
      const existing = byKey.get(resolvedKey);
      if (existing) {
        existing.amount += netAmount(t);
      } else {
        byKey.set(resolvedKey, { ...resolved, amount: netAmount(t) });
      }
    }

    return Array.from(byKey.values()).sort((a, b) => b.amount - a.amount);
  }, [transactions, rawToResolved, netAmount]);

  // Top merchants. Grouping key prefers the SMS parser's semantic key
  // (merchant_normalized: "Ola Cabs" -> "ola"), then the case-folded
  // merchant_lower (collapses "Swiggy" / "swiggy"), and finally raw merchant.
  // Display picks the most-common raw merchant casing within each group.
  const topMerchants = useMemo(() => {
    const groups = new Map<
      string,
      { total: number; casings: Map<string, number> }
    >();

    for (const t of transactions) {
      if (!t.is_expense || !t.merchant) continue;
      const key = t.merchant_normalized || t.merchant_lower || t.merchant!;
      const g = groups.get(key) ?? { total: 0, casings: new Map<string, number>() };
      g.total += netAmount(t);
      g.casings.set(t.merchant, (g.casings.get(t.merchant) ?? 0) + 1);
      groups.set(key, g);
    }

    return Array.from(groups.values())
      .map(({ total, casings }) => {
        let best = '';
        let bestCount = -1;
        for (const [casing, count] of casings) {
          if (count > bestCount) {
            best = casing;
            bestCount = count;
          }
        }
        return { name: best, amount: total };
      })
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 5);
  }, [transactions, netAmount]);

  // Summary stats
  const totalSpent = categoryBreakdown.reduce((sum, c) => sum + c.amount, 0);
  const totalIncome = transactions
    .filter(t => t.is_income)
    .reduce((sum, t) => sum + Number(t.amount), 0);
  const totalGroupSpent = groupBreakdown.reduce((sum, g) => sum + g.amount, 0);
  const totalBankSpent = bankBreakdown.reduce((sum, b) => sum + b.amount, 0);

  // Per-month averages for the current date range.
  const monthsStat = useMemo(() => {
    const start = dateRange.startDate || startOfMonth(subMonths(now, 5));
    const end = dateRange.endDate || endOfMonth(now);
    return monthsTouched(start, end);
  }, [dateRange, now]);
  const avgSpentPerMonth = monthsStat.count > 0 ? totalSpent / monthsStat.count : 0;
  const avgIncomePerMonth = monthsStat.count > 0 ? totalIncome / monthsStat.count : 0;
  const avgLabel = (value: number) =>
    `~${formatINRCompact(value)}/mo${monthsStat.partial ? ' (partial)' : ''}`;

  const toggleGroup = (groupId: string) => {
    setExcludedGroups(prev => {
      const next = new Set(prev);
      if (next.has(groupId)) next.delete(groupId);
      else next.add(groupId);
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
  };

  // Build date filter query params to pass to transaction views
  const dateFilterParams = useMemo(() => {
    if (timeRange === 'custom') {
      return `&date=custom&from=${format(customStart, 'yyyy-MM-dd')}&to=${format(customEnd, 'yyyy-MM-dd')}`;
    }
    // Map insight time ranges to activity date filters
    switch (timeRange) {
      case '1-month': return '&date=this-month';
      case '3-months': return '&date=last-3-months';
      case '6-months': return `&date=custom&from=${format(dateRange.startDate, 'yyyy-MM-dd')}&to=${format(dateRange.endDate, 'yyyy-MM-dd')}`;
      default: return '';
    }
  }, [timeRange, customStart, customEnd, dateRange]);

  // Group bar colors - Neo-Modernist Palette (Lime, White, Greys)
  const GROUP_COLORS = [
    '#D4FF32', // Acid Lime
    '#FFFFFF', // White
    '#A3A3A3', // Neutral 400
    '#525252', // Neutral 600
    '#Fefce8', // Yellow 50 (Subtle)
    '#d9f99d', // Lime 200
    '#262626', // Neutral 800
    '#e5e5e5', // Neutral 200
    '#facc15', // Yellow 400
  ];

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-background border border-border p-3 shadow-2xl">
          <p className="font-mono font-bold text-xs uppercase tracking-wider mb-2 text-muted-foreground">{payload[0].payload.label}</p>
          {payload.map((p: any) => {
            if (p.value === 0) return null;
            let label = p.dataKey;
            let color = p.stroke || p.fill;

            if (label === 'expense') {
              label = 'OUT';
              color = 'hsl(var(--primary))';
            }
            else if (label === 'income') {
              label = 'IN';
              color = 'hsl(var(--foreground))';
            }
            else if (label === 'group_ungrouped') label = 'OTHER';
            else if (label.startsWith('group_')) {
              const gId = label.replace('group_', '');
              const g = groups.find(g => g.id === gId);
              label = g?.name || 'Group';
            }
            return (
              <div key={p.dataKey} className="flex justify-between gap-4 text-xs font-mono">
                <span style={{ color }}>{label.toUpperCase()}</span>
                <span className="text-foreground">{formatINR(p.value)}</span>
              </div>
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
      <div className="px-5 pt-6 md:pt-12 pb-4 safe-area-top">
        {/* Header - Neo Style */}
        <motion.div
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="mb-8 border-b border-border/50 pb-4"
        >
          <h1 className="text-3xl font-heading font-bold text-foreground leading-none">Insights</h1>
          <p className="text-xs font-mono text-muted-foreground mt-2 uppercase tracking-widest">
            Spending Analytics
          </p>
        </motion.div>

        {/* Time Range Toggle - Segmented Control */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="mb-6 overflow-x-auto"
        >
          <div className="flex gap-0 border border-border bg-card w-fit">
            {timeRangeOptions.map((range) => (
              <button
                key={range.value}
                onClick={() => {
                  setTimeRange(range.value);
                  if (range.value === 'custom') setShowCustomPicker(true);
                  else setShowCustomPicker(false);
                }}
                className={cn(
                  'px-4 py-2 text-xs font-mono font-bold uppercase tracking-wider transition-all border-r border-border last:border-r-0 hover:bg-muted/10',
                  timeRange === range.value
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                {range.label}
              </button>
            ))}
          </div>
        </motion.div>

        {/* Custom Date Range Picker */}
        <AnimatePresence>
          {timeRange === 'custom' && showCustomPicker && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="mb-6 overflow-hidden"
            >
              <div className="neo-card p-4 space-y-4">
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
                <div className="flex items-center justify-between pt-2 border-t border-border/50">
                  <p className="text-xs font-mono text-muted-foreground">
                    {format(startOfMonth(customStart), 'MMM yyyy')} – {format(endOfMonth(customEnd), 'MMM yyyy')}
                  </p>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setShowCustomPicker(false)}
                    className="text-xs font-bold uppercase"
                  >
                    Close
                  </Button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Summary Stats - Neo Style */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.14 }}
          className="grid grid-cols-2 gap-4 mb-6"
        >
          <div className="neo-card p-5 border-l-2 border-l-primary">
            <p className="text-2xs font-mono text-muted-foreground uppercase tracking-wider mb-1">Total Spent</p>
            <p className="text-2xl font-bold font-heading text-foreground currency-display">
              {isLoading ? '...' : formatINRCompact(totalSpent)}
            </p>
            {!isLoading && totalSpent > 0 && (
              <p className="text-2xs font-mono text-muted-foreground mt-1">
                {avgLabel(avgSpentPerMonth)}
              </p>
            )}
          </div>
          <div className="neo-card p-5 border-l-2 border-l-foreground">
            <p className="text-2xs font-mono text-muted-foreground uppercase tracking-wider mb-1">Total Income</p>
            <p className="text-2xl font-bold font-heading text-foreground currency-display">
              {isLoading ? '...' : formatINRCompact(totalIncome)}
            </p>
            {!isLoading && totalIncome > 0 && (
              <p className="text-2xs font-mono text-muted-foreground mt-1">
                {avgLabel(avgIncomePerMonth)}
              </p>
            )}
          </div>
        </motion.div>

        {/* Monthly Trend Chart - Neo Style */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="neo-card p-6 mb-8"
        >
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="font-heading font-bold text-foreground">Trends</h3>
              <p className="text-xs font-mono text-muted-foreground mt-1 lowercase">
                {chartMode === 'total' ? 'spending vs income' : 'group breakdown'}
              </p>
            </div>

            {/* Chart mode toggle */}
            {groups.length > 0 && (
              <div className="flex gap-2">
                <button
                  onClick={() => setChartMode('total')}
                  className={cn(
                    'p-2 rounded-none border transition-all',
                    chartMode === 'total'
                      ? 'bg-primary border-primary text-primary-foreground'
                      : 'border-border text-muted-foreground hover:text-foreground'
                  )}
                >
                  <BarChart3 className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setChartMode('by-group')}
                  className={cn(
                    'p-2 rounded-none border transition-all',
                    chartMode === 'by-group'
                      ? 'bg-primary border-primary text-primary-foreground'
                      : 'border-border text-muted-foreground hover:text-foreground'
                  )}
                >
                  <Layers className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>

          {isLoading ? (
            <Skeleton className="h-64 w-full bg-muted/20" />
          ) : monthlyTrend.length > 0 ? (
            <>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={monthlyTrend} barCategoryGap="20%" onClick={(state: any) => {
                    if (!state?.activePayload?.[0]?.payload?.rawDate) return;

                    const label = state.activePayload[0].payload.label;
                    const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;

                    // On mobile: first tap shows tooltip, second tap on same bar filters
                    if (isTouchDevice && lastTappedBarRef.current !== label) {
                      lastTappedBarRef.current = label;
                      return; // Just show the tooltip, don't navigate
                    }

                    lastTappedBarRef.current = null;
                    const rawDate = state.activePayload[0].payload.rawDate;
                    const start = startOfMonth(rawDate);
                    const end = endOfMonth(rawDate);
                      
                    setCustomStartState(start);
                    setCustomEndState(end);
                    setShowCustomPicker(false);
                      
                    setSearchParams(prev => {
                      const next = new URLSearchParams(prev);
                      next.set('range', 'custom');
                      next.set('from', format(start, 'yyyy-MM-dd'));
                      next.set('to', format(end, 'yyyy-MM-dd'));
                      return next;
                    }, { replace: true });
                  }} className="cursor-pointer">
                    <defs>
                      {/* Neo Gradient: Transparent to Lime */}
                      <linearGradient id="expenseBarGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.8} />
                        <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0.1} />
                      </linearGradient>
                    </defs>
                    <XAxis
                      dataKey="label"
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10, fontFamily: 'monospace' }}
                      dy={10}
                    />
                    <YAxis
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10, fontFamily: 'monospace' }}
                      tickFormatter={(val: number) => formatINRCompact(val).replace('₹', '')}
                      width={45}
                    />
                    <Tooltip content={<CustomTooltip />} cursor={{ fill: 'hsl(var(--foreground))', opacity: 0.05 }} />

                    {/* Bars: spending */}
                    {chartMode === 'total' ? (
                      <Bar
                        dataKey="expense"
                        radius={[2, 2, 0, 0]}
                        fill="url(#expenseBarGrad)"
                        maxBarSize={50}
                      />
                    ) : (
                      <>
                        {activeGroups
                          .filter(g => !hiddenGroupsInChart.has(g.id))
                          .map((g, i) => (
                            <Bar
                              key={g.id}
                              dataKey={`group_${g.id}`}
                              stackId="groups"
                              fill={GROUP_COLORS[i % GROUP_COLORS.length]}
                              maxBarSize={50}
                              radius={[0, 0, 0, 0]}
                            />
                          ))}
                        {!hiddenGroupsInChart.has('ungrouped') && (
                          <Bar
                            dataKey="group_ungrouped"
                            stackId="groups"
                            fill="#333"
                            maxBarSize={50}
                          />
                        )}
                      </>
                    )}

                    {/* Line: income - White Sharp Line */}
                    <Line
                      type="linear"
                      dataKey="income"
                      stroke="hsl(var(--foreground))"
                      strokeWidth={2}
                      dot={{ r: 3, fill: 'hsl(var(--background))', strokeWidth: 2, stroke: 'hsl(var(--foreground))' }}
                      activeDot={{ r: 5, fill: 'hsl(var(--foreground))' }}
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </>
          ) : (
            <div className="h-64 flex items-center justify-center border border-dashed border-border text-muted-foreground font-mono text-xs">
              NO TREND DATA AVAILABLE
            </div>
          )}
        </motion.div>

        {/* Category Breakdown */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="neo-card p-6 mb-6"
        >
          <h3 className="font-heading font-bold text-foreground mb-4">Allocation</h3>

          {isLoading ? (
            <div className="space-y-4">
              <Skeleton className="h-10 w-full bg-muted/20" />
            </div>
          ) : categoryBreakdown.length > 0 ? (
            <div className="space-y-9">
              {categoryBreakdown.map((cat, i) => {
                const percentage = totalSpent > 0 ? (cat.amount / totalSpent) * 100 : 0;
                return (
                  <Link
                    key={cat.id}
                    to={cat.id !== 'uncategorized' ? `/transactions?category=${cat.id}${dateFilterParams}` : `/transactions${dateFilterParams ? '?' + dateFilterParams.slice(1) : ''}`}
                  >
                    <div className="group cursor-pointer">
                      <div className="flex items-center justify-between text-sm mb-3">
                        <span className="flex items-center gap-3">
                          <span className="font-mono text-muted-foreground bg-muted/20 p-1 rounded">{cat.icon}</span>
                          <span className="font-bold text-foreground group-hover:text-primary transition-colors uppercase tracking-wide">
                            {cat.name}
                          </span>
                        </span>
                        <span className="font-mono text-foreground font-medium">
                          {percentage.toFixed(0)}% <span className="text-muted-foreground mx-1">/</span> {formatINRCompact(cat.amount)}
                        </span>
                      </div>
                      <div className="h-1.5 bg-muted/20 w-full overflow-hidden rounded-full mb-2">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${percentage}%` }}
                          transition={{ delay: 0.2, duration: 0.5 }}
                          className="h-full bg-foreground group-hover:bg-primary transition-colors rounded-full"
                        />
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          ) : (
            <p className="text-center text-muted-foreground py-4 font-mono text-xs">NO DATA</p>
          )}
        </motion.div>

        {/* Group Breakdown */}
        {groupBreakdown.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.22 }}
            className="neo-card p-6 mb-6"
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-heading font-bold text-foreground">Groups</h3>
              <span className="text-xs font-mono text-muted-foreground uppercase tracking-wider">Project Spending</span>
            </div>

            <div className="space-y-9">
              {groupBreakdown.map((grp, i) => {
                const percentage = totalGroupSpent > 0 ? (grp.amount / totalGroupSpent) * 100 : 0;
                return (
                  <Link
                    key={grp.id}
                    to={`/transactions?group=${grp.id}${dateFilterParams}`}
                  >
                    <div className="group cursor-pointer">
                      <div className="flex items-center justify-between text-sm mb-2.5">
                        <span className="flex items-center gap-3">
                          <span className="font-mono text-muted-foreground bg-muted/20 p-1 rounded">{grp.icon}</span>
                          <span className="font-bold text-foreground group-hover:text-primary transition-colors uppercase tracking-wide">
                            {grp.name}
                          </span>
                        </span>
                        <span className="font-mono text-foreground font-medium">
                          {formatINRCompact(grp.amount)}
                        </span>
                      </div>
                      <div className="h-1.5 bg-muted/20 w-full overflow-hidden rounded-full mb-2">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${percentage}%` }}
                          transition={{ delay: 0.2, duration: 0.5 }}
                          className="h-full bg-foreground group-hover:bg-primary transition-colors rounded-full"
                        />
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          </motion.div>
        )}

        {/* Bank Account Breakdown */}
        {!isLoading && bankBreakdown.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.23 }}
            className="neo-card p-6 mb-6"
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-heading font-bold text-foreground">By Bank Account</h3>
              <span className="text-xs font-mono text-muted-foreground uppercase tracking-wider">Spend By Source</span>
            </div>

            <div className="space-y-9">
              {bankBreakdown.map((b) => {
                const percentage = totalBankSpent > 0 ? (b.amount / totalBankSpent) * 100 : 0;
                const params = new URLSearchParams();
                if (b.bankName) params.set('bank', b.bankName);
                if (b.accountLast4) params.set('account', b.accountLast4);
                const dateSuffix = dateFilterParams.startsWith('&')
                  ? dateFilterParams.slice(1)
                  : dateFilterParams;
                const qs = [params.toString(), dateSuffix].filter(Boolean).join('&');
                return (
                  <Link
                    key={`${b.bankName}|${b.accountLast4}`}
                    to={`/transactions${qs ? `?${qs}` : ''}`}
                  >
                    <div className="group cursor-pointer">
                      <div className="flex items-center justify-between text-sm mb-2.5">
                        <span className="font-bold text-foreground group-hover:text-primary transition-colors uppercase tracking-wide truncate max-w-[60%]">
                          {b.display || 'Unknown'}
                        </span>
                        <span className="font-mono text-foreground font-medium">
                          {formatINRCompact(b.amount)}
                        </span>
                      </div>
                      <div className="h-1.5 bg-muted/20 w-full overflow-hidden rounded-full mb-2">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${percentage}%` }}
                          transition={{ delay: 0.2, duration: 0.5 }}
                          className="h-full bg-foreground group-hover:bg-primary transition-colors rounded-full"
                        />
                      </div>
                    </div>
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
          transition={{ delay: 0.25 }}
          className="neo-card p-6"
        >
          <h3 className="font-heading font-bold text-foreground mb-4">Top Merchants</h3>

          {isLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-10 w-full" />
            </div>
          ) : topMerchants.length > 0 ? (
            <div className="space-y-2">
              {topMerchants.map((merchant, i) => (
                <Link
                  key={merchant.name}
                  to={`/transactions?merchant=${encodeURIComponent(merchant.name)}${dateFilterParams}`}
                >
                  <div className="flex items-center justify-between p-3 border border-transparent hover:border-primary/30 hover:bg-primary/5 transition-all group cursor-pointer">
                    <div className="flex items-center gap-4">
                      <span className="font-mono text-xs text-muted-foreground group-hover:text-primary">
                        0{i + 1}
                      </span>
                      <span className="text-sm font-bold text-foreground uppercase tracking-wide">
                        {merchant.name}
                      </span>
                    </div>
                    <span className="font-mono text-xs text-foreground group-hover:text-primary">
                      {formatINR(merchant.amount)}
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <p className="text-center text-muted-foreground py-4 font-mono text-xs">NO DATA</p>
          )}
        </motion.div>
      </div>
    </AppLayout>
  );
}
