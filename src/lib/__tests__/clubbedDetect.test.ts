import { describe, it, expect } from 'vitest';
import {
  analyseOccurrences,
  noteNamesOtherItems,
  splitNoteItems,
  type Occurrence,
} from '@/lib/clubbedDetect';

describe('splitNoteItems', () => {
  it('splits on a plus', () => {
    expect(splitNoteItems('Helmet + earphone cover + Ketchup')).toEqual([
      'Helmet',
      'earphone cover',
      'Ketchup',
    ]);
  });

  it('splits on the word and', () => {
    expect(splitNoteItems('mic and ketchup')).toEqual(['mic', 'ketchup']);
  });

  it('drops a leading channel tag, which is not an item', () => {
    expect(splitNoteItems('#Online | mic and ketchup')).toEqual(['mic', 'ketchup']);
  });

  it('treats a quantity marker as one item, not several', () => {
    expect(splitNoteItems('2x ketchup')).toEqual(['ketchup']);
  });

  it('handles commas and ampersands', () => {
    expect(splitNoteItems('bread, curry leaves & milk')).toEqual([
      'bread',
      'curry leaves',
      'milk',
    ]);
  });

  it('is empty for no note', () => {
    expect(splitNoteItems(null)).toEqual([]);
    expect(splitNoteItems('   ')).toEqual([]);
  });
});

describe('noteNamesOtherItems', () => {
  it('flags a note naming things the subscription is not', () => {
    expect(noteNamesOtherItems('Helmet + earphone cover + Ketchup', 'ketchup')).toBe(true);
    expect(noteNamesOtherItems('#Online | mic and ketchup', 'ketchup')).toBe(true);
  });

  it('does not flag a quantity of the same item', () => {
    // "2x ketchup" is a double purchase, not a bundled order.
    expect(noteNamesOtherItems('2x ketchup', 'ketchup')).toBe(false);
  });

  it('does not flag a single item', () => {
    expect(noteNamesOtherItems('Ketchup', 'ketchup')).toBe(false);
  });

  it('does not flag when every item is the subscription', () => {
    expect(noteNamesOtherItems('ketchup + ketchup', 'ketchup')).toBe(false);
  });

  it('says nothing without a match term, rather than flagging everything', () => {
    expect(noteNamesOtherItems('mic and ketchup', null)).toBe(false);
    expect(noteNamesOtherItems('mic and ketchup', '  ')).toBe(false);
  });

  it('ignores case', () => {
    expect(noteNamesOtherItems('MIC AND KETCHUP', 'Ketchup')).toBe(true);
  });
});

// The real ketchup subscription, which is what prompted this.
const KETCHUP: Occurrence[] = [
  { transactionId: 'helmet', note: 'Helmet + earphone cover + Ketchup', txnAmount: 2918.55 },
  { transactionId: 'two-x', note: '2x ketchup', txnAmount: 668.1 },
  { transactionId: 'k1', note: 'Ketchup', txnAmount: 331.55 },
  { transactionId: 'k2', note: 'ketchup', txnAmount: 331.55 },
  { transactionId: 'k3', note: 'Ketchup', txnAmount: 240 },
  { transactionId: 'k4', note: 'ketchup', txnAmount: 387.85 },
  { transactionId: 'mic', note: '#Online | mic and ketchup', txnAmount: 2812.55 },
];

describe('analyseOccurrences', () => {
  it('finds both bundled charges and leaves the real ones alone', () => {
    const a = analyseOccurrences(KETCHUP, 'ketchup');
    expect(a.clubbedCount).toBe(2);
    expect(a.verdicts.get('helmet')!.clubbed).toBe(true);
    expect(a.verdicts.get('mic')!.clubbed).toBe(true);
    expect(a.verdicts.get('two-x')!.clubbed).toBe(false);
    expect(a.verdicts.get('k1')!.clubbed).toBe(false);
  });

  it('learns the typical cost from the clean rows only', () => {
    // Median of 240, 331.55, 331.55, 387.85, 668.10. Including the outliers
    // would drag this up and make them look normal.
    expect(analyseOccurrences(KETCHUP, 'ketchup').typical).toBe(331.55);
  });

  it('reports both signals when they agree', () => {
    expect(analyseOccurrences(KETCHUP, 'ketchup').verdicts.get('helmet')!.reason).toBe('both');
  });

  it('catches an outlier on amount alone, with no telling note', () => {
    const occ: Occurrence[] = [
      { transactionId: 'a', note: 'gym', txnAmount: 1000 },
      { transactionId: 'b', note: 'gym', txnAmount: 1000 },
      { transactionId: 'c', note: 'gym', txnAmount: 9000 },
    ];
    const a = analyseOccurrences(occ, 'gym');
    expect(a.verdicts.get('c')!.clubbed).toBe(true);
    expect(a.verdicts.get('c')!.reason).toBe('amount');
  });

  it('does not flag ordinary variation as bundled', () => {
    const occ: Occurrence[] = [
      { transactionId: 'a', note: 'insurance', txnAmount: 1307 },
      { transactionId: 'b', note: 'insurance', txnAmount: 1307.78 },
      { transactionId: 'c', note: 'insurance', txnAmount: 1319.02 },
    ];
    expect(analyseOccurrences(occ, 'insurance').clubbedCount).toBe(0);
  });

  it('never flags on amount with only one clean sample to compare against', () => {
    // Comparing a lone row against itself would flag nothing or everything.
    const occ: Occurrence[] = [
      { transactionId: 'a', note: 'gym', txnAmount: 500 },
      { transactionId: 'b', note: 'gym + protein', txnAmount: 9000 },
    ];
    const a = analyseOccurrences(occ, 'gym');
    expect(a.verdicts.get('a')!.clubbed).toBe(false);
    expect(a.verdicts.get('b')!.reason).toBe('note');
  });

  it('has no typical figure and flags nothing for an empty list', () => {
    const a = analyseOccurrences([], 'gym');
    expect(a.typical).toBeNull();
    expect(a.clubbedCount).toBe(0);
  });
});
