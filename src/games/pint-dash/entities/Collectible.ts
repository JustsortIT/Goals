import Phaser from 'phaser';
import { COLLECTIBLE, TILE_SIZE } from '../config/constants';
import { themeArt } from '../themes';

/** A pint is worth points. A heart gives back a lost life. */
export type CollectibleKind = 'pint' | 'life';

/** Something that bobs in place until the player touches it. */
export class Collectible extends Phaser.Physics.Arcade.Sprite {
  declare body: Phaser.Physics.Arcade.Body;

  readonly kind: CollectibleKind;
  /** Points for collecting it. For a heart, only when there is no life to give back. */
  readonly value: number;

  private readonly bob: Phaser.Tweens.Tween;

  /** `x`, `y` is the bottom-centre of the tile it floats in. */
  constructor(scene: Phaser.Scene, x: number, y: number, kind: CollectibleKind = 'pint') {
    const { pickup, heart } = themeArt();
    const texture = kind === 'life' ? heart.texture : pickup.texture;
    const frame = kind === 'life' ? heart.full : pickup.frame;
    super(scene, x, y - TILE_SIZE / 2, texture, frame);
    scene.add.existing(this);
    scene.physics.add.existing(this);
    this.kind = kind;
    this.value = kind === 'life' ? COLLECTIBLE.lifeBonus : COLLECTIBLE.scoreValue;

    this.body.setAllowGravity(false);
    // A heart's box is its whole frame, which is generous. A pint's comes from the theme.
    if (kind === 'pint') {
      this.body.setSize(pickup.body.width, pickup.body.height, false);
      this.body.setOffset(pickup.body.offsetX, pickup.body.offsetY);
    }

    // Offset each one by its column so a row of them bobs as a wave.
    const column = Math.floor(x / TILE_SIZE);
    this.bob = scene.tweens.add({
      targets: this,
      y: this.y - COLLECTIBLE.bobDistance,
      duration: COLLECTIBLE.bobDurationMs,
      delay: (column % 4) * (COLLECTIBLE.bobDurationMs / 4),
      ease: 'Sine.easeInOut',
      yoyo: true,
      repeat: -1,
    });
  }

  /** Removes it and returns its score value. */
  collect(): number {
    this.bob.remove();
    this.destroy();
    return this.value;
  }
}
