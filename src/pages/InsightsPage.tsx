import { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { startOfMonth, endOfMonth, subMonths, format } from 'date-fns';
import { AppLayout } from '@/components/layout/AppLayout';
import { useTransactions } from '@/hooks/useTransactions';
import { useCategories } from '@/hooks/useCategories';
import { formatINR, formatINRCompact } from '@/lib/formatCurrency';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
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

    // Need to fetch all transactions for trend - using current filtered transactions for demo
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
          color: category?.color || '#9CA3AF',
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
        <div className="glass rounded-lg px-3 py-2">
          <p className="text-sm font-medium">{payload[0].payload.name}</p>
          <p className="text-xs text-muted-foreground">{formatINR(payload[0].value)}</p>
        </div>
      );
    }
    return null;
  };

  return (
    <AppLayout>
      <div className="px-4 pt-6 pb-4 safe-area-top">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-4"
        >
          <h1 className="text-2xl font-bold text-foreground">Insights</h1>
          <p className="text-sm text-muted-foreground">
            Understand your spending patterns
          </p>
        </motion.div>

        {/* Time Range Toggle */}
        <div className="flex gap-2 mb-6">
          {[
            { value: 'this-month', label: 'This Month' },
            { value: 'last-3-months', label: '3 Months' },
            { value: 'this-year', label: 'This Year' },
          ].map((range) => (
            <Button
              key={range.value}
              variant={timeRange === range.value ? 'default' : 'outline'}
              size="sm"
              onClick={() => setTimeRange(range.value as TimeRange)}
              className={cn(
                timeRange === range.value && 'gradient-primary'
              )}
            >
              {range.label}
            </Button>
          ))}
        </div>

        {/* Monthly Trend */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-2xl bg-card p-4 mb-4"
        >
          <h3 className="font-semibold text-foreground mb-4">Monthly Spending</h3>
          {isLoading ? (
            <Skeleton className="h-40" />
          ) : (
            <div className="h-40">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={monthlyTrend}>
                  <XAxis
                    dataKey="name"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
                  />
                  <YAxis hide />
                  <Tooltip content={<CustomTooltip />} cursor={false} />
                  <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                    {monthlyTrend.map((entry, index) => (
                      <Cell 
                        key={`cell-${index}`} 
                        fill={index === monthlyTrend.length - 1 ? 'hsl(var(--primary))' : 'hsl(var(--muted))'} 
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
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="rounded-2xl bg-card p-4 mb-4"
        >
          <h3 className="font-semibold text-foreground mb-4">By Category</h3>
          {isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-12" />
              ))}
            </div>
          ) : categoryBreakdown.length > 0 ? (
            <div className="space-y-3">
              {categoryBreakdown.map((cat, i) => {
                const percentage = totalSpent > 0 ? (cat.amount / totalSpent) * 100 : 0;
                return (
                  <motion.div
                    key={cat.id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.05 }}
                    className="space-y-1"
                  >
                    <div className="flex items-center justify-between text-sm">
                      <span className="flex items-center gap-2">
                        <span>{cat.icon}</span>
                        <span className="text-foreground">{cat.name}</span>
                      </span>
                      <span className="text-foreground font-medium">
                        {formatINRCompact(cat.amount)}
                      </span>
                    </div>
                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${percentage}%` }}
                        transition={{ delay: i * 0.05 + 0.2 }}
                        className="h-full rounded-full"
                        style={{ backgroundColor: cat.color }}
                      />
                    </div>
                  </motion.div>
                );
              })}
            </div>
          ) : (
            <p className="text-center text-muted-foreground py-4">No data available</p>
          )}
        </motion.div>

        {/* Top Merchants */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="rounded-2xl bg-card p-4"
        >
          <h3 className="font-semibold text-foreground mb-4">Top Merchants</h3>
          {isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-10" />
              ))}
            </div>
          ) : topMerchants.length > 0 ? (
            <div className="space-y-3">
              {topMerchants.map((merchant, i) => (
                <motion.div
                  key={merchant.name}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.05 }}
                  className="flex items-center justify-between"
                >
                  <div className="flex items-center gap-3">
                    <span className="w-6 h-6 rounded-full bg-muted flex items-center justify-center text-xs text-muted-foreground">
                      {i + 1}
                    </span>
                    <span className="text-foreground text-sm truncate max-w-[180px]">
                      {merchant.name}
                    </span>
                  </div>
                  <span className="text-foreground font-medium text-sm">
                    {formatINR(merchant.amount)}
                  </span>
                </motion.div>
              ))}
            </div>
          ) : (
            <p className="text-center text-muted-foreground py-4">No data available</p>
          )}
        </motion.div>
      </div>
    </AppLayout>
  );
}
