/** Percentage of a loan that has come back. Over-repayment clamps to 100 so a
 *  mis-linked credit cannot render a bar wider than its track. */
export function repaymentProgress(lent: number, repaid: number): number {
  if (!(lent > 0)) return 0;
  if (!(repaid > 0)) return 0;
  return Math.min((repaid / lent) * 100, 100);
}

export type RepaymentCheck =
  | { ok: true; amount: number; settlesInFull: boolean }
  | { ok: false; error: string };

/** Validate a typed repayment amount against what is still owed.
 *
 *  Capped at the outstanding balance rather than clamped silently. A credit
 *  larger than the debt is not a repayment of it: linked in full it would report
 *  a loan as more than settled, and the extra belongs to a separate transaction
 *  rather than hidden inside this one.
 */
export function checkRepayment(input: string, outstanding: number): RepaymentCheck {
  const trimmed = input.trim();
  if (!trimmed) return { ok: false, error: 'Enter an amount' };

  const amount = Number(trimmed);
  if (!Number.isFinite(amount)) return { ok: false, error: 'That is not a number' };
  if (amount <= 0) return { ok: false, error: 'Enter an amount above zero' };

  // Paise tolerance: 0.005 keeps a legitimate two-decimal settle-in-full from
  // tripping on float noise.
  if (amount > outstanding + 0.005) {
    return { ok: false, error: 'More than is still owed on this loan' };
  }

  return {
    ok: true,
    amount: Math.round(amount * 100) / 100,
    settlesInFull: amount >= outstanding - 0.005,
  };
}
