/**
 * Count distinct YYYY-MM months the inclusive [start, end] range touches.
 *
 * `partial` is true when the range does not start on the 1st OR does not end
 * on the last day of its month — used to render "~₹X/mo (partial)".
 * Divisor floors at 1 so a 0-day range doesn't divide by zero.
 */
export function monthsTouched(
  start: Date,
  end: Date,
): { count: number; partial: boolean } {
  if (end < start) return { count: 1, partial: true };

  const months = new Set<string>();
  // Walk by month boundary rather than by day — handles ranges of any length in O(months).
  const cursor = new Date(start.getFullYear(), start.getMonth(), 1);
  const endAnchor = new Date(end.getFullYear(), end.getMonth(), 1);
  while (cursor <= endAnchor) {
    months.add(`${cursor.getFullYear()}-${cursor.getMonth()}`);
    cursor.setMonth(cursor.getMonth() + 1);
  }

  const count = Math.max(months.size, 1);

  const startsOnFirst = start.getDate() === 1;
  // Last day of end's month
  const lastDayOfEndMonth = new Date(end.getFullYear(), end.getMonth() + 1, 0).getDate();
  const endsOnLast = end.getDate() === lastDayOfEndMonth;

  const partial = !(startsOnFirst && endsOnLast);
  return { count, partial };
}
