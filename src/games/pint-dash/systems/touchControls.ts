import Phaser from 'phaser';
import { FONT_SIZE, GAME_HEIGHT, GAME_WIDTH, TOUCH } from '../config/constants';
import { touchState, type TouchAction } from './input';
import { addPixelText, centerPixelText } from './pixelFont';

interface Button {
  action: TouchAction;
  /** Slightly larger than the visible button, so near misses still count. */
  area: Phaser.Geom.Rectangle;
  face: Phaser.GameObjects.Rectangle;
}

const FACE_COLOR = 0x1b1424;
const EDGE_COLOR = 0xffffff;

/**
 * On-screen buttons for touch devices: jump on the left, and left / right / jump on the
 * right. They only record what is held in `touchState`; `PlayerInput` turns that into
 * movement, exactly as it does for the keyboard.
 *
 * Buttons are read by checking every finger against every button each frame, rather
 * than by press and release events. That way sliding a thumb from one button to the
 * next works, and two buttons can be held at once.
 */
export class TouchControls {
  private readonly scene: Phaser.Scene;
  private readonly buttons: Button[] = [];

  /** Whether this device has a touch screen. */
  static isNeeded(scene: Phaser.Scene): boolean {
    return scene.sys.game.device.input.touch;
  }

  constructor(scene: Phaser.Scene) {
    this.scene = scene;

    const { buttonSize: size, margin, gap } = TOUCH;
    const bottom = GAME_HEIGHT - margin - size;
    const right = GAME_WIDTH - margin - size;
    const left = right - gap - size;

    this.addButton('jump', margin, bottom, 'JUMP', FONT_SIZE.small);
    this.addButton('left', left, bottom, '<', FONT_SIZE.medium);
    this.addButton('right', right, bottom, '>', FONT_SIZE.medium);
    this.addButton('jump', (left + right) / 2, bottom - gap - size, 'JUMP', FONT_SIZE.small);

    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, this.release, this);
  }

  /** Call every frame from the scene's `update`. */
  update(): void {
    const pointers = this.scene.input.manager.pointers;
    const held: Record<TouchAction, boolean> = { left: false, right: false, jump: false };

    for (const button of this.buttons) {
      const pressed = pointers.some(
        (pointer) => pointer.isDown && button.area.contains(pointer.x, pointer.y),
      );
      button.face.setFillStyle(FACE_COLOR, pressed ? TOUCH.pressedAlpha : TOUCH.idleAlpha);
      if (pressed) held[button.action] = true;
    }

    Object.assign(touchState, held);
  }

  private addButton(
    action: TouchAction,
    x: number,
    y: number,
    label: string,
    fontSize: number,
  ): void {
    const { buttonSize: size, gap } = TOUCH;
    const face = this.scene.add
      .rectangle(x, y, size, size, FACE_COLOR, TOUCH.idleAlpha)
      .setOrigin(0, 0)
      .setStrokeStyle(1, EDGE_COLOR, TOUCH.edgeAlpha);
    const text = addPixelText(this.scene, 0, 0, label, fontSize).setAlpha(TOUCH.labelAlpha);
    centerPixelText(text, x + size / 2, y + size / 2);

    const area = new Phaser.Geom.Rectangle(x - gap / 2, y - gap / 2, size + gap, size + gap);
    this.buttons.push({ action, area, face });
  }

  /** Nothing is held once the HUD goes away. */
  private release(): void {
    Object.assign(touchState, { left: false, right: false, jump: false });
  }
}
