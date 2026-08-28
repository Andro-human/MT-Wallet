import { describe, it, expect } from 'vitest';
import { checkAmountWithin, checkAttribution, checkRepayment } from '@/lib/amountInput';

describe('checkAmountWithin', () => {
  it('accepts an amount under the cap', () => {
    expect(checkAmountWithin('300', 1000, 'too big')).toEqual({
      ok: true,
      amount: 300,
      atCap: false,
    });
  });

  it('flags an amount that reaches the cap', () => {
    const r = checkAmountWithin('1000', 1000, 'too big');
    expect(r.ok && r.atCap).toBe(true);
  });

  it('refuses over the cap with the caller message', () => {
    const r = checkAmountWithin('1001', 1000, 'too big');
    expect(r).toEqual({ ok: false, error: 'too big' });
  });

  it('tolerates float noise at the cap', () => {
    // 0.1 + 0.2 is 0.30000000000000004, so an exact "0.30" must not read as over.
    const r = checkAmountWithin('0.30', 0.1 + 0.2, 'too big');
    expect(r.ok).toBe(true);
    expect(r.ok && r.atCap).toBe(true);
  });

  it('rounds to paise', () => {
    const r = checkAmountWithin('99.999', 1000, 'too big');
    expect(r.ok && r.amount).toBe(100);
  });

  it('refuses zero, negatives, blanks and non-numbers', () => {
    expect(checkAmountWithin('0', 1000, 'x').ok).toBe(false);
    expect(checkAmountWithin('-1', 1000, 'x').ok).toBe(false);
    expect(checkAmountWithin('', 1000, 'x').ok).toBe(false);
    expect(checkAmountWithin('   ', 1000, 'x').ok).toBe(false);
    expect(checkAmountWithin('abc', 1000, 'x').ok).toBe(false);
  });

  it('ignores surrounding whitespace', () => {
    expect(checkAmountWithin('  250  ', 1000, 'x').ok).toBe(true);
  });

  it('refuses anything when the cap is zero', () => {
    expect(checkAmountWithin('1', 0, 'x').ok).toBe(false);
  });
});

describe('checkRepayment', () => {
  it('accepts a partial and reports it does not settle', () => {
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
    const r = checkRepayment('1200', 1000);
    expect(r.ok === false && r.error).toMatch(/still owed/);
  });
});

describe('checkAttribution', () => {
  it('accepts part of a transaction', () => {
    // The Swiggy One fee inside a food order: ₹30 of ₹815.
    expect(checkAttribution('30', 815)).toEqual({
      ok: true,
      amount: 30,
      isWholeTransaction: false,
    });
  });

  it('recognises attributing the whole charge', () => {
    const r = checkAttribution('299', 299);
    expect(r.ok && r.isWholeTransaction).toBe(true);
  });

  it('refuses more than the transaction itself', () => {
    // A subscription cannot have taken more than the charge it sits on, and the
    // cadence maths derives its median and range from these figures.
    const r = checkAttribution('900', 815);
    expect(r.ok).toBe(false);
    expect(r.ok === false && r.error).toMatch(/than the transaction/);
  });
});
