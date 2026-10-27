import { describe, it, expect } from 'vitest';
import {
  classifyTransaction,
  defaultCashbackMonth,
  netOfCashback,
  sumCashback,
  sumIncome,
} from '@/lib/transactionMath';
import { creditKindOf } from '@/components/transactions/CreditKindControl';

const credit = (over: Record<string, unknown> = {}) => ({
  id: 'c1',
  amount: 1246,
  direction: 'credit',
  is_expense: false,
  is_income: false,
  category_id: null,
  cashback_month: '2026-09-01',
  ...over,
});

const noLinks = { duplicateExcludeIds: new Set<string>(), refundTotals: {}, refundAllocations: {} };

describe('cashback', () => {
  it('defaults to the month before the credit arrived', () => {
    expect(defaultCashbackMonth('2026-10-03T10:00:00+05:30')).toBe('2026-09-01');
    expect(defaultCashbackMonth('2026-01-15T10:00:00+05:30')).toBe('2025-12-01');
  });

  it('is never income, even when a flag writer turned is_income back on', () => {
    expect(sumIncome([credit({ is_income: true }) as any], new Set())).toBe(0);
    expect(classifyTransaction(credit({ is_income: true }) as any, noLinks)).toBe('cashback');
  });

  it('is its own bucket, so lists that hide not-counted rows still show it', () => {
    expect(classifyTransaction(credit() as any, noLinks)).toBe('cashback');
    expect(classifyTransaction(credit({ cashback_month: null }) as any, noLinks)).toBe('non-counted');
  });

  it('a plain income credit still counts as income', () => {
    expect(sumIncome([credit({ is_income: true, cashback_month: null }) as any], new Set())).toBe(1246);
  });

  it('sums cashback rows and skips duplicates', () => {
    const rows = [
      credit(),
      credit({ id: 'c2', amount: 50 }),
      credit({ id: 'c3', amount: 999, cashback_month: null, is_income: true }),
      credit({ id: 'dup', amount: 1246 }),
    ];
    expect(sumCashback(rows as any, new Set(['dup']))).toBe(1296);
  });

  it('lowers spending but never below zero', () => {
    expect(netOfCashback(10_000, 1_246)).toBe(8_754);
    expect(netOfCashback(500, 1_246)).toBe(0);
  });

  it('reads the kind off the row with cashback taking precedence', () => {
    expect(creditKindOf({ is_income: true, cashback_month: '2026-09-01' })).toBe('cashback');
    expect(creditKindOf({ is_income: true, cashback_month: null })).toBe('income');
    expect(creditKindOf({ is_income: false })).toBe('none');
  });
});
