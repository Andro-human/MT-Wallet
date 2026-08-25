// Bahi-Khata Noir categorical palette — hard cap of 8 colored categories,
// everything else renders as the muted long tail (DESIGN.md).
export const CATEGORY_PALETTE = [
  '#FFAE33', // marigold — food & dining
  '#7FCF6B', // mandi green — groceries
  '#55A9FF', // rickshaw blue — transport
  '#FF7A9E', // bazaar rose — shopping
  '#8F86FF', // indigo — subscriptions
  '#3BD0C5', // teal — bills & utilities
  '#D983FF', // orchid — entertainment
  '#E8D44D', // turmeric — health
] as const;

export const LONG_TAIL_COLOR = '#8E8574';

export const INCOME_COLOR = '#E9C46A';

export function categoryColor(stored: string | null | undefined): string {
  return stored && stored.trim() ? stored : LONG_TAIL_COLOR;
}

export const FOLD_LABEL = 'Everything else';

// Geometry, not colour count, is what limits a chart. A donut dies past ~8
// slices because the slivers get too thin to read; a stacked bar dies past ~10
// segments. Greying the tail does not declutter it, it makes separate
// categories indistinguishable from each other. So the tail is AGGREGATED into
// one honest slice instead, and every category keeps its own colour everywhere
// space allows (ranked lists, chips).
export const FOLD_DONUT = 8;
export const FOLD_STACK = 10;

// Keeps the highest `max` items as-is and sums the rest into one folded entry.
export function foldTail<T>(
  sorted: T[],
  max: number,
  make: (label: string, total: number, color: string) => T,
  value: (item: T) => number,
): T[] {
  if (sorted.length <= max + 1) return sorted;
  const kept = sorted.slice(0, max);
  const tail = sorted.slice(max);
  return [...kept, make(FOLD_LABEL, tail.reduce((sum, x) => sum + value(x), 0), LONG_TAIL_COLOR)];
}
