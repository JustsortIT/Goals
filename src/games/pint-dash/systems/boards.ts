import type Phaser from 'phaser';
import { BANNER, GAME_WIDTH } from '../config/constants';
import { themeArt } from '../themes';
import type { BoardArt } from '../themes/theme';
import { addPixelText, centerPixelText } from './pixelFont';

/**
 * Things with words on them. The theme supplies a blank picture and says where its blank
 * face is; the words are written on it here, in the pixel font.
 */

/** Behind the scenery and everything that moves, so a board never hides a keg. */
const NOTICE_DEPTH = -1;

/**
 * Writes `words` in the middle of a board's blank face. `left`, `top` is the board's
 * corner. `letterSpacing` is extra pixels between letters.
 */
function write(
  scene: Phaser.Scene,
  art: BoardArt,
  left: number,
  top: number,
  words: string,
  letterSpacing = 0,
): Phaser.GameObjects.BitmapText {
  const { writing } = art;
  const text = addPixelText(scene, 0, 0, words)
    .setTint(writing.tint)
    .setCenterAlign()
    .setLetterSpacing(letterSpacing);
  centerPixelText(text, left + writing.x + writing.width / 2, top + writing.y + writing.height / 2);
  return text;
}

/**
 * A notice board standing in the level with a message on it. `x`, `y` is the bottom-centre
 * of the cell it stands in.
 */
export function addNoticeBoard(scene: Phaser.Scene, x: number, y: number, message: string): void {
  const art = themeArt().noticeBoard;
  const board = scene.add
    .image(0, y, art.texture, art.frame)
    .setOrigin(0, 1)
    .setDepth(NOTICE_DEPTH);
  board.setX(Math.round(x - board.width / 2));
  write(scene, art, board.x, y - board.height, message).setDepth(NOTICE_DEPTH);
}

/**
 * The banner that drops in at the top of the screen to name the section of the level the
 * player has just entered, then lifts away again. It belongs to the HUD.
 */
export class SectionBanner {
  private readonly scene: Phaser.Scene;
  private readonly plate: Phaser.GameObjects.Container;
  private readonly art: BoardArt;
  private readonly height: number;
  private words: Phaser.GameObjects.BitmapText | null = null;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.art = themeArt().banner;

    const picture = scene.add.image(0, 0, this.art.texture, this.art.frame).setOrigin(0, 0);
    this.height = picture.height;
    // Hidden above the top of the screen until there is something to say.
    this.plate = scene.add.container(Math.round((GAME_WIDTH - picture.width) / 2), -this.height, [
      picture,
    ]);
  }

  show(name: string): void {
    this.words?.destroy();
    this.words = write(this.scene, this.art, 0, 0, name.toUpperCase(), BANNER.letterSpacing);
    this.plate.add(this.words);

    // Drop in, wait, lift away. Kept on whole pixels so the lettering stays crisp.
    this.scene.tweens.killTweensOf(this.plate);
    this.plate.setY(-this.height);
    this.scene.tweens.add({
      targets: this.plate,
      y: BANNER.y,
      duration: BANNER.slideMs,
      ease: 'Quad.easeOut',
      hold: BANNER.holdMs,
      yoyo: true,
      onUpdate: () => this.plate.setY(Math.round(this.plate.y)),
    });
  }
}
