/**
 * The game's content, apart from its code: what is different from one pub's game to the next.
 * In PubPixels this is what gets generated; the code never is. So anything a pub might want its
 * own (names, words, what there is to collect, how hard it is) belongs here and in `game.json`,
 * not in the scenes. Pure: no Phaser imports.
 */

/** One kind of thing that falls. */
export interface Drop {
  name: string;
  points: number;
  /** As a number, 0xrrggbb. In `game.json` it is written "#rrggbb". */
  colour: number;
  /** How fast it falls, in pixels a second. */
  fall: number;
  /** How often it comes, against the others. */
  weight: number;
}

export interface GameData {
  name: string;
  line: string;
  drops: Drop[];
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

/** Reads the data as it was fetched. Throws, saying what is wrong, if it is not this game's. */
export function readGameData(data: unknown): GameData {
  if (!isObject(data)) throw new Error('The game has no data.');
  if (!Array.isArray(data.drops) || data.drops.length === 0)
    throw new Error('The game has no drops.');

  const drops = data.drops.map((drop: unknown, index): Drop => {
    const where = `Drop ${index + 1}`;
    if (!isObject(drop)) throw new Error(`${where} is not a drop.`);
    const { points, colour, fall, weight } = drop;
    if (!isCount(points) || !isCount(fall) || !isCount(weight)) {
      throw new Error(`${where} needs whole numbers above zero for points, fall and weight.`);
    }
    if (typeof colour !== 'string' || !COLOUR.test(colour))
      throw new Error(`${where} needs a colour like "#ffd76a".`);
    return {
      name: readWords(drop.name, `drop ${index + 1}'s name`, 12),
      points,
      colour: parseInt(colour.slice(1), 16),
      fall,
      weight,
    };
  });

  return { name: readWords(data.name, 'name', 14), line: readWords(data.line, 'line', 30), drops };
}
