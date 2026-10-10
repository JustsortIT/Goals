import { describe, expect, it } from 'vitest';
import {
  isSolid,
  NOTICE_LIMITS,
  parseSections,
  sectionStarts,
  type LevelDefinition,
} from '../systems/level';
import { analyseReach, GAME_TUNING, weakened } from '../systems/reach';
import { DEFAULT_THEME } from '../themes/active';
import { LEVELS, levelFor } from './levels';

const TILE = 16;

/** A level parsed and played, with the helpers the tests below share. */
function study(definition: LevelDefinition) {
  const level = parseSections(definition.sections, TILE);
  const cellOf = (object: { x: number; y: number }) => ({
    column: Math.floor(object.x / TILE),
    row: object.y / TILE - 1,
  });
  const all = (type: string) => level.objects.filter((object) => object.type === type);
  return {
    level,
    cellOf,
    all,
    goal: cellOf(all('goal')[0]),
    // Playing a long level takes a second or two, so each is done once.
    reach: analyseReach(level),
    weakReach: analyseReach(level, weakened(GAME_TUNING, 0.9)),
  };
}

describe('levelFor', () => {
  it('finds the levels in the theme descriptions', () => {
    expect(Object.keys(LEVELS)).toContain(DEFAULT_THEME);
  });

  it('gives a theme its own level if it has one', () => {
    expect(levelFor(DEFAULT_THEME)).toBe(LEVELS[DEFAULT_THEME]);
  });

  it("gives a theme with no level of its own the default theme's", () => {
    // Kenney has no description file at all.
    expect(levelFor('kenney')).toBe(LEVELS[DEFAULT_THEME]);
    expect(levelFor('no-such-theme')).toBe(LEVELS[DEFAULT_THEME]);
  });
});

// Every level in every theme description has to be playable.
describe.each(Object.entries(LEVELS))('the level of the "%s" theme', (_theme, definition) => {
  const { level, cellOf, all, goal, reach, weakReach } = study(definition);

  it('is built from sections of the same height', () => {
    expect(level.width).toBe(
      definition.sections.reduce((sum, section) => sum + section.rows[0].length, 0),
    );
    expect(level.height).toBe(definition.sections[0].rows.length);
  });

  it('spawns the player and the goal on solid ground', () => {
    for (const type of ['player', 'goal']) {
      const { column, row } = cellOf(all(type)[0]);
      expect(isSolid(level.cells[row + 1][column])).toBe(true);
    }
  });

  it('stands scenery on something, in an empty cell', () => {
    for (const { column, row } of level.decor) {
      expect(level.cells[row][column]).toBeNull();
      expect(level.cells[row + 1][column]).not.toBeNull();
    }
  });

  it('has a checkpoint in every section', () => {
    for (const section of definition.sections) {
      expect(section.rows.join('').includes('>'), section.name).toBe(true);
    }
  });

  it('stands each notice board in the section its words belong to, and the words fit', () => {
    const starts = sectionStarts(definition.sections);
    const boards = all('notice');
    let next = 0;
    definition.sections.forEach((section, index) => {
      const end = starts[index + 1]?.column ?? level.width;
      for (const text of section.notices ?? []) {
        const board = boards[next++];
        expect(board.text).toBe(text);
        expect(cellOf(board).column).toBeGreaterThanOrEqual(starts[index].column);
        expect(cellOf(board).column).toBeLessThan(end);
        const lines = text.split('\n');
        expect(lines.length).toBeLessThanOrEqual(NOTICE_LIMITS.lines);
        expect(Math.max(...lines.map((line) => line.length))).toBeLessThanOrEqual(
          NOTICE_LIMITS.lineLength,
        );
      }
    });
    expect(next).toBe(boards.length);
  });

  it('can be finished', () => {
    expect(reach.timeTo(goal.column, goal.row)).not.toBeNull();
  });

  it('can be finished by a player who runs and jumps at nine tenths of full strength', () => {
    // So no jump on the way to the pub has to be perfect.
    expect(weakReach.timeTo(goal.column, goal.row)).not.toBeNull();
  });

  it('has every checkpoint on the way, in order', () => {
    const times = all('checkpoint').map((checkpoint) => {
      const { column, row } = cellOf(checkpoint);
      return weakReach.timeTo(column, row);
    });
    expect(times).not.toContain(null);
    expect(times).toEqual([...times].sort((a, b) => a! - b!));
  });

  it('has no pint or heart that cannot be collected', () => {
    const outOfReach = [...all('coin'), ...all('life')]
      .map(cellOf)
      .filter(({ column, row }) => !reach.touches(column, row))
      .map(({ column, row }) => `column ${column}, row ${row}`);
    expect(outOfReach).toEqual([]);
  });
});

// What is expected of the game's own level in particular.
describe('the default level', () => {
  const definition = levelFor(DEFAULT_THEME);
  const { level, cellOf, all, goal, reach } = study(definition);

  it('has everything the game can do in it', () => {
    expect(all('enemy').length).toBeGreaterThanOrEqual(1);
    expect(all('fastEnemy').length).toBeGreaterThanOrEqual(1);
    expect(all('coin').length).toBeGreaterThanOrEqual(1);
    expect(all('life').length).toBeGreaterThanOrEqual(1);
    expect(level.cells.flat()).toContain('oneWay');
    expect(all('notice').length).toBeGreaterThanOrEqual(definition.sections.length - 1);

    const scenery = level.decor.map((item) => item.kind);
    expect(scenery).toContain('landmark');
    expect(scenery).toContain('building');
  });

  it('takes about 45 seconds by the quickest route, which is about 90 for a person', () => {
    // The quickest route skips the pints and never hesitates. Playing it properly,
    // collecting and waiting for kegs, takes roughly twice as long.
    const quickest = reach.timeTo(goal.column, goal.row)!;
    expect(quickest).toBeGreaterThan(40);
    expect(quickest).toBeLessThan(52);
  });

  it('gets harder: the second half has more kegs and more to jump than the first', () => {
    const middle = level.width / 2;
    const kegs = [...all('enemy'), ...all('fastEnemy')].map((keg) => cellOf(keg).column);
    const fastKegs = all('fastEnemy').map((keg) => cellOf(keg).column);
    // A pit is a column with nothing in the bottom row.
    const pits = level.cells[level.height - 1]
      .map((cell, column) => (cell === null ? column : -1))
      .filter((column) => column >= 0);
    const inSecondHalf = (columns: number[]) => columns.filter((column) => column >= middle).length;

    expect(inSecondHalf(kegs)).toBeGreaterThan(kegs.length / 2);
    expect(inSecondHalf(fastKegs)).toBeGreaterThan(fastKegs.length / 2);
    expect(inSecondHalf(pits)).toBeGreaterThan(pits.length / 2);
  });
});
