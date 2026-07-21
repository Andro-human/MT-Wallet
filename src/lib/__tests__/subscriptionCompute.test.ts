import { describe, it, expect } from 'vitest';
import { summarizeOccurrences, monthlyNormalized, type Occurrence } from '@/lib/subscriptionCompute';

const occ = (amount: number, date: string): Occurrence => ({ amount, transacted_at: `${date}T12:00:00Z` });

describe('summarizeOccurrences', () => {
  it('detects a monthly cadence and predicts the next date from the gap', () => {
    const s = summarizeOccurrences([
      occ(299, '2026-05-08'),
      occ(299, '2026-06-08'),
      occ(299, '2026-07-08'),
    ]);
    expect(s.cadence).toBe('monthly');
    expect(s.medianAmount).toBe(299);
    expect(s.predictedNext).toBe('2026-08-08'); // last (Jul 8) + 30.5d median gap
  });

  it('uses median amount and a range for variable amounts', () => {
    const s = summarizeOccurrences([
      occ(1200, '2026-06-01'),
      occ(1307, '2026-07-01'),
      occ(1420, '2026-08-01'),
    ]);
    expect(s.medianAmount).toBe(1307);
    expect(s.amountMin).toBe(1200);
    expect(s.amountMax).toBe(1420);
    expect(s.lastAmount).toBe(1420);
  });

  it('is irregular with no prediction when fewer than 2 occurrences', () => {
    const s = summarizeOccurrences([occ(500, '2026-07-01')]);
    expect(s.cadence).toBe('irregular');
    expect(s.predictedNext).toBeNull();
    expect(s.medianAmount).toBe(500);
  });

  it('detects annual cadence', () => {
    const s = summarizeOccurrences([occ(1307, '2024-08-01'), occ(1307, '2025-08-01')]);
    expect(s.cadence).toBe('annual');
  });

  it('handles empty input without throwing', () => {
    const s = summarizeOccurrences([]);
    expect(s.medianAmount).toBe(0);
    expect(s.cadence).toBe('irregular');
  });
});

describe('monthlyNormalized', () => {
  it('normalizes by cadence when no gap is known', () => {
    expect(monthlyNormalized(1200, 'annual', null)).toBe(100);
    expect(monthlyNormalized(299, 'monthly', null)).toBe(299);
    expect(monthlyNormalized(300, 'quarterly', null)).toBe(100);
  });
  it('prefers the real gap when available', () => {
    expect(monthlyNormalized(300, 'monthly', 30)).toBe(300);
    expect(monthlyNormalized(70, 'weekly', 7)).toBe(300);
  });
  it('is 0 for no amount', () => {
    expect(monthlyNormalized(null, 'monthly', null)).toBe(0);
  });
});
