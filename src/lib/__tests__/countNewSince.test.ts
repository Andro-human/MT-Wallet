import { describe, it, expect } from 'vitest';
import { countNewSince } from '@/lib/countNewSince';

const tx = (transacted_at: string, created_at: string, id = Math.random().toString()) => ({
  id,
  transacted_at,
  created_at,
});

describe('countNewSince', () => {
  const bookmark = {
    transactedAt: new Date('2026-04-10T00:00:00Z'),
    createdAt: new Date('2026-04-10T12:00:00Z'),
  };

  it('returns 0 when no bookmark', () => {
    expect(countNewSince([tx('2026-04-15T00:00:00Z', '2026-04-15T00:00:00Z')], null)).toBe(0);
  });

  it('counts txns with transacted_at newer than bookmark', () => {
    const txns = [
      tx('2026-04-11T00:00:00Z', '2026-04-11T00:00:00Z'), // newer
      tx('2026-04-09T00:00:00Z', '2026-04-09T00:00:00Z'), // older
    ];
    expect(countNewSince(txns, bookmark)).toBe(1);
  });

  it('counts OUT-OF-ORDER txn: older transacted_at but newer created_at', () => {
    // SMS arrived late for a purchase from 2 days before the bookmark.
    // transacted_at (2026-04-08) is older than bookmark, but the message
    // was created after the bookmark — should still be counted.
    const outOfOrder = tx('2026-04-08T00:00:00Z', '2026-04-11T00:00:00Z');
    expect(countNewSince([outOfOrder], bookmark)).toBe(1);
  });

  it('does NOT count a txn that is older on BOTH keys', () => {
    const old = tx('2026-04-01T00:00:00Z', '2026-04-01T00:00:00Z');
    expect(countNewSince([old], bookmark)).toBe(0);
  });

  it('does not count a txn exactly at the bookmark (strict >)', () => {
    const atBookmark = tx('2026-04-10T00:00:00Z', '2026-04-10T12:00:00Z');
    expect(countNewSince([atBookmark], bookmark)).toBe(0);
  });

  it('respects the caller-filtered list: only counts what the user is looking at', () => {
    // If caller passes only debit txns, archived-category txns, etc — the banner
    // reflects "new in my current filter", not all new-in-the-DB.
    const filtered = [
      tx('2026-04-11T00:00:00Z', '2026-04-11T00:00:00Z'),
      tx('2026-04-12T00:00:00Z', '2026-04-12T00:00:00Z'),
    ];
    expect(countNewSince(filtered, bookmark)).toBe(2);
  });
});
