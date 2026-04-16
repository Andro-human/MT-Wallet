import { describe, it, expect } from 'vitest';
import { visibleGroups } from '@/lib/visibleGroups';

const g = (id: string, archived_at: string | null = null) => ({ id, archived_at });

describe('visibleGroups', () => {
  it('shows all non-archived groups when no current selection', () => {
    const groups = [g('a'), g('b'), g('c')];
    expect(visibleGroups(groups).map((x) => x.id)).toEqual(['a', 'b', 'c']);
  });

  it('hides archived groups by default', () => {
    const groups = [g('a'), g('b', '2026-01-01T00:00:00Z'), g('c')];
    expect(visibleGroups(groups).map((x) => x.id)).toEqual(['a', 'c']);
  });

  it('includes an archived group when it matches currentGroupId', () => {
    const groups = [g('a'), g('b', '2026-01-01T00:00:00Z'), g('c')];
    expect(visibleGroups(groups, 'b').map((x) => x.id)).toEqual(['a', 'b', 'c']);
  });

  it('does not include other archived groups when currentGroupId is an archived one', () => {
    const groups = [
      g('a'),
      g('b', '2026-01-01T00:00:00Z'),
      g('c', '2026-01-02T00:00:00Z'),
    ];
    expect(visibleGroups(groups, 'b').map((x) => x.id)).toEqual(['a', 'b']);
  });

  it('handles null/undefined currentGroupId identically', () => {
    const groups = [g('a'), g('b', '2026-01-01T00:00:00Z')];
    expect(visibleGroups(groups, null)).toEqual(visibleGroups(groups));
    expect(visibleGroups(groups, undefined)).toEqual(visibleGroups(groups));
  });

  it('handles empty input', () => {
    expect(visibleGroups([])).toEqual([]);
  });
});
