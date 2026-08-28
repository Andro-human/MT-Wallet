export type AmountCheck =
  | { ok: true; amount: number; atCap: boolean }
  | { ok: false; error: string };

/** Paise tolerance. Half a paisa keeps a legitimate two-decimal entry that
 *  equals the cap from tripping on float noise (0.1 + 0.2 is not 0.3). */
const EPSILON = 0.005;

/** Parse a typed rupee amount and hold it to a ceiling.
 *
 *  Refuses rather than clamps when it is over. Silently reducing what someone
 *  typed makes the stored number disagree with what they entered, which is worse
 *  than telling them.
 */
export function checkAmountWithin(
  input: string,
  cap: number,
  overMessage: string,
): AmountCheck {
  const trimmed = input.trim();
  if (!trimmed) return { ok: false, error: 'Enter an amount' };

  const amount = Number(trimmed);
  if (!Number.isFinite(amount)) return { ok: false, error: 'That is not a number' };
  if (amount <= 0) return { ok: false, error: 'Enter an amount above zero' };
  if (amount > cap + EPSILON) return { ok: false, error: overMessage };

  return {
    ok: true,
    amount: Math.round(amount * 100) / 100,
    atCap: amount >= cap - EPSILON,
  };
}

export type RepaymentCheck =
  | { ok: true; amount: number; settlesInFull: boolean }
  | { ok: false; error: string };

/** Validate a repayment against what is still owed on a loan. */
export function checkRepayment(input: string, outstanding: number): RepaymentCheck {
  const r = checkAmountWithin(input, outstanding, 'More than is still owed on this loan');
  return r.ok ? { ok: true, amount: r.amount, settlesInFull: r.atCap } : r;
}

export type AttributionCheck =
  | { ok: true; amount: number; isWholeTransaction: boolean }
  | { ok: false; error: string };

/** Validate how much of a transaction counts toward a subscription.
 *
 *  Capped at the transaction: a subscription cannot have taken more money than
 *  the charge it is attributed to, and letting it would corrupt the cadence
 *  maths, which derives the median and range from these figures.
 */
export function checkAttribution(input: string, transactionAmount: number): AttributionCheck {
  const r = checkAmountWithin(
    input,
    transactionAmount,
    'More than the transaction itself',
  );
  return r.ok ? { ok: true, amount: r.amount, isWholeTransaction: r.atCap } : r;
}
