/** The game's numbers and names, in one place. No Phaser imports. */
import { GAME_HEIGHT, GAME_WIDTH } from '../../shell/constants';

export const SceneKey = { Boot: 'Boot', Title: 'Title', Play: 'Play', Over: 'Over' } as const;

export const TextureKey = {
  Backdrop: 'tap-backdrop',
  Glass: 'tap-glass',
  Vignette: 'tap-vignette',
} as const;

/** Where the game's data is kept for the scenes (`this.registry`). */
export const DATA_KEY = 'gameData';

export const COLOUR = {
  background: 0x1a0f0a,
  gold: 0xffd76a,
  quiet: 0xd9d2c4,
  wash: 0x0b0705,
  white: 0xf4f6f8,
  good: 0x9be7a0,
  bad: 0xff9a9a,
} as const;

/**
 * The pint glass, as it stands on the bar. Heights are in pixels up from the inside of the
 * bottom: a pint is `bottom - top` pixels full, and the stout's top, head included, is called
 * the fill. The glass is wider at the top than at the foot, as a pint glass is.
 */
export const GLASS = {
  x: 296,
  top: 70,
  bottom: 226,
  topInner: 84,
  bottomInner: 60,
} as const;
export const GLASS_HEIGHT = GLASS.bottom - GLASS.top;

/** Where the tap's spout is, over the glass. */
export const SPOUT = { x: GLASS.x, y: 58 } as const;

/** The tap: how quickly it opens and shuts (the time it takes to get most of the way). */
export const POUR = { openMs: 110, closeMs: 150 } as const;

export const PLAY = {
  /** With no kiosk (a preview, or public play) a game is this many lives, and nothing is paid. */
  freeLives: 3,
  /** How long a result stays up before the glass is slid away. */
  resultMs: 1700,
  slideMs: 380,
  winMs: 2000,
  /** The tap is slow enough to count as stopped below this many pixels a second. */
  stoppedBelow: 0.4,
  /** How long nobody touches the screen before the game shows how to pour. */
  hintAfterMs: 6000,
} as const;

export const SCREEN = { width: GAME_WIDTH, height: GAME_HEIGHT } as const;
