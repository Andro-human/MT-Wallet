import { useState } from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { TrendingDown, TrendingUp, ChevronRight, ChevronDown, ArrowUpRight, ArrowDownRight, Activity } from 'lucide-react';
import { format, startOfMonth, endOfMonth } from 'date-fns';
import { AppLayout } from '@/components/layout/AppLayout';
import { SpendingDonut } from '@/components/dashboard/SpendingDonut';
import { DayLedger } from '@/components/dashboard/DayLedger';
import { StatCard } from '@/components/dashboard/StatCard';
import { TransactionCard } from '@/components/transactions/TransactionCard';
import { useBankDisplayMap, lookupBankDisplay } from '@/hooks/useBankDisplayMap';
import { useDashboardStats } from '@/hooks/useDashboardStats';
import { useFinanceContext } from '@/hooks/useFinanceData';
import { netAmount as computeNetAmount, creditNet } from '@/lib/transactionMath';
import { formatINR, formatINRCompact } from '@/lib/formatCurrency';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/hooks/useAuth';
import { useProfile } from '@/hooks/useProfile';
import { useDaySummaries } from '@/hooks/useDaySummaries';
import { cn } from '@/lib/utils';

export default function HomePage() {
  const { user } = useAuth();
  const [openFold, setOpenFold] = useState(false);
  const { data: profile } = useProfile();
  const budget = profile?.monthly_budget ?? 0;
  const bankDisplayMap = useBankDisplayMap();
  const {
    thisMonthSpent,
    monthChange,
    thisMonthIncome,
    chartData,
    dayLedger,
    transactionCount,
    isLoading,
  } = useDashboardStats();

  const { data: daySummaries } = useDaySummaries(startOfMonth(new Date()), endOfMonth(new Date()));

  const monthName = format(new Date(), 'MMMM');
  const year = format(new Date(), 'yyyy');

  const { refundTotals, refundAllocations, isReady: contextReady } = useFinanceContext();

  return (
    <AppLayout>
      <div className="px-4 sm:px-6 pt-6 md:pt-12 pb-4 safe-area-top max-w-2xl mx-auto">
        {/* Header - Minimalist */}
        <motion.div
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="flex items-end justify-between mb-6 md:mb-8 border-b border-border/50 pb-4"
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
            <p className="text-sm font-bold text-gold">{monthName}</p>
            <p className="text-xs text-muted-foreground font-mono">{year}</p>
          </div>
        </motion.div>

        {/* Stat strip: the one-second answer, then the drill-down below */}
        <motion.div
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-wrap items-baseline gap-x-7 gap-y-3 mb-6 md:mb-8 pb-5 border-b border-border/60"
        >
          <div>
            <p className="text-2xs font-mono uppercase tracking-widest text-muted-foreground mb-1">
              Spent
            </p>
            {isLoading ? (
              <Skeleton className="h-7 w-28 bg-muted/20" />
            ) : (
              <p className="text-2xl font-semibold text-foreground currency-display">
                {formatINR(thisMonthSpent)}
              </p>
            )}
          </div>

          {budget > 0 && (
            <div>
              <p className="text-2xs font-mono uppercase tracking-widest text-muted-foreground mb-1">
                Left of {formatINRCompact(budget)}
              </p>
              {isLoading ? (
                <Skeleton className="h-7 w-24 bg-muted/20" />
              ) : (
                <p
                  className={cn(
                    'text-2xl font-semibold currency-display',
                    budget - thisMonthSpent >= 0 ? 'text-gold' : 'text-warning',
                  )}
                >
                  {formatINR(budget - thisMonthSpent)}
                </p>
              )}
            </div>
          )}

          <div>
            <p className="text-2xs font-mono uppercase tracking-widest text-muted-foreground mb-1">
              vs last month
            </p>
            {isLoading ? (
              <Skeleton className="h-7 w-16 bg-muted/20" />
            ) : (
              <p
                className={cn(
                  'text-2xl font-semibold currency-display',
                  monthChange > 0 ? 'text-warning' : 'text-gold',
                )}
              >
                {monthChange > 0 ? '+' : '−'}
                {Math.abs(monthChange).toFixed(0)}%
              </p>
            )}
          </div>

          <div className="ml-auto text-right">
            <p className="text-2xs font-mono uppercase tracking-widest text-muted-foreground mb-1">
              In · Txns
            </p>
            <p className="text-sm text-muted-foreground currency-display">
              {isLoading ? '…' : `${formatINRCompact(thisMonthIncome)} · ${transactionCount}`}
            </p>
          </div>
        </motion.div>

        {/* Charts & Breakdown */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="neo-card p-6 mb-4 md:mb-8 border-border"
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

            <div className="w-full md:w-1/2 grid grid-cols-2 gap-3 self-start">
              {chartData.map((item) => (
                <div key={item.name} className={item.detail ? 'col-span-2' : undefined}>
                  <button
                    type="button"
                    disabled={!item.detail}
                    onClick={() => setOpenFold((v) => !v)}
                    className={cn(
                      'w-full flex items-center gap-2 text-left',
                      item.detail && 'hover:opacity-80 transition-opacity',
                    )}
                  >
                    <div className="w-2 h-2 rounded-none shrink-0" style={{ backgroundColor: item.color }} />
                    <span className="text-xs font-medium text-muted-foreground truncate">{item.name}</span>
                    {item.detail && (
                      <ChevronDown
                        className={cn('w-3 h-3 shrink-0 text-muted-foreground transition-transform', openFold && 'rotate-180')}
                      />
                    )}
                    <span className="text-xs font-mono ml-auto">{((item.value / thisMonthSpent) * 100).toFixed(0)}%</span>
                  </button>
                  {item.detail && openFold && (
                    <div className="mt-1.5 ml-4 pl-2 border-l border-border/60 space-y-1">
                      {item.detail.map((d) => (
                        <div key={d.name} className="flex items-center gap-2">
                          <span className="text-2xs text-muted-foreground/80 truncate">{d.name}</span>
                          <span className="text-2xs font-mono ml-auto text-muted-foreground">{formatINR(d.value)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </motion.div>

        {/* Day Ledger: one row per day, tap to unfold that day */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <div className="flex items-center justify-between mb-2 border-b border-border/50 pb-2">
            <h3 className="font-heading font-semibold text-foreground">The Month, Day by Day</h3>
            <Link
              to="/transactions"
              className="text-xs font-mono text-primary flex items-center gap-1 hover:underline underline-offset-4"
            >
              VIEW ALL <ChevronRight className="w-3 h-3" />
            </Link>
          </div>

          {isLoading ? (
            <div className="py-4 space-y-3">
              <Skeleton className="h-6 w-full bg-muted/10" />
              <Skeleton className="h-6 w-full bg-muted/10" />
              <Skeleton className="h-6 w-full bg-muted/10" />
            </div>
          ) : dayLedger.length > 0 ? (
            <DayLedger
              days={dayLedger}
              summaries={daySummaries}
              bankDisplayMap={bankDisplayMap}
              netAmountFor={(id, direction) => {
                if (!contextReady) return undefined;
                if (direction === 'credit' && refundAllocations[id]) {
                  return creditNet({ id } as any, refundAllocations);
                }
                return refundTotals[id] ? computeNetAmount({ id } as any, refundTotals) : undefined;
              }}
            />
          ) : (
            <div className="text-center py-12 text-muted-foreground font-mono text-xs">
              NO TRANSACTIONS RECORDED
            </div>
          )}
        </motion.div>
      </div>
    </AppLayout>
  );
}
