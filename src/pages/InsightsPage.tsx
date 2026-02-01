import { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { startOfMonth, endOfMonth, subMonths, format } from 'date-fns';
import { AppLayout } from '@/components/layout/AppLayout';
import { useTransactions } from '@/hooks/useTransactions';
import { useCategories } from '@/hooks/useCategories';
import { formatINR, formatINRCompact } from '@/lib/formatCurrency';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

type TimeRange = 'this-month' | 'last-3-months' | 'this-year';

export default function InsightsPage() {
  const [timeRange, setTimeRange] = useState<TimeRange>('this-month');
  const { data: categories = [] } = useCategories();

  const now = new Date();
  const dateRange = useMemo(() => {
    switch (timeRange) {
      case 'this-month':
        return { startDate: startOfMonth(now), endDate: endOfMonth(now) };
      case 'last-3-months':
        return { startDate: startOfMonth(subMonths(now, 2)), endDate: endOfMonth(now) };
      case 'this-year':
        return { startDate: new Date(now.getFullYear(), 0, 1), endDate: endOfMonth(now) };
    }
  }, [timeRange]);

  const { data: transactions = [], isLoading } = useTransactions(dateRange);

  // Monthly spending trend (last 6 months)
  const monthlyTrend = useMemo(() => {
    const months: Record<string, number> = {};
    for (let i = 5; i >= 0; i--) {
      const monthDate = subMonths(now, i);
      const key = format(monthDate, 'MMM');
      months[key] = 0;
    }

    transactions
      .filter(t => t.direction === 'debit' && !t.is_excluded)
      .forEach(t => {
        const key = format(new Date(t.transacted_at), 'MMM');
        if (months[key] !== undefined) {
          months[key] += Number(t.amount);
        }
      });

    return Object.entries(months).map(([name, value]) => ({ name, value }));
  }, [transactions]);

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

  const totalSpent = categoryBreakdown.reduce((sum, c) => sum + c.amount, 0);

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="glass-card px-3 py-2">
          <p className="text-sm font-semibold">{payload[0].payload.name}</p>
          <p className="text-xs text-muted-foreground mt-0.5">{formatINR(payload[0].value)}</p>
        </div>
      );
    }
    return null;
  };

  const timeRangeOptions = [
    { value: 'this-month', label: 'This Month' },
    { value: 'last-3-months', label: '3 Months' },
    { value: 'this-year', label: 'This Year' },
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
            Understand your spending patterns
          </p>
        </motion.div>

        {/* Time Range Toggle */}
        <motion.div 
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1, duration: 0.3 }}
          className="flex gap-2 mb-6 p-1 bg-card/50 rounded-xl w-fit"
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

        {/* Monthly Trend */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15, duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
          className="glass-card p-5 mb-4"
        >
          <h3 className="font-semibold text-foreground mb-1">Monthly Spending</h3>
          <p className="text-xs text-muted-foreground mb-5">Last 6 months trend</p>
          
          {isLoading ? (
            <Skeleton className="h-44" />
          ) : (
            <div className="h-44">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={monthlyTrend} barCategoryGap="20%">
                  <defs>
                    <linearGradient id="barGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="hsl(252 87% 64%)" stopOpacity={1} />
                      <stop offset="100%" stopColor="hsl(252 87% 64%)" stopOpacity={0.6} />
                    </linearGradient>
                    <linearGradient id="barGradientMuted" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="hsl(240 10% 28%)" stopOpacity={1} />
                      <stop offset="100%" stopColor="hsl(240 10% 20%)" stopOpacity={1} />
                    </linearGradient>
                  </defs>
                  <XAxis
                    dataKey="name"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11, fontWeight: 500 }}
                    dy={8}
                  />
                  <YAxis hide />
                  <Tooltip content={<CustomTooltip />} cursor={false} />
                  <Bar dataKey="value" radius={[8, 8, 0, 0]}>
                    {monthlyTrend.map((entry, index) => (
                      <Cell 
                        key={`cell-${index}`} 
                        fill={index === monthlyTrend.length - 1 ? 'url(#barGradient)' : 'url(#barGradientMuted)'}
                        style={index === monthlyTrend.length - 1 ? {
                          filter: 'drop-shadow(0 4px 12px hsl(252 87% 64% / 0.3))',
                        } : undefined}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
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
                  <motion.div
                    key={cat.id}
                    initial={{ opacity: 0, x: -12 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.04, duration: 0.3 }}
                    className="space-y-2"
                  >
                    <div className="flex items-center justify-between text-sm">
                      <span className="flex items-center gap-2.5">
                        <span className="text-base">{cat.icon}</span>
                        <span className="text-foreground font-medium">{cat.name}</span>
                      </span>
                      <span className="text-foreground font-semibold currency-display">
                        {formatINRCompact(cat.amount)}
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
                );
              })}
            </div>
          ) : (
            <p className="text-center text-muted-foreground py-8">No data available</p>
          )}
        </motion.div>

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
                <motion.div
                  key={merchant.name}
                  initial={{ opacity: 0, x: -12 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.04, duration: 0.3 }}
                  className="flex items-center justify-between p-3 rounded-xl bg-muted/30 hover:bg-muted/50 transition-colors"
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
                    <span className="text-foreground text-sm font-medium truncate max-w-[160px]">
                      {merchant.name}
                    </span>
                  </div>
                  <span className="text-foreground font-semibold text-sm currency-display">
                    {formatINR(merchant.amount)}
                  </span>
                </motion.div>
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
