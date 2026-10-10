import { describe, expect, it } from 'vitest';
import { LAYOUT } from './config';
import { readGameData } from './gameData';
import {
  answerPoints,
  ask,
  bestScore,
  fiftyFifty,
  fiftyFiftyPoints,
  questionOrder,
  readingMs,
  seeded,
  streakGivesLife,
  timeFor,
} from './logic';
import data from './game.json';

const game = readGameData(data);

describe("the game's data", () => {
  it('reads game.json', () => {
    expect(game.name).toBe('PUB QUIZ RUSH');
    expect(game.rounds).toBe(10);
    expect(game.categories.length).toBeGreaterThanOrEqual(2);
    expect(game.difficulties.map((difficulty) => difficulty.name)).toEqual([
      'EASY',
      'MEDIUM',
      'HARD',
    ]);
    expect(game.questions.length).toBeGreaterThanOrEqual(game.rounds);
  });

  it('has every question well made: four different answers, the right one marked, a level', () => {
    for (const question of game.questions) {
      expect(new Set(question.answers).size).toBe(4);
      expect(question.answers[question.correct]).toBeTruthy();
      expect([1, 2, 3]).toContain(question.level);
    }
  });

  it('has enough questions to fill a play of any genre and level, and of mixed', () => {
    for (const level of [1, 2, 3]) {
      for (const genre of game.categories) {
        const count = game.questions.filter(
          (question) => question.level === level && question.category === genre.id,
        ).length;
        expect(count).toBeGreaterThanOrEqual(game.rounds);
      }
    }
  });

  it('gets harder and shorter and worth more from easy to hard', () => {
    const [easy, medium, hard] = game.difficulties;
    expect(easy.time.startMs).toBeGreaterThan(medium.time.startMs);
    expect(medium.time.startMs).toBeGreaterThan(hard.time.startMs);
    expect(easy.multiplier).toBeLessThan(medium.multiplier);
    expect(medium.multiplier).toBeLessThan(hard.multiplier);
  });

  it("says what is wrong with data that is not this game's", () => {
    const first = data.questions[0];
    const wrong = (extra: object) => () => readGameData({ ...data, ...extra });
    expect(() => readGameData(null)).toThrow('no data');
    expect(wrong({ questions: [] })).toThrow('no questions');
    expect(wrong({ rounds: 1 })).toThrow('3 to 40 rounds');
    expect(wrong({ rounds: 40, questions: data.questions.slice(0, 30) })).toThrow(
      'fewer questions',
    );
    expect(wrong({ name: 'CAF\u00c9 QUIZ' })).toThrow('plain keyboard characters');
    expect(wrong({ line: '' })).toThrow('line');
    expect(
      wrong({ questions: [{ ...first, answers: ['A', 'B', 'C'] }, ...data.questions.slice(1)] }),
    ).toThrow('four answers');
    expect(
      wrong({
        questions: [{ ...first, answers: ['A', 'a', 'C', 'D'] }, ...data.questions.slice(1)],
      }),
    ).toThrow('the same');
    expect(wrong({ questions: [{ ...first, correct: 4 }, ...data.questions.slice(1)] })).toThrow(
      'correct',
    );
    expect(wrong({ questions: [{ ...first, level: 9 }, ...data.questions.slice(1)] })).toThrow(
      'level',
    );
    expect(
      wrong({ questions: [{ ...first, text: 'x'.repeat(91) }, ...data.questions.slice(1)] }),
    ).toThrow('plain keyboard');
    expect(wrong({ questions: [first, first, ...data.questions.slice(2)] })).toThrow('twice');
    const [easy, ...others] = data.difficulties;
    expect(
      wrong({ difficulties: [{ ...easy, time: { ...easy.time, endMs: 99999 } }, ...others] }),
    ).toThrow('endMs');
    expect(wrong({ difficulties: [easy] })).toThrow('three difficulties');
    expect(wrong({ categories: [] })).toThrow('genres');
    expect(
      wrong({ questions: [{ ...first, category: 'nowhere' }, ...data.questions.slice(1)] }),
    ).toThrow('category');
    expect(
      wrong({ questions: data.questions.filter((q) => q.category !== 'sport' || q.level !== 3) }),
    ).toThrow('SPORT');
    expect(wrong({ streakLife: -1 })).toThrow('streakLife');
  });
});

describe('the order of the questions', () => {
  const play = (seed: number, category: string | null = null, level: 1 | 2 | 3 = 2) =>
    questionOrder(game.questions, game.rounds, seed, { category, level });

  it('is the same for the same seed, and different for another', () => {
    expect(play(7)).toEqual(play(7));
    expect(play(7)).not.toEqual(play(8));
  });

  it('asks each question once, and exactly as many as there are rounds', () => {
    for (let seed = 1; seed <= 20; seed += 1) {
      const order = play(seed);
      expect(order).toHaveLength(game.rounds);
      expect(new Set(order).size).toBe(game.rounds);
    }
  });

  it('asks only the genre and level that were chosen', () => {
    for (const genre of game.categories) {
      for (const level of [1, 2, 3] as const) {
        for (const index of play(4, genre.id, level)) {
          expect(game.questions[index].category).toBe(genre.id);
          expect(game.questions[index].level).toBe(level);
        }
      }
    }
  });

  it('mixed asks every genre at the chosen level', () => {
    const seen = new Set<string>();
    for (let seed = 1; seed <= 30; seed += 1) {
      for (const index of play(seed, null, 3)) {
        expect(game.questions[index].level).toBe(3);
        seen.add(game.questions[index].category);
      }
    }
    expect(seen.size).toBe(game.categories.length);
  });

  it('says so when there are too few questions', () => {
    const few = game.questions.slice(0, 3);
    expect(() => questionOrder(few, game.rounds, 1, { category: null, level: 1 })).toThrow(
      'enough',
    );
  });

  it('moves the right answer about, but never loses it', () => {
    const question = game.questions[0];
    const places = new Set<number>();
    for (let seed = 1; seed <= 40; seed += 1) {
      const asked = ask(question, seed);
      expect(asked.answers[asked.correct]).toBe(question.answers[question.correct]);
      expect([...asked.answers].sort()).toEqual([...question.answers].sort());
      places.add(asked.correct);
    }
    expect(places.size).toBe(4);
  });

  it('has a seeded random in range', () => {
    const random = seeded(5);
    for (let count = 0; count < 100; count += 1) {
      const value = random();
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
    }
  });
});

describe('the clock and the score', () => {
  it('gets shorter each question, and never shorter than the least', () => {
    for (const { time } of game.difficulties) {
      expect(timeFor(1, time)).toBe(time.startMs);
      expect(timeFor(2, time)).toBeLessThan(timeFor(1, time));
      expect(timeFor(99, time)).toBe(time.endMs);
    }
  });

  it('leaves time to read every question, even on the shortest clock', () => {
    // Each level's questions against that level's shortest clock.
    for (const question of game.questions) {
      const { time } = game.difficulties[question.level - 1];
      expect(readingMs(question)).toBeLessThanOrEqual(time.endMs);
    }
  });

  it('fits the question and answers on the board and buttons', () => {
    // About 10.5 pixels a character at the size the words are written in.
    const lines = (characters: number, width: number) => Math.ceil((characters * 10.5) / width);
    for (const question of game.questions) {
      expect(lines(question.text.length, LAYOUT.questionWidth)).toBeLessThanOrEqual(3);
      for (const answer of question.answers) {
        expect(lines(answer.length, LAYOUT.answerWidth)).toBeLessThanOrEqual(2);
      }
    }
  });

  it('scores a quick right answer more than a slow one, and a streak more again', () => {
    const quick = answerPoints(9000, 10000, 0, game.points).points;
    const slow = answerPoints(1000, 10000, 0, game.points).points;
    expect(quick).toBeGreaterThan(slow);
    expect(slow).toBeGreaterThanOrEqual(game.points.base);
    expect(answerPoints(9000, 10000, 3, game.points).points).toBeGreaterThan(quick);
    // The streak stops at doubled.
    expect(answerPoints(9000, 10000, 20, game.points).points).toBe(
      Math.round((game.points.base + game.points.speedBonus * 0.9) * 2),
    );
    expect(answerPoints(5000, 10000, 2, game.points).streak).toBe(3);
  });

  it('pays more on a harder level', () => {
    const base = answerPoints(5000, 10000, 0, game.points).points;
    expect(answerPoints(5000, 10000, 0, game.points, 2).points).toBe(base * 2);
    expect(bestScore(game.rounds, game.points, 2)).toBeGreaterThan(
      bestScore(game.rounds, game.points),
    );
  });

  it('keeps the share of the time in range', () => {
    expect(answerPoints(-50, 10000, 0, game.points).points).toBe(game.points.base);
    expect(answerPoints(99999, 10000, 0, game.points).points).toBe(
      game.points.base + game.points.speedBonus,
    );
  });

  it('gives a life back on a streak, if it is set to', () => {
    expect(streakGivesLife(5, 5)).toBe(true);
    expect(streakGivesLife(10, 5)).toBe(true);
    expect(streakGivesLife(4, 5)).toBe(false);
    expect(streakGivesLife(0, 5)).toBe(false);
    expect(streakGivesLife(5, 0)).toBe(false);
  });

  it('can be won: a perfect play is worth a lot, and a careful one still gets through', () => {
    const best = bestScore(game.rounds, game.points);
    expect(best).toBeGreaterThan(game.rounds * game.points.base * 1.5);
    // Three wrong answers and the rest right, slowly, still finishes the questions.
    let score = 0;
    let streak = 0;
    let lives = 3;
    for (let number = 1; number <= game.rounds; number += 1) {
      if (number % 5 === 0 && lives > 1) {
        lives -= 1;
        streak = 0;
        continue;
      }
      const result = answerPoints(
        2000,
        timeFor(number, game.difficulties[1].time),
        streak,
        game.points,
      );
      streak = result.streak;
      score += result.points;
    }
    expect(lives).toBeGreaterThan(0);
    expect(score).toBeGreaterThan(0);
    expect(score).toBeLessThan(best);
  });
});

describe('the 50/50', () => {
  it('takes away two wrong answers and never the right one', () => {
    for (let seed = 0; seed < 200; seed += 1) {
      for (const correct of [0, 1, 2, 3]) {
        const gone = fiftyFifty(correct, seed);
        expect(gone).toHaveLength(2);
        expect(new Set(gone).size).toBe(2);
        expect(gone).not.toContain(correct);
      }
    }
  });

  it('is the same for the same seed, and leaves a different one for others', () => {
    expect(fiftyFifty(1, 7)).toEqual(fiftyFifty(1, 7));
    const kept = new Set(Array.from({ length: 60 }, (_, seed) => fiftyFifty(0, seed).join()));
    expect(kept.size).toBeGreaterThan(1);
  });

  it('halves what the answer is worth', () => {
    expect(fiftyFiftyPoints(200)).toBe(100);
    expect(fiftyFiftyPoints(125)).toBe(63);
  });
});
