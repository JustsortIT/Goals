/**
 * The rules of the game as plain sums, with no Phaser in them, so they can be tested
 * (`logic.test.ts`, `npm test`). Keep the rules here and the drawing in the scenes.
 *
 * A play asks `rounds` questions, easy ones first and the hard ones last, in an order made from a
 * seed (so no two plays are the same, and a test can play one). Each question has a clock that is
 * shorter the further on it comes. A right answer scores, more for a quick one and more again on a
 * streak; a wrong one, or none in time, costs a life.
 */
import type { GameData, Question } from './gameData';

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

/**
 * Which questions to ask, and in what order: the first third easy, the next medium and the last
 * hard, each picked at random from those of that level. If a level has too few, the nearest level
 * fills in. Never asks one twice.
 */
export function questionOrder(
  questions: readonly Question[],
  rounds: number,
  seed: number,
): number[] {
  const order = shuffled(questions.length, seeded(seed));
  const used = new Set<number>();
  const picked: number[] = [];
  for (let position = 0; position < rounds; position += 1) {
    const wanted = 1 + Math.floor((position * 3) / rounds);
    let best = -1;
    let bestGap = Infinity;
    for (const index of order) {
      if (used.has(index)) continue;
      const gap = Math.abs(questions[index].level - wanted);
      if (gap < bestGap) {
        best = index;
        bestGap = gap;
        if (gap === 0) break;
      }
    }
    used.add(best);
    picked.push(best);
  }
  return picked;
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

/** How long the question that comes `number`th (from 1) lasts: shorter each time, down to the least. */
export function timeFor(number: number, time: GameData['time']): number {
  return Math.max(time.endMs, time.startMs - time.stepMs * (number - 1));
}

/** The streak after a right answer, and the points it scored: quick and in a streak is worth most. */
export function answerPoints(
  timeLeftMs: number,
  timeMs: number,
  streakBefore: number,
  points: GameData['points'],
): { points: number; streak: number } {
  const streak = streakBefore + 1;
  const quick = Math.min(1, Math.max(0, timeLeftMs / timeMs));
  // Each right answer in a row adds a quarter, up to doubled.
  const multiplier = 1 + 0.25 * Math.min(streak - 1, 4);
  return { points: Math.round((points.base + points.speedBonus * quick) * multiplier), streak };
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
export function bestScore(rounds: number, points: GameData['points']): number {
  let total = 0;
  for (let streak = 0; streak < rounds; streak += 1) {
    total += answerPoints(1, 1, streak, points).points;
  }
  return total;
}
