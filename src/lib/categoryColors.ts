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
