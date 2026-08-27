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
  '#5AC8A0', // seafoam
  '#FF9F7A', // coral
  '#8FC4FF', // powder
  '#D4C25A', // brass
  '#B87FE8', // violet
  '#4FBFD9', // cerulean
  '#E8845A', // rust
  '#9FD97F', // pistachio
] as const;

export const LONG_TAIL_COLOR = '#8E8574';
export const INCOME_COLOR = '#E9C46A';
export const FOLD_LABEL = 'Others';

// Geometry, not colour count, is what limits a chart: a donut dies past ~8
// slices because the slivers get too thin, a stacked bar past ~10 segments.
export const FOLD_DONUT = 8;
export const FOLD_STACK = 10;

// djb2 over the key, so a given category or group always prefers the same slot.
function hashIndex(key: string): number {
  let h = 5381;
  for (let i = 0; i < key.length; i++) h = ((h << 5) + h + key.charCodeAt(i)) | 0;
  return Math.abs(h) % PALETTE.length;
}

// Context-free surfaces (a chip on a transaction row) take the hashed slot
// directly: there is no view to deduplicate against.
export function entityColor(key: string | null | undefined): string {
  return key ? PALETTE[hashIndex(key)] : LONG_TAIL_COLOR;
}

// Every key hashes to a preferred slot; when two collide the slot is settled by
// linear probing in CANONICAL KEY ORDER, never in rank order. So the result
// depends only on WHICH entities are in the view, not how they are sorted —
// re-sorting, or viewing the same categories over a different month, yields the
// same colours, while two slices in one chart can never come out identical.
//
// A small palette cannot give both absolute global stability and guaranteed
// in-view distinctness. This trades the former: if the SET changes (a category
// appears or drops out) a colliding pair may swap slots. Distinctness within a
// chart is never traded, because two identical slices is the bug this exists to
// prevent.
export function assignColors(keys: string[]): Map<string, string> {
  const used = new Set<number>();
  const out = new Map<string, string>();
  for (const key of [...keys].sort()) {
    let slot = hashIndex(key);
    if (used.size < PALETTE.length) {
      while (used.has(slot)) slot = (slot + 1) % PALETTE.length;
      used.add(slot);
    }
    out.set(key, PALETTE[slot]);
  }
  return out;
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
