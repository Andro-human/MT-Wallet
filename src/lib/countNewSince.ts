export interface ReviewBookmark {
  transactedAt: Date;
  createdAt: Date;
}

/**
 * Count transactions with `transacted_at` strictly newer than the bookmark.
 *
 * We intentionally ignore `created_at`: using it to catch out-of-order SMS
 * caused over-counting, because `bookmark.createdAt` is the bookmarked txn's
 * own `created_at` — any later-parsed txn would match, even semantically
 * older ones. If an out-of-order SMS arrives below the bookmark, the user
 * will still see it in the list; it just won't inflate the "N new" count.
 */
export function countNewSince<
  T extends { transacted_at: string },
>(filteredTxns: readonly T[], bookmark: ReviewBookmark | null): number {
  if (!bookmark) return 0;
  const cutoff = bookmark.transactedAt.getTime();
  let count = 0;
  for (const t of filteredTxns) {
    if (new Date(t.transacted_at).getTime() > cutoff) count++;
  }
  return count;
}
