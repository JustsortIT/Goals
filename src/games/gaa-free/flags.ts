/**
 * The flags on the stand's roof, maroon and white. They all blow the same way, to the right, as
 * flags on a roof do in the wind of the day, and out further the stronger the gusts. Their poles
 * are in the backdrop picture. One Graphics object, cleared and drawn again each frame (a few
 * rectangles), so nothing new is made.
 */
import type Phaser from 'phaser';
import { ROOF_FLAG_TOP, ROOF_FLAGS } from './config';

const PIECES = 10;

export class RoofFlags {
  private readonly g: Phaser.GameObjects.Graphics;

  constructor(scene: Phaser.Scene, depth = 0.6) {
    this.g = scene.add.graphics().setDepth(depth);
  }

  /** `strength` is how hard the wind is blowing, from 0 to 1. */
  update(timeMs: number, strength: number): void {
    const g = this.g;
    g.clear();
    // A flag is never quite still: a breeze keeps it moving even on a calm day.
    const out = Math.min(1, Math.max(strength, 0.2));
    const step = (6 + 18 * out) / PIECES;
    ROOF_FLAGS.forEach((flag, index) => {
      for (let piece = 0; piece < PIECES; piece += 1) {
        const along = piece / PIECES;
        const wave = Math.sin(timeMs / 120 + piece * 0.8 + index * 1.9) * (0.5 + out * 2) * along;
        const droop = (1 - out) * piece * 1.3;
        const x = Math.round(flag.x + 1 + piece * step);
        const y = Math.round(ROOF_FLAG_TOP + wave + droop);
        const colour = flag.colours[Math.min(2, Math.floor((piece * 3) / PIECES))];
        g.fillStyle(colour, 1);
        g.fillRect(x, y, Math.ceil(step) + 1, 7 - Math.floor(along * 2));
      }
    });
  }
}
