import type Phaser from 'phaser';
import type { LevelData } from '../systems/level';

/** A collision box inside a sprite's frame. */
export interface BodyBox {
  width: number;
  height: number;
  offsetX: number;
  offsetY: number;
}

export interface SpriteArt {
  texture: string;
  frame: number;
  body: BodyBox;
}

/** Every frame is in one texture, with the hero's feet on the bottom edge of the frame. */
export interface HeroArt {
  texture: string;
  body: BodyBox;
  /** Frames of each animation, in playback order. */
  idle: number[];
  run: number[];
  /** Frames per second of the run. More frames want a faster rate. */
  runFrameRate: number;
  /**
   * Poses for being in the air, in order from leaving the ground to coming back down.
   * One is shown at a time, picked by vertical speed (`airPoseIndex` in `movement.ts`).
   */
  air: number[];
}

/**
 * What is behind the level: the sky colour, and two rows of skyline that repeat sideways
 * and scroll slower than the level, the far row slowest. Each texture's street level is
 * `SKYLINE.belowStreet` above its bottom edge.
 */
export interface BackdropArt {
  sky: string;
  far: string;
  near: string;
}

/**
 * A picture the game writes on. The picture is blank; the words are added with the pixel
 * font, because that is the only way to get lettering that says something.
 */
export interface BoardArt {
  texture: string;
  frame: number;
  /** The blank part of the picture, inside its frame, and the colour to write in. */
  writing: { x: number; y: number; width: number; height: number; tint: number };
}

/** What the entities, the HUD and the backdrop need to know about a theme's art. */
export interface ThemeArt {
  hero: HeroArt;
  enemy: SpriteArt;
  pickup: SpriteArt;
  heart: { texture: string; full: number; empty: number };
  backdrop: BackdropArt;
  /** Stands in the level with a short message on it. */
  noticeBoard: BoardArt;
  /** Shown at the top of the screen with the name of the section being entered. */
  banner: BoardArt;
  /** Something small that crosses the sky now and then, drawn facing right. Null for none. */
  flyer: { texture: string; frame: number } | null;
}

/**
 * A theme is one complete look for the game. The level, physics and rules are the same
 * under every theme; a theme only decides which pictures are loaded and how the level's
 * cells are drawn.
 */
export interface Theme {
  readonly name: string;
  /** Queue the theme's files. Called from the Preloader's `preload`. */
  preload(scene: Phaser.Scene): void;
  /** Build any textures derived from those files, and describe the sprites. */
  create(scene: Phaser.Scene): ThemeArt;
  /** Draw the level's ground, platforms, blocks and scenery. Collision is separate. */
  renderLevel(scene: Phaser.Scene, level: LevelData): void;
  /** Draw the goal building around a door whose bottom-centre is at `x`, `y`. */
  buildGoal(scene: Phaser.Scene, x: number, y: number): void;
}
