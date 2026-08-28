/** Session-scoped undo for suggestion actions.
 *
 *  Deliberately in memory and nowhere else. There is no table, no localStorage
 *  and no audit trail: a reload clears it. The point is recovering from a
 *  misclick in the moment, not keeping a record of every label ever changed.
 *
 *  Module-level rather than component state so it survives navigating into a
 *  transaction and back, which is exactly when someone notices the mistake.
 */

export interface UndoItem {
  transactionId: string;
  /** The category the transaction sat in before an apply. Null when it had none. */
  prevCategoryId: string | null;
  /** The enrichment row as it stood, so provenance is restored rather than forged. */
  prevEnrichment: {
    lending: unknown;
    category_suggestion: string | null;
    service_identity: string | null;
    budget_excluded: boolean;
    model: string;
    enriched_at: string;
    note_hash: string;
  };
}

export interface UndoEntry {
  id: string;
  mode: 'apply' | 'dismiss';
  /** Where the transactions were moved to, for the label. Null for a dismissal. */
  toName: string | null;
  items: UndoItem[];
}

const LIMIT = 12;

let entries: UndoEntry[] = [];
let seq = 0;
const listeners = new Set<() => void>();

function emit() {
  for (const l of listeners) l();
}

export function subscribeUndo(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Stable reference between changes: useSyncExternalStore re-renders forever if
 *  this returns a fresh array each call. */
export function getUndoEntries(): UndoEntry[] {
  return entries;
}

export function pushUndo(entry: Omit<UndoEntry, 'id'>): string {
  const id = `undo-${++seq}`;
  entries = [{ ...entry, id }, ...entries].slice(0, LIMIT);
  emit();
  return id;
}

export function dropUndo(id: string) {
  const next = entries.filter((e) => e.id !== id);
  if (next.length === entries.length) return;
  entries = next;
  emit();
}

export function clearUndo() {
  if (entries.length === 0) return;
  entries = [];
  emit();
}

export function describeUndo(entry: UndoEntry): string {
  const n = entry.items.length;
  return entry.mode === 'apply'
    ? `Moved ${n} to ${entry.toName}`
    : `Dismissed ${n} suggestion${n === 1 ? '' : 's'}`;
}

/** Group an undo's items by the category to restore, so putting back a batch is
 *  one request per distinct previous category rather than one per transaction.
 *  Items in a single entry share a source category in practice; this does not
 *  rely on that. */
export function groupByPrevCategory(items: UndoItem[]): Map<string | null, string[]> {
  const out = new Map<string | null, string[]>();
  for (const item of items) {
    const list = out.get(item.prevCategoryId);
    if (list) list.push(item.transactionId);
    else out.set(item.prevCategoryId, [item.transactionId]);
  }
  return out;
}
