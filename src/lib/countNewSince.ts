export interface ReviewBookmark {
  transactedAt: Date;
  createdAt: Date;
}

/**
 * Count transactions newer than the bookmark.
 *
 * Dual-key rule: a txn counts if EITHER transacted_at OR created_at is newer
 * than the matching bookmark timestamp. That catches two cases:
 *   1. Normal SMS arrivals — transacted_at advances monotonically.
 *   2. Out-of-order SMS arrivals — a message for an older purchase arrives
 *      after the bookmark is set. transacted_at is older than the bookmark,
 *      but created_at is newer, so we surface it as "new to review".
 */
export function countNewSince<
  T extends { transacted_at: string; created_at: string },
>(filteredTxns: readonly T[], bookmark: ReviewBookmark | null): number {
  if (!bookmark) return 0;
  let count = 0;
  for (const t of filteredTxns) {
    const txAt = new Date(t.transacted_at).getTime();
    const crAt = new Date(t.created_at).getTime();
    if (
      txAt > bookmark.transactedAt.getTime() ||
      crAt > bookmark.createdAt.getTime()
    ) {
      count++;
    }
  }
  return count;
}
