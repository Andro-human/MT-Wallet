import { describe, it, expect } from 'vitest';
import {
  buildBudgetIndex,
  attributeTo,
  spendByBudget,
  standingForMonth,
  monthlyCeiling,
  weeklyPace,
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

  it('a big overspend does not poison later months', () => {
    // A 60k trip against a 10k budget. February resets to 10k, it does not
    // start 50k in the hole.
    const s = standingForMonth(TRAVEL, '2026-02', (m) => (m === '2026-01' ? 60000 : 0));
    expect(s.carryIn).toBe(0);
    expect(s.allowance).toBe(10000);
    expect(s.remaining).toBe(10000);
  });

  it('a deficit does not survive even across several months', () => {
    const s = standingForMonth(TRAVEL, '2026-04', (m) => (m === '2026-01' ? 60000 : 0));
    // Feb and Mar each go unspent, so only those two roll in.
    expect(s.carryIn).toBe(20000);
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
