import { describe, it, expect } from 'vitest';
import { countNewSince } from '@/lib/countNewSince';

const tx = (transacted_at: string) => ({ transacted_at });

describe('countNewSince', () => {
  const bookmark = {
    transactedAt: new Date('2026-04-10T00:00:00Z'),
    createdAt: new Date('2026-04-10T12:00:00Z'),
  };

  it('returns 0 when no bookmark', () => {
    expect(countNewSince([tx('2026-04-15T00:00:00Z')], null)).toBe(0);
  });

  it('counts txns with transacted_at strictly newer than bookmark', () => {
    const txns = [
      tx('2026-04-11T00:00:00Z'),
      tx('2026-04-09T00:00:00Z'),
    ];
    expect(countNewSince(txns, bookmark)).toBe(1);
  });

  it('does not count at-bookmark (strict >)', () => {
    expect(countNewSince([tx('2026-04-10T00:00:00Z')], bookmark)).toBe(0);
  });

  it('does not count older txns regardless of when they were parsed', () => {
    // Out-of-order SMS with an old transacted_at should NOT inflate the count.
    // (Dropped the dual created_at check; it caused over-counting.)
    expect(countNewSince([tx('2026-04-08T00:00:00Z')], bookmark)).toBe(0);
  });

  it('respects caller-supplied filtered list', () => {
    const filtered = [
      tx('2026-04-11T00:00:00Z'),
      tx('2026-04-12T00:00:00Z'),
    ];
    expect(countNewSince(filtered, bookmark)).toBe(2);
  });

  it('handles empty list', () => {
    expect(countNewSince([], bookmark)).toBe(0);
  });
});
