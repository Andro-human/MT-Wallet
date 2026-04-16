import type { TransactionGroup } from '@/hooks/useTransactionGroups';

/**
 * Groups to show in Add/Edit transaction selectors.
 *
 * Rule: hide archived groups, unless the current transaction is already
 * assigned to one — in which case show it so the user can see the context
 * without forcing a reassignment.
 */
export function visibleGroups<
  G extends Pick<TransactionGroup, 'id' | 'archived_at'>,
>(all: readonly G[], currentGroupId?: string | null): G[] {
  return all.filter(
    (g) => !g.archived_at || (currentGroupId != null && g.id === currentGroupId),
  );
}
