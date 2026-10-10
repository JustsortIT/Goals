import { describe, expect, it } from 'vitest';
import {
  isSolid,
  joinNotices,
  joinSections,
  parseLevel,
  parseSections,
  sectionStarts,
} from './level';

const TILE = 18;

describe('parseLevel', () => {
  it('reports the grid size', () => {
    const level = parseLevel(['P..G', '....', '....'], TILE);
    expect(level.width).toBe(4);
    expect(level.height).toBe(3);
    expect(level.tileSize).toBe(TILE);
  });

  it('says what fills each cell', () => {
    const level = parseLevel(['P...G', '#=HBC'], TILE);
    expect(level.cells).toEqual([
      [null, null, null, null, null],
      ['ground', 'oneWay', 'deck', 'brick', 'crate'],
    ]);
  });

  it('counts everything but one-way cells as solid', () => {
    expect(['ground', 'deck', 'brick', 'crate'].every((kind) => isSolid(kind as 'ground'))).toBe(
      true,
    );
    expect(isSolid('oneWay')).toBe(false);
    expect(isSolid(null)).toBe(false);
  });

  it('lists scenery by the cell it stands in, and leaves that cell empty', () => {
    const level = parseLevel(['....', 'PbLG', '####'], TILE);
    expect(level.decor).toEqual([
      { kind: 'barrel', column: 1, row: 1 },
      { kind: 'lampPost', column: 2, row: 1 },
    ]);
    expect(level.cells[1]).toEqual([null, null, null, null]);
  });

  it('rejects tall scenery with no room above it', () => {
    expect(() => parseLevel(['.#..', 'PL.G', '####'], TILE)).toThrow(/No room above "L"/);
    expect(() => parseLevel(['PL.G', '####'], TILE)).toThrow(/No room above "L"/);
  });

  it('lets an object share the space above tall scenery', () => {
    expect(() => parseLevel(['.o..', 'PL.G', '####'], TILE)).not.toThrow();
  });

  it('places objects at the bottom-centre of their cell and leaves the cell empty', () => {
    const level = parseLevel(['....', 'PoEG', '####'], TILE);

    expect(level.objects).toEqual([
      { type: 'player', x: 9, y: 36 },
      { type: 'coin', x: 27, y: 36 },
      { type: 'enemy', x: 45, y: 36 },
      { type: 'goal', x: 63, y: 36 },
    ]);
    expect(level.cells[1]).toEqual([null, null, null, null]);
  });

  it('scales object positions with the tile size', () => {
    const level = parseLevel(['PG', '##'], 16);
    expect(level.objects[1]).toEqual({ type: 'goal', x: 24, y: 16 });
  });

  it('rejects ragged rows', () => {
    expect(() => parseLevel(['P.G', '##'], TILE)).toThrow(/row 1 is 2 tiles wide, expected 3/);
  });

  it('rejects unknown symbols', () => {
    expect(() => parseLevel(['P?G'], TILE)).toThrow(/Unknown level symbol "\?" at row 0, column 1/);
  });

  it('requires exactly one player and one goal', () => {
    expect(() => parseLevel(['..G'], TILE)).toThrow(/exactly one player, found 0/);
    expect(() => parseLevel(['PPG'], TILE)).toThrow(/exactly one player, found 2/);
    expect(() => parseLevel(['P..'], TILE)).toThrow(/exactly one goal, found 0/);
  });

  it('rejects an empty level', () => {
    expect(() => parseLevel([], TILE)).toThrow(/empty/);
  });
});

describe('joinSections', () => {
  it('lays sections end to end, row by row', () => {
    const joined = joinSections([
      { name: 'a', rows: ['P.', '##'] },
      { name: 'b', rows: ['.G.', '###'] },
    ]);
    expect(joined).toEqual(['P..G.', '#####']);
  });

  it('rejects a section with a ragged row, naming it', () => {
    expect(() =>
      joinSections([
        { name: 'a', rows: ['P.', '##'] },
        { name: 'pub', rows: ['.G.', '##'] },
      ]),
    ).toThrow(/Section "pub" row 1 is 2 tiles wide, expected 3/);
  });

  it('rejects sections of different heights', () => {
    expect(() =>
      joinSections([
        { name: 'a', rows: ['P.', '##'] },
        { name: 'tall', rows: ['..', '.G', '##'] },
      ]),
    ).toThrow(/Section "tall" is 3 rows tall, expected 2/);
  });
});

describe('parseLevel: checkpoints, hearts and fast kegs', () => {
  it('makes an arrow sign both scenery and a checkpoint', () => {
    const level = parseLevel(['P>.G', '####'], TILE);
    expect(level.decor).toEqual([{ kind: 'arrowSign', column: 1, row: 0 }]);
    expect(level.objects).toContainEqual({ type: 'checkpoint', x: 27, y: 18 });
  });

  it('reads hearts and fast kegs as objects', () => {
    const level = parseLevel(['P+FG', '####'], TILE);
    expect(level.objects.map((object) => object.type)).toEqual([
      'player',
      'life',
      'fastEnemy',
      'goal',
    ]);
  });
});

describe('parseLevel: notice boards', () => {
  it('gives each board its words, in order from the left whatever row it is on', () => {
    const level = parseLevel(['...N.', 'PN..G', '#####'], TILE, ['FIRST', 'SECOND']);
    expect(level.objects.filter((object) => object.type === 'notice')).toEqual([
      { type: 'notice', x: 27, y: 36, text: 'FIRST' },
      { type: 'notice', x: 63, y: 18, text: 'SECOND' },
    ]);
  });

  it('leaves the cell of a board empty: it does not collide', () => {
    expect(parseLevel(['PN.G', '####'], TILE, ['HELLO']).cells[0]).toEqual([
      null,
      null,
      null,
      null,
    ]);
  });

  it('rejects a level whose boards and notices do not match up', () => {
    expect(() => parseLevel(['PN.G', '####'], TILE)).toThrow(/1 notice boards but 0 notices/);
    expect(() => parseLevel(['P..G', '####'], TILE, ['HELLO'])).toThrow(
      /0 notice boards but 1 notices/,
    );
  });

  it('rejects words that do not fit on a board', () => {
    expect(() => parseLevel(['PN.G', '####'], TILE, ['TOO LONG A LINE'])).toThrow(/does not fit/);
    expect(() => parseLevel(['PN.G', '####'], TILE, ['A\nB\nC\nD'])).toThrow(/does not fit/);
    expect(() => parseLevel(['PN.G', '####'], TILE, ['THREE\nLINES\nIS FINE'])).not.toThrow();
  });

  it('rejects characters the pixel font does not have', () => {
    expect(() => parseLevel(['PN.G', '####'], TILE, ['SLÁINTE'])).toThrow(/pixel font/);
  });
});

describe('parseLevel: set pieces', () => {
  it('reads a landmark and a building as scenery', () => {
    const level = parseLevel(['PM.DG', '#####'], TILE);
    expect(level.decor).toEqual([
      { kind: 'landmark', column: 1, row: 0 },
      { kind: 'building', column: 3, row: 0 },
    ]);
  });
});

describe('sections', () => {
  const sections = [
    { name: 'One', rows: ['PN.', '###'], notices: ['HELLO'] },
    { name: 'Two', rows: ['..', '##'] },
    { name: 'Three', rows: ['N.NG', '####'], notices: ['A', 'B'] },
  ];

  it('lists the notices in the order their boards come', () => {
    expect(joinNotices(sections)).toEqual(['HELLO', 'A', 'B']);
    expect(() => parseLevel(joinSections(sections), TILE, joinNotices(sections))).not.toThrow();
  });

  it('parses a level straight from its sections', () => {
    const level = parseSections(sections, TILE);
    expect(level.width).toBe(9);
    expect(level.objects.filter((object) => object.type === 'notice').map((n) => n.text)).toEqual([
      'HELLO',
      'A',
      'B',
    ]);
  });

  it('says which column each section starts at', () => {
    expect(sectionStarts(sections)).toEqual([
      { name: 'One', column: 0 },
      { name: 'Two', column: 3 },
      { name: 'Three', column: 5 },
    ]);
  });
});
