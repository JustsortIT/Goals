import Phaser from 'phaser';
import { FLYER, GAME_WIDTH } from '../config/constants';
import { themeArt } from '../themes';

/** In front of the skyline, behind the level. */
const DEPTH = -50;

/**
 * Life in the sky: every so often the theme's flyer (a gull, say) crosses the screen.
 * It is fixed to the screen, not the level, which makes it look far away. A theme with
 * no flyer has an empty sky.
 */
export class Flyers {
  private readonly scene: Phaser.Scene;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    if (themeArt().flyer) {
      this.scheduleNext(FLYER.firstDelayMs);
    }
  }

  // Timers and tweens belong to the scene, so they stop when it does.
  private scheduleNext(delayMs: number): void {
    this.scene.time.delayedCall(delayMs, () => {
      this.launch();
      this.scheduleNext(Phaser.Math.Between(FLYER.minDelayMs, FLYER.maxDelayMs));
    });
  }

  private launch(): void {
    const art = themeArt().flyer;
    if (!art) return;

    const rightwards = Phaser.Math.Between(0, 1) === 1;
    const y = Phaser.Math.Between(FLYER.minY, FLYER.maxY);
    const flyer = this.scene.add
      .image(0, y, art.texture, art.frame)
      .setScrollFactor(0)
      .setDepth(DEPTH)
      // The picture faces right.
      .setFlipX(!rightwards);

    const offScreen = flyer.width;
    const from = rightwards ? -offScreen : GAME_WIDTH + offScreen;
    const to = rightwards ? GAME_WIDTH + offScreen : -offScreen;
    flyer.setX(from);

    this.scene.tweens.add({
      targets: flyer,
      x: to,
      duration: (Math.abs(to - from) / FLYER.speed) * 1000,
      onComplete: () => flyer.destroy(),
    });
    // A slow rise and fall as it goes.
    this.scene.tweens.add({
      targets: flyer,
      y: y - FLYER.bobDistance,
      duration: FLYER.bobDurationMs,
      ease: 'Sine.easeInOut',
      yoyo: true,
      repeat: -1,
    });
  }
}
