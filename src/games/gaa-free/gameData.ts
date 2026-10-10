/**
 * The game's content, apart from its code: what is different from one pub's game to the next.
 * In PubPixels this is what gets generated; the code never is. So anything a pub might want its
 * own (names, words, how many levels, how fast the goal goes back, where the targets are and
 * how big) belongs here and in `game.json`, not in the scenes. Pure: no Phaser imports.
 */
import { GOAL, WIND } from './config';

/** One target in the goal's mouth. */
export interface Target {
  name: string;
  /** Scored when it is hit, times the level. */
  points: number;
  /** As a number, 0xrrggbb. In `game.json` it is written "#rrggbb". */
  colour: number;
  /** In pixels, on the nearest goal. The farther the goal, the smaller it is. */
  radius: number;
  /** Where its middle is in the mouth: 0 to 1 from the left post, and from the crossbar down. */
  x: number;
  y: number;
}

/**
 * A target that is always moving, worth a lot: it goes round a figure of eight in the goal
 * mouth, so the player has to aim at where it will be when the ball arrives. One a goal.
 */
export interface Bonus {
  name: string;
  points: number;
  colour: number;
  radius: number;
  /** The middle of its path in the mouth, and how far it goes either side (shares of the mouth). */
  x: number;
  y: number;
  spanX: number;
  spanY: number;
  /** How long one round takes at the first goal, and how much quicker each goal is. */
  periodMs: number;
  speedUp: number;
}

/**
 * Wind that pushes the ball sideways while it flies. It blows mostly one way on a goal, the
 * way alternating from goal to goal, with gusts that can turn it, and is stronger on each
 * farther goal. There is none before `fromLevel`.
 */
export interface Wind {
  fromLevel: number;
  /** How far, in pixels, it pushes a ball over a whole flight on the first goal it blows on. */
  strength: number;
  /** How much more it pushes on each goal after that. */
  perLevel: number;
  /** How long a gust takes to come and go. */
  gustMs: number;
  /** 1 is a steady wind, 0 is gusts that blow either way as often. */
  steadiness: number;
}

export interface GameData {
  name: string;
  line: string;
  /** How many goals to clear to win. */
  levels: number;
  /** How much smaller the goal is each level, as a share of the nearest goal. */
  shrink: number;
  targets: Target[];
  /** Null for a game with no bonus target. */
  bonus: Bonus | null;
  /** Null for a game with no wind. */
  wind: Wind | null;
}

/** The pixel font has only plain keyboard characters. */
const PLAIN = /^[ -~]*$/;
const COLOUR = /^#[0-9a-f]{6}$/i;
/** Targets are kept this far apart, in pixels, so each is a clear thing to aim at. */
const GAP = 2;

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;
const isCount = (value: unknown): value is number =>
  Number.isInteger(value) && (value as number) > 0;
const isFraction = (value: unknown): value is number =>
  typeof value === 'number' && value >= 0 && value <= 1;

function readWords(value: unknown, what: string, most: number): string {
  if (
    typeof value !== 'string' ||
    value.length === 0 ||
    value.length > most ||
    !PLAIN.test(value)
  ) {
    throw new Error(`The game's ${what} has to be 1 to ${most} plain keyboard characters.`);
  }
  return value;
}

function readTarget(target: unknown, index: number): Target {
  const where = `Target ${index + 1}`;
  if (!isObject(target)) throw new Error(`${where} is not a target.`);
  const { points, colour, radius, x, y } = target;
  if (!isCount(points)) throw new Error(`${where} needs a whole number of points above zero.`);
  if (typeof colour !== 'string' || !COLOUR.test(colour))
    throw new Error(`${where} needs a colour like "#ffd76a".`);
  if (typeof radius !== 'number' || !(radius >= 3 && radius <= 30))
    throw new Error(`${where} needs a radius from 3 to 30 pixels.`);
  if (!isFraction(x) || !isFraction(y))
    throw new Error(`${where} needs x and y from 0 to 1, its place in the goal.`);
  if (
    x * GOAL.width < radius ||
    (1 - x) * GOAL.width < radius ||
    y * GOAL.mouthHeight < radius ||
    (1 - y) * GOAL.mouthHeight < radius
  ) {
    throw new Error(`${where} does not fit inside the goal.`);
  }
  return {
    name: readWords(target.name, `target ${index + 1}'s name`, 12),
    points,
    colour: parseInt(colour.slice(1), 16),
    radius,
    x,
    y,
  };
}

function readBonus(value: unknown): Bonus | null {
  if (value === undefined || value === null) return null;
  const where = 'The bonus target';
  if (!isObject(value)) throw new Error(`${where} is not a target.`);
  const { points, colour, radius, x, y, spanX, spanY, periodMs, speedUp } = value;
  if (!isCount(points)) throw new Error(`${where} needs a whole number of points above zero.`);
  if (typeof colour !== 'string' || !COLOUR.test(colour))
    throw new Error(`${where} needs a colour like "#ffd76a".`);
  if (typeof radius !== 'number' || !(radius >= 5 && radius <= 20))
    throw new Error(`${where} needs a radius from 5 to 20 pixels.`);
  if (!isFraction(x) || !isFraction(y) || !isFraction(spanX) || !isFraction(spanY))
    throw new Error(`${where} needs x, y, spanX and spanY from 0 to 1.`);
  if (typeof periodMs !== 'number' || !(periodMs >= 1500 && periodMs <= 20000))
    throw new Error(`${where} needs a periodMs from 1500 to 20000.`);
  if (typeof speedUp !== 'number' || !(speedUp >= 0 && speedUp <= 0.3))
    throw new Error(`${where} needs a speedUp from 0 to 0.3.`);
  if (
    (x - spanX) * GOAL.width < radius ||
    (1 - x - spanX) * GOAL.width < radius ||
    (y - spanY) * GOAL.mouthHeight < radius ||
    (1 - y - spanY) * GOAL.mouthHeight < radius
  ) {
    throw new Error(`${where} goes outside the goal.`);
  }
  return {
    name: readWords(value.name, "bonus target's name", 12),
    points,
    colour: parseInt(colour.slice(1), 16),
    radius,
    x,
    y,
    spanX,
    spanY,
    periodMs,
    speedUp,
  };
}

function readWind(value: unknown, levels: number): Wind | null {
  if (value === undefined || value === null) return null;
  const where = 'The wind';
  if (!isObject(value)) throw new Error(`${where} is not wind.`);
  const { fromLevel, strength, perLevel, gustMs, steadiness } = value;
  if (!isCount(fromLevel) || fromLevel > levels)
    throw new Error(`${where} needs a fromLevel that is one of the levels.`);
  if (typeof strength !== 'number' || !(strength >= 0 && strength <= 30))
    throw new Error(`${where} needs a strength from 0 to 30 pixels.`);
  if (typeof perLevel !== 'number' || !(perLevel >= 0 && perLevel <= 10))
    throw new Error(`${where} needs a perLevel from 0 to 10 pixels.`);
  if (typeof gustMs !== 'number' || !(gustMs >= 2000 && gustMs <= 30000))
    throw new Error(`${where} needs a gustMs from 2000 to 30000.`);
  if (!isFraction(steadiness)) throw new Error(`${where} needs a steadiness from 0 to 1.`);
  // The ball has to stay on the screen with the strongest wind: a game that asks for more is refused.
  if (strength + perLevel * (levels - fromLevel) > WIND.most)
    throw new Error(`${where} gets too strong by the last level.`);
  return { fromLevel, strength, perLevel, gustMs, steadiness };
}

/** Reads the data as it was fetched. Throws, saying what is wrong, if it is not this game's. */
export function readGameData(data: unknown): GameData {
  if (!isObject(data)) throw new Error('The game has no data.');
  if (!Array.isArray(data.targets) || data.targets.length === 0)
    throw new Error('The game has no targets.');
  if (data.targets.length > 8) throw new Error('The game has too many targets: 8 is the most.');

  const targets = data.targets.map(readTarget);
  targets.forEach((one, index) => {
    targets.slice(index + 1).forEach((other, offset) => {
      const where = `Targets ${index + 1} and ${index + offset + 2}`;
      if (one.radius === other.radius)
        throw new Error(`${where} are the same size: each target has a size of its own.`);
      const apart = Math.hypot(
        (one.x - other.x) * GOAL.width,
        (one.y - other.y) * GOAL.mouthHeight,
      );
      if (apart < one.radius + other.radius + GAP) throw new Error(`${where} overlap.`);
    });
  });

  const { levels, shrink } = data;
  if (!isCount(levels) || levels > 12) throw new Error('The game needs 1 to 12 levels.');
  if (typeof shrink !== 'number' || !(shrink >= 0 && shrink <= 0.1))
    throw new Error('The goal has to shrink by 0 to 0.1 a level.');
  if (1 - shrink * (levels - 1) < GOAL.minScale)
    throw new Error('The goal goes back too far by the last level.');

  return {
    name: readWords(data.name, 'name', 14),
    line: readWords(data.line, 'line', 30),
    levels,
    shrink,
    targets,
    bonus: readBonus(data.bonus),
    wind: readWind(data.wind, levels),
  };
}
