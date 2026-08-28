import { describe, it, expect } from 'vitest';
import { buildDayLedger, makeNetAmountFor } from '@/lib/dayLedger';

const opts = (over?: Partial<Parameters<typeof buildDayLedger>[1]>) => ({
  categoryName: (id: string) => (id === 'c1' ? 'Food' : id === 'c2' ? 'Travel' : 'Uncategorized'),
  categoryColor: (id: string) => (id === 'c1' ? '#aaa' : undefined),
  refundTotals: {},
  refundAllocations: {},
  ...over,
});

const txn = (id: string, day: string, amount: number, over?: Record<string, unknown>) => ({
  id,
  transacted_at: `${day}T10:00:00`,
  amount,
  is_expense: true,
  is_income: false,
  category_id: 'c1',
  ...over,
});

describe('buildDayLedger', () => {
  it('groups by day, newest first', () => {
    const rows = buildDayLedger(
      [txn('a', '2026-08-01', 100), txn('b', '2026-08-03', 50), txn('c', '2026-08-01', 25)],
      opts(),
    );
    expect(rows.map((r) => r.key)).toEqual(['2026-08-03', '2026-08-01']);
    expect(rows[1].txns).toHaveLength(2);
    expect(rows[1].spent).toBe(125);
  });

  it('nets a refunded charge down and drops it once fully refunded', () => {
    const rows = buildDayLedger([txn('a', '2026-08-01', 100), txn('b', '2026-08-01', 60)], {
      ...opts(),
      refundTotals: { a: 40, b: 60 },
    });
    // a nets to 60; b is fully refunded so it contributes nothing.
    expect(rows[0].spent).toBe(60);
    expect(rows[0].segments).toHaveLength(1);
  });

  it('keeps income out of spend', () => {
    const rows = buildDayLedger(
      [
        txn('a', '2026-08-01', 100),
        txn('i', '2026-08-01', 500, { is_expense: false, is_income: true }),
      ],
      opts(),
    );
    expect(rows[0].spent).toBe(100);
    expect(rows[0].income).toBe(500);
  });

  it('ranks the day segments largest first', () => {
    const rows = buildDayLedger(
      [
        txn('a', '2026-08-01', 10),
        txn('b', '2026-08-01', 90, { category_id: 'c2' }),
      ],
      opts(),
    );
    expect(rows[0].segments.map((s) => s.name)).toEqual(['Travel', 'Food']);
  });

  it('falls back for an uncategorised charge rather than dropping it', () => {
    const rows = buildDayLedger([txn('a', '2026-08-01', 10, { category_id: null })], opts());
    expect(rows[0].segments[0].categoryId).toBe('uncategorized');
    expect(rows[0].segments[0].name).toBe('Uncategorized');
  });

  it('marks weekends, which the folio renders in gold', () => {
    // 2026-08-01 is a Saturday, 2026-08-03 a Monday.
    const rows = buildDayLedger([txn('a', '2026-08-01', 10), txn('b', '2026-08-03', 10)], opts());
    expect(rows.find((r) => r.key === '2026-08-01')!.weekend).toBe(true);
    expect(rows.find((r) => r.key === '2026-08-03')!.weekend).toBe(false);
  });

  it('dates the row at noon so a timezone offset cannot shift the day', () => {
    const rows = buildDayLedger([txn('a', '2026-08-01', 10)], opts());
    expect(rows[0].date.getHours()).toBe(12);
    expect(rows[0].folio).toBe('Sat 1');
  });

  it('returns nothing for no transactions', () => {
    expect(buildDayLedger([], opts())).toEqual([]);
  });
});

describe('makeNetAmountFor', () => {
  const debit = { id: 'a', direction: 'debit', amount: 100 };
  const credit = { id: 'c', direction: 'credit', amount: 500, is_income: true };

  it('reports nothing until the context is ready', () => {
    expect(makeNetAmountFor(false, { a: 40 }, {})(debit)).toBeUndefined();
  });

  it('reports nothing when the row was never refunded', () => {
    expect(makeNetAmountFor(true, {}, {})(debit)).toBeUndefined();
  });

  it('nets a partially refunded debit against its own amount', () => {
    // Regression: passing only the id computed Number(undefined) - refund and
    // rendered "₹NaN.undefined" on the row.
    expect(makeNetAmountFor(true, { a: 40 }, {})(debit)).toBe(60);
  });

  it('floors a fully refunded debit at zero rather than going negative', () => {
    expect(makeNetAmountFor(true, { a: 150 }, {})(debit)).toBe(0);
  });

  it('nets an allocated credit against its own amount', () => {
    // Regression: without is_income, creditNet returned 0 for every credit.
    expect(makeNetAmountFor(true, {}, { c: 200 })(credit)).toBe(300);
  });

  it('reports nothing for a credit with no allocation', () => {
    expect(makeNetAmountFor(true, {}, {})(credit)).toBeUndefined();
  });
});
