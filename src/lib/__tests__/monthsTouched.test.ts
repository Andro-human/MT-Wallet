import { describe, it, expect } from 'vitest';
import { monthsTouched } from '@/lib/monthsTouched';

const d = (y: number, m: number, day: number) => new Date(y, m - 1, day);

describe('monthsTouched', () => {
  it('1 full calendar month -> 1, not partial', () => {
    expect(monthsTouched(d(2026, 1, 1), d(2026, 1, 31))).toEqual({ count: 1, partial: false });
  });

  it('6 full calendar months -> 6, not partial', () => {
    expect(monthsTouched(d(2026, 1, 1), d(2026, 6, 30))).toEqual({ count: 6, partial: false });
  });

  it('15 days mid-month -> 1, partial', () => {
    expect(monthsTouched(d(2026, 3, 5), d(2026, 3, 20))).toEqual({ count: 1, partial: true });
  });

  it('year-crossing 3-month range full months -> 3, not partial', () => {
    expect(monthsTouched(d(2025, 11, 1), d(2026, 1, 31))).toEqual({ count: 3, partial: false });
  });

  it('year-crossing partial range -> 3, partial', () => {
    expect(monthsTouched(d(2025, 11, 15), d(2026, 1, 10))).toEqual({ count: 3, partial: true });
  });

  it('single day -> 1, partial', () => {
    expect(monthsTouched(d(2026, 5, 7), d(2026, 5, 7))).toEqual({ count: 1, partial: true });
  });

  it('reversed range defends against divide-by-zero', () => {
    const r = monthsTouched(d(2026, 6, 1), d(2026, 1, 1));
    expect(r.count).toBeGreaterThanOrEqual(1);
    expect(r.partial).toBe(true);
  });

  it('Feb non-leap-year full month -> 1, not partial', () => {
    expect(monthsTouched(d(2026, 2, 1), d(2026, 2, 28))).toEqual({ count: 1, partial: false });
  });

  it('Feb leap year full month -> 1, not partial', () => {
    expect(monthsTouched(d(2024, 2, 1), d(2024, 2, 29))).toEqual({ count: 1, partial: false });
  });

  it('April full month (30 days) -> 1, not partial', () => {
    expect(monthsTouched(d(2026, 4, 1), d(2026, 4, 30))).toEqual({ count: 1, partial: false });
  });
});
