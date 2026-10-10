import { describe, expect, it } from 'vitest';
import { parseLevel } from './level';
import { analyseReach, GAME_TUNING, playMove, weakened, type Move } from './reach';

const TILE = 16;
const HEIGHT = 14;
/** The first ground row. The player stands in the row above it. */
const GROUND = 11;

/**
 * Two stretches of ground with a gap between, the right one `rise` tiles higher. The
 * player starts on the left and the goal is on the right.
 */
function street(gap: number, rise = 0): string[] {
  const left = 8;
  const width = left + gap + 8;
  return Array.from({ length: HEIGHT }, (_, row) =>
    Array.from({ length: width }, (_, column) => {
      const onRight = column >= left + gap;
      const top = onRight ? GROUND - rise : GROUND;
      if ((column < left || onRight) && row >= top) return '#';
      if (row === GROUND - 1 && column === 1) return 'P';
      if (onRight && row === top - 1 && column === width - 2) return 'G';
      return '.';
    }).join(''),
  );
}

/** Whether the goal of a level can be reached, and how quickly. */
function timeToGoal(rows: string[], strength = 1): number | null {
  const level = parseLevel(rows, TILE);
  const goal = level.objects.find((object) => object.type === 'goal')!;
  const reach = analyseReach(level, weakened(GAME_TUNING, strength));
  return reach.timeTo(Math.floor(goal.x / TILE), goal.y / TILE - 1);
}

describe('playMove', () => {
  const flat = parseLevel(street(0), TILE);
  const from = { column: 3, row: GROUND - 1 };
  const jump = (overrides: Partial<Move>): Move => ({
    direction: 1,
    takeoff: 'jump',
    jumpFrames: 60,
    steerFrames: 300,
    ...overrides,
  });

  // These distances were measured in the real game, in a browser, with the same moves.
  it('matches the game: a full standing jump travels 4.97 tiles', () => {
    expect(playMove(flat, from, jump({}))!.x - 3.5).toBeCloseTo(4.969, 2);
  });

  it('matches the game: a tapped jump travels 2.59 tiles', () => {
    expect(playMove(flat, from, jump({ jumpFrames: 2 }))!.x - 3.5).toBeCloseTo(2.594, 2);
  });

  it('matches the game: letting go of the direction early shortens the jump to 3.01 tiles', () => {
    expect(playMove(flat, from, jump({ steerFrames: 12 }))!.x - 3.5).toBeCloseTo(3.007, 2);
  });

  it('goes further from a run than from a standstill', () => {
    const standing = playMove(flat, from, jump({}))!;
    const running = playMove(flat, from, jump({ takeoff: 'runningJump' }))!;
    expect(running.x).toBeGreaterThan(standing.x + 1);
  });

  it('ends on the ground, in the cell the player came to rest in', () => {
    const result = playMove(flat, from, jump({}))!;
    expect(result.row).toBe(GROUND - 1);
    expect(result.column).toBe(Math.floor(result.x));
  });

  it('gives nothing for a move that goes nowhere or ends in a fall', () => {
    // Walking on flat ground never leaves the ground, so it is not a move.
    expect(playMove(flat, from, jump({ takeoff: 'walkOff' }))).toBeNull();
    const pit = parseLevel(street(12), TILE);
    expect(
      playMove(pit, { column: 7, row: GROUND - 1 }, jump({ takeoff: 'runningJump' })),
    ).toBeNull();
  });
});

describe('analyseReach', () => {
  it('walks along flat ground at run speed', () => {
    // From column 1 to column 14 is 13 tiles at 7.5 tiles a second.
    expect(timeToGoal(street(0))).toBeCloseTo(13 / 7.5, 1);
  });

  it('crosses a gap of 5 tiles and no more', () => {
    expect(timeToGoal(street(5))).not.toBeNull();
    expect(timeToGoal(street(6))).toBeNull();
  });

  it('climbs 3 tiles and no more', () => {
    expect(timeToGoal(street(0, 3))).not.toBeNull();
    expect(timeToGoal(street(0, 4))).toBeNull();
  });

  it('crosses a narrower gap when it also has to climb', () => {
    expect(timeToGoal(street(4, 2))).not.toBeNull();
    expect(timeToGoal(street(5, 2))).toBeNull();
  });

  it('reaches less with a weaker player', () => {
    expect(timeToGoal(street(4), 0.9)).not.toBeNull();
    expect(timeToGoal(street(5), 0.9)).toBeNull();
    expect(timeToGoal(street(0, 2), 0.9)).not.toBeNull();
    expect(timeToGoal(street(0, 3), 0.9)).toBeNull();
  });

  it('jumps up through a one-way platform, but not through a solid deck', () => {
    // The goal is on a platform three tiles above where the player stands.
    const under = (platform: string) => [
      '........',
      '........',
      '...G....',
      platform,
      '........',
      '.P......',
      '########',
    ];
    expect(timeToGoal(under('..===...'))).not.toBeNull();
    // The deck spans the whole level, so there is no way round it either.
    expect(timeToGoal(under('HHHHHHHH'))).toBeNull();
  });

  it('gets onto a solid deck from the side', () => {
    expect(
      timeToGoal([
        '..........',
        '.....G....',
        '...HHHH...',
        '..........',
        '.P........',
        '##########',
      ]),
    ).not.toBeNull();
  });

  it('does not count a route that ends in a fall', () => {
    expect(timeToGoal(['P.........................G', '###.....................###'])).toBeNull();
  });

  it('gives the route as steps that join up, from the spawn point to the cell', () => {
    const level = parseLevel(street(3), TILE);
    const goal = level.objects.find((object) => object.type === 'goal')!;
    const route = analyseReach(level).routeTo(Math.floor(goal.x / TILE), goal.y / TILE - 1)!;

    expect(route[0].from).toEqual({ column: 1, row: GROUND - 1 });
    expect(route.at(-1)!.to).toEqual({ column: 17, row: GROUND - 1 });
    route.slice(1).forEach((step, index) => expect(step.from).toEqual(route[index].to));
    // Walking, apart from one jump over the gap.
    expect(route.filter((step) => step.move !== null)).toHaveLength(1);
    expect(analyseReach(parseLevel(street(9), TILE)).routeTo(17, GROUND - 1)).toBeNull();
  });

  it('says which pickups can be touched', () => {
    const level = parseLevel(
      [
        '...o.....',
        '.........',
        '.........',
        '.........',
        '.........',
        '.....o...',
        '.........',
        '.P.o...G.',
        '#########',
      ],
      TILE,
    );
    const reach = analyseReach(level);
    expect(reach.touches(3, 7)).toBe(true); // on the ground, walked through
    expect(reach.touches(5, 5)).toBe(true); // two tiles up, jumped through
    expect(reach.touches(3, 0)).toBe(false); // seven tiles up, out of reach
    expect(reach.touches(6, 7)).toBe(false); // nothing there
  });
});
