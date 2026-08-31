import { describe, it, expect } from 'vitest';
import { buildHistory, classify, floorFor, monthOutliers, type SliceRow } from '@/lib/outliers';

const row = (month: string, label: string, amount: number): SliceRow => ({ month, label, amount });

// Nine months where eating out is always there and a trip happens twice.
const ROWS: SliceRow[] = [
  ...['2026-08','2026-07','2026-06','2026-05','2026-04','2026-03','2026-02','2026-01','2025-12']
    .map((m) => row(m, 'Eating out & delivery', 10000)),
  row('2026-08', 'PC build', 40331),
  row('2026-07', 'Meghalaya trip', 19795),
  row('2026-06', 'Meghalaya trip', 17571),
  row('2026-07', 'Metro commute', 268),
];
const TOTALS = new Map(
  [...new Set(ROWS.map((r) => r.month))].map((m) => [m, ROWS.filter((r) => r.month === m).reduce((s, r) => s + r.amount, 0)]),
);

describe('floorFor', () => {
  it('uses the percentage in a quiet month so small one-offs still surface', () => {
    // 3% of 31,000 is 930, well under the flat 2,000.
    expect(floorFor(31000)).toBeCloseTo(930);
  });
  it('caps at the flat floor in a big month rather than burying things', () => {
    expect(floorFor(88000)).toBe(2000);
  });
});

describe('classify', () => {
  const hist = buildHistory(ROWS);
  it('a theme seen in one month of nine is rare', () => {
    expect(classify(hist, 'PC build', '2026-08', 40331, 50331)?.reason).toBe('rare');
  });
  it('a theme present every month at its usual size is not flagged', () => {
    expect(classify(hist, 'Eating out & delivery', '2026-08', 10000, 50331)).toBeNull();
  });
  it('a theme present every month but far above its median is flagged', () => {
    const spiky = buildHistory([...ROWS, row('2026-09', 'Eating out & delivery', 30000)]);
    expect(classify(spiky, 'Eating out & delivery', '2026-09', 30000, 30000)?.reason).toBe('large');
  });
  it('drops anything under the floor however rare', () => {
    // Metro commute is a one-off but ₹268 of a ₹30k month is noise.
    expect(classify(hist, 'Metro commute', '2026-07', 268, 30063)).toBeNull();
  });
});

describe('monthOutliers', () => {
  it('splits each month into a baseline and its one-offs', () => {
    const out = monthOutliers(ROWS, TOTALS, new Set(), null, null);
    const aug = out.find((m) => m.month === '2026-08')!;
    expect(aug.baseline).toBe(10000);
    expect(aug.outliers.map((o) => o.label)).toEqual(['PC build']);
  });

  it('the baseline is what stays still across months', () => {
    const out = monthOutliers(ROWS, TOTALS, new Set(), null, null);
    // Every month is 10,000 of eating out, except July which also absorbs the
    // ₹268 metro commute: a one-off under the floor is ordinary, not hidden.
    expect(out.find((m) => m.month === '2026-07')!.baseline).toBe(10268);
    expect(new Set(out.filter((m) => m.month !== '2026-07').map((m) => m.baseline))).toEqual(new Set([10000]));
  });

  it('a sub-floor one-off still counts toward the month, never dropped', () => {
    const out = monthOutliers(ROWS, TOTALS, new Set(), null, null);
    for (const m of out) {
      const flagged = m.outliers.reduce((s, o) => s + o.amount, 0);
      expect(m.baseline + flagged).toBeCloseTo(m.total, 2);
    }
  });

  it('a dismissed slice returns to the baseline and stops being flagged', () => {
    const out = monthOutliers(ROWS, TOTALS, new Set(['2026-08|PC build']), null, null);
    const aug = out.find((m) => m.month === '2026-08')!;
    expect(aug.outliers).toEqual([]);
    expect(aug.baseline).toBe(50331);
  });

  it('dismissing one month does not dismiss the same label elsewhere', () => {
    const out = monthOutliers(ROWS, TOTALS, new Set(['2026-07|Meghalaya trip']), null, null);
    expect(out.find((m) => m.month === '2026-07')!.outliers).toEqual([]);
    expect(out.find((m) => m.month === '2026-06')!.outliers.map((o) => o.label)).toEqual(['Meghalaya trip']);
  });

  it('a budget applies only to months it was in force for', () => {
    const out = monthOutliers(ROWS, TOTALS, new Set(), 40000, '2026-08');
    expect(out.find((m) => m.month === '2026-08')!.budget).toBe(40000);
    expect(out.find((m) => m.month === '2026-01')!.budget).toBeNull();
    expect(out.find((m) => m.month === '2026-01')!.ordinaryWithinBudget).toBeNull();
  });

  it('reports whether the ordinary month would have fit the budget', () => {
    const out = monthOutliers(ROWS, TOTALS, new Set(), 40000, '2026-08');
    const aug = out.find((m) => m.month === '2026-08')!;
    // Spent 50,331 against 40,000, but the recurring part is only 10,000.
    expect(aug.total).toBe(50331);
    expect(aug.ordinaryWithinBudget).toBe(true);
  });

  it('says so when even the ordinary month misses budget', () => {
    const out = monthOutliers(ROWS, TOTALS, new Set(), 5000, '2025-12');
    expect(out.every((m) => m.ordinaryWithinBudget === false)).toBe(true);
  });

  it('a month with nothing unusual reports an empty list, not a fabricated one', () => {
    const flat = ['2026-08','2026-07','2026-06','2026-05'].map((m) => row(m, 'Eating out & delivery', 10000));
    const t = new Map(flat.map((r) => [r.month, r.amount]));
    expect(monthOutliers(flat, t, new Set(), null, null).every((m) => m.outliers.length === 0)).toBe(true);
  });
});
