/** What made a month different from the others.
 *
 *  A slice is one coherent story of spending, so it is the right unit: nobody
 *  thinks of "the CPU" and "the ketchup" as one event just because both are
 *  Shopping. What a slice cannot tell you on its own is whether it is unusual,
 *  and that turned out not to be answerable from amounts alone.
 *
 *  Two signals are available and neither is sufficient:
 *
 *  RARITY works when a theme genuinely comes and goes (a trip, a gym signup).
 *  It breaks when the same real thing gets two labels in different months,
 *  which happens because the agent is only shown a window of prior labels.
 *
 *  SIZE works when a theme dwarfs its own history. It breaks on categories that
 *  are never recurring in the first place: Health sits near its median most
 *  months because there is a *different* one-off in it each time.
 *
 *  So this proposes generously and the user dismisses. Dismissals persist, which
 *  is the only part of the system that knows family support is occasional rather
 *  than monthly.
 */

export interface SliceRow {
  month: string;
  label: string;
  amount: number;
}

export interface MonthOutliers {
  month: string;
  total: number;
  /** Spending that shows up every month. The interesting number: it barely moves. */
  baseline: number;
  /** What the marks add up to. `baseline + flagged === total` to the paisa. */
  flagged: number;
  outliers: Outlier[];
  budget: number | null;
  /** Was the month inside budget once the one-offs are set aside? Null only when
   *  no budget exists at all. */
  ordinaryWithinBudget: boolean | null;
}

export interface Outlier {
  label: string;
  amount: number;
  reason: 'rare' | 'large';
  detail: string;
  /** Share of the month, for the bar. */
  share: number;
}

/** A dismissal stored against this instead of a real month means "never flag
 *  this label anywhere". The column is NOT NULL, so a sentinel is cheaper than
 *  a nullable month and a partial unique index. `*` cannot collide: every real
 *  month is `YYYY-MM`. */
export const EVERY_MONTH = '*';

export function isDismissed(dismissed: Set<string>, month: string, label: string): boolean {
  return dismissed.has(`${month}|${label}`) || dismissed.has(`${EVERY_MONTH}|${label}`);
}

export const RARE_MAX_MONTHS = 3;
export const LARGE_MULTIPLE = 2;
const FLAT_FLOOR = 2000;
const PCT_FLOOR = 0.03;

/** Whichever floor is lower, so a quiet month still surfaces its small
 *  one-offs and a huge month does not bury them under a percentage. */
export function floorFor(monthTotal: number): number {
  return Math.min(FLAT_FLOOR, monthTotal * PCT_FLOOR);
}

function median(xs: number[]): number {
  if (xs.length === 0) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

export function buildHistory(rows: SliceRow[]): Map<string, Map<string, number>> {
  const hist = new Map<string, Map<string, number>>();
  for (const r of rows) {
    const byMonth = hist.get(r.label) ?? new Map<string, number>();
    byMonth.set(r.month, (byMonth.get(r.month) ?? 0) + r.amount);
    hist.set(r.label, byMonth);
  }
  return hist;
}

export function classify(
  hist: Map<string, Map<string, number>>,
  label: string,
  month: string,
  amount: number,
  monthTotal: number,
): Omit<Outlier, 'label' | 'amount' | 'share'> | null {
  if (amount < floorFor(monthTotal)) return null;
  const byMonth = hist.get(label);
  if (!byMonth) return null;
  const monthsSeen = byMonth.size;
  if (monthsSeen <= RARE_MAX_MONTHS) {
    return { reason: 'rare', detail: `only ${monthsSeen} of ${countMonths(hist)} months` };
  }
  const others = [...byMonth.entries()].filter(([m]) => m !== month).map(([, v]) => v);
  const med = median(others);
  if (med > 0 && amount >= LARGE_MULTIPLE * med) {
    return { reason: 'large', detail: `${(amount / med).toFixed(1)}x its usual` };
  }
  return null;
}

function countMonths(hist: Map<string, Map<string, number>>): number {
  const months = new Set<string>();
  for (const byMonth of hist.values()) for (const m of byMonth.keys()) months.add(m);
  return months.size;
}

export function monthOutliers(
  rows: SliceRow[],
  totals: Map<string, number>,
  dismissed: Set<string>,
  monthlyBudget: number | null,
): MonthOutliers[] {
  const hist = buildHistory(rows);
  const months = [...new Set(rows.map((r) => r.month))].sort().reverse();

  return months.map((month) => {
    const total = totals.get(month) ?? rows.filter((r) => r.month === month).reduce((s, r) => s + r.amount, 0);
    const outliers: Outlier[] = [];
    let baseline = 0;
    for (const r of rows.filter((x) => x.month === month).sort((a, b) => b.amount - a.amount)) {
      const verdict = isDismissed(dismissed, month, r.label)
        ? null
        : classify(hist, r.label, month, r.amount, total);
      if (verdict) outliers.push({ label: r.label, amount: r.amount, share: r.amount / total, ...verdict });
      else baseline += r.amount;
    }
    // The current budget is applied to every month on purpose, as a fixed line
    // to read history against. It is not a claim that this budget was in force
    // then; the page says so. Which is why the label matters more than the maths.
    const budget = monthlyBudget;
    return {
      month,
      total: Math.round(total * 100) / 100,
      baseline: Math.round(baseline * 100) / 100,
      flagged: Math.round((total - baseline) * 100) / 100,
      outliers,
      budget,
      ordinaryWithinBudget: budget === null ? null : baseline <= budget,
    };
  });
}
