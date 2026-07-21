// Deterministic matcher: does a transaction belong to a subscription?
// Signal priority is note (primary) > merchant > amount (weak tie-break), with an
// optional identity boost. Amounts drift, so they never key a match. No AI here.

export interface MatchableTxn {
  id: string;
  merchant: string | null;
  notes: string | null;
  amount: number;
  serviceIdentity?: string | null;
}

export interface MatchTarget {
  matchNote: string | null;
  matchMerchant: string | null;
  identity: string | null;
  medianAmount: number | null;
}

export type MatchBand = 'high' | 'mid' | 'low';

// A note match alone (1.0 * 0.6) reaches HIGH. A merchant match alone (1.0 * 0.4)
// reaches MID but not HIGH — merchant is a suggestion, note is auto-link.
const W_NOTE = 0.6;
const W_MERCHANT = 0.4;
const W_AMOUNT = 0.1;
const IDENTITY_BOOST = 0.3;

const HIGH = 0.6;
const MID = 0.35;

function norm(s: string | null | undefined): string {
  return (s ?? '').toLowerCase().trim();
}

function tokens(s: string | null | undefined): string[] {
  return norm(s)
    .replace(/^#\w+\s*\|\s*/, '')
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length > 2);
}

// Symmetric token overlap (Jaccard). Substring containment counts as a full match so
// "netflix" matches a note of "netflix premium".
export function textSimilarity(a: string | null, b: string | null): number {
  const na = norm(a);
  const nb = norm(b);
  if (!na || !nb) return 0;
  if (na === nb || na.includes(nb) || nb.includes(na)) return 1;
  const ta = new Set(tokens(a));
  const tb = new Set(tokens(b));
  if (ta.size === 0 || tb.size === 0) return 0;
  let inter = 0;
  for (const t of ta) if (tb.has(t)) inter++;
  return inter / (ta.size + tb.size - inter);
}

function amountProximity(a: number, b: number | null): number {
  if (!b || b <= 0) return 0;
  const ratio = Math.min(a, b) / Math.max(a, b);
  // Only rewards genuinely close amounts; drops off fast.
  return ratio > 0.8 ? (ratio - 0.8) / 0.2 : 0;
}

export function scoreMatch(txn: MatchableTxn, target: MatchTarget): number {
  let score = 0;
  if (target.matchNote) score += W_NOTE * textSimilarity(txn.notes, target.matchNote);
  if (target.matchMerchant) score += W_MERCHANT * textSimilarity(txn.merchant, target.matchMerchant);
  if (target.identity && txn.serviceIdentity && norm(target.identity) === norm(txn.serviceIdentity)) {
    score += IDENTITY_BOOST;
  }
  score += W_AMOUNT * amountProximity(txn.amount, target.medianAmount);
  return Math.min(score, 1);
}

export function bandFor(score: number): MatchBand {
  if (score >= HIGH) return 'high';
  if (score >= MID) return 'mid';
  return 'low';
}

// Create-by-example: rank transactions against a typed note/merchant seed. Returns
// matches at or above MID, best first. Pure function over already-loaded txns (no query).
export function searchByExample(
  txns: MatchableTxn[],
  seed: { note?: string | null; merchant?: string | null },
): { txn: MatchableTxn; score: number; band: MatchBand }[] {
  const target: MatchTarget = {
    matchNote: seed.note ?? null,
    matchMerchant: seed.merchant ?? null,
    identity: null,
    medianAmount: null,
  };
  if (!target.matchNote && !target.matchMerchant) return [];
  return txns
    .map((txn) => ({ txn, score: scoreMatch(txn, target) }))
    .filter((r) => r.score >= MID)
    .sort((a, b) => b.score - a.score)
    .map((r) => ({ ...r, band: bandFor(r.score) }));
}
