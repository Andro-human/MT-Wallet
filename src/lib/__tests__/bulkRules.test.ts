import { describe, it, expect } from 'vitest';
import { canRemember, proposeRules, ruleWrite } from '@/lib/bulkRules';
import type { BulkEditTxn } from '@/lib/bulkEdit';
import type { UserMerchantMapping } from '@/hooks/useMerchantMappings';

const txn = (id: string, merchant: string | null, over: Partial<BulkEditTxn> = {}): BulkEditTxn => ({
  id,
  direction: 'debit',
  category_id: null,
  group_id: null,
  merchant,
  is_expense: true,
  is_income: false,
  cashback_month: null,
  ...over,
});

const rule = (over: Partial<UserMerchantMapping>): UserMerchantMapping => ({
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
  created_at: '2026-05-01T00:00:00Z',
  updated_at: '2026-05-01T00:00:00Z',
  ...over,
});

describe('bulk edit rules', () => {
  it('only offers rules for what ingest can remember', () => {
    expect(canRemember({ groupId: 'g1' })).toBe(false);
    expect(canRemember({ categoryId: null })).toBe(false);
    expect(canRemember({ categoryId: 'c1' })).toBe(true);
    expect(canRemember({ counted: false })).toBe(true);
    expect(canRemember({ merchant: 'Swiggy Instamart' })).toBe(true);
  });

  it('proposes one rule per merchant, ignoring case, and skips unnamed rows', () => {
    const proposals = proposeRules(
      [txn('a', 'Swiggy'), txn('b', 'SWIGGY'), txn('c', 'Zomato'), txn('d', null)],
      { categoryId: 'food' },
      [],
    );
    expect(proposals.map((p) => [p.merchant, p.txnCount, p.effects])).toEqual([
      ['Swiggy', 2, { category: 'food' }],
      ['Zomato', 1, { category: 'food' }],
    ]);
  });

  it('remembers counted per direction the merchant actually has', () => {
    const [p] = proposeRules(
      [txn('a', 'Ravi', { direction: 'debit' }), txn('b', 'Ravi', { direction: 'credit' })],
      { counted: false },
      [],
    );
    expect(p.effects).toEqual({ expense: false, income: false });
    const [onlyCredit] = proposeRules([txn('c', 'HSBC', { direction: 'credit' })], { counted: true }, []);
    expect(onlyCredit.effects).toEqual({ income: true });
  });

  it('updates the oldest unconditional exact rule in place, never clobbering its rename', () => {
    const existing = rule({ id: 'old', mapped_merchant: 'Swiggy Food', default_category_id: 'shopping' });
    const newer = rule({ id: 'new', created_at: '2026-06-01T00:00:00Z' });
    const [p] = proposeRules([txn('a', 'swiggy')], { categoryId: 'food' }, [newer, existing]);
    expect(p.target?.id).toBe('old');
    expect(ruleWrite(p, ['category'])).toEqual({
      kind: 'update',
      id: 'old',
      values: { default_category_id: 'food' },
      previous: { default_category_id: 'shopping' },
    });
  });

  it('inserts an exact rule when none exists, with only the effects kept', () => {
    const [p] = proposeRules([txn('a', 'SWIGGY*INSTAMART')], { categoryId: 'food', merchant: 'Swiggy Instamart' }, []);
    expect(ruleWrite(p, ['rename'])).toEqual({
      kind: 'insert',
      values: {
        raw_merchant: 'SWIGGY*INSTAMART',
        match_type: 'exact',
        mapped_merchant: 'Swiggy Instamart',
        default_category_id: null,
        default_is_expense: null,
        default_is_income: null,
      },
    });
    expect(ruleWrite(p, [])).toBeNull();
  });

  it('flags effects an older matching rule already decides', () => {
    const contains = rule({ id: 'c', raw_merchant: 'swig', match_type: 'contains', default_category_id: 'shopping', created_at: '2026-01-01T00:00:00Z' });
    const conditional = rule({ id: 'cond', amount_operator: '>', amount_threshold: 500, mapped_merchant: '' });
    const [p] = proposeRules([txn('a', 'Swiggy')], { categoryId: 'food', counted: false }, [contains, conditional]);
    expect(p.target).toBeNull();
    expect(p.shadowed).toEqual(['category']);
  });

  it('does not propose a rename to the name it already has', () => {
    expect(proposeRules([txn('a', 'Swiggy')], { merchant: 'Swiggy' }, [])).toEqual([]);
  });
});
