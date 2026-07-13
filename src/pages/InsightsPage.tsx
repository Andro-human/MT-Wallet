import { useState, useMemo, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import { ComposedChart, Bar, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { startOfMonth, endOfMonth, subMonths, format, eachMonthOfInterval, startOfDay, endOfDay } from 'date-fns';
import { ChevronRight, ChevronDown, Folder, Calendar, X, Filter, BarChart3, Layers, LayoutGrid, HandCoins } from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { MonthYearPicker } from '@/components/ui/MonthYearPicker';
import { useTransactions } from '@/hooks/useTransactions';
import { useCategories } from '@/hooks/useCategories';
import { useTransactionGroups } from '@/hooks/useTransactionGroups';
import { useBankAccounts } from '@/hooks/useBankAccounts';
import { useFinanceContext } from '@/hooks/useFinanceData';
import { useEnrichmentMap } from '@/hooks/useTxnEnrichment';
import { RecurringSection, useDetectedSubscriptions } from '@/components/insights/RecurringSection';
import { MonthlySummaryCard } from '@/components/insights/MonthlySummaryCard';
import type { MonthlyAggregates } from '@/hooks/useMonthlySummary';
import {
  netAmount as computeNetAmount,
  creditNet,
  filterOutDuplicates,
} from '@/lib/transactionMath';
import { formatINR, formatINRCompact } from '@/lib/formatCurrency';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { monthsTouched } from '@/lib/monthsTouched';

type TimeRange = '1-month' | '3-months' | '6-months' | 'custom';
type ChartMode = 'total' | 'combined';

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


// ─── Main Component ──────────────────────────────────────────────────────────
export default function InsightsPage() {
  const lastTappedBarRef = useRef<string | null>(null);
  const navigate = useNavigate();
  // Persist key filters in URL so they survive navigation
  const [timeRange, setTimeRange] = useInsightParam('range', '6-months');
  const [chartModeParam, setChartModeParam] = useInsightParam('mode', 'combined');
  const chartMode = chartModeParam as ChartMode;
  const setChartMode = setChartModeParam;
  const [allocTabParam, setAllocTab] = useInsightParam('alloc', 'combined');
  const allocTab = allocTabParam as 'combined' | 'categories' | 'groups';

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

  const { refundTotals, refundAllocations, duplicateExcludeIds, isReady: contextReady } = useFinanceContext();
  const { data: enrichmentMap } = useEnrichmentMap();
  const [expandedAlloc, setExpandedAlloc] = useState<string | null>(null);
  const isLoading = txnsLoading || !contextReady;

  const netAmount = useCallback(
    (t: { id: string; amount: number | string; is_expense?: boolean | null; is_income?: boolean | null; category_id?: string | null }) =>
      computeNetAmount(t as any, refundTotals),
    [refundTotals],
  );

  const transactions = useMemo(() => {
    let filtered = allTransactions;

    if (excludedGroups.size > 0) {
      filtered = filtered.filter(t => !t.group_id || !excludedGroups.has(t.group_id));
    }

    filtered = filterOutDuplicates(filtered, duplicateExcludeIds);

    return filtered;
  }, [allTransactions, excludedGroups, duplicateExcludeIds]);

  const hasAdvancedFilters = excludedGroups.size > 0;

  // ─── Chart Data ────────────────────────────────────────────────────────────

  // Get unique groups that have spending data (for chart legend)
  const activeGroups = useMemo(() => {
    const groupIds = new Set<string>();
    transactions.filter(t => t.is_expense && t.group_id).forEach(t => groupIds.add(t.group_id!));
    return groups.filter(g => groupIds.has(g.id));
  }, [transactions, groups]);

  // Categories with UNGROUPED expense only — grouped txns are represented by their
  // group, never double-counted here. Drives the combined trend's category segments.
  const activeCategories = useMemo(() => {
    const ids = new Set<string>();
    transactions
      .filter(t => t.is_expense && !t.group_id)
      .forEach(t => ids.add(t.category_id || 'uncategorized'));
    return Array.from(ids).map(id => {
      const c = categories.find(x => x.id === id);
      return {
        id,
        name: c?.name || 'Uncategorized',
        color: c?.color || '#6B7280',
        icon: c?.icon || '📦',
      };
    });
  }, [transactions, categories]);

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

      // Initialize breakdown columns
      if (chartMode === 'combined') {
        activeGroups.forEach(g => {
          months[key][`group_${g.id}`] = 0;
        });
        activeCategories.forEach(c => {
          months[key][`cat_${c.id}`] = 0;
        });
      }
    });

    transactions.forEach(t => {
      const key = format(new Date(t.transacted_at), 'yyyy-MM');
      if (!months[key]) return;

      if (t.is_expense) {
        months[key].expense += netAmount(t);

        if (chartMode === 'combined') {
          const segKey = t.group_id ? `group_${t.group_id}` : `cat_${t.category_id || 'uncategorized'}`;
          if (months[key][segKey] !== undefined) {
            months[key][segKey] += netAmount(t);
          }
        }
      }
      if (t.is_income) {
        months[key].income += creditNet(t as any, refundAllocations);
      }
    });

    return Object.values(months);
  }, [transactions, dateRange, chartMode, activeGroups, activeCategories, netAmount, refundAllocations]);

  // Unified allocation: each group is one slice; categories cover only UNGROUPED
  // transactions. Groups + ungrouped categories = 100% of spend, no double counting.
  const allocationBreakdown = useMemo(() => {
    const items: {
      id: string;
      linkId: string;
      name: string;
      icon: string;
      color: string;
      amount: number;
      type: 'group' | 'category';
    }[] = [];

    const groupSums: Record<string, number> = {};
    transactions
      .filter(t => t.is_expense && t.group_id)
      .forEach(t => {
        groupSums[t.group_id!] = (groupSums[t.group_id!] || 0) + netAmount(t);
      });
    for (const [groupId, amount] of Object.entries(groupSums)) {
      const group = groups.find(g => g.id === groupId);
      items.push({
        id: `group_${groupId}`,
        linkId: groupId,
        name: group?.name || 'Unknown Group',
        icon: group?.icon || '📁',
        color: group?.color || '#8B5CF6',
        amount,
        type: 'group',
      });
    }

    const catSums: Record<string, number> = {};
    transactions
      .filter(t => t.is_expense && !t.group_id)
      .forEach(t => {
        const catId = t.category_id || 'uncategorized';
        catSums[catId] = (catSums[catId] || 0) + netAmount(t);
      });
    for (const [catId, amount] of Object.entries(catSums)) {
      const category = categories.find(c => c.id === catId);
      items.push({
        id: `cat_${catId}`,
        linkId: catId,
        name: category?.name || 'Uncategorized',
        icon: category?.icon || '📦',
        color: category?.color || '#6B7280',
        amount,
        type: 'category',
      });
    }

    return items.sort((a, b) => b.amount - a.amount);
  }, [transactions, groups, categories, netAmount]);

  // Pure category breakdown — ALL expense (grouped included). Drilling into a slice
  // here shows every transaction in that category, so the numbers match.
  const categoriesBreakdown = useMemo(() => {
    const sums: Record<string, number> = {};
    transactions
      .filter(t => t.is_expense)
      .forEach(t => {
        const catId = t.category_id || 'uncategorized';
        sums[catId] = (sums[catId] || 0) + netAmount(t);
      });
    return Object.entries(sums)
      .map(([catId, amount]) => {
        const c = categories.find(x => x.id === catId);
        return {
          id: `cat_${catId}`,
          linkId: catId,
          name: c?.name || 'Uncategorized',
          icon: c?.icon || '📦',
          color: c?.color || '#6B7280',
          amount,
          type: 'category' as const,
        };
      })
      .sort((a, b) => b.amount - a.amount);
  }, [transactions, categories, netAmount]);

  // Pure group breakdown.
  const groupsBreakdown = useMemo(() => {
    const sums: Record<string, number> = {};
    transactions
      .filter(t => t.is_expense && t.group_id)
      .forEach(t => {
        sums[t.group_id!] = (sums[t.group_id!] || 0) + netAmount(t);
      });
    return Object.entries(sums)
      .map(([gid, amount]) => {
        const g = groups.find(x => x.id === gid);
        return {
          id: `group_${gid}`,
          linkId: gid,
          name: g?.name || 'Unknown Group',
          icon: g?.icon || '📁',
          color: g?.color || '#8B5CF6',
          amount,
          type: 'group' as const,
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

  const topMerchants = useMemo(() => {
    const groups = new Map<
      string,
      { total: number; casings: Map<string, number> }
    >();

    for (const t of transactions) {
      if (!t.is_expense || !t.merchant) continue;
      const key = t.merchant;
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
  const totalSpent = allocationBreakdown.reduce((sum, c) => sum + c.amount, 0);
  const totalIncome = transactions
    .filter(t => t.is_income)
    .reduce((sum, t) => sum + creditNet(t as any, refundAllocations), 0);
  const totalBankSpent = bankBreakdown.reduce((sum, b) => sum + b.amount, 0);
  const totalGroupSpent = groupsBreakdown.reduce((sum, g) => sum + g.amount, 0);

  // Active Allocation tab: which breakdown + which denominator for its bars.
  const activeAllocation =
    allocTab === 'categories' ? categoriesBreakdown : allocTab === 'groups' ? groupsBreakdown : allocationBreakdown;
  const allocationDenom = allocTab === 'groups' ? totalGroupSpent : totalSpent;

  // Sub-theme breakdown inside a tile, from AI item_labels. MUST aggregate over
  // the same transaction set the tile's number came from (combined view excludes
  // grouped txns from category slices) so sub-lines sum to the tile total.
  const subThemesFor = useCallback(
    (item: { type: 'group' | 'category'; linkId: string }) => {
      const txns = transactions.filter(t =>
        t.is_expense &&
        (item.type === 'group'
          ? t.group_id === item.linkId
          : (allocTab !== 'combined' || !t.group_id) &&
            (t.category_id || 'uncategorized') === item.linkId)
      );
      const sums = new Map<string, { amount: number; count: number }>();
      for (const t of txns) {
        const amt = netAmount(t);
        if (amt <= 0) continue;
        const label = enrichmentMap?.get(t.id)?.item_label ?? 'unlabeled';
        const cur = sums.get(label) ?? { amount: 0, count: 0 };
        cur.amount += amt;
        cur.count += 1;
        sums.set(label, cur);
      }
      return [...sums.entries()]
        .map(([label, v]) => ({ label, ...v }))
        .sort((a, b) => b.amount - a.amount);
    },
    [transactions, allocTab, netAmount, enrichmentMap],
  );

  // Monthly summary is only meaningful for a single-month view.
  const summaryMonth = useMemo(() => {
    if (timeRange === '1-month') return format(now, 'yyyy-MM');
    if (
      timeRange === 'custom' &&
      customStart.getFullYear() === customEnd.getFullYear() &&
      customStart.getMonth() === customEnd.getMonth()
    ) {
      return format(customStart, 'yyyy-MM');
    }
    return null;
  }, [timeRange, customStart, customEnd, now]);

  const { detected: detectedSubs } = useDetectedSubscriptions();

  const buildMonthlyAggregates = useCallback((): MonthlyAggregates => {
    const themeSums = new Map<string, { context: string; amount: number }>();
    for (const t of transactions) {
      if (!t.is_expense) continue;
      const amt = netAmount(t);
      if (amt <= 0) continue;
      const label = enrichmentMap?.get(t.id)?.item_label;
      if (!label || label === 'other') continue;
      const cur = themeSums.get(label) ?? { context: t.categories?.name || 'Uncategorized', amount: 0 };
      cur.amount += amt;
      themeSums.set(label, cur);
    }
    const committed = detectedSubs
      .filter((s) => s.state === 'active' && (s.band === 'high' || s.band === 'medium'))
      .reduce((sum, s) => sum + s.monthlyNormalized, 0);
    return {
      month: summaryMonth!,
      total_spent: Math.round(totalSpent),
      total_income: Math.round(totalIncome),
      allocations: allocationBreakdown
        .slice(0, 10)
        .map((a) => ({ name: a.name, amount: Math.round(a.amount), type: a.type })),
      top_sub_themes: [...themeSums.entries()]
        .map(([label, v]) => ({ context: v.context, label, amount: Math.round(v.amount) }))
        .sort((a, b) => b.amount - a.amount)
        .slice(0, 8),
      recurring_monthly_committed: committed > 0 ? committed : null,
      loans_outstanding: null,
    };
  }, [transactions, enrichmentMap, detectedSubs, summaryMonth, totalSpent, totalIncome, allocationBreakdown, netAmount]);

  // Drill-down must match the number shown: the Combined tab's category slices
  // exclude grouped txns, so their links carry &ungrouped=1.
  const allocationLinkFor = (item: { type: 'group' | 'category'; linkId: string }) => {
    if (item.type === 'group') return `/transactions?group=${item.linkId}${dateFilterParams}`;
    const base = item.linkId === 'uncategorized' ? 'uncat=1' : `category=${item.linkId}`;
    const ungrouped = allocTab === 'combined' ? '&ungrouped=1' : '';
    return `/transactions?${base}${ungrouped}${dateFilterParams}`;
  };

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
      // Spends sorted by this month's amount (desc); income pinned to the bottom.
      const income = payload.find((p: any) => p.dataKey === 'income' && p.value !== 0);
      const spends = payload
        .filter((p: any) => p.dataKey !== 'income' && p.value !== 0)
        .sort((a: any, b: any) => b.value - a.value);
      const rows = income ? [...spends, income] : spends;

      return (
        <div className="bg-background border border-border p-3 shadow-2xl">
          <p className="font-mono font-bold text-xs uppercase tracking-wider mb-2 text-muted-foreground">{payload[0].payload.label}</p>
          {rows.map((p: any) => {
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
            else if (label.startsWith('group_')) {
              const gId = label.replace('group_', '');
              const g = groups.find(g => g.id === gId);
              label = g?.name || 'Group';
            }
            else if (label.startsWith('cat_')) {
              const cId = label.replace('cat_', '');
              const c = categories.find(c => c.id === cId);
              label = c?.name || 'Uncategorized';
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
                {chartMode === 'total' ? 'spending vs income' : 'groups + categories'}
              </p>
            </div>

            {/* Chart mode toggle */}
            {(
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
                  onClick={() => setChartMode('combined')}
                  className={cn(
                    'p-2 rounded-none border transition-all',
                    chartMode === 'combined'
                      ? 'bg-primary border-primary text-primary-foreground'
                      : 'border-border text-muted-foreground hover:text-foreground'
                  )}
                >
                  <LayoutGrid className="w-4 h-4" />
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
                        {(() => {
                          // Stack order + colour follow the Allocation list (spend desc).
                          const groupColor = new Map<string, string>();
                          activeGroups.forEach((g, i) =>
                            groupColor.set(g.id, GROUP_COLORS[i % GROUP_COLORS.length]),
                          );
                          return allocationBreakdown.map(item => (
                            <Bar
                              key={item.id}
                              dataKey={item.type === 'group' ? `group_${item.linkId}` : `cat_${item.linkId}`}
                              stackId="combined"
                              fill={item.type === 'group' ? (groupColor.get(item.linkId) || GROUP_COLORS[0]) : item.color}
                              maxBarSize={50}
                              radius={[0, 0, 0, 0]}
                            />
                          ));
                        })()}
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

        {/* Monthly AI recap — single-month views only */}
        {!isLoading && summaryMonth && (
          <MonthlySummaryCard month={summaryMonth} buildAggregates={buildMonthlyAggregates} />
        )}

        {/* Allocation — groups + ungrouped categories, de-duped */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="neo-card p-6 mb-6"
        >
          <div className="flex items-center justify-between mb-4 gap-3">
            <h3 className="font-heading font-bold text-foreground">Allocation</h3>
            {groups.length > 0 && (
              <div className="flex gap-1 flex-shrink-0">
                {(['combined', 'categories', 'groups'] as const).map(tab => (
                  <button
                    key={tab}
                    onClick={() => setAllocTab(tab)}
                    className={cn(
                      'px-2.5 py-1 rounded-none border text-[10px] font-mono uppercase tracking-wider transition-all',
                      allocTab === tab
                        ? 'bg-primary border-primary text-primary-foreground'
                        : 'border-border text-muted-foreground hover:text-foreground'
                    )}
                  >
                    {tab}
                  </button>
                ))}
              </div>
            )}
          </div>

          {isLoading ? (
            <div className="space-y-4">
              <Skeleton className="h-10 w-full bg-muted/20" />
            </div>
          ) : activeAllocation.length > 0 ? (
            <div className="space-y-9">
              {activeAllocation.map((item) => {
                const percentage = allocationDenom > 0 ? (item.amount / allocationDenom) * 100 : 0;
                const isExpanded = expandedAlloc === item.id;
                const subThemes = isExpanded ? subThemesFor(item) : [];
                return (
                  <div key={item.id}>
                    <Link to={allocationLinkFor(item)}>
                      <div className="group cursor-pointer">
                        <div className="flex items-center justify-between text-sm mb-3">
                          <span className="flex items-center gap-3">
                            <span className="font-mono text-muted-foreground bg-muted/20 p-1 rounded">{item.icon}</span>
                            <span className="font-bold text-foreground group-hover:text-primary transition-colors uppercase tracking-wide flex items-center gap-1.5">
                              {item.name}
                              {allocTab === 'combined' && item.type === 'group' && (
                                <Layers className="w-3 h-3 text-muted-foreground" />
                              )}
                            </span>
                          </span>
                          <span className="font-mono text-foreground font-medium flex items-center gap-1.5">
                            {percentage.toFixed(0)}% <span className="text-muted-foreground mx-1">/</span> {formatINRCompact(item.amount)}
                            <button
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                setExpandedAlloc(isExpanded ? null : item.id);
                              }}
                              aria-label={isExpanded ? 'Hide sub-themes' : 'Show sub-themes'}
                              className="p-1 -m-1 ml-0.5 rounded hover:bg-muted/30 transition-colors"
                            >
                              <ChevronDown
                                className={cn(
                                  'w-3.5 h-3.5 text-muted-foreground transition-transform',
                                  isExpanded && 'rotate-180',
                                )}
                              />
                            </button>
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
                    <AnimatePresence>
                      {isExpanded && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.2 }}
                          className="overflow-hidden"
                        >
                          <div className="pt-1 pb-2 pl-10 pr-1 space-y-1.5">
                            {subThemes.map((s) => (
                              <div key={s.label} className="flex items-center justify-between text-xs">
                                <span className="text-muted-foreground">
                                  {s.label}
                                  <span className="opacity-50 ml-1.5">×{s.count}</span>
                                </span>
                                <span className="font-mono text-muted-foreground">{formatINRCompact(s.amount)}</span>
                              </div>
                            ))}
                            {subThemes.length === 0 && (
                              <div className="text-xs text-muted-foreground/60">No sub-themes yet</div>
                            )}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-center text-muted-foreground py-4 font-mono text-xs">NO DATA</p>
          )}
        </motion.div>

        {/* Recurring subscriptions — cadence-detected, with confirm/ignore/snooze */}
        {!isLoading && <RecurringSection />}

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
