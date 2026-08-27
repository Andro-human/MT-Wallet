import { describe, it, expect } from 'vitest';
import { cleanLast4, toTechnicalDisplay } from '@/lib/bankDisplay';

describe('cleanLast4', () => {
  it('keeps real digits, including the X-prefixed form the parser emits', () => {
    expect(cleanLast4('3760')).toBe('3760');
    expect(cleanLast4('X3760')).toBe('X3760');
  });

  it('drops the literal placeholder strings the parser has written', () => {
    // bank_account_aliases really does contain source_account_last4 = 'null'
    // for Amazon Pay and PhonePe, which rendered as "Amazon Pay ••null".
    expect(cleanLast4('null')).toBe('');
    expect(cleanLast4('NULL')).toBe('');
    expect(cleanLast4('undefined')).toBe('');
    expect(cleanLast4(' none ')).toBe('');
  });

  it('treats absent and blank as blank', () => {
    expect(cleanLast4(null)).toBe('');
    expect(cleanLast4(undefined)).toBe('');
    expect(cleanLast4('  ')).toBe('');
  });
});

describe('toTechnicalDisplay', () => {
  it('joins a name and digits', () => {
    expect(toTechnicalDisplay('HDFC', '1234')).toBe('HDFC ••1234');
  });

  it('falls back to whichever half exists', () => {
    expect(toTechnicalDisplay('Amazon Pay', null)).toBe('Amazon Pay');
    expect(toTechnicalDisplay('', '0023')).toBe('••0023');
    expect(toTechnicalDisplay(null, null)).toBe('');
  });

  it('never prints a placeholder as an account number', () => {
    expect(toTechnicalDisplay('Amazon Pay', 'null')).toBe('Amazon Pay');
    expect(toTechnicalDisplay('PhonePe', 'null')).toBe('PhonePe');
  });
});
