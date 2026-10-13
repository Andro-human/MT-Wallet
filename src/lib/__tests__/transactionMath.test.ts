import { describe, it, expect } from 'vitest';
import { flagsForDirection, classifyTransaction } from '@/lib/transactionMath';

describe('flagsForDirection', () => {
  it('sets exactly one flag, from the direction', () => {
    expect(flagsForDirection('debit')).toEqual({ is_expense: true, is_income: false });
    expect(flagsForDirection('credit')).toEqual({ is_expense: false, is_income: true });
  });

  it('treats a missing direction as a debit, as classifyTransaction does', () => {
    expect(flagsForDirection(null)).toEqual({ is_expense: true, is_income: false });
    expect(flagsForDirection(undefined)).toEqual({ is_expense: true, is_income: false });
  });

  it('brings an un-marked credit back as income only', () => {
    const txn = { id: 'salary', amount: 50000, category_id: null, direction: 'credit', ...flagsForDirection('credit') };
    const opts = { duplicateExcludeIds: new Set<string>(), refundTotals: {}, refundAllocations: {} };
    expect(classifyTransaction(txn, opts)).toBe('real');
    expect(txn.is_expense).toBe(false);
  });
});
