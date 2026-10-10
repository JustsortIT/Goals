/**
 * Which tile of the Kenney atlas draws each cell of a level. Pure, no Phaser imports.
 *
 * Ground, girders and decks pick their piece from their neighbours, so edges get
 * outlines and surfaces get paving.
 */
import type { CellKind, LevelData } from '../../systems/level';
import {
  BLOCK_TILES,
  DECK_TILES,
  DECOR_TILES,
  ONE_WAY_TILES,
  TERRAIN_TILES,
  type RunPieces,
} from './frames';

/** Phaser's "no tile here". */
export const EMPTY_TILE = -1;

/** Picks the piece for one tile of a horizontal run from whether the run continues each side. */
function pickPiece(pieces: RunPieces, continuesLeft: boolean, continuesRight: boolean): number {
  if (continuesLeft && continuesRight) return pieces[2];
  if (continuesRight) return pieces[1];
  if (continuesLeft) return pieces[3];
  return pieces[0];
}

/** The tile for every cell: `tiles[row][column]`, the shape `make.tilemap({ data })` takes. */
export function levelTiles(level: LevelData): number[][] {
  /** Whether a cell holds `kind`. Cells outside the grid count as `outside`. */
  const holds = (kind: CellKind, row: number, column: number, outside: boolean) => {
    const found = level.cells[row]?.[column];
    return found === undefined ? outside : found === kind;
  };

  /** The piece for one tile of a horizontal run of `kind`. */
  const runTile = (pieces: RunPieces, kind: CellKind, row: number, column: number) =>
    pickPiece(pieces, holds(kind, row, column - 1, false), holds(kind, row, column + 1, false));

  /**
   * The level is treated as continuing past its sides and bottom, so no outline is drawn
   * along the edge of the world.
   */
  const terrainTile = (row: number, column: number) => {
    const ground = (r: number, c: number, outside: boolean) => holds('ground', r, c, outside);
    const above = ground(row - 1, column, false);
    const below = ground(row + 1, column, true);

    let pieces: RunPieces = TERRAIN_TILES.thin;
    if (above) pieces = below ? TERRAIN_TILES.middle : TERRAIN_TILES.bottom;
    else if (below) pieces = TERRAIN_TILES.top;

    return pickPiece(pieces, ground(row, column - 1, true), ground(row, column + 1, true));
  };

  return level.cells.map((cells, row) =>
    cells.map((kind, column) => {
      switch (kind) {
        case 'ground':
          return terrainTile(row, column);
        case 'oneWay':
          return runTile(ONE_WAY_TILES, kind, row, column);
        case 'deck':
          return runTile(DECK_TILES, kind, row, column);
        case 'brick':
        case 'crate':
          return BLOCK_TILES[kind];
        case null:
          return EMPTY_TILE;
      }
    }),
  );
}

/** Scenery in the same shape as `levelTiles`. Tall pieces stack upwards from their cell. */
export function decorTiles(level: LevelData): number[][] {
  const tiles = level.cells.map((cells) => cells.map(() => EMPTY_TILE));
  for (const { kind, column, row } of level.decor) {
    DECOR_TILES[kind].forEach((tile, height) => {
      tiles[row - height][column] = tile;
    });
  }
  return tiles;
}
