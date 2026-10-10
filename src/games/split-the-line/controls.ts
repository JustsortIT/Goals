/**
 * What the player is asking for, whatever they are asking with. A kiosk has a touchscreen and
 * nothing else, so every game has to be playable with fingers alone; a keyboard is only a
 * convenience while making it. The scenes ask this, and never the pointer or the keys.
 *
 * The tap is held open by a finger on the screen, anywhere, and shuts when it lifts. The two-pint
 * bonus has two taps: a finger on the left half of the screen holds the left tap open, one on the
 * right half the right. Everything can be done with one finger, which goes from one half to the
 * other; whether two fingers at once reach the page on a real kiosk is not known yet. (While
 * making it: the space bar holds both taps, the left and right arrows one each.)
 */
import Phaser from 'phaser';
import { GAME_WIDTH } from '../../shell/constants';

export class Controls {
  /** Any tap is being held open. Set by `update`. */
  holding = false;
  /** The left half of the screen, or the right, is being held. */
  left = false;
  right = false;

  private readonly scene: Phaser.Scene;
  private readonly space: Phaser.Input.Keyboard.Key | undefined;
  private readonly keys: Phaser.Types.Input.Keyboard.CursorKeys | undefined;
  private ignoring = false;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.space = scene.input.keyboard?.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
    this.keys = scene.input.keyboard?.createCursorKeys();
  }

  private pointers(): Phaser.Input.Pointer[] {
    const { manager } = this.scene.input;
    return [manager.mousePointer, ...manager.pointers].filter(
      (pointer): pointer is Phaser.Input.Pointer => Boolean(pointer),
    );
  }

  /** Reads the fingers and the keys. Call once a frame. */
  update(): void {
    let anyDown = false;
    let left = false;
    let right = false;
    for (const pointer of this.pointers()) {
      if (!pointer.isDown) continue;
      anyDown = true;
      if (this.ignoring) continue;
      if (pointer.x < GAME_WIDTH / 2) left = true;
      else right = true;
    }
    if (!anyDown) this.ignoring = false;

    const space = this.space?.isDown === true;
    this.left = left || space || this.keys?.left.isDown === true;
    this.right = right || space || this.keys?.right.isDown === true;
    this.holding = this.left || this.right;
  }

  /**
   * Ignores the fingers until they are lifted: one that went down before the glass was ready (the
   * tap that started the play, or one held through a result) is not a pour.
   */
  cancel(): void {
    this.ignoring = this.pointers().some((pointer) => pointer.isDown);
    this.holding = false;
    this.left = false;
    this.right = false;
  }
}
