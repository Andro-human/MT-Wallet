import { describe, it, expect } from 'vitest';
import { repaymentProgress } from '@/lib/repaymentProgress';

describe('repaymentProgress', () => {
  it('is empty when nothing has come back', () => {
    expect(repaymentProgress(72, 0)).toBe(0);
  });

  it('fills proportionally on a partial repayment', () => {
    expect(repaymentProgress(1000, 250)).toBe(25);
    expect(repaymentProgress(72, 36)).toBe(50);
  });

  it('fills completely when the loan is settled', () => {
    expect(repaymentProgress(72, 72)).toBe(100);
  });

  it('clamps over-repayment instead of overflowing the track', () => {
    expect(repaymentProgress(72, 500)).toBe(100);
  });

  it('returns 0 rather than NaN or Infinity on a zero or negative loan', () => {
    expect(repaymentProgress(0, 50)).toBe(0);
    expect(repaymentProgress(-10, 50)).toBe(0);
  });
});
