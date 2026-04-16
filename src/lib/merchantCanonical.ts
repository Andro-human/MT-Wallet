// Normalize a merchant string for case-folded grouping: lowercase + trim.
export function normalizeMerchant(m: string): string {
  return m.toLowerCase().trim();
}

/**
 * Return the most-common existing casing of a merchant for the normalized
 * form of `input`. Falls back to the user's typed input if no match exists.
 *
 * Example: input="swiggy", existing=["Swiggy","Swiggy","swiggy"] -> "Swiggy"
 */
export function canonicalMerchantCasing(
  input: string,
  existingMerchants: readonly string[]
): string {
  const typed = input.trim();
  if (!typed) return input;
  const key = normalizeMerchant(typed);
  const counts = new Map<string, number>();
  for (const m of existingMerchants) {
    if (!m) continue;
    const mTrimmed = m.trim();
    if (normalizeMerchant(mTrimmed) !== key) continue;
    counts.set(mTrimmed, (counts.get(mTrimmed) ?? 0) + 1);
  }
  if (counts.size === 0) return typed;

  // Most common wins; on tie, return the first one encountered (stable).
  let best = typed;
  let bestCount = 0;
  for (const [casing, count] of counts) {
    if (count > bestCount) {
      best = casing;
      bestCount = count;
    }
  }
  return best;
}
