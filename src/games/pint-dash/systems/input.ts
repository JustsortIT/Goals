import Phaser from 'phaser';

/** What the player wants to do this frame, independent of which device or key said so. */
export interface InputState {
  moveX: -1 | 0 | 1;
  /** True only on the frame a jump key or button went down. */
  jumpPressed: boolean;
  jumpHeld: boolean;
}

export type TouchAction = 'left' | 'right' | 'jump';

/**
 * What the on-screen buttons are holding down. Written by `TouchControls` (which lives
 * in the HUD scene) and read here, the same way the keyboard is a shared device.
 */
export const touchState: Record<TouchAction, boolean> = { left: false, right: false, jump: false };

/**
 * Maps input devices to player intent: arrows or A/D to move; Space, Up or W to jump;
 * or the on-screen buttons. Entities consume `InputState`, so adding a device (a
 * gamepad, say) only needs to change this class.
 */
export class PlayerInput {
  private readonly left: Phaser.Input.Keyboard.Key[];
  private readonly right: Phaser.Input.Keyboard.Key[];
  private readonly jump: Phaser.Input.Keyboard.Key[];
  private touchJumpWasHeld = false;

  constructor(scene: Phaser.Scene) {
    const keyboard = scene.input.keyboard;
    if (!keyboard) {
      throw new Error('Keyboard input is disabled in the game config.');
    }

    const { KeyCodes } = Phaser.Input.Keyboard;
    this.left = [keyboard.addKey(KeyCodes.LEFT), keyboard.addKey(KeyCodes.A)];
    this.right = [keyboard.addKey(KeyCodes.RIGHT), keyboard.addKey(KeyCodes.D)];
    this.jump = [
      keyboard.addKey(KeyCodes.SPACE),
      keyboard.addKey(KeyCodes.UP),
      keyboard.addKey(KeyCodes.W),
    ];
  }

  /** Call exactly once per frame: reading consumes the "just pressed" state of the jump keys. */
  read(): InputState {
    const left = touchState.left || this.left.some((key) => key.isDown);
    const right = touchState.right || this.right.some((key) => key.isDown);

    let jumpPressed = touchState.jump && !this.touchJumpWasHeld;
    this.touchJumpWasHeld = touchState.jump;
    for (const key of this.jump) {
      // No short-circuit: JustDown must be called on every key to clear its flag.
      if (Phaser.Input.Keyboard.JustDown(key)) {
        jumpPressed = true;
      }
    }

    let moveX: InputState['moveX'] = 0;
    if (left !== right) {
      moveX = left ? -1 : 1;
    }

    return {
      moveX,
      jumpPressed,
      jumpHeld: touchState.jump || this.jump.some((key) => key.isDown),
    };
  }
}
