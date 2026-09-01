import { describe, it, expect } from 'vitest';
import { describeRule, conflictingFields, ruleMatches } from '@/lib/describeRule';
import type { UserMerchantMapping } from '@/hooks/useMerchantMappings';

const rule = (over: Partial<UserMerchantMapping> = {}): UserMerchantMapping => ({
  id: 'r1',
  user_id: 'u1',
  raw_merchant: 'Swiggy',
  mapped_merchant: 'Swiggy',
  default_category_id: null,
  default_is_expense: null,
  default_is_income: null,
  amount_operator: null,
  amount_threshold: null,
  date_operator: null,
  date_threshold: null,
  match_type: 'exact',
  created_at: '2026-03-05T00:00:00Z',
  updated_at: '2026-03-05T00:00:00Z',
  ...over,
});

const names = (id: string) => ({ 'cat-food': 'Food & Dining' }[id]);

describe('describeRule', () => {
  it('reads out the amount condition the way it was written', () => {
    const { conditions } = describeRule(
      rule({ match_type: 'contains', amount_operator: '<', amount_threshold: 200 }),
      names,
    );
    expect(conditions).toEqual(['merchant contains "Swiggy"', 'amount under ₹200']);
  });

  it('distinguishes exact from contains, because ingest does', () => {
    expect(describeRule(rule(), names).conditions[0]).toBe('merchant is exactly "Swiggy"');
  });

  it('names the two booleans in the words the toggles use', () => {
    expect(describeRule(rule({ default_is_expense: false }), names).effects).toEqual([
      'do not count as expense',
    ]);
    expect(describeRule(rule({ default_is_income: true }), names).effects).toEqual([
      'count as income',
    ]);
  });

  it('resolves the category to its name, and says so when it is gone', () => {
    expect(describeRule(rule({ default_category_id: 'cat-food' }), names).effects).toEqual([
      'category → Food & Dining',
    ]);
    expect(describeRule(rule({ default_category_id: 'cat-missing' }), names).effects).toEqual([
      'category → a deleted category',
    ]);
  });

  it('only reports a rename when the name actually changes', () => {
    expect(describeRule(rule({ mapped_merchant: 'Swiggy' }), names).effects[0]).toMatch(/sets no field/);
    expect(describeRule(rule({ mapped_merchant: 'Swiggy Instamart' }), names).effects).toContain(
      'rename to "Swiggy Instamart"',
    );
  });

  it('says plainly when a rule does nothing at all', () => {
    expect(describeRule(rule(), names).effects).toEqual(['nothing, this rule sets no field']);
  });
});

describe('conflictingFields', () => {
  it('flags a field two rules both set, where only the older one wins', () => {
    const rules = [
      rule({ id: 'a', default_is_expense: false }),
      rule({ id: 'b', default_is_expense: true }),
    ];
    expect(conflictingFields(rules)).toEqual(['count as expense']);
  });

  it('does not flag rules that set different fields, which now combine', () => {
    const rules = [
      rule({ id: 'a', default_is_expense: false }),
      rule({ id: 'b', default_is_income: false }),
    ];
    expect(conflictingFields(rules)).toEqual([]);
  });

  it('reports every clashing field, not just the first', () => {
    const rules = [
      rule({ id: 'a', default_is_expense: false, default_category_id: 'cat-food' }),
      rule({ id: 'b', default_is_expense: true, default_category_id: 'cat-other' }),
    ];
    expect(conflictingFields(rules)).toEqual(['category', 'count as expense']);
  });

  it('a single rule never conflicts with itself', () => {
    expect(conflictingFields([rule({ default_is_expense: false })])).toEqual([]);
  });
});

describe('ruleMatches', () => {
  const ctx = { merchant: 'swiggy', amount: 350, transactedAt: '2026-03-10T00:00:00Z' };

  it('a contains rule fires on a longer merchant string', () => {
    expect(ruleMatches(rule({ raw_merchant: 'Swiggy', match_type: 'contains' }), {
      ...ctx,
      merchant: 'swiggy instamart',
    })).toBe(true);
  });

  it('an exact rule does not fire on a longer merchant string', () => {
    expect(ruleMatches(rule(), { ...ctx, merchant: 'swiggy instamart' })).toBe(false);
  });

  it("Swiggy's two amount rules never fire on the same transaction", () => {
    const under = rule({ id: 'u', match_type: 'contains', amount_operator: '<', amount_threshold: 200 });
    const over = rule({ id: 'o', match_type: 'contains', amount_operator: '>', amount_threshold: 200 });
    for (const amount of [150, 350]) {
      const firing = [under, over].filter((r) => ruleMatches(r, { ...ctx, amount }));
      expect(firing).toHaveLength(1);
    }
  });

  it('so two category rules split by amount are not a conflict', () => {
    const under = rule({ id: 'u', match_type: 'contains', amount_operator: '<', amount_threshold: 200, default_category_id: 'cat-junk' });
    const over = rule({ id: 'o', match_type: 'contains', amount_operator: '>', amount_threshold: 200, default_category_id: 'cat-food' });
    const firing = [under, over].filter((r) => ruleMatches(r, { ...ctx, amount: 350 }));
    expect(conflictingFields(firing)).toEqual([]);
    // ...while the same two with no amount gate genuinely do clash.
    expect(conflictingFields([
      rule({ id: 'a', default_category_id: 'cat-junk' }),
      rule({ id: 'b', default_category_id: 'cat-food' }),
    ])).toEqual(['category']);
  });

  it('a day-of-month gate keeps a rule out', () => {
    const late = rule({ date_operator: '>', date_threshold: 20 });
    expect(ruleMatches(late, ctx)).toBe(false);
    expect(ruleMatches(late, { ...ctx, transactedAt: '2026-03-25T00:00:00Z' })).toBe(true);
  });
});
