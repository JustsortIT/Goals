/** The game's numbers and names, in one place. No Phaser imports. */

export const SceneKey = { Boot: 'Boot', Title: 'Title', Play: 'Play', Over: 'Over' } as const;

export const TextureKey = { Backdrop: 'quiz-backdrop', Vignette: 'quiz-vignette' } as const;

/** Where the game's data is kept for the scenes (`this.registry`). */
export const DATA_KEY = 'gameData';

export const COLOUR = {
  background: 0x1a0f0a,
  gold: 0xffd76a,
  quiet: 0xd9d2c4,
  wash: 0x0b0705,
  chalk: 0xf2f0e6,
  good: 0x3aa655,
  bad: 0xd6342a,
} as const;

/** The four answer buttons: a colour each, so a player can find theirs at a glance. */
export const BUTTON_COLOURS = [0xb42a31, 0x1f4f93, 0x1f6a3c, 0xb8892a] as const;

/** Where things are on the 480 by 270 screen. */
export const LAYOUT = {
  board: { x: 20, y: 22, width: 440, height: 74 },
  bar: { x: 20, y: 99, width: 440, height: 5 },
  button: { width: 214, height: 72, xs: [20, 246], ys: [114, 192] },
  /** The most the question may wrap to, and how wide a line of it is. */
  questionWidth: 420,
  answerWidth: 192,
} as const;

export const PLAY = {
  /** With no kiosk (a preview, or public play) a game is this many lives, and nothing is paid. */
  freeLives: 3,
  /** How long the right answer is shown before the next question. */
  resultMs: 1200,
  /** A short breath before a question's clock starts, so the words can be read. */
  startMs: 450,
  winMs: 1800,
} as const;
