import { describe, it, expect } from 'vitest';
import {
  groupByMove,
  indexCategories,
  resolveMove,
  type CategoryLookup,
} from '../suggestionMath';

const CATS: CategoryLookup[] = [
  { id: 'c-shop', slug: 'shopping', name: 'Shopping', icon: '🛍️' },
  { id: 'c-groc', slug: 'groceries', name: 'Groceries', icon: '🥦' },
  { id: 'c-cat', slug: 'cat', name: 'Cat', icon: '🐱' },
];
const index = indexCategories(CATS);

describe('resolveMove', () => {
  it('resolves a slug to the move it describes', () => {
    const move = resolveMove('c-shop', 'groceries', index);
    expect(move?.from?.name).toBe('Shopping');
    expect(move?.to.name).toBe('Groceries');
  });

  it('drops a suggestion naming the category it already sits in', () => {
    // Happens when the user files it by hand before opening the inbox.
    expect(resolveMove('c-groc', 'groceries', index)).toBeNull();
  });

  it('drops a slug no category answers to', () => {
    // The category was renamed or deleted after the agent wrote the suggestion.
    expect(resolveMove('c-shop', 'dining-out', index)).toBeNull();
  });

  it('treats an uncategorised transaction as a move from nothing', () => {
    const move = resolveMove(null, 'groceries', index);
    expect(move?.from).toBeNull();
    expect(move?.to.name).toBe('Groceries');
  });

  it('ignores case and surrounding whitespace on the slug', () => {
    expect(resolveMove('c-shop', '  GROCERIES \n', index)?.to.id).toBe('c-groc');
  });

  it('has nothing to say when there is no suggestion', () => {
    expect(resolveMove('c-shop', null, index)).toBeNull();
    expect(resolveMove('c-shop', '   ', index)).toBeNull();
  });
});

const item = (
  fromId: string | null,
  toId: string,
  amount: number,
  transactedAt: string,
) => {
  const from = fromId ? CATS.find((c) => c.id === fromId)! : null;
  const to = CATS.find((c) => c.id === toId)!;
  return {
    from: from ? { id: from.id, name: from.name, icon: from.icon } : null,
    to: { id: to.id, name: to.name, icon: to.icon },
    amount,
    transactedAt,
  };
};

describe('groupByMove', () => {
  it('collapses identical moves into one group', () => {
    const groups = groupByMove([
      item('c-shop', 'c-groc', 100, '2026-08-01'),
      item('c-shop', 'c-groc', 250, '2026-08-02'),
    ]);
    expect(groups).toHaveLength(1);
    expect(groups[0].items).toHaveLength(2);
    expect(groups[0].total).toBe(350);
  });

  it('keeps different destinations apart', () => {
    const groups = groupByMove([
      item('c-shop', 'c-groc', 100, '2026-08-01'),
      item('c-shop', 'c-cat', 100, '2026-08-01'),
    ]);
    expect(groups).toHaveLength(2);
  });

  it('does not merge an uncategorised source with a categorised one', () => {
    const groups = groupByMove([
      item(null, 'c-groc', 100, '2026-08-01'),
      item('c-shop', 'c-groc', 100, '2026-08-01'),
    ]);
    expect(groups).toHaveLength(2);
    expect(groups.map((g) => g.key).sort()).toEqual([
      'c-shop->c-groc',
      'none->c-groc',
    ]);
  });

  it('puts the biggest group first', () => {
    const groups = groupByMove([
      item('c-shop', 'c-cat', 9999, '2026-08-01'),
      item('c-shop', 'c-groc', 10, '2026-08-01'),
      item('c-shop', 'c-groc', 10, '2026-08-02'),
    ]);
    // Count wins over money: two small rows outrank one large one.
    expect(groups[0].key).toBe('c-shop->c-groc');
  });

  it('breaks a tie on count by money', () => {
    const groups = groupByMove([
      item('c-shop', 'c-groc', 10, '2026-08-01'),
      item('c-shop', 'c-cat', 500, '2026-08-01'),
    ]);
    expect(groups[0].key).toBe('c-shop->c-cat');
  });

  it('orders rows within a group newest first', () => {
    const groups = groupByMove([
      item('c-shop', 'c-groc', 10, '2026-08-01'),
      item('c-shop', 'c-groc', 10, '2026-08-20'),
      item('c-shop', 'c-groc', 10, '2026-08-10'),
    ]);
    expect(groups[0].items.map((i) => i.transactedAt)).toEqual([
      '2026-08-20',
      '2026-08-10',
      '2026-08-01',
    ]);
  });

  it('returns nothing for no input', () => {
    expect(groupByMove([])).toEqual([]);
  });
});
