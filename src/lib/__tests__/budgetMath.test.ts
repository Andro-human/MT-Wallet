import { describe, it, expect } from 'vitest';
import {
  buildBudgetIndex,
  attributeTo,
  spendByBudget,
  standingForMonth,
  monthlyCeiling,
  weeklyPace,
  countOrders,
  type BudgetDef,
} from '@/lib/budgetMath';

const budget = (over: Partial<BudgetDef> & { id: string }): BudgetDef => ({
  name: over.id,
  amount: 5000,
  carryover: false,
  isRemainder: false,
  activeFrom: '2026-01-01',
  categoryIds: [],
  groupIds: [],
  ...over,
});

const FOOD = budget({ id: 'food', categoryIds: ['cat-food'] });
const TRAVEL = budget({ id: 'travel', amount: 10000, carryover: true, groupIds: ['grp-trip'], categoryIds: ['cat-travel'] });
const MISC = budget({ id: 'misc', isRemainder: true });

describe('attribution', () => {
  const index = buildBudgetIndex([FOOD, TRAVEL, MISC]);

  it('charges a grouped transaction to the group budget, not its category', () => {
    // A trip dinner is categorised Food but belongs to the trip. Counting it in
    // both is the double-count the precedence rule exists to prevent.
    expect(attributeTo({ category_id: 'cat-food', group_id: 'grp-trip' }, index)).toBe('travel');
  });

  it('falls back to the category when the group has no budget', () => {
    expect(attributeTo({ category_id: 'cat-food', group_id: 'grp-unbudgeted' }, index)).toBe('food');
  });

  it('sends anything unclaimed to the remainder', () => {
    expect(attributeTo({ category_id: 'cat-nobody', group_id: null }, index)).toBe('misc');
    expect(attributeTo({ category_id: null, group_id: null }, index)).toBe('misc');
  });

  it('returns null when nothing claims it and there is no remainder budget', () => {
    const noMisc = buildBudgetIndex([FOOD]);
    expect(attributeTo({ category_id: 'cat-nobody', group_id: null }, noMisc)).toBeNull();
  });

  it('counts each transaction exactly once across budgets', () => {
    const txns = [
      { category_id: 'cat-food', group_id: null, amount: 300 },
      { category_id: 'cat-food', group_id: 'grp-trip', amount: 900 },
      { category_id: 'cat-nobody', group_id: null, amount: 100 },
    ];
    const spend = spendByBudget(txns, index);
    expect(spend).toEqual({ food: 300, travel: 900, misc: 100 });
    const total = Object.values(spend).reduce((a, b) => a + b, 0);
    expect(total).toBe(1300);
  });
});

describe('carry-forward', () => {
  it('does not carry when the budget has not opted in', () => {
    const s = standingForMonth(FOOD, '2026-03', () => 0);
    expect(s.carryIn).toBe(0);
    expect(s.allowance).toBe(5000);
  });

  it('rolls an unspent month forward', () => {
    // Nothing spent in Jan or Feb: March has three months of Travel available.
    const s = standingForMonth(TRAVEL, '2026-03', () => 0);
    expect(s.carryIn).toBe(20000);
    expect(s.allowance).toBe(30000);
  });

  it('the user\'s case: untravelled 10k makes next month 20k', () => {
    const travel = budget({ ...TRAVEL, activeFrom: '2026-01-01' });
    const s = standingForMonth(travel, '2026-02', (m) => (m === '2026-01' ? 0 : 0));
    expect(s.allowance).toBe(20000);
  });

  it('a small overspend follows you into next month', () => {
    // The Rs 493 Groceries overshoot should chase you; forgiving it makes the
    // cap meaningless.
    const s = standingForMonth(TRAVEL, '2026-02', (m) => (m === '2026-01' ? 10493 : 0));
    expect(s.carryIn).toBe(-493);
    expect(s.allowance).toBe(9507);
  });

  it('a big overspend is floored at one month, so it stays recoverable', () => {
    // A 60k trip against a 10k budget is -50k before the floor. February gets
    // 0, not -40k.
    const s = standingForMonth(TRAVEL, '2026-02', (m) => (m === '2026-01' ? 60000 : 0));
    expect(s.carryIn).toBe(-10000);
    expect(s.allowance).toBe(0);
  });

  it('recovers within a couple of months rather than half a year', () => {
    // Jan blows 60k. Feb spends nothing against a 0 allowance, so Feb ends flat
    // and March is back to the full base.
    const spend = (m: string) => (m === '2026-01' ? 60000 : 0);
    expect(standingForMonth(TRAVEL, '2026-02', spend).allowance).toBe(0);
    expect(standingForMonth(TRAVEL, '2026-03', spend).allowance).toBe(10000);
  });

  it('the floor is per month, not a running total', () => {
    // Overspend twice in a row: each month floors at -base rather than stacking
    // into an ever deeper hole.
    const spend = (m: string) => (m === '2026-01' || m === '2026-02' ? 60000 : 0);
    expect(standingForMonth(TRAVEL, '2026-03', spend).carryIn).toBe(-10000);
  });

  it('carries only the surplus, not the whole base', () => {
    // Jan: 10k allowance, 4k spent, so 6k travels.
    const s = standingForMonth(TRAVEL, '2026-02', (m) => (m === '2026-01' ? 4000 : 0));
    expect(s.carryIn).toBe(6000);
    expect(s.allowance).toBe(16000);
  });

  it('reports remaining as negative when this month is over budget', () => {
    const s = standingForMonth(FOOD, '2026-03', () => 6200);
    expect(s.remaining).toBe(-1200);
  });

  it('crosses a year boundary', () => {
    const t = budget({ ...TRAVEL, activeFrom: '2026-11-01' });
    const s = standingForMonth(t, '2027-01', () => 0);
    expect(s.carryIn).toBe(20000);
  });

  it('is zero before the budget exists', () => {
    const t = budget({ ...TRAVEL, activeFrom: '2026-06-01' });
    const s = standingForMonth(t, '2026-03', () => 0);
    expect(s).toEqual({ base: 0, carryIn: 0, allowance: 0, spent: 0, remaining: 0 });
  });
});

describe('monthlyCeiling', () => {
  it('sums the base amounts, ignoring carry', () => {
    // Carry would make the headline jump for reasons unrelated to this month's
    // plan, so the ceiling is bases only.
    expect(monthlyCeiling([FOOD, TRAVEL, MISC], '2026-03')).toBe(20000);
  });

  it('ignores budgets that have not started yet', () => {
    const future = budget({ id: 'future', amount: 9999, activeFrom: '2026-09-01' });
    expect(monthlyCeiling([FOOD, future], '2026-03')).toBe(5000);
  });

  it("matches the user's list", () => {
    const list = [
      budget({ id: 'food', amount: 5000 }),
      budget({ id: 'shopping', amount: 5000 }),
      budget({ id: 'groceries-home', amount: 5000 }),
      budget({ id: 'health', amount: 4000 }),
      budget({ id: 'cat', amount: 3000 }),
      budget({ id: 'utilities-subs', amount: 3000 }),
      budget({ id: 'travel', amount: 10000 }),
      budget({ id: 'misc', amount: 5000, isRemainder: true }),
    ];
    expect(monthlyCeiling(list, '2026-08')).toBe(40000);
  });
});

describe('weeklyPace', () => {
  it('is null when no weekly target is set', () => {
    expect(weeklyPace(FOOD, 900)).toBeNull();
  });

  it('reports the fraction of the week spent', () => {
    const food = budget({ ...FOOD, weeklyAmount: 1250 });
    expect(weeklyPace(food, 625)).toBe(0.5);
    expect(weeklyPace(food, 1500)).toBe(1.2);
  });
});

describe('countOrders', () => {
  it('counts a combined set once', () => {
    // The real shape: Zomato bills an order and its fee separately, and the
    // user combines the two in the Activity page.
    const combines = { a: 'c1', b: 'c1' };
    expect(countOrders([{ id: 'a' }, { id: 'b' }], combines)).toBe(1);
  });

  it('counts anything uncombined on its own', () => {
    expect(countOrders([{ id: 'a' }, { id: 'b' }], {})).toBe(2);
  });

  it('mixes combined and solo correctly', () => {
    const combines = { a: 'c1', b: 'c1', d: 'c2', e: 'c2' };
    // c1, c2, and the solo c.
    expect(countOrders([{ id: 'a' }, { id: 'b' }, { id: 'c' }, { id: 'd' }, { id: 'e' }], combines)).toBe(3);
  });

  it('does not double count a combine whose members arrive apart', () => {
    const combines = { a: 'c1', z: 'c1' };
    expect(countOrders([{ id: 'a' }, { id: 'm' }, { id: 'z' }], combines)).toBe(2);
  });

  it('is zero for an empty week', () => {
    expect(countOrders([], {})).toBe(0);
  });
});
