/** The game's numbers and names, in one place. No Phaser imports. */
import { GAME_HEIGHT, GAME_WIDTH } from '../../shell/constants';

export const SceneKey = { Boot: 'Boot', Title: 'Title', Play: 'Play', Over: 'Over' } as const;

export const TextureKey = {
  Backdrop: 'gaa-backdrop',
  Ball: 'gaa-ball',
  Bonus: 'gaa-bonus',
  Glow: 'gaa-glow',
  Vignette: 'gaa-vignette',
} as const;

/** The ball is drawn tumbling: this many frames of it, each this many pixels across. */
export const BALL = { size: 20, frames: 12 } as const;

/** Where the game's data is kept for the scenes (`this.registry`). */
export const DATA_KEY = 'gameData';

export const COLOUR = {
  background: 0x3d8b3a,
  gold: 0xffd76a,
  quiet: 0xd6dde3,
  wash: 0x0b1410,
  white: 0xf4f6f8,
  shade: 0xaeb9c2,
  hit: 0x2e7d32,
  miss: 0xff9a9a,
} as const;

/**
 * A Gaelic football goal seen from the kick: two posts and a crossbar, with the net under the
 * bar. The posts are 6.5 m apart and the bar 2.5 m up, so the mouth is that shape here. Every
 * number is for the goal at its nearest (scale 1); farther goals are smaller and higher up.
 */
export const GOAL = {
  centreX: GAME_WIDTH / 2,
  width: 180,
  mouthHeight: 69,
  baseY: 160,
  /** How tall the posts are drawn, from the ground. */
  postHeight: 140,
  /** How far up the screen the goal's base goes as it moves away: this much for a scale of 0. */
  lift: 60,
  /** The smallest the goal may become: a game that asks for less than this is refused. */
  minScale: 0.5,
} as const;

/** The kick: a pull back on the screen, and the ball's flight. */
export const KICK = {
  origin: { x: GAME_WIDTH / 2, y: 195 },
  /** The ball lands this many pixels from where it was for every pixel of pull. */
  gain: 1.6,
  /** The longest pull that counts, and the furthest down: the finger runs out of screen. */
  maxPull: 90,
  maxPullY: GAME_HEIGHT - 195 - 5,
  /** A pull shorter than this is a touch, not a kick. */
  minPull: 8,
  flightMs: 600,
  arcHeight: 36,
  /** The ball's own size counts towards a hit: a target is hit if the ball touches it. */
  reach: 3,
  /** The dotted line shows this much of the way to where the ball will land, not all of it. */
  guide: 0.75,
  /** How far the ball is drawn back with the finger, as a share of the pull. */
  drawBack: 0.4,
  /** The ball's size on landing, at the nearest goal and at the farthest. */
  landScaleNear: 0.5,
  landScaleFar: 0.35,
} as const;

export const PLAY = {
  /** With no kiosk (a preview, or public play) a game is this many lives, and nothing is paid. */
  freeLives: 3,
  /** A level cleared gives this many lives back. */
  bonusLives: 1,
  /** How long a shot's result stays on the screen before the ball comes back. */
  resultMs: 750,
  clearMs: 1300,
  goalBackMs: 900,
  winMs: 1800,
} as const;

/** Wind: the most it may push a ball, and where its flag and gauge are drawn. */
export const WIND = {
  most: 24,
  flag: { x: 84, baseY: 168, height: 38 },
  gauge: { x: GAME_WIDTH / 2, y: 25, half: 44 },
} as const;
