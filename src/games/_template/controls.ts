/**
 * What the player is asking for, whatever they are asking with. A kiosk has a touchscreen and
 * nothing else, so every game has to be playable with fingers alone; a keyboard is only a
 * convenience while making it. The scenes ask this, and never the pointer or the keys.
 */
import Phaser from 'phaser';
import { GAME_WIDTH } from '../../shell/constants';

export class Controls {
  private readonly scene: Phaser.Scene;
  private readonly keys: Phaser.Types.Input.Keyboard.CursorKeys | undefined;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.keys = scene.input.keyboard?.createCursorKeys();
  }

  /** Where across the screen the player wants to be: under the finger, or as far as a held key points. */
  target(current: number): number {
    // `x` is where the finger is on the game's own 480 by 270, whatever size the screen is. (A
    // game whose camera scrolls wants `worldX`, which is only kept up to date for a scene that
    // listens for pointer events.)
    const pointer = this.scene.input.activePointer;
    if (pointer.isDown) return pointer.x;
    if (this.keys?.left?.isDown) return 0;
    if (this.keys?.right?.isDown) return GAME_WIDTH;
    return current;
  }
}
