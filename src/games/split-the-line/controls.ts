/**
 * What the player is asking for, whatever they are asking with. A kiosk has a touchscreen and
 * nothing else, so every game has to be playable with fingers alone; a keyboard is only a
 * convenience while making it. The scenes ask this, and never the pointer or the keys.
 *
 * The tap is held open by a finger on the screen, anywhere, and shuts when it lifts. (While
 * making it: the space bar does the same.)
 */
import Phaser from 'phaser';

export class Controls {
  /** The tap is being held open. Set by `update`. */
  holding = false;

  private readonly scene: Phaser.Scene;
  private readonly space: Phaser.Input.Keyboard.Key | undefined;
  private ignoring = false;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.space = scene.input.keyboard?.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
  }

  /** Reads the finger and the key. Call once a frame. */
  update(): void {
    const pointer = this.scene.input.activePointer;
    if (!pointer.isDown) this.ignoring = false;
    this.holding = (pointer.isDown && !this.ignoring) || this.space?.isDown === true;
  }

  /**
   * Ignores the finger until it is lifted: one that went down before the glass was ready (the tap
   * that started the play, or one held through a result) is not a pour.
   */
  cancel(): void {
    this.ignoring = this.scene.input.activePointer.isDown;
    this.holding = false;
  }
}
