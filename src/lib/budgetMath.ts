/** Budget attribution and carry-forward. See PLAN-budgets.md.
 *
 *  Everything here is pure. Carry is DERIVED by walking months rather than
 *  stored, because refunds land late in this app: a stored running balance
 *  would be silently corrupted by a refund arriving after a month closed and
 *  nothing would show it.
 */

export const REMAINDER = '__remainder__';

export interface BudgetDef {
  id: string;
  name: string;
  /** Monthly cap. */
  amount: number;
  /** Optional weekly pacing target. The same money at a different cadence,
   *  never an extra allowance. */
  weeklyAmount?: number | null;
  carryover: boolean;
  isRemainder: boolean;
  /** yyyy-MM-01. Carry never reaches back before this. */
  activeFrom: string;
  categoryIds: string[];
  groupIds: string[];
}

export interface BudgetIndex {
  byCategory: Map<string, string>;
  byGroup: Map<string, string>;
  remainderId: string | null;
}

export function buildBudgetIndex(budgets: BudgetDef[]): BudgetIndex {
  const byCategory = new Map<string, string>();
  const byGroup = new Map<string, string>();
  let remainderId: string | null = null;

  for (const b of budgets) {
    if (b.isRemainder) remainderId = b.id;
    // First writer wins. The DB enforces one budget per category and per group,
    // so a collision here means stale client state, not a legal configuration.
    for (const c of b.categoryIds) if (!byCategory.has(c)) byCategory.set(c, b.id);
    for (const g of b.groupIds) if (!byGroup.has(g)) byGroup.set(g, b.id);
  }
  return { byCategory, byGroup, remainderId };
}

/** Which budget a transaction is charged to.
 *
 *  Group first, then category, then the remainder. This is the same
 *  "groups whole, categories ungrouped-only" precedence the backend uses for
 *  the Insights combined view, so a transaction is never counted twice and
 *  budget figures agree with Insights.
 *
 *  Returns null when nothing claims it and no remainder budget exists.
 */
export function attributeTo(
  txn: { category_id?: string | null; group_id?: string | null },
  index: BudgetIndex,
): string | null {
  if (txn.group_id) {
    const viaGroup = index.byGroup.get(txn.group_id);
    if (viaGroup) return viaGroup;
  }
  if (txn.category_id) {
    const viaCategory = index.byCategory.get(txn.category_id);
    if (viaCategory) return viaCategory;
  }
  return index.remainderId ?? null;
}

/** Sum counted spend per budget id. Callers pass transactions that have ALREADY
 *  passed classifyTransaction, with `amount` net of refunds. */
export function spendByBudget(
  txns: { category_id?: string | null; group_id?: string | null; amount: number }[],
  index: BudgetIndex,
): Record<string, number> {
  const out: Record<string, number> = {};
  for (const t of txns) {
    const id = attributeTo(t, index);
    if (!id) continue;
    out[id] = (out[id] ?? 0) + t.amount;
  }
  return out;
}

const monthKey = (d: string) => d.slice(0, 7);

function addMonth(month: string): string {
  const [y, m] = month.split('-').map(Number);
  return m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, '0')}`;
}

export interface MonthStanding {
  base: number;
  /** Unspent allowance rolled in from earlier months. Never negative. */
  carryIn: number;
  /** base + carryIn: what is actually available this month. */
  allowance: number;
  spent: number;
  /** allowance - spent. Negative means over budget this month. */
  remaining: number;
}

/** What a budget has available in `month`, with carry walked forward from
 *  activeFrom.
 *
 *  Deficits never carry. A 60k trip against a 10k Travel budget resets to 10k
 *  next month rather than leaving a hole that takes half a year to climb out
 *  of. Surpluses do carry when the budget opts in, so an untravelled 10k makes
 *  next month 20k.
 *
 *  `spentIn` is asked per month rather than passed as a map so the caller can
 *  compute lazily; it must return counted, refund-netted spend.
 */
export function standingForMonth(
  budget: BudgetDef,
  month: string,
  spentIn: (month: string) => number,
): MonthStanding {
  const start = monthKey(budget.activeFrom);
  const base = budget.amount;

  if (month < start) {
    return { base: 0, carryIn: 0, allowance: 0, spent: 0, remaining: 0 };
  }

  let carryIn = 0;
  if (budget.carryover) {
    for (let m = start; m < month; m = addMonth(m)) {
      const allowance = base + carryIn;
      // Only the surplus travels. max(0, ...) is what stops a big overspend
      // from poisoning every month after it.
      carryIn = Math.max(0, allowance - spentIn(m));
    }
  }

  const allowance = base + carryIn;
  const spent = spentIn(month);
  return { base, carryIn, allowance, spent, remaining: allowance - spent };
}

/** The month's ceiling: the sum of every active budget's base amount.
 *
 *  Carry is deliberately excluded. The ceiling answers "what did I plan to
 *  spend a month", and folding in a rolled-over travel surplus would make the
 *  headline number jump around for reasons that have nothing to do with this
 *  month's plan.
 */
export function monthlyCeiling(budgets: BudgetDef[], month: string): number {
  return budgets
    .filter((b) => monthKey(b.activeFrom) <= month)
    .reduce((sum, b) => sum + b.amount, 0);
}

/** Weekly pacing, as a fraction of the week's target already spent.
 *
 *  A month is about 4.35 weeks, not 4, so a weekly target set at amount/4 will
 *  overshoot the monthly cap by roughly 9% if followed exactly. The monthly cap
 *  is the real limit; this is a rhythm indicator, which is why it returns a
 *  ratio and not a verdict.
 */
export function weeklyPace(budget: BudgetDef, spentThisWeek: number): number | null {
  if (!budget.weeklyAmount || budget.weeklyAmount <= 0) return null;
  return spentThisWeek / budget.weeklyAmount;
}
