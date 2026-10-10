/**
 * Leaves carried along by a strong wind: a few at a gust's start, more as it grows. They go the
 * way the wind blows now, fluttering up and down and turning as they go. A fixed number of small
 * shapes is made once and used again, so nothing is made in the game loop.
 */
import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH } from '../../shell/constants';
import { LEAVES } from './config';

const COLOURS = [0x8fb339, 0xc98a2b, 0xe0b73a, 0x9a4a1f, 0x6fa13f, 0xd2691e];

interface Leaf {
  shape: Phaser.GameObjects.Rectangle;
  phase: number;
  /** Faster or slower than the others, so they do not go in a line. */
  pace: number;
  alive: boolean;
}

export class Leaves {
  private readonly leaves: Leaf[] = [];
  private timeMs = 0;

  constructor(scene: Phaser.Scene, depth = 2.9) {
    for (let index = 0; index < LEAVES.count; index += 1) {
      const shape = scene.add
        .rectangle(0, 0, 4 + (index % 3), 3, COLOURS[index % COLOURS.length])
        .setDepth(depth)
        .setVisible(false);
      this.leaves.push({
        shape,
        phase: Math.random() * Math.PI * 2,
        pace: 0.7 + Math.random() * 0.6,
        alive: false,
      });
    }
  }

  /** `push` is the wind, from -1 to 1 (right is positive); `intensity` is how many leaves, 0 to 1. */
  update(deltaMs: number, push: number, intensity: number): void {
    this.timeMs += deltaMs;
    const seconds = deltaMs / 1000;
    const dir = push >= 0 ? 1 : -1;
    const wanted = Math.round(intensity * this.leaves.length);
    const speed = 50 + 190 * Math.abs(push);

    this.leaves.forEach((leaf, index) => {
      const { shape } = leaf;
      // A leaf that is out of the wind's way, or off the screen, is brought in again at the edge
      // the wind is coming from, if there is a gust enough for it.
      if (!leaf.alive) {
        if (index >= wanted) return;
        leaf.alive = true;
        shape.setVisible(true);
        shape.setPosition(dir > 0 ? -6 : GAME_WIDTH + 6, Phaser.Math.Between(34, GAME_HEIGHT - 24));
      }
      const flutter = Math.sin(this.timeMs / 260 + leaf.phase) * 26 + 10;
      shape.x += dir * speed * leaf.pace * seconds;
      shape.y += flutter * seconds;
      shape.rotation += 7 * seconds * leaf.pace;
      const gone = shape.x < -8 || shape.x > GAME_WIDTH + 8 || shape.y > GAME_HEIGHT + 6;
      if (gone) {
        leaf.alive = false;
        shape.setVisible(false);
      }
    });
  }
}
