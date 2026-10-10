import { describe, expect, it } from 'vitest';
import { BOARD, SERVE } from './config';
import {
  BOARD_ORDER,
  crosshairAt,
  dartHit,
  dartsCleared,
  dartsPoints,
  dartsRound,
  hitName,
} from './darts';
import { readGameData } from './gameData';
import { moodOf, ServeRun, serveRound, slideTimeMs } from './serve';
import data from './game.json';

const game = readGameData(data);
const bonus = game.bonus;
if (!bonus) throw new Error('game.json has no bonus games');
const serveSettings = bonus.serve;
const numbersFor = (kind: string): number[] =>
  bonus.after.filter((_, i) => bonus.kinds[i] === kind);

describe('the bonus settings for darts and serving', () => {
  it('are read from game.json', () => {
    expect(bonus.kinds).toEqual(['rapid', 'darts', 'moving', 'serve', 'two']);
    expect(bonus.darts.throws).toBe(3);
    expect(bonus.serve.customers).toBe(8);
  });

  it('are refused if wrong', () => {
    const wrong = (extra: object) => () =>
      readGameData({ ...data, bonus: { ...data.bonus, ...extra } });
    expect(wrong({ darts: { ...data.bonus.darts, throws: 9 } })).toThrow('throws');
    expect(wrong({ darts: { ...data.bonus.darts, throws: 2.5 } })).toThrow('throws');
    expect(wrong({ darts: { ...data.bonus.darts, targetStart: 250 } })).toThrow(
      'more than the darts',
    );
    expect(wrong({ darts: { ...data.bonus.darts, periodMs: 100 } })).toThrow('periodMs');
    expect(wrong({ serve: { ...data.bonus.serve, needed: 9 } })).toThrow('more customers');
    expect(wrong({ serve: { ...data.bonus.serve, customers: 2 } })).toThrow('customers');
    expect(wrong({ serve: { ...data.bonus.serve, minGapMs: 3000 } })).toThrow('minimum');
    expect(wrong({ serve: undefined })).toThrow('settings for');
    expect(wrong({ kinds: ['rapid', 'darts', 'moving', 'serve', 'karaoke'] })).toThrow(
      'kinds can only be',
    );
  });
});

describe('the dartboard', () => {
  const R = BOARD.radius;
  // A point at `share` of the radius, `turn` of a full turn clockwise from the top.
  const at = (share: number, turn: number) => ({
    dx: R * share * Math.sin(turn * 2 * Math.PI),
    dy: -R * share * Math.cos(turn * 2 * Math.PI),
  });
  const hit = (share: number, turn: number) => {
    const { dx, dy } = at(share, turn);
    return dartHit(dx, dy);
  };

  it('has the numbers in the order of a real board', () => {
    expect([...BOARD_ORDER].sort((a, b) => a - b)).toEqual(
      Array.from({ length: 20 }, (_, i) => i + 1),
    );
    expect(BOARD_ORDER.slice(0, 4)).toEqual([20, 1, 18, 4]);
    // The neighbours of each number add up to the same on a real board only for a few: 20 sits between 5 and 1.
    expect(BOARD_ORDER[19]).toBe(5);
  });

  it('scores the bull, the outer bull, a miss', () => {
    expect(dartHit(0, 0)).toEqual({ score: 50, ring: 'bull', number: 0 });
    expect(hit(0.1, 0.3)).toEqual({ score: 25, ring: 'outer', number: 0 });
    expect(hit(1.01, 0).score).toBe(0);
    expect(hit(1.5, 0.5).ring).toBe('miss');
  });

  it('scores the segments, in the right places round the board', () => {
    expect(hit(0.3, 0)).toMatchObject({ score: 20, ring: 'single' });
    expect(hit(0.3, 0.05)).toMatchObject({ number: 1 });
    expect(hit(0.3, 0.25)).toMatchObject({ number: 6 });
    expect(hit(0.3, 0.5)).toMatchObject({ number: 3 });
    expect(hit(0.3, 0.75)).toMatchObject({ number: 11 });
    expect(hit(0.3, 0.97)).toMatchObject({ number: 5 });
  });

  it('doubles and trebles', () => {
    expect(hit(0.59, 0)).toMatchObject({ score: 60, ring: 'treble' });
    expect(hit(0.96, 0)).toMatchObject({ score: 40, ring: 'double' });
    expect(hit(0.96, 0.25)).toMatchObject({ score: 12, ring: 'double' });
    expect(hit(0.75, 0)).toMatchObject({ score: 20, ring: 'single' });
  });

  it('names a hit as the game writes it', () => {
    expect(hitName(hit(0.59, 0))).toBe('T20');
    expect(hitName(hit(0.96, 0.25))).toBe('D6');
    expect(hitName(hit(0.3, 0.5))).toBe('3');
    expect(hitName(dartHit(0, 0))).toBe('BULL');
    expect(hitName(hit(0.1, 0))).toBe('25');
    expect(hitName(hit(1.2, 0))).toBe('MISS');
  });
});

describe('the darts round', () => {
  it('is harder the further on it comes: a higher target and a quicker crosshair', () => {
    const first = dartsRound(2, bonus.darts);
    const later = dartsRound(6, bonus.darts);
    expect(later.target).toBeGreaterThan(first.target);
    expect(later.periodMs).toBeLessThan(first.periodMs);
    expect(dartsRound(1, bonus.darts).target).toBe(bonus.darts.targetStart);
  });

  it('never asks for more than the darts can make', () => {
    expect(dartsRound(99, bonus.darts).target).toBeLessThanOrEqual(bonus.darts.throws * 60);
  });

  it('keeps the crosshair over the board and a little beyond, and never still', () => {
    const round = dartsRound(3, bonus.darts);
    let farthest = 0;
    let moved = 0;
    let last = crosshairAt(0, round.periodMs);
    for (let time = 5; time < 40000; time += 5) {
      const now = crosshairAt(time, round.periodMs);
      farthest = Math.max(farthest, Math.hypot(now.x, now.y));
      moved += Math.hypot(now.x - last.x, now.y - last.y);
      last = now;
    }
    expect(farthest).toBeGreaterThan(BOARD.radius);
    expect(farthest).toBeLessThanOrEqual(BOARD.radius * BOARD.sway * Math.SQRT2 + 1e-6);
    expect(moved / 40).toBeGreaterThan(80);
  });

  it('scores a dart by its place, times a value and the pint, and is cleared at the target', () => {
    const round = dartsRound(3, bonus.darts);
    expect(dartsPoints(60, 3, round)).toBe(60 * bonus.darts.pointsEach * 3);
    expect(dartsCleared(round.target, round)).toBe(true);
    expect(dartsCleared(round.target - 1, round)).toBe(false);
  });

  it('can be won: there are good moments to throw, each long enough for a finger', () => {
    for (const number of numbersFor('darts')) {
      const round = dartsRound(number, bonus.darts);
      // Each dart has to make this much, on average, to reach the target.
      const need = Math.ceil(round.target / round.throws);
      const runs: { start: number; end: number }[] = [];
      let from: number | null = null;
      for (let time = 0; time <= round.timeMs; time += 5) {
        const spot = crosshairAt(time, round.periodMs);
        const good = dartHit(spot.x, spot.y).score >= need;
        if (good && from === null) from = time;
        if (!good && from !== null) {
          runs.push({ start: from, end: time });
          from = null;
        }
      }
      // Pick throws a person could make: at least 0.6 s apart, each in a run of at least 100 ms.
      const picks: number[] = [];
      for (const run of runs) {
        const middle = (run.start + run.end) / 2;
        const last = picks[picks.length - 1] ?? -Infinity;
        if (run.end - run.start >= 100 && middle - last >= 600) picks.push(middle);
      }
      expect(picks.length).toBeGreaterThanOrEqual(round.throws + 2);
      // And the first three are early enough that the clock is no problem.
      expect(picks[round.throws - 1]).toBeLessThan(round.timeMs * 0.6);
    }
  });
});

describe('the serving round', () => {
  it('is made by rule, the same every time', () => {
    expect(serveRound(4, bonus.serve)).toEqual(serveRound(4, bonus.serve));
    expect(serveRound(4, bonus.serve)).not.toEqual(serveRound(5, bonus.serve));
  });

  it('brings customers quicker and has them wait less each pint further on', () => {
    const early = serveRound(2, bonus.serve);
    const late = serveRound(7, bonus.serve);
    const gapOf = (round: typeof early) =>
      round.customers[1].arriveMs - round.customers[0].arriveMs;
    expect(gapOf(late)).toBeLessThanOrEqual(gapOf(early));
    expect(late.customers[0].patienceMs).toBeLessThan(early.customers[0].patienceMs);
    expect(late.pointsEach).toBeGreaterThan(early.pointsEach);
  });

  it('never makes one wait for a place at the bar', () => {
    for (let number = 1; number <= 8; number += 1) {
      const round = serveRound(number, bonus.serve);
      round.customers.forEach((customer, index) => {
        const next = round.customers.find((c, i) => i > index && c.slot === customer.slot);
        if (next) expect(customer.arriveMs + customer.patienceMs).toBeLessThan(next.arriveMs);
      });
    }
  });

  it('sets customers in places along the bar, wanting one of three drinks', () => {
    const round = serveRound(3, bonus.serve);
    for (const customer of round.customers) {
      expect(SERVE.slots[customer.slot]).toBeDefined();
      expect([0, 1, 2]).toContain(customer.wants);
    }
    expect(new Set(round.customers.map((c) => c.wants)).size).toBe(3);
  });

  it('slides a pint further to a place further along, at a steady speed', () => {
    expect(slideTimeMs(SERVE.slots[3])).toBeGreaterThan(slideTimeMs(SERVE.slots[0]));
    expect(slideTimeMs(SERVE.pullX)).toBeGreaterThan(0);
  });
});

/** Plays a round: sees a new pint after `reactionMs`, and serves it to whoever waiting wants it most urgently. */
function play(number: number, reactionMs: number): ServeRun {
  const run = new ServeRun(serveRound(number, serveSettings));
  for (let time = 0; time < 60000 && !run.finished; time += 10) {
    run.update(10);
    if (run.pint && run.timeMs >= run.pint.sinceMs + reactionMs) {
      const kind = run.pint.kind;
      const next = run
        .waiting()
        .filter((customer) => customer.wants === kind)
        .sort((a, b) => a.leftMs - b.leftMs)[0];
      if (next) run.tap(next.slot);
    }
  }
  return run;
}

describe('serving a round', () => {
  it('serves a customer a pint they want, and takes patience from one given the wrong one', () => {
    const run = new ServeRun(serveRound(3, bonus.serve));
    run.update(bonus.serve.firstMs + 10);
    expect(run.waiting()).toHaveLength(1);
    expect(run.pint).not.toBeNull();
    const customer = run.waiting()[0];
    expect(run.tap((customer.slot + 1) % 4)).toBe('none');
    expect(run.pint).not.toBeNull();
    // Make the pint the wrong one.
    if (run.pint) run.pint.kind = (customer.wants + 1) % 3;
    const before = customer.leftMs;
    expect(run.tap(customer.slot)).toBe('wrong');
    expect(customer.leftMs).toBe(before - bonus.serve.wrongPenaltyMs);
    expect(run.wrong).toBe(1);
    expect(run.pint).toBeNull();
    // After the gap there is another pint, and that serves.
    run.update(bonus.serve.pintGapMs + 20);
    expect(run.pint).not.toBeNull();
    if (run.pint) run.pint.kind = customer.wants;
    expect(run.tap(customer.slot)).toBe('served');
    expect(run.served).toBe(1);
    expect(run.points).toBeGreaterThan(0);
    expect(customer.state).toBe('served');
  });

  it('serves the quick for more: up to twice what the slow are worth', () => {
    const quick = play(3, 100);
    const slow = play(3, 1400);
    expect(quick.points / Math.max(1, quick.served)).toBeGreaterThan(
      slow.points / Math.max(1, slow.served),
    );
  });

  it('lets a customer give up when their patience runs out', () => {
    const run = new ServeRun(serveRound(3, bonus.serve));
    for (let time = 0; time < 60000 && !run.finished; time += 10) run.update(10);
    expect(run.missed).toBe(bonus.serve.customers);
    expect(run.served).toBe(0);
    expect(run.cleared).toBe(false);
    expect(run.drain().filter((event) => event.type === 'left')).toHaveLength(
      bonus.serve.customers,
    );
  });

  it('shows how a customer feels as their patience goes', () => {
    const run = new ServeRun(serveRound(3, bonus.serve));
    run.update(bonus.serve.firstMs + 10);
    const customer = run.waiting()[0];
    expect(moodOf(customer)).toBe('content');
    customer.leftMs = customer.patienceMs * 0.4;
    expect(moodOf(customer)).toBe('annoyed');
    customer.leftMs = customer.patienceMs * 0.1;
    expect(moodOf(customer)).toBe('angry');
    customer.state = 'served';
    expect(moodOf(customer)).toBe('happy');
  });

  it('can be won by a player who takes 0.7 s to see the pint, in every round it comes up', () => {
    for (const number of numbersFor('serve')) {
      const run = play(number, 700);
      expect(run.finished).toBe(true);
      expect(run.served).toBeGreaterThanOrEqual(run.round.needed);
      expect(run.cleared).toBe(true);
    }
  });

  it('is not won by tapping without looking: a wrong pint costs patience', () => {
    const run = new ServeRun(serveRound(6, bonus.serve));
    for (let time = 0; time < 60000 && !run.finished; time += 10) {
      run.update(10);
      // After the time it takes to see the pint, the oldest customer waiting, whatever they want.
      const first = run.waiting()[0];
      if (run.pint && first && run.timeMs >= run.pint.sinceMs + 700) run.tap(first.slot);
    }
    const careful = play(6, 700);
    expect(run.wrong).toBeGreaterThan(0);
    expect(run.served).toBeLessThan(careful.served);
  });
});
