import { useMemo } from 'react';
import { format } from 'date-fns';
import { useTransactions } from './useTransactions';

/** Months that actually have transactions, newest first, as 'yyyy-MM'.
 *
 *  Offering a fixed last-twelve would list months with nothing in them, and a
 *  dashboard of zeroes is not a month anyone meant to open. The full list is
 *  already in the cache for the budget strip, so this costs nothing.
 */
export function useMonthsWithData(): string[] {
  const { data: txns = [] } = useTransactions();

  return useMemo(() => {
    const months = new Set<string>();
    for (const t of txns) months.add(format(new Date(t.transacted_at), 'yyyy-MM'));
    return [...months].sort().reverse();
  }, [txns]);
}
