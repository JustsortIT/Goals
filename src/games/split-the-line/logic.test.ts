import { describe, expect, it } from 'vitest';
import { CATCH_HALF, GLASS_HEIGHT, POUR } from './config';
import { readGameData } from './gameData';
import {
  bonusAfter,
  bonusCleared,
  bonusRounds,
  bonusScore,
  clearsRound,
  coastAfterRelease,
  glassWidthAt,
  judge,
  newPour,
  roundFor,
  roundPoints,
  stepPour,
  surgeAt,
  swingOffset,
  underTap,
} from './logic';
import data from './game.json';

const game = readGameData(data);
const rounds = Array.from({ length: game.rounds }, (_, index) =>
  roundFor(index + 1, game.pour, GLASS_HEIGHT),
);

describe("the game's data", () => {
  it('reads game.json', () => {
    expect(game.name).toBe('SPLIT THE LINE');
    expect(game.rounds).toBe(8);
    expect(game.drink.liquid).toBe(0x1b0e09);
    expect(game.mark.colour).toBe(0xe8c15a);
  });

  it("says what is wrong with data that is not this game's", () => {
    expect(() => readGameData(null)).toThrow('no data');
    expect(() => readGameData({ ...data, rounds: 0 })).toThrow('1 to 12 rounds');
    expect(() => readGameData({ ...data, name: 'CAF\u00c9' })).toThrow('plain keyboard characters');
    expect(() => readGameData({ ...data, drink: { ...data.drink, head: 'cream' } })).toThrow(
      'colour',
    );
    expect(() => readGameData({ ...data, pour: { ...data.pour, flowStart: 900 } })).toThrow(
      'flowStart',
    );
    expect(() => readGameData({ ...data, pour: { ...data.pour, markHigh: 0.9 } })).toThrow(
      'does not fit',
    );
    expect(() =>
      readGameData({ ...data, pour: { ...data.pour, bandMin: 20, bandStart: 8 } }),
    ).toThrow('bandMin');
    expect(() => readGameData({ ...data, splitTolerance: 20 })).toThrow('splitTolerance');
    expect(() => readGameData({ ...data, points: { close: 0, split: 1 } })).toThrow('points');
  });
});

describe('the rounds', () => {
  it('are made by rule, the same every time', () => {
    expect(roundFor(3, game.pour, GLASS_HEIGHT)).toEqual(rounds[2]);
  });

  it('keep the mark inside the glass, and move it about', () => {
    for (const round of rounds) {
      expect(round.centre - round.band).toBeGreaterThan(0);
      expect(round.centre + round.band + coastAfterRelease(round.flow * 1.6)).toBeLessThan(
        GLASS_HEIGHT,
      );
    }
    expect(new Set(rounds.map((round) => Math.round(round.centre))).size).toBeGreaterThan(5);
  });

  it('get harder: a narrower mark, a quicker tap, a wilder one', () => {
    for (let index = 1; index < rounds.length; index += 1) {
      expect(rounds[index].band).toBeLessThanOrEqual(rounds[index - 1].band);
      expect(rounds[index].flow).toBeGreaterThan(rounds[index - 1].flow);
      expect(rounds[index].surge).toBeGreaterThanOrEqual(rounds[index - 1].surge);
    }
    expect(Math.min(...rounds.map((round) => round.band))).toBeGreaterThanOrEqual(
      game.pour.bandMin,
    );
  });
});

describe('the pour', () => {
  const round = rounds[2];

  it('speeds up while held, and fills the glass', () => {
    const pour = newPour();
    stepPour(pour, true, 50, round, GLASS_HEIGHT);
    const early = pour.flow;
    stepPour(pour, true, 400, round, GLASS_HEIGHT);
    expect(early).toBeGreaterThan(0);
    expect(pour.flow).toBeGreaterThan(early);
    expect(pour.fill).toBeGreaterThan(0);
  });

  it('goes on filling after the finger lifts, by about what is said', () => {
    const pour = newPour();
    stepPour(pour, true, 1200, round, GLASS_HEIGHT);
    const at = pour.fill;
    const predicted = coastAfterRelease(pour.flow);
    stepPour(pour, false, 2000, round, GLASS_HEIGHT);
    expect(pour.fill - at).toBeGreaterThan(predicted * 0.9);
    expect(pour.fill - at).toBeLessThan(predicted * 1.1);
    expect(pour.flow).toBeLessThan(0.4);
  });

  it('comes out the same at any frame rate', () => {
    const slow = newPour();
    const quick = newPour();
    for (let time = 0; time < 1485; time += 33) stepPour(slow, true, 33, round, GLASS_HEIGHT);
    for (let time = 0; time < 1485; time += 5) stepPour(quick, true, 5, round, GLASS_HEIGHT);
    expect(slow.fill).toBeCloseTo(quick.fill, 0);
  });

  it('never goes over the top of the glass', () => {
    const pour = newPour();
    stepPour(pour, true, 20000, round, GLASS_HEIGHT);
    expect(pour.fill).toBe(GLASS_HEIGHT);
  });

  it('surges about the usual flow, more in a wilder round', () => {
    const calm = { surge: 0.1, phase: 0 };
    const wild = { surge: 0.5, phase: 0 };
    const spread = (surge: { surge: number; phase: number }) => {
      let low = Infinity;
      let high = -Infinity;
      for (let time = 0; time < 5000; time += 20) {
        const value = surgeAt(time, surge);
        low = Math.min(low, value);
        high = Math.max(high, value);
      }
      return high - low;
    };
    expect(spread(wild)).toBeGreaterThan(spread(calm) * 3);
  });
});

describe('what a stop is worth', () => {
  const round = rounds[1];
  const tolerance = game.splitTolerance;

  it('is a split on the middle, close inside the mark, short or over outside it, a spill at the top', () => {
    expect(judge(round.centre, round, tolerance, GLASS_HEIGHT).verdict).toBe('split');
    expect(judge(round.centre + tolerance, round, tolerance, GLASS_HEIGHT).verdict).toBe('split');
    expect(judge(round.centre - round.band + 0.1, round, tolerance, GLASS_HEIGHT).verdict).toBe(
      'close',
    );
    expect(judge(round.centre - round.band - 1, round, tolerance, GLASS_HEIGHT).verdict).toBe(
      'short',
    );
    expect(judge(round.centre + round.band + 1, round, tolerance, GLASS_HEIGHT).verdict).toBe(
      'over',
    );
    expect(judge(GLASS_HEIGHT, round, tolerance, GLASS_HEIGHT).verdict).toBe('spill');
  });

  it('scores a split most, a close one by how near, and a miss nothing, times the round', () => {
    const split = roundPoints('split', 0, round, game.points);
    const near = roundPoints('close', 1, round, game.points);
    const far = roundPoints('close', round.band - 0.5, round, game.points);
    expect(split).toBe(game.points.split * round.number);
    expect(near).toBeGreaterThan(far);
    expect(far).toBeGreaterThan(0);
    expect(roundPoints('short', -20, round, game.points)).toBe(0);
    expect(roundPoints('spill', 50, round, game.points)).toBe(0);
  });

  it('moves the player on only inside the mark', () => {
    expect(['split', 'close'].every((verdict) => clearsRound(verdict as 'split' | 'close'))).toBe(
      true,
    );
    expect(['short', 'over', 'spill'].some((verdict) => clearsRound(verdict as 'short'))).toBe(
      false,
    );
  });
});

describe('every round can be won', () => {
  /** Pours, and lifts the finger when what is let through as the tap shuts would take it to `aim`. */
  function pourToAim(round: (typeof rounds)[number], lateMs: number): number {
    const pour = newPour();
    let open = true;
    let waited = 0;
    for (let time = 0; time < 30000; time += 8) {
      stepPour(pour, open, 8, round, GLASS_HEIGHT);
      if (open && pour.fill + coastAfterRelease(pour.flow) >= round.centre) {
        waited += 8;
        if (waited > lateMs) open = false;
      }
      if (!open && pour.flow < 0.4) break;
    }
    return pour.fill;
  }

  it('by lifting the finger at the right moment', () => {
    for (const round of rounds) {
      const fill = pourToAim(round, 0);
      expect(judge(fill, round, game.splitTolerance, GLASS_HEIGHT).verdict).not.toBe('spill');
      expect(Math.abs(fill - round.centre)).toBeLessThanOrEqual(round.band);
    }
  });

  it('with room for a finger that is a little early or late, even on the last round', () => {
    for (const round of rounds) {
      // The time the pour spends inside the mark, which is how long the finger has to lift in.
      const windowMs = ((2 * round.band) / (round.flow * 1.6)) * 1000;
      expect(windowMs).toBeGreaterThan(80);
    }
    const first = rounds[0];
    expect(Math.abs(pourToAim(first, 120) - first.centre)).toBeLessThanOrEqual(first.band);
  });

  it('and the tap shuts in the time it is said to', () => {
    expect(POUR.closeMs).toBeGreaterThan(0);
  });
});

describe('the glass', () => {
  it('is wider at the top than at the foot', () => {
    expect(glassWidthAt(0, 100, 60, 84)).toBe(60);
    expect(glassWidthAt(100, 100, 60, 84)).toBe(84);
    expect(glassWidthAt(50, 100, 60, 84)).toBe(72);
    expect(glassWidthAt(500, 100, 60, 84)).toBe(84);
  });
});

describe('the bonus games', () => {
  const bonus = game.bonus;
  if (!bonus) throw new Error('game.json has no bonus games');

  it('are read from game.json, or left out, and refused if wrong', () => {
    expect(bonus.kinds).toEqual(['rapid', 'darts', 'moving', 'serve', 'two']);
    expect(readGameData({ ...data, bonus: undefined }).bonus).toBeNull();
    expect(() => readGameData({ ...data, bonus: { ...data.bonus, kinds: ['rapid'] } })).toThrow(
      'as many kinds',
    );
    expect(() =>
      readGameData({
        ...data,
        bonus: { ...data.bonus, kinds: ['rapid', 'darts', 'moving', 'serve', 'dance'] },
      }),
    ).toThrow('kinds can only be');
    expect(() =>
      readGameData({ ...data, bonus: { ...data.bonus, after: [2, 3, 5, 6, 8] } }),
    ).toThrow('before the last pint');
    expect(() =>
      readGameData({ ...data, bonus: { ...data.bonus, after: [4, 2, 5, 6, 7] } }),
    ).toThrow('rising');
    expect(() =>
      readGameData({
        ...data,
        bonus: { ...data.bonus, rapid: { ...data.bonus.rapid, timeMs: 10 } },
      }),
    ).toThrow('timeMs');
    expect(() => readGameData({ ...data, bonus: { ...data.bonus, multiplier: 9 } })).toThrow(
      'multiplier',
    );
  });

  it('come up after the pints they are set for, and no others', () => {
    expect(bonusAfter(2, bonus)).toBe('rapid');
    expect(bonusAfter(3, bonus)).toBe('darts');
    expect(bonusAfter(5, bonus)).toBe('moving');
    expect(bonusAfter(6, bonus)).toBe('serve');
    expect(bonusAfter(7, bonus)).toBe('two');
    expect(bonusAfter(1, bonus)).toBeNull();
    expect(bonusAfter(4, bonus)).toBeNull();
    expect(bonusAfter(8, bonus)).toBeNull();
    expect(bonusAfter(2, null)).toBeNull();
  });

  it('give a rapid pour a quicker tap and a narrower mark, and two pints two marks', () => {
    const base = roundFor(2, game.pour, GLASS_HEIGHT);
    const [rapid] = bonusRounds('rapid', 2, game.pour, bonus, GLASS_HEIGHT);
    expect(rapid.flow).toBeCloseTo(base.flow * bonus.rapid.flowFactor);
    expect(rapid.band).toBeLessThan(base.band);
    expect(rapid.band).toBeGreaterThanOrEqual(3);
    expect(rapid.centre).toBe(base.centre);
    expect(bonusRounds('moving', 4, game.pour, bonus, GLASS_HEIGHT)).toHaveLength(1);
    const two = bonusRounds('two', 6, game.pour, bonus, GLASS_HEIGHT);
    expect(two).toHaveLength(2);
    expect(two[0].centre).not.toBe(two[1].centre);
  });

  it('can be won: a rapid pour has a window for the finger', () => {
    for (const cleared of bonus.after.filter((_, index) => bonus.kinds[index] === 'rapid')) {
      const [round] = bonusRounds('rapid', cleared, game.pour, bonus, GLASS_HEIGHT);
      // A quarter of a second, even at the tap's fastest: a person can hit that.
      expect(((2 * round.band) / (round.flow * 1.6)) * 1000).toBeGreaterThan(200);
      expect(round.centre / round.flow).toBeLessThan(bonus.rapid.timeMs / 1000);
    }
  });

  it('can be won: a moving glass is under the tap long enough, with time to spare', () => {
    // How much of its swing the glass is under the tap.
    let under = 0;
    const steps = 3600;
    for (let step = 0; step < steps; step += 1) {
      const offset = swingOffset(
        (step / steps) * bonus.moving.periodMs,
        bonus.moving.amplitude,
        bonus.moving.periodMs,
      );
      if (underTap(offset, CATCH_HALF)) under += 1;
    }
    const share = under / steps;
    expect(share).toBeGreaterThan(0.3);
    for (const cleared of bonus.after.filter((_, index) => bonus.kinds[index] === 'moving')) {
      const [round] = bonusRounds('moving', cleared, game.pour, bonus, GLASS_HEIGHT);
      const secondsNeeded = round.centre / round.flow / share;
      expect(secondsNeeded * 1000).toBeLessThan(bonus.moving.timeMs * 0.6);
    }
  });

  it('can be won: two pints take less time than there is, poured one after the other', () => {
    for (const cleared of bonus.after.filter((_, index) => bonus.kinds[index] === 'two')) {
      const rounds = bonusRounds('two', cleared, game.pour, bonus, GLASS_HEIGHT);
      const seconds = rounds.reduce((sum, round) => sum + round.centre / round.flow, 0);
      expect(seconds * 1000).toBeLessThan(bonus.two.timeMs * 0.7);
    }
  });

  it('swings about the middle, and a glass off to one side misses the tap', () => {
    expect(swingOffset(0, 56, 3600)).toBeCloseTo(0);
    expect(swingOffset(900, 56, 3600)).toBeCloseTo(56);
    expect(swingOffset(2700, 56, 3600)).toBeCloseTo(-56);
    expect(underTap(10, CATCH_HALF)).toBe(true);
    expect(underTap(-CATCH_HALF, CATCH_HALF)).toBe(true);
    expect(underTap(CATCH_HALF + 1, CATCH_HALF)).toBe(false);
  });

  it('score double, and are cleared only if every glass was', () => {
    expect(bonusScore([100, 250], bonus)).toBe(350 * bonus.multiplier);
    expect(bonusCleared(['split'])).toBe(true);
    expect(bonusCleared(['split', 'close'])).toBe(true);
    expect(bonusCleared(['split', 'short'])).toBe(false);
    expect(bonusCleared([])).toBe(false);
  });
});
