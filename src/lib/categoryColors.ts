// Colours are DERIVED, never stored. Categories get added and groups get
// archived and recreated constantly, so persisting a colour per row means a
// migration every time one appears, and stale rows drift into collisions.
//
// Deterministic, not random: Math.random() re-rolls every render and the chart
// flickers. Ranked views deal colours out by position, which cannot collide.
// Single chips hash the id, so one entity is stable without storing anything.
export const PALETTE = [
  '#FFAE33', // marigold
  '#55A9FF', // rickshaw blue
  '#7FCF6B', // mandi green
  '#FF7A9E', // bazaar rose
  '#8F86FF', // indigo
  '#3BD0C5', // teal
  '#E8D44D', // turmeric
  '#D983FF', // orchid
  '#FF8C42', // burnt orange
  '#6FD3E8', // sky
  '#B8D96B', // olive
  '#E86BA8', // magenta
  '#7B9CFF', // periwinkle
  '#4FC79A', // jade
  '#E8B14D', // amber
  '#C98FE8', // lilac
] as const;

export const LONG_TAIL_COLOR = '#8E8574';
export const INCOME_COLOR = '#E9C46A';
export const FOLD_LABEL = 'Everything else';

// Geometry, not colour count, is what limits a chart: a donut dies past ~8
// slices because the slivers get too thin, a stacked bar past ~10 segments.
export const FOLD_DONUT = 8;
export const FOLD_STACK = 10;

// Ranked views: position in the sorted list. Distinct for the first
// PALETTE.length entries, which is well past any fold threshold.
export function paletteAt(index: number): string {
  return PALETTE[index % PALETTE.length];
}

// Single chips have no ranking context, so hash the id instead. Stable for a
// given entity forever, and a brand new category or group is coloured on
// creation with no seeding.
export function entityColor(id: string | null | undefined): string {
  if (!id) return LONG_TAIL_COLOR;
  let h = 5381;
  for (let i = 0; i < id.length; i++) h = ((h << 5) + h + id.charCodeAt(i)) | 0;
  return paletteAt(Math.abs(h));
}

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
