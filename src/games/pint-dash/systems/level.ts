/**
 * Level format and parser. Pure data, no Phaser imports, so it is unit-testable in Node.
 *
 * A level says what is in each cell (ground, a girder, a crate, a lamp post), not which
 * picture to draw: that is the theme's job. `LevelData` deliberately mirrors what a Tiled
 * map provides, so swapping the text grid for Tiled JSON only touches the loader.
 *
 * A level is written as text grids: one string per row, one character per tile. Levels
 * are data in a theme's description file (see `levels/levels.ts`), which cannot hold
 * comments, so the legend is here:
 *
 *   .  empty                 P  player spawn (exactly one)
 *   #  ground                E  rolling keg          F  a faster keg
 *   =  one-way platform      o  pint                 +  heart: gives back a lost life
 *   H  hanging deck (solid)  G  the pub door (exactly one); the pub is built around it
 *   B  brick block (solid)   >  arrow sign: a checkpoint. After passing one, the player
 *   C  crate (solid)            comes back to it on losing a life
 *                            N  notice board. What each one says is in the section's
 *                               `notices`, in order from the left: at most 3 lines of 7
 *
 * Street furniture (drawn, never collides). Tall pieces need the cell above empty:
 *   L  lamp post (2 tall)    s  street sign (2 tall)   !  warning sign (2 tall)
 *   b  barrel                r  road barrier           f  fence          ,  weeds
 *   M  the theme's landmark  D  a building front. Both are big: leave room around them
 *
 * Objects and scenery stand on the bottom of their cell. Ground, platforms and decks
 * pick their edge pieces automatically.
 */

/** Things that fill a cell and can be stood on. */
export type CellKind = 'ground' | 'oneWay' | 'deck' | 'brick' | 'crate';

/** Scenery: drawn, never collides. */
export type DecorKind =
  | 'weeds'
  | 'fence'
  | 'arrowSign'
  | 'barrel'
  | 'roadBarrier'
  | 'warningSign'
  | 'streetSign'
  | 'lampPost'
  /** A big set piece that belongs to the theme: a statue, a fountain. */
  | 'landmark'
  /** A building front along the street, other than the goal. */
  | 'building';

export type LevelObjectType =
  | 'player'
  | 'enemy'
  /** A keg that rolls faster. */
  | 'fastEnemy'
  | 'coin'
  /** A heart: gives back a lost life. */
  | 'life'
  /** Where the player comes back after losing a life, once they have passed it. */
  | 'checkpoint'
  /** A board with a short message written on it. */
  | 'notice'
  | 'goal';

export interface DecorItem {
  kind: DecorKind;
  /** The cell it stands in. */
  column: number;
  row: number;
}

export interface LevelObject {
  type: LevelObjectType;
  /** Pixel position of the bottom-centre of the object's cell (where its feet go). */
  x: number;
  y: number;
  /** For a notice: what is written on it. Lines are separated by `\n`. */
  text?: string;
}

export interface LevelData {
  /** Size in tiles. */
  width: number;
  height: number;
  tileSize: number;
  /** `cells[row][column]`; null is empty. */
  cells: (CellKind | null)[][];
  decor: DecorItem[];
  objects: LevelObject[];
}

/** One-way cells only stop things falling onto them; every other kind is solid all round. */
export function isSolid(kind: CellKind | null): boolean {
  return kind !== null && kind !== 'oneWay';
}

const CELL_SYMBOLS: Record<string, CellKind> = {
  '#': 'ground',
  '=': 'oneWay',
  H: 'deck',
  B: 'brick',
  C: 'crate',
};

const OBJECT_SYMBOLS: Record<string, LevelObjectType> = {
  P: 'player',
  E: 'enemy',
  F: 'fastEnemy',
  o: 'coin',
  '+': 'life',
  G: 'goal',
};

/** An arrow sign is scenery and a checkpoint at once. */
const CHECKPOINT_SYMBOL = '>';

/** A notice board. What each one says is given alongside the grid, in order from the left. */
const NOTICE_SYMBOL = 'N';

/**
 * How much fits on a notice board: every theme's board has room for this much of the
 * pixel font at its smallest size.
 */
export const NOTICE_LIMITS = { lines: 3, lineLength: 7 } as const;

/** Throws unless a notice's text fits a board and uses only characters the font has. */
function checkNotice(text: string): void {
  const lines = text.split('\n');
  const tooLong = lines.find((line) => line.length > NOTICE_LIMITS.lineLength);
  if (lines.length > NOTICE_LIMITS.lines || tooLong !== undefined) {
    throw new Error(
      `Notice ${JSON.stringify(text)} does not fit: at most ${NOTICE_LIMITS.lines} lines ` +
        `of ${NOTICE_LIMITS.lineLength} characters.`,
    );
  }
  if (!/^[ -~\n]+$/.test(text)) {
    throw new Error(
      `Notice ${JSON.stringify(text)} uses a character the pixel font does not have.`,
    );
  }
}

const DECOR_SYMBOLS: Record<string, DecorKind> = {
  ',': 'weeds',
  f: 'fence',
  '>': 'arrowSign',
  b: 'barrel',
  r: 'roadBarrier',
  '!': 'warningSign',
  s: 'streetSign',
  L: 'lampPost',
  M: 'landmark',
  D: 'building',
};

/** How many cells tall each piece of scenery is. Tall ones need empty cells above them. */
export const DECOR_HEIGHT: Record<DecorKind, number> = {
  weeds: 1,
  fence: 1,
  arrowSign: 1,
  barrel: 1,
  roadBarrier: 1,
  warningSign: 2,
  streetSign: 2,
  lampPost: 2,
  // Set pieces are as big as the theme draws them, so no room is reserved for them.
  landmark: 1,
  building: 1,
};

const EMPTY_SYMBOL = '.';

/** A stretch of a level, as a text grid. A long level is written as sections laid end to end. */
export interface LevelSection {
  /** Shown on the banner when the player reaches the section. */
  name: string;
  /** What the section is for. For whoever edits the level; the game does not use it. */
  note?: string;
  rows: readonly string[];
  /** What the section's notice boards (`N`) say, in order from the left. */
  notices?: readonly string[];
}

/** A whole level as data: what a theme's description file holds under "level". */
export interface LevelDefinition {
  sections: readonly LevelSection[];
}

/**
 * Joins sections left to right into one grid for `parseLevel`. Throws if a section's rows
 * are not all the same width, or the sections are not all the same height.
 */
export function joinSections(sections: readonly LevelSection[]): string[] {
  const height = sections[0]?.rows.length ?? 0;
  for (const { name, rows } of sections) {
    if (rows.length !== height) {
      throw new Error(`Section "${name}" is ${rows.length} rows tall, expected ${height}.`);
    }
    rows.forEach((row, index) => {
      if (row.length !== rows[0].length) {
        throw new Error(
          `Section "${name}" row ${index} is ${row.length} tiles wide, expected ${rows[0].length}.`,
        );
      }
    });
  }
  return Array.from({ length: height }, (_, row) =>
    sections.map((section) => section.rows[row]).join(''),
  );
}

/** The notices of every section, in the order their boards appear in the joined level. */
export function joinNotices(sections: readonly LevelSection[]): string[] {
  return sections.flatMap((section) => section.notices ?? []);
}

/** Joins a level's sections and parses the result. */
export function parseSections(sections: readonly LevelSection[], tileSize: number): LevelData {
  return parseLevel(joinSections(sections), tileSize, joinNotices(sections));
}

/** The column each section starts at in the joined level. */
export function sectionStarts(
  sections: readonly LevelSection[],
): Array<{ name: string; column: number }> {
  let column = 0;
  return sections.map(({ name, rows }) => {
    const start = { name, column };
    column += rows[0].length;
    return start;
  });
}

/**
 * Turns a text grid (one string per row, one character per tile) into `LevelData`.
 * `notices` is what the notice boards (`N`) say, in order from the left. Throws on ragged
 * rows, unknown characters, scenery with no room, a missing/duplicated player or goal,
 * or notices that do not match the boards or do not fit on one.
 */
export function parseLevel(
  rows: readonly string[],
  tileSize: number,
  notices: readonly string[] = [],
): LevelData {
  if (rows.length === 0 || rows[0].length === 0) {
    throw new Error('Level is empty.');
  }

  const width = rows[0].length;
  /** The bottom-centre of a cell, in pixels: where something standing in it has its feet. */
  const feet = (column: number, row: number) => ({
    x: column * tileSize + tileSize / 2,
    y: (row + 1) * tileSize,
  });
  const cells: (CellKind | null)[][] = [];
  const decor: DecorItem[] = [];
  const objects: LevelObject[] = [];
  const boards: LevelObject[] = [];

  rows.forEach((row, rowIndex) => {
    if (row.length !== width) {
      throw new Error(`Level row ${rowIndex} is ${row.length} tiles wide, expected ${width}.`);
    }

    const cellRow: (CellKind | null)[] = [];
    for (let column = 0; column < width; column++) {
      const symbol = row[column];
      cellRow.push(CELL_SYMBOLS[symbol] ?? null);

      if (symbol in DECOR_SYMBOLS) {
        const kind = DECOR_SYMBOLS[symbol];
        for (let level = 1; level < DECOR_HEIGHT[kind]; level++) {
          const above = rows[rowIndex - level]?.[column];
          if (above !== EMPTY_SYMBOL && !(above !== undefined && above in OBJECT_SYMBOLS)) {
            throw new Error(
              `No room above "${symbol}" at row ${rowIndex}, column ${column}: ` +
                `it is ${DECOR_HEIGHT[kind]} tiles tall.`,
            );
          }
        }
        decor.push({ kind, column, row: rowIndex });
        if (symbol === CHECKPOINT_SYMBOL) {
          objects.push({ type: 'checkpoint', ...feet(column, rowIndex) });
        }
      } else if (symbol === NOTICE_SYMBOL) {
        boards.push({ type: 'notice', ...feet(column, rowIndex) });
      } else if (symbol in OBJECT_SYMBOLS) {
        objects.push({ type: OBJECT_SYMBOLS[symbol], ...feet(column, rowIndex) });
      } else if (symbol !== EMPTY_SYMBOL && !(symbol in CELL_SYMBOLS)) {
        throw new Error(`Unknown level symbol "${symbol}" at row ${rowIndex}, column ${column}.`);
      }
    }
    cells.push(cellRow);
  });

  for (const required of ['player', 'goal'] as const) {
    const count = objects.filter((object) => object.type === required).length;
    if (count !== 1) {
      throw new Error(`Level needs exactly one ${required}, found ${count}.`);
    }
  }

  // The grid is read top row first, but the notices are listed as a player meets them.
  if (boards.length !== notices.length) {
    throw new Error(`Level has ${boards.length} notice boards but ${notices.length} notices.`);
  }
  boards.sort((a, b) => a.x - b.x);
  boards.forEach((board, index) => {
    checkNotice(notices[index]);
    objects.push({ ...board, text: notices[index] });
  });

  return { width, height: rows.length, tileSize, cells, decor, objects };
}
