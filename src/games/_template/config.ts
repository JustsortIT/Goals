/** The template's numbers and names, in one place. No Phaser imports. */
import { GAME_HEIGHT } from '../../shell/constants';

export const SceneKey = { Boot: 'Boot', Title: 'Title', Play: 'Play', Over: 'Over' } as const;

/** Where the game's data is kept for the scenes (`this.registry`). */
export const DATA_KEY = 'gameData';

export const COLOUR = {
  background: 0x15151f,
  paddle: 0xe8e6df,
  gold: 0xffd76a,
  quiet: 0xa9a7b8,
  wash: 0x0b0b12,
} as const;

export const PLAY = {
  /** With no kiosk (a preview, or public play) a game is this many lives, and nothing is paid. */
  freeLives: 3,
  paddleWidth: 48,
  paddleHeight: 8,
  paddleY: GAME_HEIGHT - 24,
  /** Pixels a second: the paddle follows the finger, no faster than this. */
  paddleSpeed: 420,
  dropSize: 10,
  /** A drop comes this often at first, and this often at the quickest. */
  firstEveryMs: 1100,
  quickestEveryMs: 380,
  /** The score at which drops come at their quickest. */
  quickestAtScore: 1500,
} as const;
