/**
 * This game's text: a plain bold sans-serif, smooth at any zoom, instead of the shell's pixel font,
 * because a quiz is read in a glance and the pixel font is hard to read. (The pixel font is the
 * rule for PubPixels' games; a game that keeps this text cannot be carried over as it is.)
 *
 * It is written with the sizes the pixel font used (`FONT_SIZE`), so the scenes lay out the same.
 */
import Phaser from 'phaser';

const FAMILY = "'Trebuchet MS', 'Segoe UI', Verdana, Arial, sans-serif";
/** What a pixel font size becomes: a little larger, for the same width of word. */
const SCALE = 1.2;
/** The texture is drawn at this many times the size, so it stays sharp on a 1080p kiosk. */
const RESOLUTION = 4;

const css = (colour: number): string => `#${colour.toString(16).padStart(6, '0')}`;

export class QuizText extends Phaser.GameObjects.Text {
  constructor(scene: Phaser.Scene, x: number, y: number, words: string, size: number) {
    super(scene, Math.round(x), Math.round(y), words, {
      fontFamily: FAMILY,
      fontStyle: 'bold',
      color: '#ffffff',
      stroke: '#1b1426',
      resolution: RESOLUTION,
    });
    this.setFontSize(size);
    // The pictures are drawn without smoothing; the words need it to stay clean.
    this.texture.setFilter(Phaser.Textures.FilterMode.LINEAR);
  }

  /** Sizes are those of the pixel font. */
  override setFontSize(size: number): this {
    const px = Math.round(size * SCALE);
    super.setFontSize(px);
    this.setStroke('#1b1426', Math.max(2, Math.round(px / 7)));
    return this;
  }

  override setTint(colour: number): this {
    return this.setColor(css(colour));
  }

  setMaxWidth(width: number): this {
    return this.setWordWrapWidth(width, true);
  }

  setCenterAlign(): this {
    return this.setAlign('center');
  }
}

export function addText(
  scene: Phaser.Scene,
  x: number,
  y: number,
  words: string,
  size: number = 8,
): QuizText {
  const text = new QuizText(scene, x, y, words, size);
  scene.add.existing(text);
  return text;
}

/** Centres text on a point. */
export function centerText(text: Phaser.GameObjects.Text, x: number, y: number): void {
  text.setPosition(Math.round(x - text.width / 2), Math.round(y - text.height / 2));
}
