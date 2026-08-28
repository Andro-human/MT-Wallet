import { describe, it, expect, beforeEach } from 'vitest';
import {
  clearUndo,
  describeUndo,
  dropUndo,
  getUndoEntries,
  groupByPrevCategory,
  pushUndo,
  subscribeUndo,
  type UndoItem,
} from '../undoStore';

const item = (transactionId: string, prevCategoryId: string | null): UndoItem => ({
  transactionId,
  prevCategoryId,
  prevEnrichment: {
    lending: null,
    category_suggestion: 'groceries',
    service_identity: null,
    budget_excluded: false,
    model: 'claude-fable-5',
    enriched_at: '2026-07-13T16:12:34.502Z',
    note_hash: 'abc',
  },
});

beforeEach(() => clearUndo());

describe('undo stack', () => {
  it('returns the newest entry first', () => {
    pushUndo({ mode: 'apply', toName: 'Groceries', items: [item('t1', 'c-shop')] });
    pushUndo({ mode: 'dismiss', toName: null, items: [item('t2', 'c-shop')] });
    expect(getUndoEntries().map((e) => e.mode)).toEqual(['dismiss', 'apply']);
  });

  it('hands back an id that finds the entry again', () => {
    const id = pushUndo({ mode: 'apply', toName: 'Cat', items: [item('t1', null)] });
    expect(getUndoEntries().find((e) => e.id === id)?.toName).toBe('Cat');
  });

  it('keeps a stable reference between changes', () => {
    // useSyncExternalStore re-renders forever if getSnapshot returns a fresh
    // array each call.
    pushUndo({ mode: 'apply', toName: 'Groceries', items: [item('t1', 'c-shop')] });
    expect(getUndoEntries()).toBe(getUndoEntries());
  });

  it('changes reference when an entry is added', () => {
    const before = getUndoEntries();
    pushUndo({ mode: 'apply', toName: 'Groceries', items: [item('t1', 'c-shop')] });
    expect(getUndoEntries()).not.toBe(before);
  });

  it('drops one entry and leaves the rest', () => {
    const a = pushUndo({ mode: 'apply', toName: 'A', items: [item('t1', 'c1')] });
    pushUndo({ mode: 'apply', toName: 'B', items: [item('t2', 'c1')] });
    dropUndo(a);
    expect(getUndoEntries().map((e) => e.toName)).toEqual(['B']);
  });

  it('ignores dropping an id that is not there, without notifying', () => {
    let calls = 0;
    const unsub = subscribeUndo(() => calls++);
    dropUndo('undo-does-not-exist');
    unsub();
    expect(calls).toBe(0);
  });

  it('forgets the oldest past the limit', () => {
    for (let i = 0; i < 15; i++) {
      pushUndo({ mode: 'apply', toName: `c${i}`, items: [item(`t${i}`, 'c1')] });
    }
    const entries = getUndoEntries();
    expect(entries).toHaveLength(12);
    expect(entries[0].toName).toBe('c14');
    expect(entries[11].toName).toBe('c3');
  });

  it('notifies subscribers on push and clear', () => {
    let calls = 0;
    const unsub = subscribeUndo(() => calls++);
    pushUndo({ mode: 'apply', toName: 'A', items: [item('t1', 'c1')] });
    clearUndo();
    unsub();
    expect(calls).toBe(2);
  });

  it('stops notifying after unsubscribe', () => {
    let calls = 0;
    subscribeUndo(() => calls++)();
    pushUndo({ mode: 'apply', toName: 'A', items: [item('t1', 'c1')] });
    expect(calls).toBe(0);
  });
});

describe('describeUndo', () => {
  it('names the destination for an apply', () => {
    const id = pushUndo({
      mode: 'apply',
      toName: 'Groceries',
      items: [item('t1', 'c1'), item('t2', 'c1')],
    });
    expect(describeUndo(getUndoEntries().find((e) => e.id === id)!)).toBe(
      'Moved 2 to Groceries',
    );
  });

  it('pluralises a dismissal', () => {
    const one = pushUndo({ mode: 'dismiss', toName: null, items: [item('t1', 'c1')] });
    expect(describeUndo(getUndoEntries().find((e) => e.id === one)!)).toBe(
      'Dismissed 1 suggestion',
    );
    const two = pushUndo({
      mode: 'dismiss',
      toName: null,
      items: [item('t1', 'c1'), item('t2', 'c1')],
    });
    expect(describeUndo(getUndoEntries().find((e) => e.id === two)!)).toBe(
      'Dismissed 2 suggestions',
    );
  });
});

describe('groupByPrevCategory', () => {
  it('groups transactions by the category to restore', () => {
    const groups = groupByPrevCategory([
      item('t1', 'c-shop'),
      item('t2', 'c-shop'),
      item('t3', 'c-health'),
    ]);
    expect(groups.get('c-shop')).toEqual(['t1', 't2']);
    expect(groups.get('c-health')).toEqual(['t3']);
  });

  it('keeps an uncategorised restore separate under null', () => {
    const groups = groupByPrevCategory([item('t1', null), item('t2', 'c-shop')]);
    expect(groups.get(null)).toEqual(['t1']);
    expect(groups.size).toBe(2);
  });
});
