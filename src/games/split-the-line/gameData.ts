/**
 * The game's content, apart from its code: what is different from one pub's game to the next.
 * In PubPixels this is what gets generated; the code never is. So anything a pub might want its
 * own (names, the drink and its colours, how many rounds, how quick the tap is and how wide the
 * mark) belongs here and in `game.json`, not in the scenes. Pure: no Phaser imports.
 */
import { GLASS_HEIGHT } from './config';

/** How the rounds get harder: all by rule from these numbers, so every round can be checked. */
export interface Difficulty {
  /** How fast the tap pours in the first round, and how much faster in each round after (px a second). */
  flowStart: number;
  flowStep: number;
  /** How much the tap surges and eases as it pours (0 is steady), at first and how much more each round. */
  surgeStart: number;
  surgeStep: number;
  /** How far either side of the middle of the mark still counts, at first and how much less each round. */
  bandStart: number;
  bandStep: number;
  /** ...and never less than this. */
  bandMin: number;
  /** The middle of the mark is somewhere between these two, as a share of the glass's height. */
  markLow: number;
  markHigh: number;
}

export interface GameData {
  name: string;
  line: string;
  rounds: number;
  drink: { name: string; liquid: number; head: number };
  mark: { colour: number };
  pour: Difficulty;
  points: { close: number; split: number };
  /** A stop this close to the middle of the mark (px) is a split. */
  splitTolerance: number;
}

/** The pixel font has only plain keyboard characters. */
const PLAIN = /^[ -~]*$/;
const COLOUR = /^#[0-9a-f]{6}$/i;

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;
const isCount = (value: unknown): value is number =>
  Number.isInteger(value) && (value as number) > 0;

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

function readColour(value: unknown, what: string): number {
  if (typeof value !== 'string' || !COLOUR.test(value))
    throw new Error(`The ${what} needs a colour like "#e8c15a".`);
  return parseInt(value.slice(1), 16);
}

function readNumber(
  value: Record<string, unknown>,
  key: string,
  low: number,
  high: number,
  what: string,
): number {
  const number = value[key];
  if (typeof number !== 'number' || !(number >= low && number <= high))
    throw new Error(`The ${what} needs ${key} from ${low} to ${high}.`);
  return number;
}

function readDifficulty(value: unknown): Difficulty {
  if (!isObject(value)) throw new Error('The game has no pour settings.');
  const what = 'pour';
  const pour: Difficulty = {
    flowStart: readNumber(value, 'flowStart', 10, 120, what),
    flowStep: readNumber(value, 'flowStep', 0, 15, what),
    surgeStart: readNumber(value, 'surgeStart', 0, 0.6, what),
    surgeStep: readNumber(value, 'surgeStep', 0, 0.15, what),
    bandStart: readNumber(value, 'bandStart', 4, 30, what),
    bandStep: readNumber(value, 'bandStep', 0, 5, what),
    bandMin: readNumber(value, 'bandMin', 2, 20, what),
    markLow: readNumber(value, 'markLow', 0.1, 0.9, what),
    markHigh: readNumber(value, 'markHigh', 0.1, 0.9, what),
  };
  if (pour.bandMin > pour.bandStart)
    throw new Error('The pour bandMin is more than its bandStart.');
  if (pour.markLow > pour.markHigh) throw new Error('The pour markLow is more than its markHigh.');
  // The widest mark has to fit in the glass at both ends, with a little to spare.
  const room = 4;
  if (
    pour.markLow * GLASS_HEIGHT - pour.bandStart < room ||
    pour.markHigh * GLASS_HEIGHT + pour.bandStart > GLASS_HEIGHT - room
  ) {
    throw new Error('The mark does not fit in the glass: make it lower or its band narrower.');
  }
  return pour;
}

/** Reads the data as it was fetched. Throws, saying what is wrong, if it is not this game's. */
export function readGameData(data: unknown): GameData {
  if (!isObject(data)) throw new Error('The game has no data.');
  if (!isCount(data.rounds) || data.rounds > 12) throw new Error('The game needs 1 to 12 rounds.');
  const { drink, mark, points } = data;
  if (!isObject(drink)) throw new Error('The game has no drink.');
  if (!isObject(mark)) throw new Error('The game has no mark.');
  if (!isObject(points) || !isCount(points.close) || !isCount(points.split))
    throw new Error('The points for a close and a split need whole numbers above zero.');
  const splitTolerance = data.splitTolerance;
  if (typeof splitTolerance !== 'number' || !(splitTolerance >= 0.5 && splitTolerance <= 4))
    throw new Error('The splitTolerance has to be from 0.5 to 4 pixels.');

  return {
    name: readWords(data.name, 'name', 14),
    line: readWords(data.line, 'line', 30),
    rounds: data.rounds,
    drink: {
      name: readWords(drink.name, 'drink name', 12),
      liquid: readColour(drink.liquid, 'drink liquid'),
      head: readColour(drink.head, 'drink head'),
    },
    mark: { colour: readColour(mark.colour, 'mark') },
    pour: readDifficulty(data.pour),
    points: { close: points.close, split: points.split },
    splitTolerance,
  };
}
