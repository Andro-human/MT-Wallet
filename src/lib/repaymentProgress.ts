/** Percentage of a loan that has come back. Over-repayment clamps to 100 so a
 *  mis-linked credit cannot render a bar wider than its track. */
export function repaymentProgress(lent: number, repaid: number): number {
  if (!(lent > 0)) return 0;
  if (!(repaid > 0)) return 0;
  return Math.min((repaid / lent) * 100, 100);
}

// checkRepayment moved to lib/amountInput.ts, alongside the subscription
// attribution check it shares its parsing and capping rules with.
export { checkRepayment, type RepaymentCheck } from './amountInput';
