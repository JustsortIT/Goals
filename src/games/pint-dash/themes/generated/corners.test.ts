import { describe, expect, it } from 'vitest';
import { Corner, cornerCodes } from './corners';

const { NorthWest: NW, NorthEast: NE, SouthWest: SW, SouthEast: SE } = Corner;

/** Turns rows of '#' and '.' into the lookup `cornerCodes` wants. */
const grid = (rows: string[]) => (row: number, column: number) => rows[row]?.[column] === '#';

describe('cornerCodes', () => {
  it('is one row and one column bigger than the level', () => {
    const codes = cornerCodes(2, 3, () => false);
    expect(codes.length).toBe(3);
    expect(codes[0].length).toBe(4);
    expect(codes.flat().every((code) => code === 0)).toBe(true);
  });

  it('surrounds a single filled cell with its four corner pieces', () => {
    expect(cornerCodes(1, 1, grid(['#']))).toEqual([
      [SE, SW],
      [NE, NW],
    ]);
  });

  it('uses edge pieces along a run and the full piece inside a block', () => {
    const codes = cornerCodes(2, 3, grid(['###', '###']));
    // Top edge: only the two southern corners are solid.
    expect(codes[0][1]).toBe(SW + SE);
    // Left edge: only the two eastern corners.
    expect(codes[1][0]).toBe(NE + SE);
    // Interior meeting point: all four.
    expect(codes[1][1]).toBe(NW + NE + SW + SE);
    // Bottom-right outer corner.
    expect(codes[2][3]).toBe(NW);
  });

  it('asks about cells outside the grid, so ground can continue past the edges', () => {
    const everywhereBelowRowZero = (row: number) => row >= 1;
    const codes = cornerCodes(2, 2, everywhereBelowRowZero);
    expect(codes[1]).toEqual([SW + SE, SW + SE, SW + SE]);
    expect(codes[2]).toEqual(Array(3).fill(NW + NE + SW + SE));
  });
});
