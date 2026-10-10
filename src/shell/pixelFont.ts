import Phaser from 'phaser';
import { FONT_SIZE } from './constants';
import { FontKey, PIXEL_FONT_TEXTURE } from './keys';

/**
 * Builds a bitmap font from the loaded TTF, so text is drawn with the same hard pixels
 * as the rest of the art. Canvas text (Phaser's `Text`) is always anti-aliased by the
 * browser, which shows up as soft grey fringes at this resolution.
 *
 * Each glyph is rasterised large, read back once, and reduced to the font's own pixel
 * grid by sampling the centre of every font pixel. A dark outline is baked in, so text
 * stays readable over both the pale sky and the ground, and survives tinting.
 */

/** The font is designed on a grid of this many pixels per em. */
const GRID = FONT_SIZE.small;
/** Each font pixel is rasterised as a block this many canvas pixels wide. */
const SUPERSAMPLE = 8;
/** Room kept above and below the baseline, in font pixels. */
const ASCENT = 7;
const DESCENT = 2;
const FIRST_CHAR = 32;
const LAST_CHAR = 126;
const OUTLINE_COLOR = '#2b2540';
/** Outline margin on every side of a glyph. */
const MARGIN = 1;
/** Transparent gap between glyphs in the texture, so scaled text never samples a neighbour. */
const GAP = 1;

interface Glyph {
  code: number;
  /** Advance width in font pixels. */
  advance: number;
  /** `pixels[y][x]` is true where the glyph is filled. */
  pixels: boolean[][];
}

function rasteriseGlyphs(): Glyph[] {
  const height = ASCENT + DESCENT;
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (!context) {
    throw new Error('Could not create a canvas to build the pixel font.');
  }

  const font = `${GRID * SUPERSAMPLE}px "${FontKey.PixelSource}"`;
  context.font = font;
  const glyphs: Glyph[] = [];
  for (let code = FIRST_CHAR; code <= LAST_CHAR; code++) {
    const width = context.measureText(String.fromCharCode(code)).width;
    glyphs.push({ code, advance: Math.max(1, Math.round(width / SUPERSAMPLE)), pixels: [] });
  }

  const totalAdvance = glyphs.reduce((sum, glyph) => sum + glyph.advance, 0);
  canvas.width = totalAdvance * SUPERSAMPLE;
  canvas.height = height * SUPERSAMPLE;
  // Resizing a canvas resets its state.
  context.font = font;
  context.textBaseline = 'alphabetic';
  context.fillStyle = '#ffffff';

  let cursor = 0;
  const starts: number[] = [];
  for (const glyph of glyphs) {
    starts.push(cursor);
    context.fillText(String.fromCharCode(glyph.code), cursor * SUPERSAMPLE, ASCENT * SUPERSAMPLE);
    cursor += glyph.advance;
  }

  const { data } = context.getImageData(0, 0, canvas.width, canvas.height);
  const half = SUPERSAMPLE / 2;
  glyphs.forEach((glyph, index) => {
    for (let y = 0; y < height; y++) {
      const row: boolean[] = [];
      for (let x = 0; x < glyph.advance; x++) {
        const sampleX = (starts[index] + x) * SUPERSAMPLE + half;
        const sampleY = y * SUPERSAMPLE + half;
        row.push(data[(sampleY * canvas.width + sampleX) * 4 + 3] >= 128);
      }
      glyph.pixels.push(row);
    }
  });

  return glyphs;
}

/** Call once, after the TTF (`FontKey.PixelSource`) has loaded. */
export function createPixelFont(scene: Phaser.Scene): void {
  if (scene.cache.bitmapFont.exists(FontKey.Pixel)) {
    return;
  }

  const glyphs = rasteriseGlyphs();
  const cellHeight = ASCENT + DESCENT + MARGIN * 2;
  const cellWidth = (glyph: Glyph) => glyph.advance + MARGIN * 2;
  const textureWidth = glyphs.reduce((sum, glyph) => sum + cellWidth(glyph) + GAP, 0);

  const texture = scene.textures.createCanvas(PIXEL_FONT_TEXTURE, textureWidth, cellHeight);
  if (!texture) {
    throw new Error('Could not create the pixel font texture.');
  }
  const context = texture.getContext();

  // BMFont XML is the format Phaser's own bitmap font parser reads.
  const chars: string[] = [];
  let cellX = 0;
  for (const glyph of glyphs) {
    const filled = (x: number, y: number) => glyph.pixels[y]?.[x] === true;

    for (let y = -MARGIN; y < ASCENT + DESCENT + MARGIN; y++) {
      for (let x = -MARGIN; x < glyph.advance + MARGIN; x++) {
        let color: string | null = null;
        if (filled(x, y)) {
          color = '#ffffff';
        } else {
          // Outline any empty pixel that touches a filled one, diagonals included.
          for (let dy = -1; dy <= 1 && !color; dy++) {
            for (let dx = -1; dx <= 1 && !color; dx++) {
              if (filled(x + dx, y + dy)) color = OUTLINE_COLOR;
            }
          }
        }
        if (color) {
          context.fillStyle = color;
          context.fillRect(cellX + MARGIN + x, MARGIN + y, 1, 1);
        }
      }
    }

    // Advancing one pixel less than the cell makes neighbouring outlines share a column.
    chars.push(
      `<char id="${glyph.code}" x="${cellX}" y="0" width="${cellWidth(glyph)}" height="${cellHeight}" ` +
        `xoffset="0" yoffset="0" xadvance="${glyph.advance + MARGIN}"/>`,
    );
    cellX += cellWidth(glyph) + GAP;
  }
  texture.refresh();

  const xml = new DOMParser().parseFromString(
    `<font><info face="${FontKey.Pixel}" size="${GRID}"/><common lineHeight="${cellHeight + 1}"/>` +
      `<chars count="${chars.length}">${chars.join('')}</chars></font>`,
    'application/xml',
  );
  const data = Phaser.GameObjects.BitmapText.ParseXMLBitmapFont(xml, texture.get());
  scene.cache.bitmapFont.add(FontKey.Pixel, { data, texture: PIXEL_FONT_TEXTURE, frame: null });
}

/**
 * Adds text in the pixel font. Use sizes from `FONT_SIZE`: only multiples of 8px keep
 * every font pixel a whole number of screen pixels.
 */
export function addPixelText(
  scene: Phaser.Scene,
  x: number,
  y: number,
  text: string,
  size: number = FONT_SIZE.small,
): Phaser.GameObjects.BitmapText {
  return scene.add.bitmapText(Math.round(x), Math.round(y), FontKey.Pixel, text, size);
}

/** Centres text on a point, keeping its top-left corner on a whole pixel. */
export function centerPixelText(text: Phaser.GameObjects.BitmapText, x: number, y: number): void {
  text.setPosition(Math.round(x - text.width / 2), Math.round(y - text.height / 2));
}
