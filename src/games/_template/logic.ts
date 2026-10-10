/**
 * The rules of the game as plain sums, with no Phaser in them, so they can be tested
 * (`logic.test.ts`, `npm test`). Keep the rules here and the drawing in the scenes: it is what
 * makes a game easy to change, and to trust.
 */
import type { Drop } from './gameData';

/** Where the paddle is after `deltaMs`, going towards `target` no faster than `speed`, kept on the screen. */
export function movePaddle(
  x: number,
  target: number,
  speed: number,
  deltaMs: number,
  width: number,
  screen: number,
): number {
  const step = (speed * deltaMs) / 1000;
  const next = Math.abs(target - x) <= step ? target : x + Math.sign(target - x) * step;
  return Math.min(Math.max(next, width / 2), screen - width / 2);
}

/** Whether a drop that has come down to the paddle's height landed on it. */
export function isCaught(
  dropX: number,
  paddleX: number,
  paddleWidth: number,
  dropSize: number,
): boolean {
  return Math.abs(dropX - paddleX) <= (paddleWidth + dropSize) / 2;
}

/** How long until the next drop: shorter as the score grows, down to the quickest. */
export function everyMs(
  score: number,
  first: number,
  quickest: number,
  quickestAtScore: number,
): number {
  const along = Math.min(Math.max(score / quickestAtScore, 0), 1);
  return Math.round(first + (quickest - first) * along);
}

/** The drop a roll from 0 up to 1 picks, each as often as its weight says. */
export function pickDrop(drops: readonly Drop[], roll: number): Drop {
  const total = drops.reduce((sum, drop) => sum + drop.weight, 0);
  let left = roll * total;
  for (const drop of drops) {
    left -= drop.weight;
    if (left < 0) return drop;
  }
  return drops[drops.length - 1];
}
