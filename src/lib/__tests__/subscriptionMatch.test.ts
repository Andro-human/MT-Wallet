import { describe, it, expect } from 'vitest';
import { scoreMatch, bandFor, searchByExample, textSimilarity, type MatchableTxn } from '@/lib/subscriptionMatch';

const txn = (over: Partial<MatchableTxn>): MatchableTxn => ({
  id: 't', merchant: null, notes: null, amount: 100, serviceIdentity: null, ...over,
});

describe('textSimilarity', () => {
  it('is 1 for equal / containment', () => {
    expect(textSimilarity('netflix', 'netflix')).toBe(1);
    expect(textSimilarity('netflix premium', 'netflix')).toBe(1);
  });
  it('is 0 when either side empty', () => {
    expect(textSimilarity(null, 'netflix')).toBe(0);
    expect(textSimilarity('netflix', '')).toBe(0);
  });
  it('does not fully match merely-overlapping phrases', () => {
    // "life insurance" vs "health insurance" share only one token
    expect(textSimilarity('life insurance', 'health insurance')).toBeLessThan(0.5);
  });
});

describe('scoreMatch + bandFor', () => {
  it('note match alone reaches HIGH', () => {
    const s = scoreMatch(txn({ notes: 'netflix' }), { matchNote: 'netflix', matchMerchant: null, identity: null, medianAmount: null });
    expect(bandFor(s)).toBe('high');
  });

  it('merchant-only match lands in MID (not auto-link)', () => {
    const s = scoreMatch(txn({ merchant: 'NETFLIX.COM', notes: null }), { matchNote: null, matchMerchant: 'netflix', identity: null, medianAmount: null });
    expect(bandFor(s)).toBe('mid');
  });

  it('identity equality boosts the score', () => {
    const withId = scoreMatch(
      txn({ notes: 'prime', serviceIdentity: 'youtube premium' }),
      { matchNote: 'youtube', matchMerchant: null, identity: 'youtube premium', medianAmount: null },
    );
    const withoutId = scoreMatch(
      txn({ notes: 'prime', serviceIdentity: null }),
      { matchNote: 'youtube', matchMerchant: null, identity: 'youtube premium', medianAmount: null },
    );
    expect(withId).toBeGreaterThan(withoutId);
  });

  it('amount only is a weak tie-break, never a match on its own', () => {
    const s = scoreMatch(txn({ amount: 299 }), { matchNote: null, matchMerchant: null, identity: null, medianAmount: 299 });
    expect(bandFor(s)).toBe('low');
  });

  it('empty note and merchant target scores 0 (no false link)', () => {
    const s = scoreMatch(txn({ notes: 'anything', merchant: 'anywhere' }), { matchNote: null, matchMerchant: null, identity: null, medianAmount: null });
    expect(s).toBe(0);
  });

  it('life-insurance note does not match a health-insurance subscription', () => {
    const s = scoreMatch(txn({ notes: 'health insurance premium' }), { matchNote: 'life insurance', matchMerchant: null, identity: null, medianAmount: null });
    expect(bandFor(s)).not.toBe('high');
  });
});

describe('searchByExample', () => {
  const txns: MatchableTxn[] = [
    txn({ id: 'a', merchant: 'Netflix', notes: 'netflix', amount: 649 }),
    txn({ id: 'b', merchant: 'NETFLIX.COM', notes: null, amount: 499 }),
    txn({ id: 'c', merchant: 'Swiggy', notes: 'dinner', amount: 300 }),
  ];

  it('returns note matches high, merchant-only mid, and excludes unrelated', () => {
    const res = searchByExample(txns, { note: 'netflix', merchant: 'netflix' });
    const ids = res.map((r) => r.txn.id);
    expect(ids).toContain('a');
    expect(ids).toContain('b');
    expect(ids).not.toContain('c');
    expect(res.find((r) => r.txn.id === 'a')!.band).toBe('high');
  });

  it('returns nothing for an empty seed', () => {
    expect(searchByExample(txns, {})).toEqual([]);
  });

  it('sorts best-first', () => {
    const res = searchByExample(txns, { note: 'netflix' });
    for (let i = 1; i < res.length; i++) expect(res[i - 1].score).toBeGreaterThanOrEqual(res[i].score);
  });
});
