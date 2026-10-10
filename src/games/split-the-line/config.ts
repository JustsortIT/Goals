/** The game's numbers and names, in one place. No Phaser imports. */
import { GAME_HEIGHT, GAME_WIDTH } from '../../shell/constants';

export const SceneKey = {
  Boot: 'Boot',
  Title: 'Title',
  Play: 'Play',
  Over: 'Over',
  Darts: 'Darts',
  Serve: 'Serve',
} as const;

export const TextureKey = {
  Backdrop: 'tap-backdrop',
  Glass: 'tap-glass',
  GlassBack: 'tap-glass-back',
  Stout: 'tap-stout',
  Shadow: 'tap-shadow',
  Vignette: 'tap-vignette',
  /** The pub's room, with a bar and no taps (serving), and a wall with nothing on it (darts). */
  BackdropRoom: 'tap-backdrop-room',
  BackdropWall: 'tap-backdrop-wall',
  Board: 'tap-board',
  DartFlying: 'tap-dart-flying',
  DartStuck: 'tap-dart-stuck',
} as const;

/** The drinks a customer can want: stout, lager and red ale. The taps' handles are these colours. */
export const DRINKS = [
  { name: 'stout', liquid: 0x1b0e09, head: 0xefe3c8, glow: 0x6b2a14 },
  { name: 'lager', liquid: 0xe9b92e, head: 0xfffaf0, glow: 0xffe27a },
  { name: 'red ale', liquid: 0x9c3b15, head: 0xf2e6cf, glow: 0xd9743a },
] as const;
export const pintKey = (kind: number): string => `tap-pint-${kind}`;
export const customerKey = (look: number): string => `tap-customer-${look}`;
/** How many different customers are drawn. */
export const LOOKS = 5;

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
  top: 84,
  bottom: 240,
  topInner: 84,
  bottomInner: 60,
} as const;
export const GLASS_HEIGHT = GLASS.bottom - GLASS.top;

/** How far either side of the middle of the spout a glass can be and still catch the pour. */
export const CATCH_HALF = 34;

/** Where the tap's spout is, over the glass. */
export const SPOUT = { x: GLASS.x, y: 72 } as const;

/** The three taps: how far each is from the middle one, and its handle's colour (the middle one pours). */
export const TAPS = [
  { dx: -50, colour: 0xb42a31 },
  { dx: 0, colour: 0x1d2025 },
  { dx: 50, colour: 0x1f6a3c },
] as const;

/** A tap handle's picture, and the height of the pin it pivots on (the top of the faucet). */
export const HANDLE = { width: 16, height: 38, pivotY: 58 } as const;

/** The handle's picture for tap `index`. */
export const handleKey = (index: number): string => `tap-handle-${index}`;

/** The tap: how quickly it opens and shuts (the time it takes to get most of the way). */
export const POUR = { openMs: 110, closeMs: 150 } as const;

export const PLAY = {
  /** With no kiosk (a preview, or public play) a game is this many lives, and nothing is paid. */
  freeLives: 3,
  /** How long a result stays up before the glass is slid away. */
  resultMs: 1700,
  slideMs: 380,
  winMs: 2000,
  /** How long a bonus game is announced before it starts. */
  introMs: 2600,
  /** The tap is slow enough to count as stopped below this many pixels a second. */
  stoppedBelow: 0.4,
  /** How long nobody touches the screen before the game shows how to pour. */
  hintAfterMs: 6000,
} as const;

export const SCREEN = { width: GAME_WIDTH, height: GAME_HEIGHT } as const;

/**
 * The dartboard, as it hangs on the wall. `radius` is the outside of the doubles, in pixels; the
 * rings are shares of it. They are a little wider than on a real board (a treble is 10% across,
 * where a real one is 8%), so a finger's timing can hit them. The number ring and the surround
 * lie outside `radius`.
 */
export const BOARD = {
  x: 240,
  y: 146,
  radius: 96,
  numbers: 107,
  outer: 117,
  rings: { bull: 0.06, outerBull: 0.14, trebleIn: 0.54, trebleOut: 0.64, doubleIn: 0.9 },
  /** How far across the board, as a share of its radius, the crosshair sways either way. */
  sway: 0.92,
} as const;

/** Throwing darts: how long a dart is in the air, and how big it looks when it is thrown and when it lands. */
export const THROW = {
  flightMs: 230,
  startScale: 2.1,
  landScale: 0.9,
  resultMs: 1500,
  pauseMs: 520,
} as const;

/** Serving: where the customers stand along the bar, where the pints come from, and how fast they slide. */
export const SERVE = {
  slots: [112, 206, 300, 394],
  /** The foot of a customer's picture, which is the top of the bar. */
  standY: 196,
  pullX: 44,
  barY: 226,
  /** Pixels a millisecond. */
  slideSpeed: 0.85,
  /** How wide a customer's place is for a tap, and from how far up. */
  hitHalf: 50,
  hitTop: 76,
  /** How long a customer takes to go once they are served, or have given up. */
  leaveMs: 700,
} as const;
