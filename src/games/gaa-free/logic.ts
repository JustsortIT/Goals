/**
 * The rules of the game as plain sums, with no Phaser in them, so they can be tested
 * (`logic.test.ts`, `npm test`). Keep the rules here and the drawing in the scenes.
 *
 * The kick: the player drags a finger back from where it first touched. The ball goes the other
 * way, `KICK.gain` times as far as the drag, and lands where the goal is. A target is hit if the
 * ball lands on it.
 */
import { GOAL, KICK } from './config';
import type { Bonus, Target, Wind } from './gameData';

export interface Point {
  x: number;
  y: number;
}

/** The goal as it stands on the screen: the posts, the bar and the ground. */
export interface GoalGeometry {
  scale: number;
  left: number;
  right: number;
  /** The underside of the crossbar. */
  top: number;
  baseY: number;
  mouthWidth: number;
  mouthHeight: number;
  postWidth: number;
  /** The top of the posts. */
  postTop: number;
}

/** A target as it stands on the screen. */
export interface Spot extends Point {
  r: number;
}

/** What a kick came to. */
export type ShotKind = 'hit' | 'bonus' | 'repeat' | 'net' | 'over' | 'wide' | 'short';

export interface Shot {
  kind: ShotKind;
  /** Which target, for a hit or a repeat. -1 for anything else, the bonus target included. */
  index: number;
}

/** How big the goal is at a level: it goes back a little each time, but never past `minScale`. */
export function levelScale(
  level: number,
  shrink: number,
  minScale: number = GOAL.minScale,
): number {
  return Math.max(minScale, 1 - shrink * (level - 1));
}

/** The goal at a scale. Whole pixels, so what is drawn is what is hit. */
export function goalGeometry(scale: number): GoalGeometry {
  const mouthWidth = Math.round(GOAL.width * scale);
  const mouthHeight = Math.round(GOAL.mouthHeight * scale);
  const baseY = Math.round(GOAL.baseY - (1 - scale) * GOAL.lift);
  const left = Math.round(GOAL.centreX - mouthWidth / 2);
  return {
    scale,
    left,
    right: left + mouthWidth,
    top: baseY - mouthHeight,
    baseY,
    mouthWidth,
    mouthHeight,
    postWidth: Math.max(3, Math.round(5 * scale)),
    postTop: baseY - Math.round(GOAL.postHeight * scale),
  };
}

/** Where each target is on the screen, for a goal. */
export function targetSpots(geometry: GoalGeometry, targets: readonly Target[]): Spot[] {
  return targets.map((target) => ({
    x: geometry.left + target.x * geometry.mouthWidth,
    y: geometry.top + target.y * geometry.mouthHeight,
    r: target.radius * geometry.scale,
  }));
}

const length = (pull: Point): number => Math.hypot(pull.x, pull.y);

/** A pull held to the longest there is, and no further down than the screen goes. */
export function clampPull(pull: Point, maxLength: number, maxY: number): Point {
  const y = Math.min(pull.y, maxY);
  const size = length({ x: pull.x, y });
  if (size <= maxLength) return { x: pull.x, y };
  return { x: (pull.x * maxLength) / size, y: (y * maxLength) / size };
}

/** Whether a pull is a kick: back (down the screen) and more than a touch. */
export function isKick(pull: Point, minLength: number = KICK.minPull): boolean {
  return pull.y > 0 && length(pull) >= minLength;
}

/** Where a ball kicked from `origin` with a pull comes down in the goal's plane. */
export function landingPoint(origin: Point, pull: Point, gain: number = KICK.gain): Point {
  return { x: origin.x - pull.x * gain, y: origin.y - pull.y * gain };
}

/** The pull that lands the ball on a point: the other way round from `landingPoint`. */
export function pullFor(origin: Point, point: Point, gain: number = KICK.gain): Point {
  return { x: (origin.x - point.x) / gain, y: (origin.y - point.y) / gain };
}

/** Where the ball is, `along` of the way (0 to 1) from the kick to where it lands. */
export function ballAt(origin: Point, landing: Point, along: number, arc: number): Point {
  return {
    x: origin.x + (landing.x - origin.x) * along,
    y: origin.y + (landing.y - origin.y) * along - arc * Math.sin(Math.PI * along),
  };
}

/** What the kick came to: a target hit (or hit again), the net, or off the goal. */
export function resolveShot(
  landing: Point,
  geometry: GoalGeometry,
  spots: readonly Spot[],
  cleared: readonly boolean[],
  reach: number = KICK.reach,
  bonus: Spot | null = null,
): Shot {
  // The bonus target moves in front of the others, so it is the first thing the ball can touch.
  if (bonus && Math.hypot(landing.x - bonus.x, landing.y - bonus.y) <= bonus.r + reach)
    return { kind: 'bonus', index: -1 };

  let best = -1;
  let bestScore = Infinity;
  spots.forEach((spot, index) => {
    const distance = Math.hypot(landing.x - spot.x, landing.y - spot.y);
    if (distance > spot.r + reach) return;
    // A target still to hit wins over one already hit, if the ball touches both.
    const score = distance - spot.r + (cleared[index] ? 1000 : 0);
    if (score < bestScore) {
      best = index;
      bestScore = score;
    }
  });
  if (best >= 0) return { kind: cleared[best] ? 'repeat' : 'hit', index: best };

  const between = landing.x >= geometry.left && landing.x <= geometry.right;
  if (between && landing.y >= geometry.top && landing.y <= geometry.baseY)
    return { kind: 'net', index: -1 };
  if (between) return { kind: landing.y < geometry.top ? 'over' : 'short', index: -1 };
  return { kind: 'wide', index: -1 };
}

/** What a target scores at a level: the same target is worth more the farther the goal. */
export function levelPoints(points: number, level: number): number {
  return points * level;
}

/** The ball's size on landing: smaller for a farther goal. */
export function landScale(goalScale: number): number {
  const along = Math.min(Math.max((1 - goalScale) / (1 - GOAL.minScale), 0), 1);
  return KICK.landScaleNear + (KICK.landScaleFar - KICK.landScaleNear) * along;
}

/** How long the bonus target takes to go round once on a level: quicker each goal. */
export function bonusPeriod(bonus: Pick<Bonus, 'periodMs' | 'speedUp'>, level: number): number {
  return bonus.periodMs / (1 + bonus.speedUp * (level - 1));
}

/** Where the bonus target is 	imeMs into a level: a figure of eight, the same every time. */
export function bonusSpot(
  timeMs: number,
  bonus: Bonus,
  level: number,
  geometry: GoalGeometry,
  out: Spot = { x: 0, y: 0, r: 0 },
): Spot {
  const phase = (2 * Math.PI * timeMs) / bonusPeriod(bonus, level);
  const across = bonus.x + bonus.spanX * Math.sin(phase);
  const down = bonus.y + bonus.spanY * Math.sin(2 * phase);
  out.x = geometry.left + across * geometry.mouthWidth;
  out.y = geometry.top + down * geometry.mouthHeight;
  out.r = bonus.radius * geometry.scale;
  return out;
}

/** A colour (0xrrggbb) made lighter (above 1) or darker (below 1), for the shading of a picture. */
export function shade(colour: number, factor: number): number {
  const part = (shift: number): number =>
    Math.min(255, Math.max(0, Math.round(((colour >> shift) & 255) * factor)));
  return (part(16) << 16) | (part(8) << 8) | part(0);
}

/** The most the wind can push a ball on a level, in pixels over a whole flight. */
export function windMost(wind: Wind | null, level: number): number {
  if (!wind || level < wind.fromLevel) return 0;
  return wind.strength + wind.perLevel * (level - wind.fromLevel);
}

/**
 * How far the wind pushes a ball kicked `timeMs` into a level, in pixels over a whole flight:
 * positive is to the right. It blows mostly one way, which alternates from goal to goal, and
 * gusts come and go on top, so it can ease, or even turn.
 */
export function windAt(timeMs: number, wind: Wind | null, level: number): number {
  if (!wind || level < wind.fromLevel) return 0;
  const side = level % 2 === 0 ? 1 : -1;
  const gust = Math.sin((2 * Math.PI * timeMs) / wind.gustMs + level * 1.7);
  return windMost(wind, level) * (wind.steadiness * side + (1 - wind.steadiness) * gust);
}

/**
 * How a ball flying away from the kicker looks: it gets smaller in proportion to how far off it
 * is, so it covers the screen quickly at first and slowly at the end. `t` is the share of the
 * flight's time gone (0 to 1); `along` is how far along the line to the landing it looks to have
 * got, and `scale` how big it is, ending at `endScale`.
 */
export function flightProgress(t: number, endScale: number): { along: number; scale: number } {
  const time = Math.min(1, Math.max(0, t));
  const scale = 1 / (1 + (1 / endScale - 1) * time);
  return { along: (1 - scale) / (1 - endScale), scale };
}
