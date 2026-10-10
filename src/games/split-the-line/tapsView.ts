/**
 * The three taps' moving parts. Their fixed parts (the bar, the brackets and the faucets) are in
 * the backdrop picture. What moves is drawn here:
 *
 * - each handle is pulled towards the player to open its tap and pushed back to shut it. It is
 *   seen from the front, so tipping it forward makes it shorter and a little wider (it is coming
 *   at the viewer), and it shudders a little while the stout runs;
 * - a few flecks of foam jump at the nozzle while it pours;
 * - when a tap shuts, a drop forms on the nozzle, grows, and falls.
 *
 * A fixed set of images and one Graphics object are used again each frame, so nothing is made in
 * the game loop.
 */
import Phaser from 'phaser';
import { HANDLE, handleKey, SPOUT, TAPS } from './config';

/** How quickly a handle is pulled open and let back, and how far it tips (radians) when fully pulled. */
const PULL = { openMs: 90, closeMs: 140, tip: 0.95 } as const;
/** A drop on a nozzle: how long it grows for, then how it falls (pixels a second, and a second squared). */
const DROP = { growMs: 650, gravity: 520, reach: 16 } as const;

type DropState = { phase: 'none' | 'grow' | 'fall'; age: number; y: number; speed: number };

export class TapsView {
  private readonly handles: Phaser.GameObjects.Image[];
  private readonly fx: Phaser.GameObjects.Graphics;
  private readonly pull: number[] = TAPS.map(() => 0);
  private readonly drops: DropState[] = TAPS.map(() => ({ phase: 'none', age: 0, y: 0, speed: 0 }));
  private readonly colours: { liquid: number; head: number };
  private timeMs = 0;

  constructor(scene: Phaser.Scene, depth: number, colours: { liquid: number; head: number }) {
    this.colours = colours;
    this.handles = TAPS.map((tap, index) =>
      scene.add
        .image(SPOUT.x + tap.dx, HANDLE.pivotY, handleKey(index))
        .setOrigin(0.5, 1)
        .setDepth(depth),
    );
    this.fx = scene.add.graphics().setDepth(depth + 0.4);
  }

  /** How far tap `index` is pulled, from 0 (shut) to 1 (fully open). */
  pulled(index: number): number {
    return this.pull[index] ?? 0;
  }

  /** Moves the handles towards `targets` (1 is held open, 0 shut), and draws the drops and foam. */
  update(deltaMs: number, targets: readonly number[]): void {
    this.timeMs += deltaMs;
    const g = this.fx;
    g.clear();

    TAPS.forEach((tap, index) => {
      const before = this.pull[index];
      const target = targets[index] ?? 0;
      const rate = target > before ? PULL.openMs : PULL.closeMs;
      const next = before + (target - before) * (1 - Math.exp(-deltaMs / rate));
      this.pull[index] = Math.abs(target - next) < 0.002 ? target : next;
      const pulled = this.pull[index];

      // Tipping towards the viewer: shorter, and a little wider as it comes closer.
      const angle = pulled * PULL.tip;
      const shudder = pulled > 0.6 ? Math.sin(this.timeMs / 34 + index * 2.1) * 0.5 * pulled : 0;
      this.handles[index]
        .setPosition(SPOUT.x + tap.dx + shudder, HANDLE.pivotY)
        .setScale(1 + 0.3 * Math.sin(angle), Math.cos(angle));

      this.foam(g, SPOUT.x + tap.dx, pulled, index);
      this.drip(g, SPOUT.x + tap.dx, index, before, target, deltaMs);
    });
  }

  /** Flecks of foam that jump at the nozzle while the tap is open. */
  private foam(g: Phaser.GameObjects.Graphics, x: number, pulled: number, index: number): void {
    if (pulled < 0.4) return;
    g.fillStyle(this.colours.head, 0.85);
    for (let fleck = 0; fleck < 3; fleck += 1) {
      const phase = (this.timeMs / 70 + fleck * 1.7 + index) % 3;
      const side = fleck % 2 === 0 ? -1 : 1;
      g.fillRect(Math.round(x + side * (1 + phase)), Math.round(SPOUT.y + 1 + phase * 1.5), 1, 1);
    }
  }

  /** A drop forms on the nozzle when the tap shuts, hangs and grows, then falls. */
  private drip(
    g: Phaser.GameObjects.Graphics,
    x: number,
    index: number,
    before: number,
    target: number,
    deltaMs: number,
  ): void {
    const drop = this.drops[index];
    if (target === 0 && before > 0.7 && drop.phase === 'none') {
      drop.phase = 'grow';
      drop.age = 0;
    }
    // Opening a tap again takes the drop away.
    if (target > 0 && drop.phase !== 'none') drop.phase = 'none';

    if (drop.phase === 'grow') {
      drop.age += deltaMs;
      const size = 1 + Math.min(1, drop.age / DROP.growMs) * 2;
      g.fillStyle(this.colours.liquid, 1);
      g.fillRect(x - 1, SPOUT.y, 2, Math.round(size));
      g.fillStyle(0xd9b48a, 0.5);
      g.fillRect(x - 1, SPOUT.y, 1, 1);
      if (drop.age >= DROP.growMs) {
        drop.phase = 'fall';
        drop.y = SPOUT.y + 2;
        drop.speed = 0;
      }
    } else if (drop.phase === 'fall') {
      const seconds = deltaMs / 1000;
      drop.speed += DROP.gravity * seconds;
      drop.y += drop.speed * seconds;
      if (drop.y > SPOUT.y + DROP.reach) {
        drop.phase = 'none';
        return;
      }
      g.fillStyle(this.colours.liquid, 1);
      g.fillRect(x - 1, Math.round(drop.y), 2, 3);
    }
  }
}
