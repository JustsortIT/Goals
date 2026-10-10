/**
 * Where things are in the Kenney art (see public/assets/CREDITS.md). This file is the
 * only place that knows tile and frame numbers; it has no Phaser imports so pure code
 * can use it.
 *
 * The level draws from several Kenney "Pixel Platformer" sheets. At boot they are
 * stacked into one tile atlas (`textures.ts`), 20 tiles wide, each
 * sheet starting on its own row. The helpers below take a frame number as counted in
 * the original sheet (left to right, top to bottom, from 0) and return its number in
 * that atlas.
 */

import type { DecorKind } from '../../systems/level';

export const ATLAS_COLUMNS = 20;

export interface SheetLayout {
  /** Row of the atlas this sheet starts on. */
  firstRow: number;
  /** Size of the sheet itself, in tiles. */
  columns: number;
  rows: number;
}

export const SHEETS = {
  base: { firstRow: 0, columns: 20, rows: 9 },
  industrial: { firstRow: 9, columns: 16, rows: 7 },
  food: { firstRow: 16, columns: 16, rows: 7 },
  bricks: { firstRow: 23, columns: 9, rows: 9 },
  /** One row of tiles drawn in code, in the same style. */
  custom: { firstRow: 32, columns: ATLAS_COLUMNS, rows: 1 },
} as const satisfies Record<string, SheetLayout>;

export const ATLAS_ROWS = SHEETS.custom.firstRow + SHEETS.custom.rows;

const from = (sheet: SheetLayout) => (frame: number) =>
  (sheet.firstRow + Math.floor(frame / sheet.columns)) * ATLAS_COLUMNS + (frame % sheet.columns);

const base = from(SHEETS.base);
const industrial = from(SHEETS.industrial);
const bricks = from(SHEETS.bricks);
const custom = from(SHEETS.custom);

/**
 * A run of same-kind tiles picks its piece by position in the run:
 * [alone, left end, middle, right end].
 */
export type RunPieces = readonly [alone: number, left: number, middle: number, right: number];

const run = (sheet: (frame: number) => number, pieces: RunPieces): RunPieces => [
  sheet(pieces[0]),
  sheet(pieces[1]),
  sheet(pieces[2]),
  sheet(pieces[3]),
];

/** Paved ground: a stone slab over earth. */
export const TERRAIN_TILES = {
  /** One tile thick: slab on top and an edge underneath. */
  thin: run(industrial, [0, 1, 2, 3]),
  /** Paved surface with more ground below it. */
  top: run(industrial, [16, 17, 18, 19]),
  /** Earth with ground both above and below. */
  middle: run(industrial, [32, 33, 34, 35]),
  /** Earth with ground above and open air below. */
  bottom: run(industrial, [48, 49, 50, 51]),
} as const;

/** Steel girders, used for one-way platforms. There is no stand-alone piece. */
export const ONE_WAY_TILES = run(industrial, [5, 4, 5, 6]);

/** A solid striped deck, for platforms that hang in mid-air. */
export const DECK_TILES = run(industrial, [88, 87, 88, 90]);

/** Solid single blocks. */
export const BLOCK_TILES = {
  brick: bricks(17),
  crate: base(26),
} as const;

/** Scenery that is drawn but never collides. Listed bottom tile first. */
export const DECOR_TILES = {
  weeds: [base(124)],
  fence: [base(106)],
  arrowSign: [base(88)],
  barrel: [industrial(9)],
  roadBarrier: [industrial(41)],
  warningSign: [industrial(58), industrial(42)],
  streetSign: [industrial(74), industrial(73)],
  lampPost: [custom(0), custom(1)],
  // The pack has nothing for the big set pieces, so this theme leaves them out.
  landmark: [],
  building: [],
} as const satisfies Record<DecorKind, readonly number[]>;

/** Sprites and building parts that live in the tile atlas. */
export const TileFrame = {
  HeartFull: base(44),
  HeartEmpty: base(46),
  DoorTop: base(130),
  DoorBottom: base(150),
  Keg: industrial(10),
  BrickWall: bricks(26),
  BrickCap: bricks(17),
  Window: custom(2),
  SignLeft: custom(3),
  SignMiddle: custom(4),
  SignRight: custom(5),
  Pint: custom(6),
} as const;

/** Positions in the custom row, for the code that draws it. */
export const CustomTile = {
  LampPost: 0,
  LampHead: 1,
  Window: 2,
  SignLeft: 3,
  SignMiddle: 4,
  SignRight: 5,
  Pint: 6,
} as const;

/** Source frames in the original sheets that custom art is derived from. */
export const SourceFrame = {
  /** Food sheet: the white mug the pint is recoloured from. */
  Mug: 89,
  /** Character sheet: the hero, standing and stepping, still wearing a helmet. */
  HeroStand: 9,
  HeroStep: 10,
} as const;

/** Frame size of the character sheet, in pixels. Tiles are `TILE_SIZE`. */
export const CHARACTER_SIZE = 24;

/** Frames of the hero texture built at boot (the pack's hero with the helmet removed). */
export const HeroFrame = {
  Stand: 0,
  Step: 1,
} as const;
