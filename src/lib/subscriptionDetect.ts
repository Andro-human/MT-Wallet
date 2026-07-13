export interface DetectTxn {
  id: string;
  merchant: string | null;
  amount: number;
  transacted_at: string;
  direction: 'credit' | 'debit';
  category_slug?: string | null;
}

export interface DetectedSubscription {
  clusterKey: string;
  label: string;
  cadence: 'weekly' | 'monthly' | 'quarterly' | 'annual' | 'irregular';
  medianGapDays: number;
  occurrences: number;
  amount: number;
  amountMin: number;
  amountMax: number;
  isVariable: boolean;
  confidence: number;
  band: 'high' | 'medium' | 'low';
  nextExpected: string;
  monthlyNormalized: number;
  state: 'active' | 'possibly_cancelled';
  firstSeen: string;
  lastSeen: string;
}

export interface DetectOptions {
  now?: Date;
  minOccurrences?: number;
  excludeCategories?: string[];
  excludeIds?: Set<string>;
  labelFor?: (clusterKey: string, rawMerchant: string) => string;
}

const DAY_MS = 86_400_000;

const CADENCES: { name: DetectedSubscription['cadence']; center: number; tol: number }[] = [
  { name: 'weekly', center: 7, tol: 2 },
  { name: 'monthly', center: 30, tol: 7 },
  { name: 'quarterly', center: 91, tol: 12 },
  { name: 'annual', center: 365, tol: 20 },
];

// Merchant strings that are noise, not a payable entity.
const MERCHANT_STOPLIST = new Set(['debit', 'credit', 'upi', 'neft', 'imps', 'atm', 'cash']);

// Nothing legitimate bills more often than weekly. A shorter median gap means
// frequent discretionary spend (Swiggy) or a same-day burst (a shopping spree),
// never a subscription. Below this we don't even score the cluster.
const MIN_CADENCE_DAYS = 5;

// A cluster whose median gap matches no known cadence is "irregular". It can still
// be a loose recurring cost, but it must clear a much higher bar to surface, so we
// discount its cadence score rather than letting near-random spacing score full marks.
const IRREGULAR_PENALTY = 0.4;

function median(sorted: number[]): number {
  const n = sorted.length;
  if (n === 0) return 0;
  const mid = Math.floor(n / 2);
  return n % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function mean(xs: number[]): number {
  return xs.reduce((a, b) => a + b, 0) / xs.length;
}

function stddevPop(xs: number[]): number {
  const m = mean(xs);
  return Math.sqrt(mean(xs.map((x) => (x - m) ** 2)));
}

// A UPI VPA / handle isn't a merchant we can cluster meaningfully.
function isVpaLike(merchant: string): boolean {
  return merchant.includes('@');
}

export function normalizeMerchant(merchant: string): string {
  return merchant.trim().toLowerCase();
}

function titleCase(s: string): string {
  return s.replace(/\b\w/g, (c) => c.toUpperCase());
}

export function detectSubscriptions(
  txns: DetectTxn[],
  opts: DetectOptions = {}
): DetectedSubscription[] {
  const now = opts.now ?? new Date();
  const minOcc = opts.minOccurrences ?? 3;
  const excludeCats = new Set(opts.excludeCategories ?? ['investment', 'self-transfer', 'transfer']);
  const excludeIds = opts.excludeIds ?? new Set<string>();
  const labelFor = opts.labelFor ?? ((_k, raw) => titleCase(raw));

  const groups = new Map<string, DetectTxn[]>();
  for (const t of txns) {
    if (t.direction !== 'debit') continue;
    if (!t.merchant) continue;
    if (excludeIds.has(t.id)) continue;
    if (t.category_slug && excludeCats.has(t.category_slug)) continue;
    const key = normalizeMerchant(t.merchant);
    if (!key || MERCHANT_STOPLIST.has(key) || isVpaLike(key)) continue;
    (groups.get(key) ?? groups.set(key, []).get(key)!).push(t);
  }

  const out: DetectedSubscription[] = [];

  for (const [key, rows] of groups) {
    if (rows.length < minOcc) continue;

    rows.sort((a, b) => +new Date(a.transacted_at) - +new Date(b.transacted_at));
    const times = rows.map((r) => +new Date(r.transacted_at));
    const gaps: number[] = [];
    for (let i = 1; i < times.length; i++) gaps.push((times[i] - times[i - 1]) / DAY_MS);
    if (gaps.length === 0) continue;

    const sortedGaps = [...gaps].sort((a, b) => a - b);
    const medianGap = median(sortedGaps);
    if (medianGap < MIN_CADENCE_DAYS) continue;

    const matched = CADENCES.find((c) => Math.abs(medianGap - c.center) <= c.tol);
    const cadence = matched?.name ?? 'irregular';
    const tol = matched ? matched.tol : 0.3 * medianGap;
    const regularity = gaps.filter((g) => Math.abs(g - medianGap) <= tol).length / gaps.length;
    // Irregular clusters can't earn a full cadence score, so they rarely reach high/medium.
    const cadenceScore = matched ? regularity : regularity * IRREGULAR_PENALTY;

    const amounts = rows.map((r) => r.amount);
    const meanAmt = mean(amounts);
    // Median for the DISPLAYED amount — one combined order poisons a mean
    // (ketchup: mean ₹821 vs median ₹331). Mean still drives stability scoring.
    const medianAmt = median([...amounts].sort((a, b) => a - b));
    const amountStability = meanAmt > 0 ? Math.max(0, 1 - stddevPop(amounts) / meanAmt) : 0;
    const isVariable = amountStability < 0.9;

    const lastSeenMs = times[times.length - 1];
    const overdue = (+now - lastSeenMs) / DAY_MS / medianGap;
    const recencyScore = overdue > 1.5 ? 0.2 : overdue > 1.0 ? 0.6 : 1;
    const state: DetectedSubscription['state'] = overdue > 1.5 ? 'possibly_cancelled' : 'active';

    const countBonus = Math.min(rows.length / 6, 1);
    const confidence =
      0.5 * cadenceScore + 0.25 * amountStability + 0.15 * recencyScore + 0.1 * countBonus;
    // A subscription recurs on a schedule. An irregular cluster may still be a loose
    // recurring cost, but it never earns more than low band (surfaced only on request).
    const band: DetectedSubscription['band'] =
      cadence === 'irregular'
        ? 'low'
        : confidence >= 0.7
          ? 'high'
          : confidence >= 0.5
            ? 'medium'
            : 'low';

    out.push({
      clusterKey: key,
      label: labelFor(key, rows[rows.length - 1].merchant ?? key),
      cadence,
      medianGapDays: Math.round(medianGap),
      occurrences: rows.length,
      amount: Math.round(medianAmt * 100) / 100,
      amountMin: Math.min(...amounts),
      amountMax: Math.max(...amounts),
      isVariable,
      confidence: Math.round(confidence * 100) / 100,
      band,
      nextExpected: new Date(lastSeenMs + medianGap * DAY_MS).toISOString().slice(0, 10),
      monthlyNormalized: Math.round((medianAmt * 30) / medianGap),
      state,
      firstSeen: new Date(times[0]).toISOString().slice(0, 10),
      lastSeen: new Date(lastSeenMs).toISOString().slice(0, 10),
    });
  }

  return out.sort((a, b) => b.monthlyNormalized - a.monthlyNormalized);
}
