import type { UserMerchantMapping } from '@/hooks/useMerchantMappings';
import type { BulkEdit, BulkEditTxn } from './bulkEdit';

export type RuleEffect = 'category' | 'expense' | 'income' | 'rename';

export interface RuleEffects {
  category?: string;
  expense?: boolean;
  income?: boolean;
  rename?: string;
}

export interface RuleProposal {
  /** Lowercased merchant: rules match names case-insensitively. */
  key: string;
  merchant: string;
  txnCount: number;
  effects: RuleEffects;
  /** The rule to update in place, or null to insert a new one. */
  target: UserMerchantMapping | null;
  /** Effects an older rule already decides, so this one would never win them. */
  shadowed: RuleEffect[];
}

type RuleColumns = Partial<
  Pick<UserMerchantMapping, 'default_category_id' | 'default_is_expense' | 'default_is_income' | 'mapped_merchant'>
>;

export type RuleWrite =
  | { kind: 'update'; id: string; values: RuleColumns; previous: RuleColumns }
  | { kind: 'insert'; values: RuleColumns & Pick<UserMerchantMapping, 'raw_merchant' | 'match_type'> };

const COLUMN: Record<RuleEffect, keyof RuleColumns> = {
  category: 'default_category_id',
  expense: 'default_is_expense',
  income: 'default_is_income',
  rename: 'mapped_merchant',
};

/** "No category" and group cannot be remembered: ingest treats a null default as unset. */
export function canRemember(edit: BulkEdit): boolean {
  return !!edit.categoryId || edit.counted !== undefined || !!edit.merchant;
}

const isUnconditional = (r: UserMerchantMapping) => !r.amount_operator && !r.date_operator;

function nameMatches(rule: UserMerchantMapping, key: string): boolean {
  const raw = (rule.raw_merchant ?? '').toLowerCase();
  return rule.match_type === 'contains' ? key.includes(raw) : key === raw;
}

function setsEffect(rule: UserMerchantMapping, effect: RuleEffect): boolean {
  // Ingest reads mapped_merchant as `mapped_merchant || null`, so any non-empty
  // value renames, even one equal to the raw name.
  if (effect === 'rename') return !!rule.mapped_merchant;
  const v = rule[COLUMN[effect]];
  return v !== null && v !== undefined && v !== '';
}

/** One proposal per merchant. Ingest folds every matching rule and the oldest
 *  wins each field, so a new rule beside an existing one would lose: the target
 *  is the oldest unconditional exact rule for the name, updated in place. */
export function proposeRules(
  txns: BulkEditTxn[],
  edit: BulkEdit,
  rules: UserMerchantMapping[],
): RuleProposal[] {
  const byCreated = [...rules].sort((a, b) => a.created_at.localeCompare(b.created_at));
  const merchants = new Map<string, { merchant: string; count: number; debit: boolean; credit: boolean }>();
  for (const t of txns) {
    const name = (t.merchant ?? '').trim();
    if (!name) continue;
    const key = name.toLowerCase();
    const m = merchants.get(key) ?? { merchant: name, count: 0, debit: false, credit: false };
    m.count++;
    if (t.direction === 'credit') m.credit = true;
    else m.debit = true;
    merchants.set(key, m);
  }

  const proposals: RuleProposal[] = [];
  for (const [key, m] of merchants) {
    const effects: RuleEffects = {};
    if (edit.categoryId) effects.category = edit.categoryId;
    if (edit.counted !== undefined) {
      if (m.debit) effects.expense = edit.counted;
      if (m.credit) effects.income = edit.counted;
    }
    if (edit.merchant && edit.merchant !== m.merchant) effects.rename = edit.merchant;
    if (Object.keys(effects).length === 0) continue;

    const matching = byCreated.filter((r) => nameMatches(r, key));
    const target =
      matching.find((r) => r.match_type !== 'contains' && (r.raw_merchant ?? '').toLowerCase() === key && isUnconditional(r)) ??
      null;
    const older = target ? matching.slice(0, matching.indexOf(target)) : matching;
    const shadowed = (Object.keys(effects) as RuleEffect[]).filter((e) => older.some((r) => setsEffect(r, e)));

    proposals.push({ key, merchant: m.merchant, txnCount: m.count, effects, target, shadowed });
  }
  return proposals.sort((a, b) => a.merchant.localeCompare(b.merchant));
}

/** The write for a proposal, with only the effects the user kept. Null when none are left. */
export function ruleWrite(proposal: RuleProposal, kept: RuleEffect[]): RuleWrite | null {
  const values: RuleColumns = {};
  for (const e of kept) {
    const v = proposal.effects[e];
    if (v !== undefined) (values as Record<string, unknown>)[COLUMN[e]] = v;
  }
  if (Object.keys(values).length === 0) return null;

  if (proposal.target) {
    const previous: RuleColumns = {};
    for (const col of Object.keys(values) as (keyof RuleColumns)[]) {
      (previous as Record<string, unknown>)[col] = proposal.target[col] ?? null;
    }
    return { kind: 'update', id: proposal.target.id, values, previous };
  }
  return {
    kind: 'insert',
    values: {
      raw_merchant: proposal.merchant,
      match_type: 'exact',
      // The column is required; the raw name is the no-op rename the single-edit popup writes too.
      mapped_merchant: proposal.merchant,
      default_category_id: null,
      default_is_expense: null,
      default_is_income: null,
      ...values,
    },
  };
}
