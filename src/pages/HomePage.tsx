import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { TrendingDown, TrendingUp, ChevronRight, ArrowUpRight, ArrowDownRight, Activity } from 'lucide-react';
import { format } from 'date-fns';
import { AppLayout } from '@/components/layout/AppLayout';
import { SpendingDonut } from '@/components/dashboard/SpendingDonut';
import { StatCard } from '@/components/dashboard/StatCard';
import { TransactionCard } from '@/components/transactions/TransactionCard';
import { useDashboardStats } from '@/hooks/useDashboardStats';
import { useRefundTotals } from '@/hooks/useRefundLinks';
import { formatINR, formatINRCompact } from '@/lib/formatCurrency';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/hooks/useAuth';

export default function HomePage() {
  const { user } = useAuth();
  const {
    thisMonthSpent,
    monthChange,
    thisMonthIncome,
    chartData,
    recentTxns,
    transactionCount,
    isLoading,
  } = useDashboardStats();

  const monthName = format(new Date(), 'MMMM');
  const year = format(new Date(), 'yyyy');

  // Batch-fetch refund totals for recent debit transactions
  const debitTxnIds = useMemo(() =>
    recentTxns.filter(t => t.direction === 'debit').map(t => t.id),
    [recentTxns]
  );
  const { data: refundTotals = {} } = useRefundTotals(debitTxnIds);

  return (
    <AppLayout>
      <div className="px-6 pt-12 pb-4 safe-area-top max-w-2xl mx-auto">
        {/* Header - Minimalist */}
        <motion.div
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="flex items-end justify-between mb-8 border-b border-border/50 pb-4"
        >
          <div>
            <p className="text-xs font-mono uppercase tracking-widest text-muted-foreground mb-1">
              Terminal • {user?.user_metadata?.full_name?.split(' ')[0] || 'User'}
            </p>
            <h1 className="text-3xl font-heading font-bold text-foreground leading-none">
              Dashboard
            </h1>
          </div>
          <div className="text-right">
            <p className="text-sm font-bold text-primary">{monthName}</p>
            <p className="text-xs text-muted-foreground font-mono">{year}</p>
          </div>
        </motion.div>

        {/* Bento Grid Layout */}
        <div className="grid grid-cols-2 gap-4 mb-8">

          {/* Main Hero: Total Spent - Spans 2 cols */}
          <div className="col-span-2">
            <motion.div
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              className="neo-card p-6 relative overflow-hidden bg-card"
            >
              <div className="absolute top-0 right-0 p-4 opacity-50">
                <Activity className="w-12 h-12 text-muted-foreground/10" />
              </div>

              <p className="text-xs font-mono uppercase tracking-widest text-muted-foreground mb-2">
                Total Output
              </p>

              {isLoading ? (
                <Skeleton className="h-12 w-48 bg-muted/20" />
              ) : (
                <div className="relative z-10">
                  <h2 className="text-5xl font-heading font-bold text-foreground tracking-tighter">
                    <span className="text-2xl text-muted-foreground align-top mr-1">₹</span>
                    {formatINR(thisMonthSpent).replace('₹', '')}
                  </h2>

                  <div className="flex items-center gap-3 mt-4">
                    <div className={`flex items-center gap-1.5 px-2 py-1 border text-xs font-mono font-medium ${monthChange > 0
                        ? 'border-destructive/30 text-destructive bg-destructive/5'
                        : 'border-primary/30 text-primary bg-primary/5'
                      }`}>
                      {monthChange > 0 ? '▲' : '▼'} {Math.abs(monthChange).toFixed(0)}%
                    </div>
                    <span className="text-xs text-muted-foreground font-mono uppercase">vs last month</span>
                  </div>
                </div>
              )}
            </motion.div>
          </div>

          {/* Quick Stats */}
          <StatCard
            label="Income"
            value={isLoading ? '...' : formatINRCompact(thisMonthIncome)}
            icon={<TrendingUp className="w-4 h-4" />}
            variant="default"
          />
          <StatCard
            label="Transactions"
            value={isLoading ? '...' : transactionCount.toString()}
            icon={<TrendingDown className="w-4 h-4" />}
            variant="default"
          />
        </div>

        {/* Charts & Breakdown */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="neo-card p-6 mb-8 border-border"
        >
          <div className="flex items-center justify-between mb-6">
            <h3 className="font-heading font-semibold text-foreground">Allocation</h3>
            <p className="text-xs font-mono text-muted-foreground uppercase">By Category</p>
          </div>

          <div className="flex flex-col md:flex-row items-center gap-8">
            <div className="w-full md:w-1/2 flex justify-center">
              {isLoading ? (
                <Skeleton className="w-40 h-40 rounded-full bg-muted/10" />
              ) : chartData.length > 0 ? (
                <div className="w-48">
                  <SpendingDonut data={chartData} totalSpent={thisMonthSpent} />
                </div>
              ) : (
                <div className="h-40 flex items-center justify-center text-muted-foreground text-xs font-mono border border-dashed border-border w-full">
                  NO DATA
                </div>
              )}
            </div>

            <div className="w-full md:w-1/2 grid grid-cols-2 gap-3">
              {chartData.slice(0, 6).map((item) => (
                <div key={item.name} className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-none" style={{ backgroundColor: item.color }} />
                  <span className="text-xs font-medium text-muted-foreground truncate">{item.name}</span>
                  <span className="text-xs font-mono ml-auto">{((item.value / thisMonthSpent) * 100).toFixed(0)}%</span>
                </div>
              ))}
            </div>
          </div>
        </motion.div>

        {/* Recent Transactions */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <div className="flex items-center justify-between mb-4 border-b border-border/50 pb-2">
            <h3 className="font-heading font-semibold text-foreground">Activity Log</h3>
            <Link
              to="/transactions"
              className="text-xs font-mono text-primary flex items-center gap-1 hover:underline underline-offset-4"
            >
              VIEW ALL <ChevronRight className="w-3 h-3" />
            </Link>
          </div>

          <div className="space-y-0 border border-border bg-card">
            {isLoading ? (
              <div className="p-4 space-y-4">
                <Skeleton className="h-12 w-full bg-muted/10" />
                <Skeleton className="h-12 w-full bg-muted/10" />
              </div>
            ) : recentTxns.length > 0 ? (
              recentTxns.map((txn, i) => {
                const refundTotal = refundTotals[txn.id];
                const net = refundTotal ? Number(txn.amount) - refundTotal : undefined;
                return (
                  <Link key={txn.id} to={`/transactions/${txn.id}`}>
                    <TransactionCard transaction={txn} index={i} netAmount={net} />
                  </Link>
                );
              })
            ) : (
              <div className="text-center py-12 text-muted-foreground font-mono text-xs">
                NO TRANSACTIONS RECORDED
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </AppLayout>
  );
}
