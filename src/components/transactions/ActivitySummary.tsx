import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { ArrowUpRight, ArrowDownRight, TrendingUp, TrendingDown, Wallet } from 'lucide-react';
import { format, eachDayOfInterval, eachWeekOfInterval, eachMonthOfInterval, startOfDay, startOfWeek, startOfMonth, differenceInDays } from 'date-fns';
import { TransactionWithCategory } from '@/types/database';
import { formatINR, formatINRCompact } from '@/lib/formatCurrency';

interface ActivitySummaryProps {
  transactions: TransactionWithCategory[];
  dateRange: { startDate?: Date; endDate?: Date };
  isLoading?: boolean;
}

export function ActivitySummary({ transactions, dateRange, isLoading }: ActivitySummaryProps) {
  const stats = useMemo(() => {
    const expenses = transactions
      .filter(t => t.direction === 'debit' && !t.is_excluded)
      .reduce((sum, t) => sum + Number(t.amount), 0);

    const income = transactions
      .filter(t => t.direction === 'credit')
      .reduce((sum, t) => sum + Number(t.amount), 0);

    return { expenses, income, net: income - expenses };
  }, [transactions]);

  const chartData = useMemo(() => {
    if (!dateRange.startDate || !dateRange.endDate) return [];

    const daysDiff = differenceInDays(dateRange.endDate, dateRange.startDate);

    // Choose granularity based on range
    let intervals: Date[];
    let formatStr: string;
    let getKey: (date: Date) => string;

    if (daysDiff <= 35) {
      // Daily for up to ~1 month
      intervals = eachDayOfInterval({ start: dateRange.startDate, end: dateRange.endDate });
      formatStr = 'd';
      getKey = (d) => format(startOfDay(d), 'yyyy-MM-dd');
    } else if (daysDiff <= 120) {
      // Weekly for up to ~4 months
      intervals = eachWeekOfInterval({ start: dateRange.startDate, end: dateRange.endDate });
      formatStr = 'MMM d';
      getKey = (d) => format(startOfWeek(d), 'yyyy-MM-dd');
    } else {
      // Monthly
      intervals = eachMonthOfInterval({ start: dateRange.startDate, end: dateRange.endDate });
      formatStr = 'MMM';
      getKey = (d) => format(startOfMonth(d), 'yyyy-MM');
    }

    // Initialize buckets
    const buckets: Record<string, { expense: number; income: number; label: string }> = {};
    intervals.forEach(d => {
      const key = getKey(d);
      buckets[key] = { expense: 0, income: 0, label: format(d, formatStr) };
    });

    // Fill buckets
    transactions.forEach(t => {
      const txDate = new Date(t.transacted_at);
      let key: string;
      if (daysDiff <= 35) {
        key = format(startOfDay(txDate), 'yyyy-MM-dd');
      } else if (daysDiff <= 120) {
        key = format(startOfWeek(txDate), 'yyyy-MM-dd');
      } else {
        key = format(startOfMonth(txDate), 'yyyy-MM');
      }

      if (buckets[key]) {
        if (t.direction === 'debit' && !t.is_excluded) {
          buckets[key].expense += Number(t.amount);
        } else if (t.direction === 'credit') {
          buckets[key].income += Number(t.amount);
        }
      }
    });

    return Object.values(buckets);
  }, [transactions, dateRange]);

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="glass-card px-3 py-2 text-xs">
          <p className="text-muted-foreground mb-1">{payload[0]?.payload?.label}</p>
          {payload.map((p: any) => (
            <p key={p.dataKey} className="font-medium" style={{ color: p.stroke }}>
              {p.dataKey === 'expense' ? 'Spent' : 'Income'}: {formatINR(p.value)}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  if (isLoading) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass-card p-5 mb-5"
      >
        <div className="h-32 bg-muted/20 rounded-xl animate-pulse" />
        <div className="grid grid-cols-3 gap-3 mt-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-16 bg-muted/20 rounded-xl animate-pulse" />
          ))}
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
      className="glass-card p-5 mb-5"
    >
      {/* Chart */}
      {chartData.length > 1 && (
        <div className="h-28 -mx-2 mb-4">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 4, right: 4, bottom: 0, left: 4 }}>
              <defs>
                <linearGradient id="expenseGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="hsl(0 72% 51%)" stopOpacity={0.3} />
                  <stop offset="100%" stopColor="hsl(0 72% 51%)" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="incomeGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="hsl(160 84% 39%)" stopOpacity={0.3} />
                  <stop offset="100%" stopColor="hsl(160 84% 39%)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis
                dataKey="label"
                axisLine={false}
                tickLine={false}
                tick={{ fill: 'hsl(240 5% 55%)', fontSize: 10 }}
                interval="preserveStartEnd"
                dy={4}
              />
              <YAxis hide />
              <Tooltip content={<CustomTooltip />} cursor={false} />
              <Area
                type="monotone"
                dataKey="expense"
                stroke="hsl(0 72% 51%)"
                strokeWidth={2}
                fill="url(#expenseGrad)"
                dot={false}
                activeDot={{ r: 3, strokeWidth: 0 }}
              />
              <Area
                type="monotone"
                dataKey="income"
                stroke="hsl(160 84% 39%)"
                strokeWidth={2}
                fill="url(#incomeGrad)"
                dot={false}
                activeDot={{ r: 3, strokeWidth: 0 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Stat Row */}
      <div className="grid grid-cols-3 gap-3">
        <div className="text-center p-3 rounded-xl bg-destructive/5 border border-destructive/10">
          <div className="flex items-center justify-center gap-1 mb-1">
            <ArrowUpRight className="w-3 h-3 text-destructive" />
            <span className="text-2xs text-muted-foreground uppercase tracking-wider font-medium">Spent</span>
          </div>
          <p className="text-sm font-bold text-foreground currency-display">
            {formatINRCompact(stats.expenses)}
          </p>
        </div>

        <div className="text-center p-3 rounded-xl bg-success/5 border border-success/10">
          <div className="flex items-center justify-center gap-1 mb-1">
            <ArrowDownRight className="w-3 h-3 text-success" />
            <span className="text-2xs text-muted-foreground uppercase tracking-wider font-medium">Income</span>
          </div>
          <p className="text-sm font-bold text-foreground currency-display">
            {formatINRCompact(stats.income)}
          </p>
        </div>

        <div className="text-center p-3 rounded-xl bg-primary/5 border border-primary/10">
          <div className="flex items-center justify-center gap-1 mb-1">
            <Wallet className="w-3 h-3 text-primary" />
            <span className="text-2xs text-muted-foreground uppercase tracking-wider font-medium">Net</span>
          </div>
          <p className={`text-sm font-bold currency-display ${stats.net >= 0 ? 'text-success' : 'text-destructive'}`}>
            {stats.net >= 0 ? '+' : ''}{formatINRCompact(stats.net)}
          </p>
        </div>
      </div>
    </motion.div>
  );
}
