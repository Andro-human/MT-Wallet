import { describe, it, expect } from 'vitest';
import { syncRunFlag } from '@/lib/syncRunFlag';

describe('syncRunFlag', () => {
  it('leaves the normal cases unmarked', () => {
    expect(syncRunFlag('success')).toBeNull();
    expect(syncRunFlag('no_messages')).toBeNull();
  });

  it('marks a partial run in warning', () => {
    expect(syncRunFlag('partial')).toEqual({ color: 'text-warning', label: 'partial' });
  });

  it('marks a failed run in vermilion, never green or red-for-money', () => {
    expect(syncRunFlag('failed')).toEqual({ color: 'text-primary', label: 'failed' });
  });

  it('treats an unrecognised status as failed rather than silently fine', () => {
    expect(syncRunFlag('timed_out')).toEqual({ color: 'text-primary', label: 'failed' });
    expect(syncRunFlag(null)).toEqual({ color: 'text-primary', label: 'failed' });
    expect(syncRunFlag(undefined)).toEqual({ color: 'text-primary', label: 'failed' });
  });
});
