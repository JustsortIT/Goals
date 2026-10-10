import type Phaser from 'phaser';
import { TextureKey } from '../config/keys';
import { addPixelText } from './pixelFont';

type Emitter = Phaser.GameObjects.Particles.ParticleEmitter;
type EmitterConfig = Phaser.Types.GameObjects.Particles.ParticleEmitterConfig;

const DEPTH = 50;

const COLORS = {
  dust: [0xffffff, 0xdce1e7, 0x959ab1],
  /** Beer and foam. */
  pickup: [0xf4b041, 0xffffff, 0xffd76a],
  /** Splinters of a keg. */
  enemy: [0xf48243, 0xd45734, 0x959ab1],
  player: [0xffffff, 0xd45734, 0xf4cca1],
  confetti: [0xd45734, 0xf4b041, 0x4cc47c, 0x5f79b0, 0xffffff],
};

/**
 * One-shot particle bursts and floating text. Emitters are created once per scene and
 * reused; nothing here affects gameplay.
 */
export class Effects {
  private readonly scene: Phaser.Scene;
  private readonly dustEmitter: Emitter;
  private readonly sparkleEmitter: Emitter;
  private readonly enemyBurstEmitter: Emitter;
  private readonly playerBurstEmitter: Emitter;
  private readonly confettiEmitter: Emitter;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;

    this.dustEmitter = this.createEmitter({
      speed: { min: 8, max: 36 },
      angle: { min: 200, max: 340 },
      lifespan: { min: 180, max: 380 },
      alpha: { start: 0.9, end: 0 },
      gravityY: -30,
      tint: COLORS.dust,
    });
    this.sparkleEmitter = this.createEmitter({
      speed: { min: 30, max: 90 },
      angle: { min: 0, max: 360 },
      lifespan: { min: 250, max: 450 },
      alpha: { start: 1, end: 0 },
      gravityY: 160,
      tint: COLORS.pickup,
    });
    // One emitter per colour set: setParticleTint() only replaces the current value, so
    // it cannot switch an emitter to a different random-pick list of tints.
    const burst: EmitterConfig = {
      speed: { min: 40, max: 130 },
      angle: { min: 0, max: 360 },
      lifespan: { min: 300, max: 600 },
      alpha: { start: 1, end: 0 },
      scale: [1, 2],
      gravityY: 300,
    };
    this.enemyBurstEmitter = this.createEmitter({ ...burst, tint: COLORS.enemy });
    this.playerBurstEmitter = this.createEmitter({ ...burst, tint: COLORS.player });
    this.confettiEmitter = this.createEmitter({
      speed: { min: 60, max: 170 },
      angle: { min: 230, max: 310 },
      lifespan: { min: 700, max: 1200 },
      alpha: { start: 1, end: 0, ease: 'Cubic.easeIn' },
      scale: [1, 2],
      gravityY: 260,
      tint: COLORS.confetti,
    });
  }

  /** A puff kicked up at ground level, for jumps and landings. */
  dust(x: number, y: number, count = 5): void {
    this.dustEmitter.explode(count, x, y);
  }

  sparkle(x: number, y: number): void {
    this.sparkleEmitter.explode(8, x, y);
  }

  enemyBurst(x: number, y: number): void {
    this.enemyBurstEmitter.explode(12, x, y);
  }

  playerBurst(x: number, y: number): void {
    this.playerBurstEmitter.explode(18, x, y);
  }

  confetti(x: number, y: number): void {
    this.confettiEmitter.explode(40, x, y);
  }

  /** Text that floats up from a point and fades, such as "+10" over a coin. */
  popup(x: number, y: number, text: string, tint = 0xffe066): void {
    const label = addPixelText(this.scene, x, y, text)
      .setOrigin(0.5, 1)
      .setTint(tint)
      .setDepth(DEPTH + 1);

    // Rises quickly then settles, and only fades near the end so it stays readable.
    this.scene.tweens.add({
      targets: label,
      y: { value: label.y - 16, ease: 'Cubic.easeOut' },
      alpha: { value: 0, ease: 'Cubic.easeIn' },
      duration: 700,
      onComplete: () => label.destroy(),
    });
  }

  private createEmitter(config: EmitterConfig): Emitter {
    return this.scene.add
      .particles(0, 0, TextureKey.Particle, { ...config, emitting: false })
      .setDepth(DEPTH);
  }
}
