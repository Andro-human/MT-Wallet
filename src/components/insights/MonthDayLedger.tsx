import { DayLedger } from '@/components/dashboard/DayLedger';
import { useMonthDayLedger } from '@/hooks/useMonthDayLedger';
import { useBankDisplayMap } from '@/hooks/useBankDisplayMap';
import { useFinanceContext } from '@/hooks/useFinanceData';
import { makeNetAmountFor } from '@/lib/dayLedger';
import { Skeleton } from '@/components/ui/skeleton';

/** The chosen month's ledger, under its review.
 *
 *  No new navigation: the month tabs above already say which month is being
 *  read, and the ledger of a finished month belongs beside the write-up of it.
 */
export function MonthDayLedger({ month }: { month: string | null }) {
  const { days, summaries, isLoading } = useMonthDayLedger(month);
  const bankDisplayMap = useBankDisplayMap();
  const { refundTotals, refundAllocations, isReady } = useFinanceContext();

  if (!month) return null;

  return (
    <div className="mt-6">
      <h3 className="text-xs font-mono uppercase tracking-wider text-muted-foreground mb-2">
        Day by day
      </h3>
      {isLoading ? (
        <Skeleton className="h-24 w-full bg-muted/20" />
      ) : days.length === 0 ? (
        <p className="text-sm text-muted-foreground py-4">No transactions that month.</p>
      ) : (
        <DayLedger
          days={days}
          summaries={summaries}
          bankDisplayMap={bankDisplayMap}
          netAmountFor={makeNetAmountFor(isReady, refundTotals, refundAllocations)}
        />
      )}
    </div>
  );
}
