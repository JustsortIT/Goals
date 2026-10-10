/**
 * What the player is asking for, whatever they are asking with. A kiosk has a touchscreen and
 * nothing else, so every game has to be playable with fingers alone; a keyboard is only a
 * convenience while making it. The scenes ask this, and never the pointer or the keys.
 *
 * The kick is a drag: touch anywhere, pull back (down the screen) and let go. The pull is how
 * far the finger has moved from where it first touched, so the finger never has to cover the
 * ball. With a keyboard: left and right aim, up and down set the power, space kicks.
 */
import Phaser from 'phaser';

export interface Pull {
  x: number;
  y: number;
}

/** Pixels of pull a second while a key is held. */
const KEY_SPEED = 70;

export class Controls {
  /** The pull while the player is holding, else null. Set by `update`. */
  held: Pull | null = null;
  /** The pull the player let go with, for the one `update` after they let go. */
  released: Pull | null = null;

  private readonly scene: Phaser.Scene;
  private readonly keys: Phaser.Types.Input.Keyboard.CursorKeys | undefined;
  private readonly space: Phaser.Input.Keyboard.Key | undefined;
  private readonly pull: Pull = { x: 0, y: 0 };
  private readonly keyPull: Pull = { x: 0, y: 0 };
  private down = false;
  private ignoring = false;
  private keyAiming = false;
  private startX = 0;
  private startY = 0;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.keys = scene.input.keyboard?.createCursorKeys();
    this.space = scene.input.keyboard?.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
  }

  /** Reads the finger and the keys. Call once a frame. */
  update(deltaMs: number): void {
    this.released = null;
    const pointer = this.scene.input.activePointer;
    if (!pointer.isDown) this.ignoring = false;

    if (pointer.isDown && !this.ignoring) {
      if (!this.down) {
        this.down = true;
        // Where the finger first touched, not where it was when this frame looked.
        this.startX = pointer.downX;
        this.startY = pointer.downY;
      }
      this.pull.x = pointer.x - this.startX;
      this.pull.y = pointer.y - this.startY;
      this.held = this.pull;
      return;
    }
    if (this.down) {
      this.down = false;
      this.held = null;
      this.released = { x: this.pull.x, y: this.pull.y };
      return;
    }
    this.readKeys(deltaMs);
  }

  /**
   * Forgets a hold, and ignores the finger until it is lifted: a finger that went down while the
   * ball was flying is not a kick.
   */
  cancel(): void {
    this.ignoring = this.scene.input.activePointer.isDown;
    this.down = false;
    this.held = null;
    this.released = null;
    this.keyAiming = false;
    this.keyPull.x = 0;
    this.keyPull.y = 0;
  }

  private readKeys(deltaMs: number): void {
    const { keys, space } = this;
    if (!keys || !space) return;
    const step = (KEY_SPEED * deltaMs) / 1000;
    // The pull is the other way from the aim: aiming left is a pull to the right.
    if (keys.left.isDown) this.keyPull.x += step;
    if (keys.right.isDown) this.keyPull.x -= step;
    if (keys.up.isDown) this.keyPull.y += step;
    if (keys.down.isDown) this.keyPull.y -= step;
    if (keys.left.isDown || keys.right.isDown || keys.up.isDown || keys.down.isDown) {
      this.keyAiming = true;
    }
    if (this.keyAiming && Phaser.Input.Keyboard.JustDown(space)) {
      this.released = { x: this.keyPull.x, y: this.keyPull.y };
      this.held = null;
      return;
    }
    this.held = this.keyAiming ? this.keyPull : null;
  }
}
