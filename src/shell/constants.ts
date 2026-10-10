/**
 * What is the same whatever type of game is playing: the size of the screen, the pixel font's
 * sizes, and the timings of a game on a kiosk. No imports, so anything may read it.
 *
 * A type's own tunables are its own (`platformer/config/constants.ts`).
 */

/** Every game is drawn at this size and scaled to fit the screen: a whole multiple on 1920×1080. */
export const GAME_WIDTH = 480;
export const GAME_HEIGHT = 270;

/** Text sizes. The pixel font is drawn on an 8px grid, so only multiples of 8 stay crisp. */
export const FONT_SIZE = {
  small: 8,
  medium: 16,
  large: 24,
  title: 40,
} as const;

/** The picture a shared link to the game shows: the title screen, at the size link previews want. */
export const SHARE_PICTURE = { width: 1200, height: 630 } as const;

/**
 * The game on a kiosk (`kiosk.ts`), where a play is paid for. None of it is used anywhere else.
 */
export const KIOSK = {
  /** How far under the title screen's prompt the second line (the credit, or the price) is. */
  detailGap: 16,
  /** How often the title screen asks for the credit, besides when the kiosk says a coin went in. */
  pollMs: 10_000,
  /** How long the end screen stays before the title screen comes back by itself. */
  endScreenMs: 20_000,
  /** How many more times a score is sent when the server does not answer, and how far apart. */
  scoreRetries: 3,
  scoreRetryMs: 5000,
  /** How long the title screen waits, with no credit on the kiosk, before it shows the scores. */
  attractMs: 15_000,
  /** How long the scores stay up before the title screen comes back. */
  scoresMs: 10_000,
  /** How long a player whose lives have run out has to buy more before the game ends. */
  continueMs: 30_000,
  /** How long a player has to enter initials before the scores are shown without them. */
  initialsMs: 30_000,
} as const;
