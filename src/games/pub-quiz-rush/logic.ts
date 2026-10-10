/**
 * The rules of the game as plain sums, with no Phaser in them, so they can be tested
 * (`logic.test.ts`, `npm test`). Keep the rules here and the drawing in the scenes.
 *
 * The player picks a genre and a difficulty, and a play asks `rounds` questions of that genre and
 * level, in an order made from a seed (so no two plays are the same, and a test can play one). Each
 * question has a clock that is shorter the further on it comes, and harder levels start shorter. A right answer scores, more for a quick one and more again on a
 * streak; a wrong one, or none in time, costs a life.
 */
import type { GameData, Question, Time } from './gameData';

/** A small seeded random, the same every time for the same seed. */
export function seeded(seed: number): () => number {
  let state = seed | 0;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A shuffled copy of 0 to count - 1. */
function shuffled(count: number, random: () => number): number[] {
  const order = Array.from({ length: count }, (_, index) => index);
  for (let at = count - 1; at > 0; at -= 1) {
    const other = Math.floor(random() * (at + 1));
    [order[at], order[other]] = [order[other], order[at]];
  }
  return order;
}

/** What a play was asked for: a genre (null for mixed, every genre) and a level from 1 to 3. */
export interface Pick {
  category: string | null;
  level: 1 | 2 | 3;
}

/**
 * Which questions to ask, and in what order: `rounds` of those of the genre and the level the
 * player chose, picked at random by the seed. Never asks one twice. Gives the questions' places in
 * `questions`.
 */
export function questionOrder(
  questions: readonly Question[],
  rounds: number,
  seed: number,
  pick: Pick,
): number[] {
  const fits = questions
    .map((question, index) => ({ question, index }))
    .filter(
      ({ question }) =>
        question.level === pick.level &&
        (pick.category === null || question.category === pick.category),
    );
  if (fits.length < rounds)
    throw new Error('There are not enough questions for that genre and level.');
  return shuffled(fits.length, seeded(seed))
    .slice(0, rounds)
    .map((at) => fits[at].index);
}

/** A question with its answers in a new order, and where the right one went. */
export interface Asked {
  text: string;
  answers: string[];
  correct: number;
}

/** The question's answers shuffled by the seed, so the right one is not always in the same button. */
export function ask(question: Question, seed: number): Asked {
  const order = shuffled(4, seeded(seed));
  return {
    text: question.text,
    answers: order.map((index) => question.answers[index]),
    correct: order.indexOf(question.correct),
  };
}

/** The two wrong answers a 50/50 takes away: which of the four buttons, picked by the seed. */
export function fiftyFifty(correct: number, seed: number): number[] {
  const wrong = [0, 1, 2, 3].filter((index) => index !== correct);
  const order = shuffled(wrong.length, seeded(seed));
  return [wrong[order[0]], wrong[order[1]]].sort();
}

/** What a right answer is worth after a 50/50 was used on its question. */
export const fiftyFiftyPoints = (points: number): number => Math.round(points / 2);

/** How long the question that comes `number`th (from 1) lasts: shorter each time, down to the least. */
export function timeFor(number: number, time: Time): number {
  return Math.max(time.endMs, time.startMs - time.stepMs * (number - 1));
}

/** The streak after a right answer, and the points it scored: quick and in a streak is worth most. */
export function answerPoints(
  timeLeftMs: number,
  timeMs: number,
  streakBefore: number,
  points: GameData['points'],
  multiplier = 1,
): { points: number; streak: number } {
  const streak = streakBefore + 1;
  const quick = Math.min(1, Math.max(0, timeLeftMs / timeMs));
  // Each right answer in a row adds a quarter, up to doubled.
  const streakMultiplier = 1 + 0.25 * Math.min(streak - 1, 4);
  const worth = (points.base + points.speedBonus * quick) * streakMultiplier * multiplier;
  return { points: Math.round(worth), streak };
}

/** Whether a streak this long gives a life back. */
export const streakGivesLife = (streak: number, every: number): boolean =>
  every > 0 && streak > 0 && streak % every === 0;

/** How long it takes to read a question and its answers, which a clock must always leave room for. */
export function readingMs(question: Question): number {
  const characters = question.text.length + question.answers.reduce((sum, a) => sum + a.length, 0);
  return 1500 + 20 * characters;
}

/** The most a perfect play can score: every question right and answered at once, on a streak. */
export function bestScore(rounds: number, points: GameData['points'], multiplier = 1): number {
  let total = 0;
  for (let streak = 0; streak < rounds; streak += 1) {
    total += answerPoints(1, 1, streak, points, multiplier).points;
  }
  return total;
}
