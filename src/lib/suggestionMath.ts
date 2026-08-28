export interface SuggestionCategory {
  id: string;
  name: string;
  icon: string | null;
}

export interface CategoryLookup {
  id: string;
  slug: string;
  name: string;
  icon: string | null;
}

export interface MoveGroup<T> {
  key: string;
  from: SuggestionCategory | null;
  to: SuggestionCategory;
  items: T[];
  total: number;
}

const chip = (c: CategoryLookup): SuggestionCategory => ({
  id: c.id,
  name: c.name,
  icon: c.icon,
});

/** Build the slug and id indexes once per render rather than per transaction. */
export function indexCategories(categories: CategoryLookup[]) {
  return {
    bySlug: new Map(categories.map((c) => [c.slug.trim().toLowerCase(), c])),
    byId: new Map(categories.map((c) => [c.id, c])),
  };
}

/** Whether a stored suggestion is worth showing, and the move it describes.
 *
 *  Two ways a suggestion is not actionable, and both occur in real data:
 *  the slug names a category that no longer exists (renamed or deleted since the
 *  agent wrote it), and the slug names the category the transaction already sits
 *  in, which happens when the user files it manually before opening the inbox.
 *  Neither is an error; both are simply nothing to ask about.
 */
export function resolveMove(
  currentCategoryId: string | null,
  suggestionSlug: string | null | undefined,
  index: ReturnType<typeof indexCategories>,
): { from: SuggestionCategory | null; to: SuggestionCategory } | null {
  const slug = suggestionSlug?.trim().toLowerCase();
  if (!slug) return null;

  const to = index.bySlug.get(slug);
  if (!to) return null;
  if (to.id === currentCategoryId) return null;

  const from = currentCategoryId ? index.byId.get(currentCategoryId) : undefined;
  return { from: from ? chip(from) : null, to: chip(to) };
}

/** Collapse identical moves into one decision, heaviest group first.
 *
 *  The agent repeats itself for a reason: eight Amazon rows all moving
 *  Shopping -> Groceries is one judgement call, not eight. Ties on count break
 *  on money, so the group worth more sits higher.
 */
export function groupByMove<
  T extends {
    from: SuggestionCategory | null;
    to: SuggestionCategory;
    amount: number;
    transactedAt: string;
  },
>(items: T[]): MoveGroup<T>[] {
  const map = new Map<string, MoveGroup<T>>();

  for (const item of items) {
    // An uncategorised source is a distinct move from any categorised one, so it
    // needs its own key rather than colliding under an empty string.
    const key = `${item.from?.id ?? 'none'}->${item.to.id}`;
    let group = map.get(key);
    if (!group) {
      group = { key, from: item.from, to: item.to, items: [], total: 0 };
      map.set(key, group);
    }
    group.items.push(item);
    group.total += item.amount;
  }

  for (const group of map.values()) {
    group.items.sort((a, b) => b.transactedAt.localeCompare(a.transactedAt));
  }

  return [...map.values()].sort(
    (a, b) => b.items.length - a.items.length || b.total - a.total,
  );
}
