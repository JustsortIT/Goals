/**
 * The game's content, apart from its code: what is different from one pub's game to the next.
 * In PubPixels this is what gets generated; the code never is. So the name, the line under it,
 * every question and its answers, how long a question lasts and what it scores belong here and in
 * `game.json`, not in the scenes. Pure: no Phaser imports.
 */

/** One question: its genre, its words, the four answers (the right one at `correct`), and how hard it is (1 to 3). */
export interface Question {
  category: string;
  text: string;
  answers: [string, string, string, string];
  correct: number;
  level: 1 | 2 | 3;
}

/** A genre the player may choose, and the name shown on its button. */
export interface Category {
  id: string;
  name: string;
}

/** A difficulty: the questions of its level, how long each lasts, and what its answers are worth. */
export interface Difficulty {
  name: string;
  multiplier: number;
  /** How long a question lasts: the first one, how much less each next one gets, and never less than. */
  time: { startMs: number; stepMs: number; endMs: number };
}

export type Time = Difficulty['time'];

export interface GameData {
  name: string;
  line: string;
  /** How many questions a play asks to win it. */
  rounds: number;
  /** The genres to choose from (and Mixed, which is every genre, is always offered as well). */
  categories: Category[];
  /** Easy, medium and hard, in that order: difficulty 1 to 3 asks the questions of level 1 to 3. */
  difficulties: [Difficulty, Difficulty, Difficulty];
  /** What a right answer is worth: this much, and up to this much more for a quick one. */
  points: { base: number; speedBonus: number };
  /** A streak of this many right answers in a row gives a life back (0 for never). */
  streakLife: number;
  questions: Question[];
}

/** The pixel font has only plain keyboard characters. */
const PLAIN = /^[ -~]*$/;

/** The most characters a question and an answer may have: what fits on the board and a button. */
export const MOST = { question: 90, answer: 26, name: 14, line: 30, button: 12 } as const;

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

function readWords(value: unknown, what: string, most: number): string {
  if (
    typeof value !== 'string' ||
    value.trim().length === 0 ||
    value.length > most ||
    !PLAIN.test(value)
  ) {
    throw new Error(`The game's ${what} has to be 1 to ${most} plain keyboard characters.`);
  }
  return value;
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

function readTime(value: unknown, what: string): Time {
  if (!isObject(value)) throw new Error(`The ${what} has no time settings.`);
  const startMs = readNumber(value, 'startMs', 3000, 30000, what);
  const endMs = readNumber(value, 'endMs', 2000, 30000, what);
  if (endMs > startMs) throw new Error(`The ${what} has an endMs that is more than its startMs.`);
  return { startMs, stepMs: readNumber(value, 'stepMs', 0, 2000, what), endMs };
}

function readDifficulty(value: unknown, index: number): Difficulty {
  const what = `difficulty ${index + 1}`;
  if (!isObject(value)) throw new Error(`The ${what} is not a difficulty.`);
  return {
    name: readWords(value.name, `${what} name`, MOST.button),
    multiplier: readNumber(value, 'multiplier', 0.5, 5, what),
    time: readTime(value.time, what),
  };
}

function readCategory(value: unknown, index: number): Category {
  const what = `genre ${index + 1}`;
  if (!isObject(value)) throw new Error(`The ${what} is not a genre.`);
  const id = readWords(value.id, `${what} id`, 20);
  if (!/^[a-z0-9-]+$/.test(id))
    throw new Error(`The ${what} id has to be lowercase letters, digits or dashes.`);
  return { id, name: readWords(value.name, `${what} name`, MOST.button) };
}

function readQuestion(value: unknown, index: number, categories: Set<string>): Question {
  const where = `Question ${index + 1}`;
  if (!isObject(value)) throw new Error(`${where} is not a question.`);
  const { answers, correct, level, category } = value;
  if (typeof category !== 'string' || !categories.has(category))
    throw new Error(`${where} needs a category that is one of the game's genres.`);
  if (!Array.isArray(answers) || answers.length !== 4)
    throw new Error(`${where} needs exactly four answers.`);
  const words = answers.map((answer, at) =>
    readWords(answer, `${where} answer ${at + 1}`, MOST.answer),
  );
  if (new Set(words.map((word) => word.trim().toLowerCase())).size !== 4)
    throw new Error(`${where} has two answers that are the same.`);
  if (!Number.isInteger(correct) || (correct as number) < 0 || (correct as number) > 3)
    throw new Error(`${where} needs correct to say which answer is right, from 0 to 3.`);
  if (level !== 1 && level !== 2 && level !== 3)
    throw new Error(`${where} needs a level of 1, 2 or 3.`);
  return {
    category,
    text: readWords(value.text, `${where} text`, MOST.question),
    answers: words as Question['answers'],
    correct: correct as number,
    level,
  };
}

/** Reads the data as it was fetched. Throws, saying what is wrong, if it is not this game's. */
export function readGameData(data: unknown): GameData {
  if (!isObject(data)) throw new Error('The game has no data.');
  const { rounds, categories, difficulties, points, streakLife, questions } = data;
  if (!Number.isInteger(rounds) || (rounds as number) < 3 || (rounds as number) > 40)
    throw new Error('The game needs 3 to 40 rounds.');
  if (!Array.isArray(categories) || categories.length < 1 || categories.length > 8)
    throw new Error('The game needs 1 to 8 genres.');
  if (!Array.isArray(difficulties) || difficulties.length !== 3)
    throw new Error('The game needs exactly three difficulties: easy, medium and hard.');
  if (!isObject(points)) throw new Error('The game has no points settings.');
  if (!Number.isInteger(streakLife) || (streakLife as number) < 0 || (streakLife as number) > 20)
    throw new Error('The streakLife has to be a whole number from 0 to 20.');
  if (!Array.isArray(questions) || questions.length === 0)
    throw new Error('The game has no questions.');
  if (questions.length < (rounds as number))
    throw new Error('The game has fewer questions than rounds.');
  if (questions.length > 600) throw new Error('The game has too many questions: 600 is the most.');

  const genres = categories.map(readCategory);
  if (new Set(genres.map((genre) => genre.id)).size !== genres.length)
    throw new Error('Two genres have the same id.');
  const ids = new Set(genres.map((genre) => genre.id));
  const read = questions.map((question, index) => readQuestion(question, index, ids));
  const seen = new Set<string>();
  for (const question of read) {
    const key = question.text.trim().toLowerCase();
    if (seen.has(key)) throw new Error(`The question "${question.text}" is in the game twice.`);
    seen.add(key);
  }

  // A play of any genre and any difficulty must have enough questions to fill it.
  for (const level of [1, 2, 3]) {
    for (const genre of genres) {
      const count = read.filter((q) => q.category === genre.id && q.level === level).length;
      if (count < (rounds as number))
        throw new Error(`The genre ${genre.name} has fewer level ${level} questions than rounds.`);
    }
  }

  return {
    name: readWords(data.name, 'name', MOST.name),
    line: readWords(data.line, 'line', MOST.line),
    rounds: rounds as number,
    categories: genres,
    difficulties: difficulties.map(readDifficulty) as GameData['difficulties'],
    points: {
      base: readNumber(points, 'base', 1, 1000, 'points'),
      speedBonus: readNumber(points, 'speedBonus', 0, 1000, 'points'),
    },
    streakLife: streakLife as number,
    questions: read,
  };
}
