import { format, isWeekend } from 'date-fns';
import { LONG_TAIL_COLOR } from './categoryColors';
import { netAmount as computeNetAmount, creditNet } from './transactionMath';
import type { RefundAllocationsMap, RefundTotalsMap } from './transactionMath';

export interface DaySegment {
  categoryId: string;
  name: string;
  color: string;
  value: number;
}

export interface DayLedgerRow<T> {
  key: string;
  date: Date;
  folio: string;
  weekend: boolean;
  spent: number;
  income: number;
  segments: DaySegment[];
  txns: T[];
}

interface LedgerTxn {
  transacted_at: string;
  is_expense?: boolean | null;
  is_income?: boolean | null;
  category_id?: string | null;
}

/** One row per day, newest first: the spine the ledger draws.
 *
 *  Pure so it can serve any month rather than only the one in progress. It was
 *  written inline against "this month", which is why a past month had no ledger
 *  to show even though every figure it needs was already loaded.
 *
 *  Takes already-counted transactions: the caller decides what counts, since the
 *  duplicate and refund rules live with the rest of the money maths.
 */
export function buildDayLedger<T extends LedgerTxn>(
  counted: T[],
  opts: {
    categoryName: (categoryId: string) => string;
    categoryColor: (categoryId: string) => string | undefined;
    refundTotals: RefundTotalsMap;
    refundAllocations: RefundAllocationsMap;
  },
): DayLedgerRow<T>[] {
  const byDay = new Map<string, T[]>();
  for (const t of counted) {
    const key = format(new Date(t.transacted_at), 'yyyy-MM-dd');
    const bucket = byDay.get(key);
    if (bucket) bucket.push(t);
    else byDay.set(key, [t]);
  }

  return [...byDay.entries()]
    .sort((a, b) => (a[0] < b[0] ? 1 : -1))
    .map(([key, txns]) => {
      // Noon avoids the date shifting a day under a timezone offset.
      const date = new Date(`${key}T12:00:00`);
      const perCat = new Map<string, number>();
      let spent = 0;
      let income = 0;

      for (const t of txns) {
        if (t.is_expense) {
          const value = computeNetAmount(t as any, opts.refundTotals);
          if (value <= 0) continue;
          spent += value;
          const catId = t.category_id || 'uncategorized';
          perCat.set(catId, (perCat.get(catId) || 0) + value);
        } else if (t.is_income) {
          income += creditNet(t as any, opts.refundAllocations);
        }
      }

      const segments: DaySegment[] = [...perCat.entries()]
        .sort((a, b) => b[1] - a[1])
        .map(([categoryId, value]) => ({
          categoryId,
          value,
          name: opts.categoryName(categoryId),
          color: opts.categoryColor(categoryId) ?? LONG_TAIL_COLOR,
        }));

      return {
        key,
        date,
        folio: format(date, 'EEE d'),
        weekend: isWeekend(date),
        spent,
        income,
        segments,
        txns,
      };
    });
}

/** The per-row net amount the ledger prints, for both places that draw one.
 *
 *  Takes the transaction, not just its id. Passing `{ id }` made netAmount
 *  compute Number(undefined) minus the refund, which rendered "₹NaN.undefined"
 *  on every partially refunded row, and made creditNet return 0 because it saw
 *  no is_income.
 *
 *  Returns undefined when nothing was refunded, which is the signal to render
 *  the raw amount rather than a netted one.
 */
export function makeNetAmountFor(
  ready: boolean,
  refundTotals: RefundTotalsMap,
  refundAllocations: RefundAllocationsMap,
) {
  return (txn: {
    id: string;
    direction?: string | null;
    amount: number | string;
    is_income?: boolean | null;
  }): number | undefined => {
    if (!ready) return undefined;
    if (txn.direction === 'credit') {
      return refundAllocations[txn.id] ? creditNet(txn as any, refundAllocations) : undefined;
    }
    return refundTotals[txn.id] ? computeNetAmount(txn as any, refundTotals) : undefined;
  };
}
