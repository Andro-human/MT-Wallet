// Code owns every number on a subscription. Given its linked occurrences, derive
// cadence, amount stats, and the predicted next date from the real gap distribution.
// No AI, no frozen "every 30 days" assumption.

export type Cadence = 'weekly' | 'monthly' | 'quarterly' | 'annual' | 'irregular';

const DAY_MS = 86_400_000;
const CADENCES: { name: Exclude<Cadence, 'irregular'>; center: number; tol: number }[] = [
  { name: 'weekly', center: 7, tol: 2 },
  { name: 'monthly', center: 30, tol: 7 },
  { name: 'quarterly', center: 91, tol: 12 },
  { name: 'annual', center: 365, tol: 20 },
];

export interface Occurrence {
  amount: number;
  transacted_at: string;
}

export interface OccurrenceSummary {
  cadence: Cadence;
  medianGapDays: number | null;
  medianAmount: number;
  amountMin: number;
  amountMax: number;
  lastAmount: number;
  predictedNext: string | null; // YYYY-MM-DD
  confidence: number;
}

function median(sorted: number[]): number {
  const n = sorted.length;
  if (n === 0) return 0;
  const mid = Math.floor(n / 2);
  return n % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

export function summarizeOccurrences(occ: Occurrence[]): OccurrenceSummary {
  const amounts = occ.map((o) => o.amount);
  const sortedAmts = [...amounts].sort((a, b) => a - b);
  const byTime = [...occ].sort((a, b) => +new Date(a.transacted_at) - +new Date(b.transacted_at));
  const times = byTime.map((o) => +new Date(o.transacted_at));

  const base = {
    medianAmount: Math.round(median(sortedAmts) * 100) / 100,
    amountMin: amounts.length ? Math.min(...amounts) : 0,
    amountMax: amounts.length ? Math.max(...amounts) : 0,
    lastAmount: byTime.length ? byTime[byTime.length - 1].amount : 0,
  };

  if (times.length < 2) {
    return { ...base, cadence: 'irregular', medianGapDays: null, predictedNext: null, confidence: 0.3 };
  }

  const gaps: number[] = [];
  for (let i = 1; i < times.length; i++) gaps.push((times[i] - times[i - 1]) / DAY_MS);
  const medianGap = median([...gaps].sort((a, b) => a - b));
  const matched = CADENCES.find((c) => Math.abs(medianGap - c.center) <= c.tol);
  const cadence: Cadence = matched?.name ?? 'irregular';

  const tol = matched ? matched.tol : 0.3 * medianGap;
  const regularity = gaps.filter((g) => Math.abs(g - medianGap) <= tol).length / gaps.length;
  const countBonus = Math.min(occ.length / 6, 1);
  const confidence = Math.round((0.7 * regularity + 0.3 * countBonus) * 100) / 100;

  const lastSeen = times[times.length - 1];
  const predictedNext = new Date(lastSeen + medianGap * DAY_MS).toISOString().slice(0, 10);

  return { ...base, cadence, medianGapDays: Math.round(medianGap), predictedNext, confidence };
}

export function monthlyNormalized(medianAmount: number | null, cadence: Cadence, medianGapDays: number | null): number {
  if (!medianAmount) return 0;
  if (medianGapDays && medianGapDays > 0) return Math.round((medianAmount * 30) / medianGapDays);
  const perMonth: Record<Cadence, number> = { weekly: 30 / 7, monthly: 1, quarterly: 1 / 3, annual: 1 / 12, irregular: 0 };
  return Math.round(medianAmount * perMonth[cadence]);
}
