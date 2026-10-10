import Phaser from 'phaser';
import { FX, PLAYER } from '../config/constants';
import { AnimKey } from '../config/keys';
import type { InputState } from '../systems/input';
import { airPoseIndex, createJumpState, stepJump, stepRunVelocity } from '../systems/movement';
import { themeArt } from '../themes';
import type { HeroArt } from '../themes/theme';

/** Below this horizontal speed the player counts as standing still. */
const RUN_ANIMATION_MIN_SPEED = 10;

/** Emitted on the Player so the scene can add effects without the Player knowing about them. */
export const PlayerEvent = {
  /** Arguments: none. */
  Jumped: 'jumped',
  /** Arguments: fall speed at impact, in pixels per second. */
  Landed: 'landed',
} as const;

/**
 * The player is two objects. This class is the physics sprite: it is never drawn, and
 * its position and body are what gameplay code reads. `visual` is the sprite on screen,
 * which follows it every frame. Arcade bodies resize with their sprite's scale, so
 * keeping them apart lets the visual squash, stretch and animate freely.
 */
export class Player extends Phaser.Physics.Arcade.Sprite {
  declare body: Phaser.Physics.Arcade.Body;

  private readonly visual: Phaser.GameObjects.Sprite;
  private readonly art: HeroArt;
  private jumpState = createJumpState();
  private wasOnGround = true;
  private lastVelocityY = 0;
  private squashTween: Phaser.Tweens.Tween | null = null;

  /** `x`, `y` is where the feet go (bottom-centre). */
  constructor(scene: Phaser.Scene, x: number, y: number) {
    const art = themeArt().hero;
    const { texture, body } = art;
    const stand = art.idle[0];
    super(scene, x, y, texture, stand);
    this.art = art;
    scene.add.existing(this);
    scene.physics.add.existing(this);

    this.setOrigin(0.5, 1).setVisible(false);
    this.body.setSize(body.width, body.height, false);
    this.body.setOffset(body.offsetX, body.offsetY);
    this.body.setCollideWorldBounds(true);

    this.visual = scene.add.sprite(x, y, texture, stand).setOrigin(0.5, 1);
    this.visual.play(AnimKey.PlayerIdle);

    // Arcade writes the new position to this sprite during POST_UPDATE; this listener
    // is added after Arcade's, so the visual picks up the same frame's position.
    scene.events.on(Phaser.Scenes.Events.POST_UPDATE, this.syncVisual, this);
  }

  /** Feet position before the current physics step moved the body. */
  get previousBottom(): number {
    return this.body.prev.y + this.body.height;
  }

  /** Applies one frame of input. Call from the scene's `update`. */
  tick(input: InputState, deltaMs: number): void {
    const body = this.body;
    // Requiring non-upward velocity stops the frame after take-off from counting as grounded.
    const onGround = (body.blocked.down || body.touching.down) && body.velocity.y >= 0;

    const velocityX = stepRunVelocity(
      body.velocity.x,
      input.moveX,
      onGround,
      deltaMs / 1000,
      PLAYER,
    );
    const velocityY = stepJump(
      this.jumpState,
      {
        onGround,
        jumpPressed: input.jumpPressed,
        jumpHeld: input.jumpHeld,
        velocityY: body.velocity.y,
      },
      deltaMs,
      PLAYER,
    );

    body.setVelocity(velocityX, Math.min(velocityY, PLAYER.maxFallSpeed));

    if (input.moveX !== 0) {
      this.visual.setFlipX(input.moveX < 0);
    }

    if (this.jumpState.justJumped) {
      this.squash(FX.jumpStretch);
      this.emit(PlayerEvent.Jumped);
    } else if (onGround && !this.wasOnGround) {
      if (this.lastVelocityY >= FX.landDustMinSpeed) {
        this.squash(FX.landSquash);
      }
      this.emit(PlayerEvent.Landed, this.lastVelocityY);
    }

    this.updateAnimation(onGround && !this.jumpState.justJumped, velocityX);
    this.wasOnGround = onGround;
    this.lastVelocityY = body.velocity.y;
  }

  /** Bounce off a stomped enemy. */
  bounce(): void {
    this.body.setVelocityY(-PLAYER.stompBounceVelocity);
    this.squash(FX.jumpStretch);
  }

  die(): void {
    this.disableBody(true, false);
    this.resetSquash();
    // Phaser 4: setTintFill() is gone; fill is a tint mode.
    this.visual.setTint(0xffffff).setTintMode(Phaser.TintModes.FILL);
    this.scene.tweens.add({ targets: this.visual, alpha: 0, duration: 300 });
  }

  respawn(x: number, y: number): void {
    this.scene.tweens.killTweensOf(this.visual);
    this.squashTween = null;
    this.visual.clearTint().setTintMode(Phaser.TintModes.MULTIPLY);
    this.visual.setAlpha(1).setScale(1).setFlipX(false).play(AnimKey.PlayerIdle);

    this.jumpState = createJumpState();
    this.wasOnGround = true;
    this.lastVelocityY = 0;
    // Re-enable physics but keep this sprite hidden: only `visual` is drawn.
    this.enableBody(true, x, y, true, false);
  }

  override destroy(fromScene?: boolean): void {
    this.scene?.events.off(Phaser.Scenes.Events.POST_UPDATE, this.syncVisual, this);
    this.visual.destroy();
    super.destroy(fromScene);
  }

  private syncVisual(): void {
    this.visual.setPosition(this.x, this.y);
  }

  private updateAnimation(onGround: boolean, velocityX: number): void {
    if (!onGround) {
      // In the air the pose follows vertical speed, so it suits any height of jump or fall.
      const { air } = this.art;
      this.visual.anims.stop();
      this.visual.setFrame(air[airPoseIndex(this.body.velocity.y, air.length, PLAYER)]);
      return;
    }

    const running = Math.abs(velocityX) > RUN_ANIMATION_MIN_SPEED;
    this.visual.play(running ? AnimKey.PlayerRun : AnimKey.PlayerIdle, true);
  }

  /** Snaps the visual to a squashed or stretched scale, then eases it back to normal. */
  private squash(scale: { x: number; y: number }): void {
    this.resetSquash();
    this.visual.setScale(scale.x, scale.y);
    this.squashTween = this.scene.tweens.add({
      targets: this.visual,
      scaleX: 1,
      scaleY: 1,
      duration: FX.squashRecoverMs,
      ease: 'Quad.easeOut',
    });
  }

  private resetSquash(): void {
    this.squashTween?.remove();
    this.squashTween = null;
    this.visual.setScale(1);
  }
}
