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

/** The bonus games played by pouring: they use the glass and the taps, in the Play scene. */
export type PourBonusKind = 'rapid' | 'moving' | 'two';
/** The bonus mini games, each a scene of its own: darts, and serving pints to customers. */
export type MiniBonusKind = 'darts' | 'serve';
/** The kinds of bonus game there are. */
export type BonusKind = PourBonusKind | MiniBonusKind;
const BONUS_KINDS: readonly BonusKind[] = ['rapid', 'moving', 'two', 'darts', 'serve'];
export const isMini = (kind: BonusKind): kind is MiniBonusKind =>
  kind === 'darts' || kind === 'serve';

/** Darts: a crosshair sways over the board and a tap throws; the darts have to add up to the target. */
export interface DartsSettings {
  /** How many darts a round, and the score they have to add up to for the first pint it comes after. */
  throws: number;
  targetStart: number;
  /** How much more it asks for each pint further on. */
  targetStep: number;
  /** How long the crosshair takes to go once across the board, and how much quicker each pint further on. */
  periodMs: number;
  speedUp: number;
  /** The clock, and what each point on the board is worth (times the pint's number). */
  timeMs: number;
  pointsEach: number;
}

/** Serve the pints: customers come to the bar and each wants a drink; a tap sends the pint to them. */
export interface ServeSettings {
  customers: number;
  /** When the first comes, how far apart they come, how much sooner each pint further on, and never sooner than. */
  firstMs: number;
  gapMs: number;
  gapStep: number;
  minGapMs: number;
  /** How long a customer waits, how much less each pint further on, and never less than. */
  patienceMs: number;
  patienceStep: number;
  minPatienceMs: number;
  /** How long before the next pint is ready, and how much patience a wrong pint takes away. */
  pintGapMs: number;
  wrongPenaltyMs: number;
  /** How many have to be served, and what each is worth (times the pint's number, more for the quick). */
  needed: number;
  pointsEach: number;
}

/**
 * The bonus games that come up between pints. They never cost a life, but a bonus cleared scores
 * double and gives one back. `after` says after which pints (by the number of the pint just
 * cleared), and `kinds` which bonus comes after each.
 */
export interface BonusSettings {
  after: number[];
  kinds: BonusKind[];
  /** What a bonus game's points are multiplied by. */
  multiplier: number;
  lifeOnSuccess: boolean;
  /** Rapid pour: one pint, a much quicker tap, a much narrower mark, against the clock. */
  rapid: { flowFactor: number; bandFactor: number; timeMs: number };
  /** Moving glass: it slides along the bar under the tap, and only fills while it is under it. */
  moving: { flowFactor: number; amplitude: number; periodMs: number; timeMs: number };
  /** Two pints: two glasses at once, the left half of the screen for one tap, the right for the other. */
  two: { timeMs: number };
  darts: DartsSettings;
  serve: ServeSettings;
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
  /** Null for a game with no bonus games. */
  bonus: BonusSettings | null;
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

function readDarts(value: Record<string, unknown>): DartsSettings {
  const what = 'darts bonus';
  const throws = readNumber(value, 'throws', 1, 6, what);
  if (!Number.isInteger(throws)) throw new Error('The darts bonus needs a whole number of throws.');
  const settings: DartsSettings = {
    throws,
    targetStart: readNumber(value, 'targetStart', 10, 300, what),
    targetStep: readNumber(value, 'targetStep', 0, 30, what),
    periodMs: readNumber(value, 'periodMs', 1200, 8000, what),
    speedUp: readNumber(value, 'speedUp', 0, 0.3, what),
    timeMs: readNumber(value, 'timeMs', 6000, 60000, what),
    pointsEach: readNumber(value, 'pointsEach', 1, 20, what),
  };
  // Three treble twenties is the most a dart can make: a target above that cannot be won.
  if (settings.targetStart > throws * 60)
    throw new Error('The darts target is more than the darts can make.');
  return settings;
}

function readServe(value: Record<string, unknown>, after: number[]): ServeSettings {
  const what = 'serve bonus';
  const settings: ServeSettings = {
    customers: readNumber(value, 'customers', 3, 14, what),
    firstMs: readNumber(value, 'firstMs', 300, 5000, what),
    gapMs: readNumber(value, 'gapMs', 600, 5000, what),
    gapStep: readNumber(value, 'gapStep', 0, 300, what),
    minGapMs: readNumber(value, 'minGapMs', 500, 4000, what),
    patienceMs: readNumber(value, 'patienceMs', 2500, 20000, what),
    patienceStep: readNumber(value, 'patienceStep', 0, 1000, what),
    minPatienceMs: readNumber(value, 'minPatienceMs', 1500, 15000, what),
    pintGapMs: readNumber(value, 'pintGapMs', 100, 2000, what),
    wrongPenaltyMs: readNumber(value, 'wrongPenaltyMs', 0, 5000, what),
    needed: readNumber(value, 'needed', 1, 14, what),
    pointsEach: readNumber(value, 'pointsEach', 1, 200, what),
  };
  if (!Number.isInteger(settings.customers) || !Number.isInteger(settings.needed))
    throw new Error('The serve bonus needs whole numbers of customers and needed.');
  if (settings.needed > settings.customers)
    throw new Error('The serve bonus needs more customers served than there are.');
  if (settings.minGapMs > settings.gapMs || settings.minPatienceMs > settings.patienceMs)
    throw new Error('The serve bonus has a minimum above its start.');
  void after;
  return settings;
}

function readBonus(value: unknown, rounds: number): BonusSettings | null {
  if (value === undefined || value === null) return null;
  if (!isObject(value)) throw new Error('The bonus games are not a set of settings.');
  const what = 'bonus';
  const { after, kinds, rapid, moving, two, darts, serve } = value;
  if (!Array.isArray(after) || !Array.isArray(kinds) || after.length !== kinds.length)
    throw new Error('The bonus needs as many kinds as it has places to come up (after).');
  after.forEach((place, index) => {
    if (!isCount(place) || place >= rounds || (index > 0 && place <= after[index - 1]))
      throw new Error('The bonus after has to be rising pint numbers before the last pint.');
  });
  kinds.forEach((kind) => {
    if (!BONUS_KINDS.includes(kind as BonusKind))
      throw new Error(`The bonus kinds can only be ${BONUS_KINDS.join(', ')}.`);
  });
  if (
    !isObject(rapid) ||
    !isObject(moving) ||
    !isObject(two) ||
    !isObject(darts) ||
    !isObject(serve)
  )
    throw new Error('The bonus needs settings for rapid, moving, two, darts and serve.');
  return {
    after: after as number[],
    kinds: kinds as BonusKind[],
    multiplier: readNumber(value, 'multiplier', 1, 5, what),
    lifeOnSuccess: value.lifeOnSuccess === true,
    rapid: {
      flowFactor: readNumber(rapid, 'flowFactor', 1, 3, 'rapid bonus'),
      bandFactor: readNumber(rapid, 'bandFactor', 0.3, 1, 'rapid bonus'),
      timeMs: readNumber(rapid, 'timeMs', 3000, 30000, 'rapid bonus'),
    },
    moving: {
      flowFactor: readNumber(moving, 'flowFactor', 1, 3, 'moving bonus'),
      amplitude: readNumber(moving, 'amplitude', 20, 90, 'moving bonus'),
      periodMs: readNumber(moving, 'periodMs', 2000, 8000, 'moving bonus'),
      timeMs: readNumber(moving, 'timeMs', 5000, 40000, 'moving bonus'),
    },
    two: { timeMs: readNumber(two, 'timeMs', 5000, 40000, 'two-pint bonus') },
    darts: readDarts(darts),
    serve: readServe(serve, after as number[]),
  };
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
    bonus: readBonus(data.bonus, data.rounds),
  };
}
