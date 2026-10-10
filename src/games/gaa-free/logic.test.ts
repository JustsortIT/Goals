import { describe, expect, it } from 'vitest';
import { GOAL, KICK } from './config';
import { readGameData } from './gameData';
import {
  ballAt,
  bonusPeriod,
  bonusSpot,
  clampPull,
  goalGeometry,
  isKick,
  landingPoint,
  landScale,
  levelPoints,
  levelScale,
  pullFor,
  resolveShot,
  shade,
  targetSpots,
  windAt,
  windMost,
} from './logic';
import data from './game.json';

const game = readGameData(data);

describe("the game's data", () => {
  it('reads game.json: five targets, each its own size', () => {
    expect(game.name).toBe('FREE TAKER');
    expect(game.targets).toHaveLength(5);
    expect(new Set(game.targets.map((target) => target.radius)).size).toBe(5);
    expect(game.targets[0].colour).toBe(0xffd76a);
  });

  it('gives smaller targets more points', () => {
    const bySize = [...game.targets].sort((a, b) => b.radius - a.radius);
    expect(bySize.map((target) => target.points)).toEqual(
      [...bySize.map((target) => target.points)].sort((a, b) => a - b),
    );
  });

  it("says what is wrong with data that is not this game's", () => {
    const [first, second] = data.targets;
    expect(() => readGameData(null)).toThrow('no data');
    expect(() => readGameData({ ...data, targets: [] })).toThrow('no targets');
    expect(() => readGameData({ ...data, name: 'CAF\u00c9' })).toThrow('plain keyboard characters');
    expect(() => readGameData({ ...data, targets: [{ ...first, points: 0 }] })).toThrow(
      'points above zero',
    );
    expect(() => readGameData({ ...data, targets: [{ ...first, x: 0.01 }] })).toThrow(
      'does not fit',
    );
    expect(() => readGameData({ ...data, targets: [first, { ...first, x: 0.52 }] })).toThrow(
      'same size',
    );
    expect(() =>
      readGameData({ ...data, targets: [first, { ...second, radius: 16, x: 0.4, y: 0.55 }] }),
    ).toThrow('overlap');
    expect(() => readGameData({ ...data, levels: 0 })).toThrow('1 to 12 levels');
    expect(() => readGameData({ ...data, levels: 12, shrink: 0.1 })).toThrow('too far');
  });
});

describe('the goal', () => {
  it('goes back a little each level, and no further than its smallest', () => {
    expect(levelScale(1, 0.07)).toBe(1);
    expect(levelScale(2, 0.07)).toBeCloseTo(0.93);
    expect(levelScale(50, 0.07)).toBe(GOAL.minScale);
  });

  it('gets smaller and higher up the screen as it goes back', () => {
    const near = goalGeometry(1);
    const far = goalGeometry(0.65);
    expect(far.mouthWidth).toBeLessThan(near.mouthWidth);
    expect(far.baseY).toBeLessThan(near.baseY);
    expect(near.left + near.mouthWidth / 2).toBe(GOAL.centreX);
  });

  it('shrinks the targets with it', () => {
    const near = targetSpots(goalGeometry(1), game.targets);
    const far = targetSpots(goalGeometry(0.65), game.targets);
    far.forEach((spot, index) => expect(spot.r).toBeCloseTo(near[index].r * 0.65));
  });
});

describe('the kick', () => {
  it('is a pull back that is more than a touch', () => {
    expect(isKick({ x: 0, y: 30 })).toBe(true);
    expect(isKick({ x: 0, y: 3 })).toBe(false);
    expect(isKick({ x: 0, y: -40 })).toBe(false);
  });

  it('holds a pull to the longest, and no further down than the screen goes', () => {
    const pull = clampPull({ x: 300, y: 400 }, 90, 70);
    expect(Math.hypot(pull.x, pull.y)).toBeCloseTo(90);
    expect(pull.y).toBeLessThanOrEqual(70);
    expect(clampPull({ x: 10, y: 20 }, 90, 70)).toEqual({ x: 10, y: 20 });
  });

  it('sends the ball the other way from the pull', () => {
    const landing = landingPoint({ x: 240, y: 200 }, { x: 20, y: 40 }, 2);
    expect(landing).toEqual({ x: 200, y: 120 });
    expect(pullFor({ x: 240, y: 200 }, landing, 2)).toEqual({ x: 20, y: 40 });
  });

  it('arcs: on the ground at both ends, highest in the middle', () => {
    const from = { x: 240, y: 200 };
    const to = { x: 240, y: 100 };
    expect(ballAt(from, to, 0, 30)).toEqual(from);
    expect(ballAt(from, to, 1, 30).y).toBeCloseTo(100);
    expect(ballAt(from, to, 0.5, 30).y).toBeCloseTo(120);
  });
});

describe('every target can be hit, on every level', () => {
  it('with a pull the finger can make', () => {
    for (let level = 1; level <= game.levels; level += 1) {
      const geometry = goalGeometry(levelScale(level, game.shrink));
      for (const spot of targetSpots(geometry, game.targets)) {
        const pull = pullFor(KICK.origin, spot);
        expect(pull.y).toBeGreaterThan(0);
        expect(pull.y).toBeLessThanOrEqual(KICK.maxPullY);
        expect(Math.hypot(pull.x, pull.y)).toBeLessThanOrEqual(KICK.maxPull);
        expect(isKick(pull)).toBe(true);
      }
    }
  });

  it('and is still big enough to aim at on the last level', () => {
    const geometry = goalGeometry(levelScale(game.levels, game.shrink));
    const smallest = Math.min(...targetSpots(geometry, game.targets).map((spot) => spot.r));
    // Within this many pixels of the finger's own movement: about the width of a fingertip's wobble.
    expect((smallest + KICK.reach) / KICK.gain).toBeGreaterThanOrEqual(2.5);
  });
});

describe('what a kick comes to', () => {
  const geometry = goalGeometry(1);
  const spots = targetSpots(geometry, game.targets);
  const none = game.targets.map(() => false);
  const at = (dx: number, dy: number) => ({ x: spots[0].x + dx, y: spots[0].y + dy });

  it('hits a target the ball touches', () => {
    expect(resolveShot(spots[0], geometry, spots, none)).toEqual({ kind: 'hit', index: 0 });
    const edge = spots[0].r + KICK.reach;
    expect(resolveShot(at(edge, 0), geometry, spots, none).kind).toBe('hit');
    expect(resolveShot(at(edge + 1, 0), geometry, spots, none).kind).toBe('net');
  });

  it('counts a target already hit as a repeat, not a miss', () => {
    const done = game.targets.map((_, index) => index === 0);
    expect(resolveShot(spots[0], geometry, spots, done)).toEqual({ kind: 'repeat', index: 0 });
  });

  it('says where a ball that missed went', () => {
    const middle = geometry.left + geometry.mouthWidth / 2;
    expect(resolveShot({ x: middle, y: geometry.top - 10 }, geometry, [], []).kind).toBe('over');
    expect(resolveShot({ x: middle, y: geometry.baseY + 10 }, geometry, [], []).kind).toBe('short');
    expect(resolveShot({ x: geometry.left - 5, y: geometry.top + 5 }, geometry, [], []).kind).toBe(
      'wide',
    );
    expect(resolveShot({ x: middle, y: geometry.top + 1 }, geometry, [], []).kind).toBe('net');
  });
});

describe('the score', () => {
  it('is worth more the farther the goal', () => {
    expect(levelPoints(30, 1)).toBe(30);
    expect(levelPoints(30, 4)).toBe(120);
  });

  it('draws the ball smaller on a farther goal', () => {
    expect(landScale(1)).toBe(KICK.landScaleNear);
    expect(landScale(GOAL.minScale)).toBe(KICK.landScaleFar);
    expect(landScale(0.7)).toBeLessThan(landScale(0.9));
  });
});

describe('the bonus target', () => {
  const bonus = game.bonus;
  if (!bonus) throw new Error('game.json has no bonus target');

  it('is read from game.json, or left out', () => {
    expect(bonus.points).toBe(100);
    expect(readGameData({ ...data, bonus: undefined }).bonus).toBeNull();
    expect(() => readGameData({ ...data, bonus: { ...data.bonus, spanX: 0.5 } })).toThrow(
      'outside the goal',
    );
    expect(() => readGameData({ ...data, bonus: { ...data.bonus, periodMs: 100 } })).toThrow(
      'periodMs',
    );
    expect(() => readGameData({ ...data, bonus: { ...data.bonus, radius: 2 } })).toThrow('radius');
  });

  it('goes round the goal the same way every time, and quicker on a farther goal', () => {
    const geometry = goalGeometry(1);
    const period = bonusPeriod(bonus, 1);
    expect(period).toBe(bonus.periodMs);
    expect(bonusPeriod(bonus, 4)).toBeLessThan(period);
    const start = bonusSpot(0, bonus, 1, geometry);
    const round = bonusSpot(period, bonus, 1, geometry);
    expect(round.x).toBeCloseTo(start.x);
    expect(round.y).toBeCloseTo(start.y);
    expect(bonusSpot(period / 4, bonus, 1, geometry).x).toBeGreaterThan(start.x + 20);
  });

  it('can be written into an object that is given, so moving it makes nothing new', () => {
    const out = { x: 0, y: 0, r: 0 };
    expect(bonusSpot(500, bonus, 1, goalGeometry(1), out)).toBe(out);
    expect(out.r).toBe(bonus.radius);
  });

  it('stays inside the goal and can be reached at every moment of every level', () => {
    for (let level = 1; level <= game.levels; level += 1) {
      const geometry = goalGeometry(levelScale(level, game.shrink));
      for (let time = 0; time < bonusPeriod(bonus, level); time += 50) {
        const spot = bonusSpot(time, bonus, level, geometry);
        expect(spot.x - spot.r).toBeGreaterThanOrEqual(geometry.left);
        expect(spot.x + spot.r).toBeLessThanOrEqual(geometry.right);
        expect(spot.y - spot.r).toBeGreaterThanOrEqual(geometry.top);
        expect(spot.y + spot.r).toBeLessThanOrEqual(geometry.baseY);
        const pull = pullFor(KICK.origin, spot);
        expect(pull.y).toBeLessThanOrEqual(KICK.maxPullY);
        expect(Math.hypot(pull.x, pull.y)).toBeLessThanOrEqual(KICK.maxPull);
      }
    }
  });

  it('is hit before a target behind it, and scores nothing once it is gone', () => {
    const geometry = goalGeometry(1);
    const spots = targetSpots(geometry, game.targets);
    const none = game.targets.map(() => false);
    const over = { ...spots[0] };
    expect(resolveShot(spots[0], geometry, spots, none, KICK.reach, over)).toEqual({
      kind: 'bonus',
      index: -1,
    });
    expect(resolveShot(spots[0], geometry, spots, none, KICK.reach, null).kind).toBe('hit');
    const far = { x: over.x + over.r + KICK.reach + 1, y: over.y, r: over.r };
    expect(resolveShot(spots[0], geometry, spots, none, KICK.reach, far).kind).toBe('hit');
  });
});

describe('colour', () => {
  it('is made lighter or darker a part at a time, and kept in range', () => {
    expect(shade(0x808080, 0.5)).toBe(0x404040);
    expect(shade(0xff8000, 2)).toBe(0xffff00);
    expect(shade(0x102030, 0)).toBe(0);
  });
});

describe('the wind', () => {
  const wind = game.wind;
  if (!wind) throw new Error('game.json has no wind');

  it('is read from game.json, or left out, and refused if it is wrong', () => {
    expect(wind.fromLevel).toBe(2);
    expect(readGameData({ ...data, wind: undefined }).wind).toBeNull();
    expect(() => readGameData({ ...data, wind: { ...data.wind, fromLevel: 9 } })).toThrow(
      'fromLevel',
    );
    expect(() => readGameData({ ...data, wind: { ...data.wind, strength: 99 } })).toThrow(
      'strength',
    );
    expect(() => readGameData({ ...data, wind: { ...data.wind, steadiness: 2 } })).toThrow(
      'steadiness',
    );
    expect(() => readGameData({ ...data, wind: { ...data.wind, perLevel: 10 } })).toThrow(
      'too strong',
    );
  });

  it('does not blow on the first goal, and blows harder on each after', () => {
    expect(windMost(wind, 1)).toBe(0);
    expect(windAt(1234, wind, 1)).toBe(0);
    expect(windMost(wind, 3)).toBeGreaterThan(windMost(wind, 2));
    expect(windMost(null, 5)).toBe(0);
    expect(windAt(500, null, 5)).toBe(0);
  });

  it('is the same at the same moment, never more than its most, and gusts', () => {
    for (let level = wind.fromLevel; level <= game.levels; level += 1) {
      const seen = new Set<number>();
      for (let time = 0; time < wind.gustMs * 2; time += 100) {
        const push = windAt(time, wind, level);
        expect(windAt(time, wind, level)).toBe(push);
        expect(Math.abs(push)).toBeLessThanOrEqual(windMost(wind, level) + 1e-9);
        seen.add(Math.round(push));
      }
      expect(seen.size).toBeGreaterThan(5);
    }
  });

  it('blows mostly one way on a goal, and the other way on the next', () => {
    const average = (level: number) => {
      let sum = 0;
      let count = 0;
      for (let time = 0; time < wind.gustMs; time += 50) {
        sum += windAt(time, wind, level);
        count += 1;
      }
      return sum / count;
    };
    expect(Math.sign(average(2))).not.toBe(Math.sign(average(3)));
  });

  it('can always be allowed for: every target is still reachable aimed against the strongest wind', () => {
    for (let level = 1; level <= game.levels; level += 1) {
      const geometry = goalGeometry(levelScale(level, game.shrink));
      const most = windMost(wind, level);
      for (const spot of targetSpots(geometry, game.targets)) {
        for (const side of [-1, 1]) {
          // To land on the spot with the wind pushing `side * most`, aim that far the other way.
          const pull = pullFor(KICK.origin, { x: spot.x - side * most, y: spot.y });
          expect(pull.y).toBeLessThanOrEqual(KICK.maxPullY);
          expect(Math.hypot(pull.x, pull.y)).toBeLessThanOrEqual(KICK.maxPull);
        }
      }
    }
  });
});
