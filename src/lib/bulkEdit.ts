import type { Transaction } from '@/types/database';

/** A field left undefined keeps each transaction's own value; null clears it. */
export interface BulkEdit {
  categoryId?: string | null;
  groupId?: string | null;
  counted?: boolean;
  merchant?: string;
}

export type BulkEditTxn = Pick<
  Transaction,
  'id' | 'direction' | 'category_id' | 'group_id' | 'merchant' | 'is_expense' | 'is_income' | 'cashback_month'
>;

export type TxnPatch = Partial<
  Pick<Transaction, 'category_id' | 'group_id' | 'merchant' | 'is_expense' | 'is_income' | 'cashback_month'>
>;

export function isEmptyEdit(edit: BulkEdit): boolean {
  return Object.values(edit).every((v) => v === undefined);
}

export function patchFor(txn: BulkEditTxn, edit: BulkEdit): TxnPatch {
  const patch: TxnPatch = {};
  if (edit.categoryId !== undefined) patch.category_id = edit.categoryId;
  if (edit.groupId !== undefined) patch.group_id = edit.groupId;
  if (edit.merchant !== undefined) patch.merchant = edit.merchant;
  if (edit.counted !== undefined) {
    // Direction decides which flag counts (classifyTransaction). A cashback is a
    // third kind of credit, so choosing counted or not counted ends it.
    if (txn.direction === 'credit') {
      patch.is_income = edit.counted;
      patch.cashback_month = null;
    } else {
      patch.is_expense = edit.counted;
    }
  }
  return patch;
}

/** What the transaction held under each key of its patch, so undo restores exactly that. */
export function previousFor(txn: BulkEditTxn, patch: TxnPatch): TxnPatch {
  const prev: Record<string, unknown> = {};
  for (const key of Object.keys(patch) as (keyof TxnPatch)[]) prev[key] = txn[key] ?? null;
  return prev as TxnPatch;
}

/** Rows that need the identical patch share one update. */
export function batchByPatch(items: { id: string; patch: TxnPatch }[]): { patch: TxnPatch; ids: string[] }[] {
  const batches = new Map<string, { patch: TxnPatch; ids: string[] }>();
  for (const { id, patch } of items) {
    const key = JSON.stringify(Object.entries(patch).sort(([a], [b]) => a.localeCompare(b)));
    const batch = batches.get(key) ?? { patch, ids: [] };
    batch.ids.push(id);
    batches.set(key, batch);
  }
  return [...batches.values()];
}
