import Phaser from 'phaser';
import { ENEMY } from '../config/constants';
import { themeArt } from '../themes';

/** A keg that rolls back and forth, turning at walls and at the edge of whatever it is on. */
export class Enemy extends Phaser.Physics.Arcade.Sprite {
  declare body: Phaser.Physics.Arcade.Body;

  private direction: -1 | 1 = -1;
  private readonly speed: number;

  /** `x`, `y` is the bottom-centre of the cell it starts in. `speed` is in pixels a second. */
  constructor(scene: Phaser.Scene, x: number, y: number, speed: number = ENEMY.patrolSpeed) {
    const { texture, frame, body } = themeArt().enemy;
    super(scene, x, y, texture, frame);
    this.speed = speed;
    scene.add.existing(this);
    scene.physics.add.existing(this);

    // Centre origin, so it spins around its middle. Arcade bodies ignore rotation.
    this.setY(y - this.height / 2);
    this.body.setSize(body.width, body.height, false);
    this.body.setOffset(body.offsetX, body.offsetY);
    this.body.setCollideWorldBounds(true);
  }

  /** Call from the scene's `update` with the layer the keg rolls on. */
  patrol(layer: Phaser.Tilemaps.TilemapLayer): void {
    const body = this.body;
    if (!body.enable) {
      return;
    }

    const movingLeft = this.direction < 0;
    const hitWall = movingLeft ? body.blocked.left : body.blocked.right;

    // Look one pixel ahead of the leading edge for something to roll on.
    const probeX = movingLeft ? body.left - 1 : body.right + 1;
    const ahead: Phaser.Tilemaps.Tile | null = layer.getTileAtWorldXY(probeX, body.bottom + 1);
    const atLedge = body.blocked.down && !ahead?.collideUp;

    if (hitWall || atLedge) {
      this.direction = movingLeft ? 1 : -1;
    }

    const velocity = this.direction * this.speed;
    body.setVelocityX(velocity);
    // Spin at the rate a wheel as wide as the keg would turn at this speed.
    body.setAngularVelocity(Phaser.Math.RadToDeg(velocity / body.halfWidth));
  }

  /** Stomped: stop colliding, burst outwards, then remove. */
  smash(): void {
    this.disableBody(true, false);
    this.scene.tweens.add({
      targets: this,
      scale: 1.4,
      alpha: 0,
      duration: 150,
      onComplete: () => this.destroy(),
    });
  }
}
