/**
 * Every gameplay tunable lives in this file.
 *
 * Tiles are drawn at the art's native size, which depends on the theme (18px for the
 * Kenney art, 16px for generated packs). So anything that should feel the same whatever
 * the tile size is written in tiles and converted with `tiles()`. Times are in
 * milliseconds; screen-space values (camera, HUD) stay in pixels.
 */
import { TILE_SIZE } from '../themes/active';

export { TILE_SIZE };

export const GAME_WIDTH = 480;
export const GAME_HEIGHT = 270;
/** The sky. The skyline is drawn over it. */
export const BACKGROUND_COLOR = '#cfe3ef';

/** Converts a length, speed or acceleration from tiles to pixels. */
const tiles = (count: number) => count * TILE_SIZE;

export const WORLD = {
  gravity: tiles(62.5),
  /** How far below the bottom of the level the player can fall before dying. */
  fallDeathMargin: tiles(2),
  /** One-way platforms only catch a body whose feet were within this distance above them. */
  oneWayTolerance: 1,
} as const;

export const PLAYER = {
  runSpeed: tiles(7.5),
  groundAccel: tiles(56.25),
  groundFriction: tiles(68.75),
  airAccel: tiles(37.5),
  airFriction: tiles(12.5),
  /** Initial upward speed of a jump. With this gravity it reaches roughly 3.6 tiles. */
  jumpVelocity: tiles(21.875),
  /** Upward velocity is multiplied by this when jump is released early (variable jump height). */
  jumpCutMultiplier: 0.45,
  maxFallSpeed: tiles(22.5),
  /** Grace period after walking off a ledge in which a jump still counts. */
  coyoteTimeMs: 100,
  /** A jump pressed this long before landing still fires on touchdown. */
  jumpBufferMs: 100,
  stompBounceVelocity: tiles(16.25),
  /** A hit counts as a stomp if the player's feet were at most this far below the enemy's top. */
  stompTolerance: 4,
  lives: 3,
  respawnDelayMs: 700,
} as const;

export const ENEMY = {
  patrolSpeed: tiles(2.2),
  /** The kegs marked as fast in the level. */
  fastPatrolSpeed: tiles(3.6),
} as const;

export const COLLECTIBLE = {
  scoreValue: 10,
  /** What a heart is worth when the player has no lost life for it to give back. */
  lifeBonus: 50,
  bobDistance: 3,
  bobDurationMs: 700,
} as const;

export const CHECKPOINT = {
  /** A checkpoint sign this close to the start is just a sign: the player starts there anyway. */
  nearStart: tiles(3),
} as const;

export const CAMERA = {
  deadzoneWidth: 80,
  deadzoneHeight: 50,
  /** 1 snaps the camera to the deadzone edge; lower values ease towards it. */
  lerp: 1,
} as const;

/** Presentation only: nothing here changes how the game plays. */
export const FX = {
  /** Scale applied to the player sprite on take-off and touchdown, eased back to 1. */
  jumpStretch: { x: 0.8, y: 1.2 },
  landSquash: { x: 1.25, y: 0.75 },
  squashRecoverMs: 160,
  /** Landings slower than this make no dust. */
  landDustMinSpeed: tiles(7.5),
  stompShake: { durationMs: 80, intensity: 0.004 },
  deathShake: { durationMs: 150, intensity: 0.008 },
  fadeInMs: 250,
  fadeOutMs: 350,
  /** Pause on the goal (confetti time) before fading to the end screen. */
  goalCelebrationMs: 900,
  /** Edge darkening. Starts `innerRadius` of the way from the centre to a corner. */
  vignette: { innerRadius: 0.5, alpha: 0.16 },
} as const;

/** The city skyline behind the level: two rows of buildings. */
export const SKYLINE = {
  /** Screen y of street level in the backdrop when the camera rests at the bottom of the level. */
  streetY: GAME_HEIGHT - tiles(3),
  /** How much solid building is drawn below street level, to fill the view down into pits. */
  belowStreet: tiles(3),
  /** How fast each row scrolls relative to the camera (0 = fixed to the screen, 1 = with the level). */
  farParallax: 0.12,
  nearParallax: 0.3,
  /**
   * How far a generated skyline picture is faded towards its haze colour: 0 leaves it as
   * drawn, 1 makes it a flat silhouette. The far row is fainter.
   */
  farHaze: 0.8,
  nearHaze: 0.66,
  /**
   * How high a generated far row stands, as a share of the near row's height. The near
   * row hides everything below its roofline, so this decides how much of the far one shows.
   */
  farLift: 0.75,
} as const;

/** On-screen buttons for touch devices. Sizes and positions are in game pixels. */
export const TOUCH = {
  buttonSize: 40,
  /** Distance from the edges of the screen. */
  margin: 10,
  /** Space between neighbouring buttons. */
  gap: 6,
  idleAlpha: 0.3,
  pressedAlpha: 0.65,
  edgeAlpha: 0.5,
  labelAlpha: 0.9,
} as const;

/** The banner that names each section of the level as the player enters it. */
export const BANNER = {
  /** Screen y of its top edge once it has dropped in. */
  y: 4,
  slideMs: 250,
  holdMs: 2200,
  /** Extra pixels between letters, so a short name fills more of the plate. */
  letterSpacing: 2,
} as const;

/** The theme's flyer: something that crosses the sky now and then. Screen pixels. */
export const FLYER = {
  firstDelayMs: 2500,
  minDelayMs: 5000,
  maxDelayMs: 11000,
  /** Pixels a second. */
  speed: 26,
  /** The band of sky it flies in: below the HUD's top row, above the rooftops. */
  minY: 34,
  maxY: 96,
  bobDistance: 3,
  bobDurationMs: 900,
} as const;

/** Text sizes. The pixel font is drawn on an 8px grid, so only multiples of 8 stay crisp. */
export const FONT_SIZE = {
  small: 8,
  medium: 16,
  large: 24,
  title: 40,
} as const;

/** The game's name, as shown on the title screen. index.html has it too, for the browser tab. */
export const GAME_TITLE = 'Pint Dash';

/** The title screen. Positions are screen y of each line's centre. */
export const TITLE = {
  nameY: 58,
  nameColor: 0xffd76a,
  shadowOffset: 4,
  shadowAlpha: 0.35,
  tagline: 'COLLECT THE PINTS. DODGE THE KEGS. GET TO THE PUB.',
  taglineY: 94,
  promptY: 128,
  /** How long the start prompt stays on, then off. */
  blinkMs: 500,
} as const;
