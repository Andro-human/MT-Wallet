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

export const COLOUR_CAP = 8;

// The eight-colour cap is a rendering decision, not stored data: in any ranked
// view the leaders keep their own identity colour and the tail greys out, so
// whichever categories dominate the range you are looking at are the ones that
// read. Membership is per-view; the hue stays pinned to the category so the same
// series holds its colour across a multi-month range.
export function cappedColor(
  rank: number,
  storedColor: string | null | undefined,
  cap: number = COLOUR_CAP,
): string {
  return rank < cap ? categoryColor(storedColor) : LONG_TAIL_COLOR;
}

// Ranks ids by descending value, then maps each to its capped colour.
export function rankedColors<T>(
  items: T[],
  value: (item: T) => number,
  key: (item: T) => string,
  color: (item: T) => string | null | undefined,
  cap: number = COLOUR_CAP,
): Map<string, string> {
  return new Map(
    [...items]
      .sort((a, b) => value(b) - value(a))
      .map((item, i) => [key(item), cappedColor(i, color(item), cap)]),
  );
}
