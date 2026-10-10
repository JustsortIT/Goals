/**
 * The rules of the game as plain sums, with no Phaser in them, so they can be tested
 * (`logic.test.ts`, `npm test`). Keep the rules here and the drawing in the scenes.
 *
 * A round is one pint. The player holds the screen to pour and lets go to stop; the tap does not
 * stop at once, so the stout goes on rising a little after the finger lifts. The aim is to stop
 * the top of the pint (the head) on the middle of the mark on the glass.
 */
import { POUR } from './config';
import type { BonusKind, BonusSettings, Difficulty, GameData } from './gameData';

/** One round, as the rules of the game make it from the round's number. */
export interface Round {
  number: number;
  /** Where the middle of the mark is, in pixels up from the inside of the bottom. */
  centre: number;
  /** How far either side of the middle still counts. */
  band: number;
  /** How fast the tap pours, px a second, before its surges. */
  flow: number;
  /** How much the tap surges and eases (0 is steady). */
  surge: number;
  /** Where in its surging the tap starts, so each round's tap behaves its own way. */
  phase: number;
}

/** Where the pour has got to: how full, how fast it is running, and how long the tap has been open. */
export interface Pour {
  fill: number;
  flow: number;
  openMs: number;
}

export type Verdict = 'split' | 'close' | 'short' | 'over' | 'spill';

export const newPour = (): Pour => ({ fill: 0, flow: 0, openMs: 0 });

/** The part of a number after the point. */
const fraction = (x: number): number => x - Math.floor(x);

/**
 * Round `number` (from 1), made by rule: the mark goes up and down the glass in a fixed
 * unevenly-spaced run, the tap is quicker and surges more each round, and the mark narrows.
 * Nothing is chosen by hand, so any round can be proved playable (`logic.test.ts`).
 */
export function roundFor(number: number, pour: Difficulty, glassHeight: number): Round {
  const along = fraction(number * 0.618034 + 0.17);
  const centre = (pour.markLow + (pour.markHigh - pour.markLow) * along) * glassHeight;
  return {
    number,
    centre,
    band: Math.max(pour.bandMin, pour.bandStart - pour.bandStep * (number - 1)),
    flow: pour.flowStart + pour.flowStep * (number - 1),
    surge: Math.min(0.6, pour.surgeStart + pour.surgeStep * (number - 1)),
    phase: number * 1.7,
  };
}

/** How the tap runs `openMs` after it was opened, as a share of its usual flow: it surges and eases. */
export function surgeAt(openMs: number, round: Pick<Round, 'surge' | 'phase'>): number {
  const wave =
    0.6 * Math.sin(openMs / 410 + round.phase) + 0.4 * Math.sin(openMs / 157 + round.phase * 2.3);
  return 1 + round.surge * wave;
}

/**
 * Moves the pour on by `deltaMs`. With the finger down the flow works up to what the tap gives;
 * with it up the flow dies away, which takes time, and the glass goes on filling meanwhile. It
 * changes `pour` and gives it back. Steps are cut short enough to be the same at any frame rate.
 */
export function stepPour(
  pour: Pour,
  holding: boolean,
  deltaMs: number,
  round: Round,
  glassHeight: number,
): Pour {
  let left = deltaMs;
  while (left > 0) {
    const dt = Math.min(left, 8);
    left -= dt;
    if (holding) pour.openMs += dt;
    const target = holding ? round.flow * surgeAt(pour.openMs, round) : 0;
    const tau = holding ? POUR.openMs : POUR.closeMs;
    pour.flow += (target - pour.flow) * (1 - Math.exp(-dt / tau));
    pour.fill = Math.min(glassHeight, pour.fill + (pour.flow * dt) / 1000);
  }
  return pour;
}

/** How far the fill will still rise if the finger lifts now: what the tap lets through as it shuts. */
export function coastAfterRelease(flow: number): number {
  return (flow * POUR.closeMs) / 1000;
}

/** What a stop at `fill` comes to: a split on the middle, close inside the mark, short, over, or a spill. */
export function judge(
  fill: number,
  round: Round,
  splitTolerance: number,
  glassHeight: number,
): { verdict: Verdict; error: number } {
  const error = fill - round.centre;
  if (fill >= glassHeight) return { verdict: 'spill', error };
  const size = Math.abs(error);
  if (size <= splitTolerance) return { verdict: 'split', error };
  if (size <= round.band) return { verdict: 'close', error };
  return { verdict: error < 0 ? 'short' : 'over', error };
}

/** What a stop is worth: only one inside the mark scores, the nearer the middle the more, times the round. */
export function roundPoints(
  verdict: Verdict,
  error: number,
  round: Round,
  points: GameData['points'],
): number {
  if (verdict === 'split') return points.split * round.number;
  if (verdict !== 'close') return 0;
  const nearness = 1 - Math.abs(error) / round.band;
  return Math.max(10, Math.round(points.close * nearness)) * round.number;
}

/** A pour that stops inside the mark moves the player on; anything else is a life lost. */
export const clearsRound = (verdict: Verdict): boolean =>
  verdict === 'split' || verdict === 'close';

/** The glass's inside is this wide, this far up from the bottom (0) to the top (`glassHeight`). */
export function glassWidthAt(
  up: number,
  glassHeight: number,
  bottomInner: number,
  topInner: number,
): number {
  return bottomInner + (topInner - bottomInner) * Math.min(1, Math.max(0, up / glassHeight));
}

/* ------------------------------------------------------------------------------------------
 * Bonus games
 * ---------------------------------------------------------------------------------------- */

/** Which bonus game comes up after pint `cleared` is cleared, if any. */
export function bonusAfter(cleared: number, bonus: BonusSettings | null): BonusKind | null {
  if (!bonus) return null;
  const index = bonus.after.indexOf(cleared);
  return index >= 0 ? bonus.kinds[index] : null;
}

/**
 * The rounds of a bonus game, one for each glass, made by rule from the number of the pint that
 * has just been cleared: a rapid pour is that pint with a somewhat quicker tap and a somewhat
 * narrower mark; a moving glass is that pint with a quicker tap; two pints are that pint and another.
 */
export function bonusRounds(
  kind: BonusKind,
  number: number,
  pour: Difficulty,
  bonus: BonusSettings,
  glassHeight: number,
): Round[] {
  const base = roundFor(number, pour, glassHeight);
  if (kind === 'rapid') {
    return [
      {
        ...base,
        flow: base.flow * bonus.rapid.flowFactor,
        band: Math.max(3, base.band * bonus.rapid.bandFactor),
      },
    ];
  }
  if (kind === 'moving') return [{ ...base, flow: base.flow * bonus.moving.flowFactor }];
  return [base, roundFor(number + 3, pour, glassHeight)];
}

/** How far a sliding glass is from the middle, `timeMs` into its swing. */
export function swingOffset(timeMs: number, amplitude: number, periodMs: number): number {
  return amplitude * Math.sin((2 * Math.PI * timeMs) / periodMs);
}

/** Whether a glass `offset` pixels from under the tap is still catching the pour. */
export const underTap = (offset: number, catchHalf: number): boolean =>
  Math.abs(offset) <= catchHalf;

/** What a bonus game scores: the pints' points added up, times the bonus's multiplier. */
export function bonusScore(points: readonly number[], bonus: BonusSettings): number {
  return points.reduce((sum, one) => sum + one, 0) * bonus.multiplier;
}

/** A bonus game is cleared when every glass was stopped inside its mark. */
export const bonusCleared = (verdicts: readonly Verdict[]): boolean =>
  verdicts.length > 0 && verdicts.every(clearsRound);
