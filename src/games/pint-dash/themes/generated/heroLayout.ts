/**
 * Fitting a hero's animation frames into one texture. Pure, no Phaser imports.
 *
 * The frames arrive drawn on one shared canvas, with the hero wherever the generator put
 * it. The game wants equal cells with the standing hero's feet on the bottom edge and its
 * middle in the middle, because that is the point the Player is positioned by.
 */
import type { Box } from './pixels';

export interface HeroFrame {
  /** What is drawn in this frame, on the shared canvas. */
  bounds: Box;
  /**
   * Poses in the air are moved so their lowest point is on the ground line. The physics
   * supplies the height of a jump, so a pose that also rises on the canvas would float
   * above its collision box.
   */
  dropToGround: boolean;
}

export interface HeroLayout {
  frameWidth: number;
  frameHeight: number;
  /** Where to draw each frame's canvas inside its cell. */
  offsets: { x: number; y: number }[];
}

/**
 * `standing` is the standing hero on the shared canvas; it sets the ground line and the
 * middle. Cells are at least `minWidth` wide, and always an even number of pixels wide so
 * a centred sprite sits on whole pixels.
 */
export function layoutHeroFrames(standing: Box, frames: HeroFrame[], minWidth: number): HeroLayout {
  const ground = standing.y + standing.height;
  const middle = Math.floor(standing.x + standing.width / 2);

  const drops = frames.map(({ bounds, dropToGround }) =>
    dropToGround ? ground - (bounds.y + bounds.height) : 0,
  );
  // How far the widest frame reaches to either side of the middle.
  const reach = Math.max(
    ...frames.map(({ bounds }) => Math.max(middle - bounds.x, bounds.x + bounds.width - middle)),
  );
  const top = Math.min(...frames.map(({ bounds }, index) => bounds.y + drops[index]));

  const frameWidth = Math.max(reach * 2, minWidth + (minWidth % 2));
  return {
    frameWidth,
    frameHeight: ground - top,
    offsets: drops.map((drop) => ({ x: frameWidth / 2 - middle, y: drop - top })),
  };
}
