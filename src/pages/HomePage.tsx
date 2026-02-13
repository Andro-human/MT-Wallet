import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { TrendingDown, TrendingUp, ChevronRight, ArrowUpRight, ArrowDownRight } from 'lucide-react';
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

  const monthName = format(new Date(), 'MMMM yyyy');

  // Batch-fetch refund totals for recent debit transactions
  const debitTxnIds = useMemo(() => 
    recentTxns.filter(t => t.direction === 'debit').map(t => t.id),
    [recentTxns]
  );
  const { data: refundTotals = {} } = useRefundTotals(debitTxnIds);

  return (
    <AppLayout>
      <div className="px-5 pt-8 pb-4 safe-area-top">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
          className="flex items-center justify-between mb-8"
        >
          <div>
            <h1 className="text-2xl font-bold text-foreground">
              Hi, {user?.user_metadata?.full_name?.split(' ')[0] || 'there'} 👋
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">{monthName}</p>
          </div>
        </motion.div>

        {/* Hero Stat Card */}
        <motion.div
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.1, duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
          className="glass-elevated p-6 mb-5 overflow-hidden relative"
        >
          {/* Gradient accent */}
          <div 
            className="absolute top-0 right-0 w-32 h-32 opacity-30"
            style={{
              background: 'radial-gradient(circle at top right, hsl(252 87% 64% / 0.4), transparent 70%)',
            }}
          />
          
          <p className="text-2xs text-muted-foreground uppercase tracking-extra-wide font-medium relative">
            Total Spent This Month
          </p>
          
          {isLoading ? (
            <Skeleton className="h-12 w-44 bg-muted/30 mt-3" />
          ) : (
            <>
              <h2 className="text-hero text-foreground mt-2 currency-display relative">
                <span className="text-[0.6em] text-muted-foreground mr-1">₹</span>
                {formatINR(thisMonthSpent).replace('₹', '')}
              </h2>
              <div className="flex items-center gap-2 mt-3 relative">
                <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${
                  monthChange > 0 
                    ? 'bg-destructive/10 text-destructive' 
                    : 'bg-success/10 text-success'
                }`}>
                  {monthChange > 0 ? (
                    <ArrowUpRight className="w-3.5 h-3.5" />
                  ) : (
                    <ArrowDownRight className="w-3.5 h-3.5" />
                  )}
                  {Math.abs(monthChange).toFixed(0)}%
                </div>
                <span className="text-xs text-muted-foreground">vs last month</span>
              </div>
            </>
          )}
        </motion.div>

        {/* Stat Grid */}
        <div className="grid grid-cols-2 gap-3 mb-6">
          <StatCard
            label="Income"
            value={isLoading ? '...' : formatINRCompact(thisMonthIncome)}
            icon={<TrendingUp className="w-4 h-4 text-success" />}
          />
          <StatCard
            label="Transactions"
            value={isLoading ? '...' : transactionCount.toString()}
            icon={<TrendingDown className="w-4 h-4 text-primary" />}
          />
        </div>

        {/* Category Breakdown */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
          className="glass-card p-5 mb-6"
        >
          <h3 className="font-semibold text-foreground mb-1">Spending by Category</h3>
          <p className="text-xs text-muted-foreground mb-4">Where your money goes</p>
          
          {isLoading ? (
            <div className="h-56 flex items-center justify-center">
              <Skeleton className="w-44 h-44 rounded-full" />
            </div>
          ) : chartData.length > 0 ? (
            <SpendingDonut data={chartData} totalSpent={thisMonthSpent} />
          ) : (
            <div className="h-56 flex items-center justify-center text-muted-foreground text-sm">
              No transactions this month
            </div>
          )}
          
          {/* Legend */}
          {chartData.length > 0 && (
            <div className="grid grid-cols-2 gap-x-4 gap-y-2.5 mt-5 pt-4 border-t border-border/50">
              {chartData.slice(0, 4).map((item) => (
                <div key={item.name} className="flex items-center gap-2.5">
                  <div
                    className="w-2.5 h-2.5 rounded-full"
                    style={{ 
                      backgroundColor: item.color,
                      boxShadow: `0 0 8px ${item.color}60`,
                    }}
                  />
                  <span className="text-xs text-muted-foreground truncate">
                    {item.icon} {item.name}
                  </span>
                </div>
              ))}
            </div>
          )}
        </motion.div>

        {/* Recent Transactions */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
        >
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-semibold text-foreground">Recent Transactions</h3>
              <p className="text-xs text-muted-foreground mt-0.5">Your latest activity</p>
            </div>
            <Link
              to="/transactions"
              className="text-sm text-primary font-medium flex items-center gap-1 hover:gap-2 transition-all duration-200"
            >
              See all
              <ChevronRight className="w-4 h-4" />
            </Link>
          </div>

          <div className="space-y-2.5">
            {isLoading ? (
              Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-[72px] rounded-2xl" />
              ))
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
              <div className="text-center py-12 text-muted-foreground">
                <p className="text-sm">No transactions yet</p>
                <p className="text-xs mt-1 opacity-70">Add sample data from Settings</p>
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </AppLayout>
  );
}
