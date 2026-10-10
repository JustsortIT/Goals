/** String keys the shell's own code needs. A type's keys are its own (`platformer/config/keys.ts`). */

export const FontKey = {
  /** The bitmap font all in-game text uses (`pixelFont.ts`). */
  Pixel: 'pixel',
  /** The TTF it is built from, which a type loads before it builds the font; the key is its CSS font-family. */
  PixelSource: 'Kenney Mini',
} as const;

/** The texture the pixel font is drawn into. */
export const PIXEL_FONT_TEXTURE = 'pixel-font';
