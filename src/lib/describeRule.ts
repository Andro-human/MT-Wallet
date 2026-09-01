import type { UserMerchantMapping } from '@/hooks/useMerchantMappings';

/** A rule is only reviewable if it says what it does. These read as a sentence
 *  because the reason to open this list is a transaction that came in wrong, and
 *  the question is always "which of these did that". */
export function describeRule(
  rule: UserMerchantMapping,
  categoryName: (id: string) => string | undefined,
): { conditions: string[]; effects: string[] } {
  const conditions: string[] = [
    rule.match_type === 'contains'
      ? `merchant contains "${rule.raw_merchant}"`
      : `merchant is exactly "${rule.raw_merchant}"`,
  ];

  if (rule.amount_operator && rule.amount_threshold !== null) {
    const word =
      rule.amount_operator === '<' ? 'under'
        : rule.amount_operator === '<=' ? 'at most'
          : rule.amount_operator === '>' ? 'over'
            : rule.amount_operator === '>=' ? 'at least'
              : 'exactly';
    conditions.push(`amount ${word} ₹${rule.amount_threshold.toLocaleString('en-IN')}`);
  }

  if (rule.date_operator && rule.date_threshold !== null) {
    const word =
      rule.date_operator === '<' ? 'before day'
        : rule.date_operator === '<=' ? 'on or before day'
          : rule.date_operator === '>' ? 'after day'
            : rule.date_operator === '>=' ? 'on or after day'
              : 'on day';
    conditions.push(`${word} ${rule.date_threshold} of the month`);
  }

  const effects: string[] = [];
  if (rule.default_category_id) {
    effects.push(`category → ${categoryName(rule.default_category_id) ?? 'a deleted category'}`);
  }
  if (rule.default_is_expense !== null) {
    effects.push(rule.default_is_expense ? 'count as expense' : 'do not count as expense');
  }
  if (rule.default_is_income !== null) {
    effects.push(rule.default_is_income ? 'count as income' : 'do not count as income');
  }
  if (rule.mapped_merchant && rule.mapped_merchant !== rule.raw_merchant) {
    effects.push(`rename to "${rule.mapped_merchant}"`);
  }
  if (effects.length === 0) effects.push('nothing, this rule sets no field');

  return { conditions, effects };
}

/** Rules that set the same field, where only the earliest actually decides it.
 *  Surfacing the clash is the point: a merchant behaving oddly usually has two
 *  rules disagreeing, and the loser is invisible otherwise. */
export function conflictingFields(rules: UserMerchantMapping[]): string[] {
  const fields: [keyof UserMerchantMapping, string][] = [
    ['default_category_id', 'category'],
    ['default_is_expense', 'count as expense'],
    ['default_is_income', 'count as income'],
  ];
  return fields
    .filter(([key]) => rules.filter((r) => r[key] !== null).length > 1)
    .map(([, label]) => label);
}
