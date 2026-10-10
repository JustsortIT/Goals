/**
 * Corner tiles, as used by generated tilesets. Pure, no Phaser imports.
 *
 * A generated tileset does not have "a ground tile". It has sixteen pieces, one for
 * every combination of its four corners being solid or empty. Each piece is drawn
 * centred on the point where four level cells meet, and is chosen by which of those
 * four cells are filled. So the picture is a grid shifted half a tile from the level
 * grid, one row and one column bigger.
 */

/** A piece's code: which of its corners are solid. */
export const Corner = { NorthWest: 1, NorthEast: 2, SouthWest: 4, SouthEast: 8 } as const;

/**
 * The corner code for every meeting point of a grid of `rows` by `columns` cells.
 * `isFilled` may be asked about cells outside the grid. 0 means nothing to draw.
 */
export function cornerCodes(
  rows: number,
  columns: number,
  isFilled: (row: number, column: number) => boolean,
): number[][] {
  const codes: number[][] = [];
  for (let row = 0; row <= rows; row++) {
    const codeRow: number[] = [];
    for (let column = 0; column <= columns; column++) {
      codeRow.push(
        (isFilled(row - 1, column - 1) ? Corner.NorthWest : 0) +
          (isFilled(row - 1, column) ? Corner.NorthEast : 0) +
          (isFilled(row, column - 1) ? Corner.SouthWest : 0) +
          (isFilled(row, column) ? Corner.SouthEast : 0),
      );
    }
    codes.push(codeRow);
  }
  return codes;
}
