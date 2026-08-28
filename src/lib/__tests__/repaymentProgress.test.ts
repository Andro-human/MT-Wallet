import { describe, it, expect } from 'vitest';
import { checkRepayment, repaymentProgress } from '@/lib/repaymentProgress';

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

describe('checkRepayment', () => {
  it('accepts a partial repayment and reports it does not settle', () => {
    expect(checkRepayment('300', 1000)).toEqual({
      ok: true,
      amount: 300,
      settlesInFull: false,
    });
  });

  it('recognises settling in full', () => {
    const r = checkRepayment('1000', 1000);
    expect(r.ok && r.settlesInFull).toBe(true);
  });

  it('refuses more than is still owed', () => {
    // Linking a credit bigger than the debt would report the loan as more than
    // settled, and the surplus belongs to its own transaction.
    const r = checkRepayment('1200', 1000);
    expect(r.ok).toBe(false);
    expect(r.ok === false && r.error).toMatch(/still owed/);
  });

  it('allows a two-decimal settle-in-full despite float noise', () => {
    const outstanding = 0.1 + 0.2; // 0.30000000000000004
    const r = checkRepayment('0.30', outstanding);
    expect(r.ok).toBe(true);
    expect(r.ok && r.settlesInFull).toBe(true);
  });

  it('rounds to paise rather than storing a long float', () => {
    const r = checkRepayment('99.999', 1000);
    expect(r.ok && r.amount).toBe(100);
  });

  it('refuses zero and negatives', () => {
    expect(checkRepayment('0', 1000).ok).toBe(false);
    expect(checkRepayment('-50', 1000).ok).toBe(false);
  });

  it('refuses empty and non-numeric input', () => {
    expect(checkRepayment('', 1000).ok).toBe(false);
    expect(checkRepayment('   ', 1000).ok).toBe(false);
    expect(checkRepayment('abc', 1000).ok).toBe(false);
  });

  it('ignores surrounding whitespace', () => {
    expect(checkRepayment('  250  ', 1000)).toEqual({
      ok: true,
      amount: 250,
      settlesInFull: false,
    });
  });

  it('refuses anything once the loan is already settled', () => {
    expect(checkRepayment('1', 0).ok).toBe(false);
  });
});
