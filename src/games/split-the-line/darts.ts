/**
 * The rules of the darts bonus, as plain sums with no Phaser in them (tested in
 * `bonusGames.test.ts`). A crosshair sways over the board; a tap throws a dart where it is, and the
 * darts add up to a score that has to reach the target. A dart's score is the standard board's.
 */
import { BOARD } from './config';
import type { DartsSettings } from './gameData';

/** The numbers round the board, clockwise from the top. */
export const BOARD_ORDER = [
  20, 1, 18, 4, 13, 6, 10, 15, 2, 17, 3, 19, 7, 16, 8, 11, 14, 9, 12, 5,
] as const;

export type Ring = 'bull' | 'outer' | 'treble' | 'double' | 'single' | 'miss';

export interface DartHit {
  score: number;
  ring: Ring;
  /** The number of the segment, or 0 for the bull, the outer bull and a miss. */
  number: number;
}

/** What a dart is worth where it lands, `dx` and `dy` pixels from the middle of the board. */
export function dartHit(dx: number, dy: number, radius: number = BOARD.radius): DartHit {
  const r = Math.hypot(dx, dy) / radius;
  if (r > 1) return { score: 0, ring: 'miss', number: 0 };
  if (r <= BOARD.rings.bull) return { score: 50, ring: 'bull', number: 0 };
  if (r <= BOARD.rings.outerBull) return { score: 25, ring: 'outer', number: 0 };

  // The angle clockwise from the top; each segment is a twentieth of a turn, the first centred on the top.
  const turn = (Math.atan2(dx, -dy) + 2 * Math.PI) % (2 * Math.PI);
  const segment = Math.floor(((turn + Math.PI / 20) % (2 * Math.PI)) / (Math.PI / 10));
  const number = BOARD_ORDER[segment];
  if (r >= BOARD.rings.trebleIn && r <= BOARD.rings.trebleOut)
    return { score: number * 3, ring: 'treble', number };
  if (r >= BOARD.rings.doubleIn) return { score: number * 2, ring: 'double', number };
  return { score: number, ring: 'single', number };
}

/** The short name of a hit, as the game writes it: BULL, 25, T20, D16 or a plain number. */
export function hitName(hit: DartHit): string {
  if (hit.ring === 'miss') return 'MISS';
  if (hit.ring === 'bull') return 'BULL';
  if (hit.ring === 'outer') return '25';
  if (hit.ring === 'treble') return `T${hit.number}`;
  if (hit.ring === 'double') return `D${hit.number}`;
  return String(hit.number);
}

/** One round of the bonus, made by rule from the number of the pint it comes after. */
export interface DartsRound {
  throws: number;
  target: number;
  /** How long the crosshair takes to go once across, side to side. */
  periodMs: number;
  timeMs: number;
  pointsEach: number;
}

export function dartsRound(number: number, settings: DartsSettings): DartsRound {
  return {
    throws: settings.throws,
    target: Math.min(
      settings.throws * 60,
      settings.targetStart + settings.targetStep * (number - 1),
    ),
    periodMs: settings.periodMs / (1 + settings.speedUp * (number - 1)),
    timeMs: settings.timeMs,
    pointsEach: settings.pointsEach,
  };
}

/**
 * Where the crosshair is `timeMs` into the round, in pixels from the middle of the board. It
 * wanders as a Lissajous figure: sideways with one period and up and down with another that is not
 * a whole number of times it, so it never repeats in a way a player can learn, and covers the board.
 */
export function crosshairAt(timeMs: number, periodMs: number): { x: number; y: number } {
  const reach = BOARD.radius * BOARD.sway;
  return {
    x: reach * Math.sin((2 * Math.PI * timeMs) / periodMs + 0.6),
    y: reach * Math.sin((2 * Math.PI * timeMs) / (periodMs * 1.37) + 2.1),
  };
}

/** What the round's darts are worth: the score on the board, a point value each, times the pint's number. */
export function dartsPoints(total: number, number: number, round: DartsRound): number {
  return total * round.pointsEach * number;
}

/** The round is won if the darts add up to the target. */
export const dartsCleared = (total: number, round: DartsRound): boolean => total >= round.target;
