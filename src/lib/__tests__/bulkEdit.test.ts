import { describe, it, expect } from 'vitest';
import { batchByPatch, isEmptyEdit, patchFor, previousFor, type BulkEditTxn } from '@/lib/bulkEdit';

const txn = (over: Partial<BulkEditTxn> = {}): BulkEditTxn => ({
  id: 't1',
  direction: 'debit',
  category_id: 'cat-food',
  group_id: null,
  merchant: 'SWIGGY*INSTAMART',
  is_expense: true,
  is_income: false,
  cashback_month: null,
  ...over,
});

describe('bulk edit', () => {
  it('touches only the fields that were chosen', () => {
    expect(patchFor(txn(), { groupId: 'g-goa' })).toEqual({ group_id: 'g-goa' });
    expect(patchFor(txn(), { categoryId: null, merchant: 'Swiggy Instamart' })).toEqual({
      category_id: null,
      merchant: 'Swiggy Instamart',
    });
    expect(isEmptyEdit({})).toBe(true);
    expect(isEmptyEdit({ groupId: null })).toBe(false);
  });

  it('counts a debit as spending and a credit as income, never both', () => {
    expect(patchFor(txn(), { counted: false })).toEqual({ is_expense: false });
    expect(patchFor(txn({ direction: 'credit' }), { counted: true })).toEqual({
      is_income: true,
      cashback_month: null,
    });
  });

  it('ends a cashback when the credit is marked counted or not counted', () => {
    const cashback = txn({ direction: 'credit', is_income: false, cashback_month: '2026-09-01' });
    expect(patchFor(cashback, { counted: false })).toEqual({ is_income: false, cashback_month: null });
  });

  it('remembers exactly what each row held, so undo puts it back', () => {
    const row = txn({ group_id: null, category_id: 'cat-food' });
    const patch = patchFor(row, { groupId: 'g-goa', categoryId: 'cat-travel' });
    expect(previousFor(row, patch)).toEqual({ group_id: null, category_id: 'cat-food' });
  });

  it('sends one update per distinct patch', () => {
    const batches = batchByPatch([
      { id: 'a', patch: { group_id: 'g1', category_id: 'c1' } },
      { id: 'b', patch: { category_id: 'c1', group_id: 'g1' } },
      { id: 'c', patch: { group_id: null, category_id: 'c1' } },
    ]);
    expect(batches.map((b) => b.ids)).toEqual([['a', 'b'], ['c']]);
  });
});
