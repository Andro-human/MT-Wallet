/** Spotting a charge that bundled the subscription in with other shopping.
 *
 *  A subscription matches on a word, so it takes the whole charge. "Helmet +
 *  earphone cover + Ketchup" is not a ketchup purchase, and attributing all
 *  ₹2,918.55 to it makes the card advertise a range that describes Amazon orders.
 *
 *  Two independent signals, because either alone misses cases:
 *   - the note names items the subscription is not
 *   - the amount is a large multiple of what this subscription usually costs
 *
 *  Nothing here invents a stored figure. It marks rows and offers the observed
 *  typical amount as a starting point; the user confirms.
 */

/** Items in one charge are written with these between them. */
const SEPARATORS = /\s*(?:\+|&|,|\/|\band\b|\bwith\b)\s*/i;

/** A leading channel tag such as "#Online | " is not one of the items. */
const LEADING_TAG = /^\s*#\S+\s*\|\s*/;

/** Quantity markers: "2x ketchup" is one item bought twice, not two items. */
const QUANTITY = /^\s*\d+\s*x\s*/i;

/** How many times the typical cost an amount must reach to look bundled on its
 *  own. Deliberately loose: a genuine double purchase ("2x ketchup" at roughly
 *  twice the usual) must not trip it, while an 8x outlier obviously should. */
export const AMOUNT_MULTIPLE = 2.5;

/** The distinct things a note says were bought. */
export function splitNoteItems(note: string | null | undefined): string[] {
  const cleaned = (note ?? '').replace(LEADING_TAG, '').trim();
  if (!cleaned) return [];
  return cleaned
    .split(SEPARATORS)
    .map((part) => part.replace(QUANTITY, '').trim())
    .filter(Boolean);
}

function median(sorted: number[]): number | null {
  if (sorted.length === 0) return null;
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

/** Whether a note names something the subscription is not.
 *
 *  Needs the match term: without it every multi-item note would look bundled,
 *  including the ones where all the items are the subscription.
 */
export function noteNamesOtherItems(
  note: string | null | undefined,
  matchTerm: string | null | undefined,
): boolean {
  const term = (matchTerm ?? '').trim().toLowerCase();
  if (!term) return false;

  const items = splitNoteItems(note);
  if (items.length < 2) return false;

  return items.some((item) => !item.toLowerCase().includes(term));
}

export type ClubbedReason = 'note' | 'amount' | 'both';

export interface Occurrence {
  transactionId: string;
  note: string | null;
  /** What the transaction charged, not what is currently attributed. */
  txnAmount: number;
}

export interface OccurrenceVerdict {
  transactionId: string;
  clubbed: boolean;
  reason: ClubbedReason | null;
}

export interface ClubbedAnalysis {
  verdicts: Map<string, OccurrenceVerdict>;
  /** Median charge of the occurrences that do not look bundled, which is the
   *  best available estimate of what this subscription actually costs. Null when
   *  nothing is left to learn from. */
  typical: number | null;
  clubbedCount: number;
}

/** Flag the bundled charges and report what the subscription usually costs.
 *
 *  Two passes on purpose. The typical cost has to be learned from the notes that
 *  look clean, because including an 8x outlier in that median is exactly what
 *  makes the outlier look normal.
 */
export function analyseOccurrences(
  occurrences: Occurrence[],
  matchTerm: string | null | undefined,
): ClubbedAnalysis {
  const byNote = new Map<string, boolean>();
  for (const o of occurrences) {
    byNote.set(o.transactionId, noteNamesOtherItems(o.note, matchTerm));
  }

  const cleanAmounts = occurrences
    .filter((o) => !byNote.get(o.transactionId))
    .map((o) => o.txnAmount)
    .sort((a, b) => a - b);
  const typical = median(cleanAmounts);

  const verdicts = new Map<string, OccurrenceVerdict>();
  let clubbedCount = 0;

  for (const o of occurrences) {
    const byNoteHit = byNote.get(o.transactionId) === true;
    // Only meaningful with something clean to compare against, and never
    // against a single sample, which would be comparing a row with itself.
    const byAmountHit =
      typical !== null && cleanAmounts.length >= 2 && o.txnAmount > typical * AMOUNT_MULTIPLE;

    const clubbed = byNoteHit || byAmountHit;
    if (clubbed) clubbedCount += 1;

    verdicts.set(o.transactionId, {
      transactionId: o.transactionId,
      clubbed,
      reason: clubbed
        ? byNoteHit && byAmountHit
          ? 'both'
          : byNoteHit
            ? 'note'
            : 'amount'
        : null,
    });
  }

  return { verdicts, typical, clubbedCount };
}
