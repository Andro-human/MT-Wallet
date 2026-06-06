import { useMemo } from 'react';
import { useTransactions } from './useTransactions';
import { useRefundTotals, useRefundAllocations } from './useRefundLinks';
import { useDuplicateExcludeIds } from './useDuplicateLinks';
import type { TransactionWithCategory } from '@/types/database';
import type {
  DuplicateExcludeSet,
  RefundTotalsMap,
  RefundAllocationsMap,
} from '@/lib/transactionMath';

export interface FinanceDataFilters {
  startDate?: Date;
  endDate?: Date;
  categoryId?: string;
  direction?: 'credit' | 'debit';
  search?: string;
  limit?: number;
  groupId?: string;
  bankName?: string;
  accountLast4?: string;
}

export interface FinanceData {
  transactions: TransactionWithCategory[];
  refundTotals: RefundTotalsMap;
  refundAllocations: RefundAllocationsMap;
  duplicateExcludeIds: DuplicateExcludeSet;
  isReady: boolean;
  isLoading: boolean;
}

const EMPTY_REFUND_TOTALS: RefundTotalsMap = {};
const EMPTY_ALLOCATIONS: RefundAllocationsMap = {};
const EMPTY_EXCLUDE_SET: DuplicateExcludeSet = new Set();

export function useFinanceData(filters?: FinanceDataFilters): FinanceData {
  const txnsQuery = useTransactions(filters);
  const refundTotalsQuery = useRefundTotals();
  const refundAllocationsQuery = useRefundAllocations();
  const duplicateExcludeIdsQuery = useDuplicateExcludeIds();

  // Gate on isLoading not isFetching so background refetches don't drop
  // pages back into a skeleton state.
  const isReady =
    !txnsQuery.isLoading &&
    !refundTotalsQuery.isLoading &&
    !refundAllocationsQuery.isLoading &&
    !duplicateExcludeIdsQuery.isLoading;

  return useMemo<FinanceData>(
    () => ({
      transactions: txnsQuery.data ?? [],
      refundTotals: refundTotalsQuery.data ?? EMPTY_REFUND_TOTALS,
      refundAllocations: refundAllocationsQuery.data ?? EMPTY_ALLOCATIONS,
      duplicateExcludeIds: duplicateExcludeIdsQuery.data ?? EMPTY_EXCLUDE_SET,
      isReady,
      isLoading: !isReady,
    }),
    [
      txnsQuery.data,
      refundTotalsQuery.data,
      refundAllocationsQuery.data,
      duplicateExcludeIdsQuery.data,
      isReady,
    ],
  );
}

export interface FinanceContext {
  refundTotals: RefundTotalsMap;
  refundAllocations: RefundAllocationsMap;
  duplicateExcludeIds: DuplicateExcludeSet;
  isReady: boolean;
}

export function useFinanceContext(): FinanceContext {
  const refundTotalsQuery = useRefundTotals();
  const refundAllocationsQuery = useRefundAllocations();
  const duplicateExcludeIdsQuery = useDuplicateExcludeIds();

  const isReady =
    !refundTotalsQuery.isLoading &&
    !refundAllocationsQuery.isLoading &&
    !duplicateExcludeIdsQuery.isLoading;

  return useMemo<FinanceContext>(
    () => ({
      refundTotals: refundTotalsQuery.data ?? EMPTY_REFUND_TOTALS,
      refundAllocations: refundAllocationsQuery.data ?? EMPTY_ALLOCATIONS,
      duplicateExcludeIds: duplicateExcludeIdsQuery.data ?? EMPTY_EXCLUDE_SET,
      isReady,
    }),
    [
      refundTotalsQuery.data,
      refundAllocationsQuery.data,
      duplicateExcludeIdsQuery.data,
      isReady,
    ],
  );
}
