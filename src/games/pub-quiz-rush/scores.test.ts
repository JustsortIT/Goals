import { describe, expect, it } from 'vitest';
import { scoreRows } from './scores';

const board = (count: number) => ({
  entries: Array.from({ length: count }, (_, index) => ({
    rank: index + 1,
    initials: 'AAA',
    score: 1000 - index * 10,
    playId: index + 1,
  })),
  best: null,
});

describe('the scores shown', () => {
  it('are the best few, with the player marked', () => {
    const rows = scoreRows(board(10), 2, 5);
    expect(rows).toHaveLength(5);
    expect(rows.map((row) => row.mine)).toEqual([false, true, false, false, false]);
  });

  it('show a place lower down in the last row', () => {
    const rows = scoreRows(board(10), 8, 5);
    expect(rows).toHaveLength(5);
    expect(rows[4]).toMatchObject({ rank: 8, mine: true });
    expect(rows[3].rank).toBe(4);
  });

  it('are fewer when the board is short, and none with no board', () => {
    expect(scoreRows(board(3), null, 5)).toHaveLength(3);
    expect(scoreRows(null, 1, 5)).toEqual([]);
  });
});
