import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { TrendingDown, TrendingUp, ChevronRight, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { format } from 'date-fns';
import { AppLayout } from '@/components/layout/AppLayout';
import { SpendingDonut } from '@/components/dashboard/SpendingDonut';
import { StatCard } from '@/components/dashboard/StatCard';
import { TransactionCard } from '@/components/transactions/TransactionCard';
import { useDashboardStats } from '@/hooks/useDashboardStats';
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

  return (
    <AppLayout>
      <div className="px-4 pt-6 pb-4 safe-area-top">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center justify-between mb-6"
        >
          <div>
            <h1 className="text-2xl font-bold text-foreground">
              Hi, {user?.user_metadata?.full_name?.split(' ')[0] || 'there'} 👋
            </h1>
            <p className="text-sm text-muted-foreground">{monthName}</p>
          </div>
        </motion.div>

        {/* Main Stat */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.1 }}
          className="rounded-2xl gradient-primary p-6 mb-4"
        >
          <p className="text-sm text-primary-foreground/70 uppercase tracking-wider">
            Total Spent This Month
          </p>
          {isLoading ? (
            <Skeleton className="h-10 w-40 bg-white/20 mt-2" />
          ) : (
            <>
              <h2 className="text-4xl font-bold text-primary-foreground mt-1">
                {formatINR(thisMonthSpent)}
              </h2>
              <div className="flex items-center gap-2 mt-2">
                {monthChange > 0 ? (
                  <ArrowUpRight className="w-4 h-4 text-red-300" />
                ) : (
                  <ArrowDownRight className="w-4 h-4 text-green-300" />
                )}
                <span className={monthChange > 0 ? 'text-red-300 text-sm' : 'text-green-300 text-sm'}>
                  {Math.abs(monthChange).toFixed(0)}% vs last month
                </span>
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
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="rounded-2xl bg-card p-4 mb-6"
        >
          <h3 className="font-semibold text-foreground mb-2">Spending by Category</h3>
          {isLoading ? (
            <div className="h-52 flex items-center justify-center">
              <Skeleton className="w-40 h-40 rounded-full" />
            </div>
          ) : chartData.length > 0 ? (
            <SpendingDonut data={chartData} totalSpent={thisMonthSpent} />
          ) : (
            <div className="h-52 flex items-center justify-center text-muted-foreground text-sm">
              No transactions this month
            </div>
          )}
          
          {/* Legend */}
          {chartData.length > 0 && (
            <div className="grid grid-cols-2 gap-2 mt-4">
              {chartData.slice(0, 4).map((item) => (
                <div key={item.name} className="flex items-center gap-2">
                  <div
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: item.color }}
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
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-foreground">Recent Transactions</h3>
            <Link
              to="/transactions"
              className="text-sm text-primary flex items-center gap-1 hover:underline"
            >
              See all
              <ChevronRight className="w-4 h-4" />
            </Link>
          </div>

          <div className="space-y-2">
            {isLoading ? (
              Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-16 rounded-xl" />
              ))
            ) : recentTxns.length > 0 ? (
              recentTxns.map((txn, i) => (
                <Link key={txn.id} to={`/transactions/${txn.id}`}>
                  <TransactionCard transaction={txn} index={i} />
                </Link>
              ))
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                No transactions yet
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </AppLayout>
  );
}
