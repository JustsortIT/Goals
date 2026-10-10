/**
 * The flags on the stand's roof, which blow the way the wind does: out straight in a strong wind,
 * hanging and rippling gently in none. Their poles are in the backdrop picture. One Graphics
 * object, cleared and drawn again each frame (a few rectangles), so nothing new is made.
 */
import type Phaser from 'phaser';
import { ROOF_FLAG_TOP, ROOF_FLAGS } from './config';

const PIECES = 10;

export class RoofFlags {
  private readonly g: Phaser.GameObjects.Graphics;

  constructor(scene: Phaser.Scene, depth = 0.6) {
    this.g = scene.add.graphics().setDepth(depth);
  }

  /** `push` is the wind from -1 (full to the left) to 1 (full to the right). */
  update(timeMs: number, push: number): void {
    const g = this.g;
    g.clear();
    const dir = push >= 0 ? 1 : -1;
    // A flag is never quite still: a breeze keeps it moving even on a calm day.
    const strength = Math.min(1, Math.max(Math.abs(push), 0.18));
    const step = (6 + 18 * strength) / PIECES;
    ROOF_FLAGS.forEach((flag, index) => {
      for (let piece = 0; piece < PIECES; piece += 1) {
        const along = piece / PIECES;
        const wave =
          Math.sin(timeMs / 120 + piece * 0.8 + index * 1.9) * (0.5 + strength * 2) * along;
        const droop = (1 - strength) * piece * 1.3;
        const x = Math.round(dir > 0 ? flag.x + 1 + piece * step : flag.x - (piece + 1) * step);
        const y = Math.round(ROOF_FLAG_TOP + wave + droop);
        const colour = flag.colours[Math.min(2, Math.floor((piece * 3) / PIECES))];
        g.fillStyle(colour, 1);
        g.fillRect(x, y, Math.ceil(step) + 1, 7 - Math.floor(along * 2));
      }
    });
  }
}
