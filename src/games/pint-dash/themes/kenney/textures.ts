import type Phaser from 'phaser';
import { TILE_SIZE } from '../../config/constants';
import { TextureKey } from '../../config/keys';
import {
  ATLAS_COLUMNS,
  ATLAS_ROWS,
  CHARACTER_SIZE,
  CustomTile,
  SHEETS,
  SourceFrame,
  type SheetLayout,
} from './frames';

/**
 * Kenney textures that are built at boot rather than loaded as-is: the loaded sheets
 * combined into one tile atlas, and a few tiles and sprites derived from the art pack.
 * Call after the sheets these draw from have loaded.
 *
 * Colours come from the art pack's palette so the additions sit with the rest.
 */

type Draw = (context: CanvasRenderingContext2D) => void;
type Rgb = readonly [red: number, green: number, blue: number];

const OUTLINE = '#434a5f';
const STEEL = '#959ab1';
const STEEL_DARK = '#737999';
const STEEL_LIGHT = '#dce1e7';
const CREAM = '#fff6e2';
const LAMP_GLOW = '#ffd76a';

function createTexture(
  scene: Phaser.Scene,
  key: string,
  width: number,
  height: number,
  draw: Draw,
): Phaser.Textures.CanvasTexture | null {
  if (scene.textures.exists(key)) {
    return null;
  }

  const texture = scene.textures.createCanvas(key, width, height);
  if (!texture) {
    throw new Error(`Could not create texture "${key}".`);
  }
  draw(texture.getContext());
  texture.refresh();
  return texture;
}

/** A filled rectangle with a one-pixel outline, the basic shape of the art style. */
function box(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  fill: string,
): void {
  context.fillStyle = OUTLINE;
  context.fillRect(x, y, width, height);
  context.fillStyle = fill;
  context.fillRect(x + 1, y + 1, width - 2, height - 2);
}

function sourceImage(scene: Phaser.Scene, key: string): CanvasImageSource {
  return scene.textures.get(key).getSourceImage() as CanvasImageSource;
}

/**
 * Copies one frame of a sheet onto its own small canvas, lets `edit` change the pixels,
 * and returns the canvas. Reading pixels back is slow on a normal canvas, so the edits
 * happen here rather than on the big atlas.
 */
function editFrame(
  scene: Phaser.Scene,
  sheetKey: string,
  sheet: { columns: number },
  frame: number,
  size: number,
  edit: (image: ImageData) => void,
): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (!context) {
    throw new Error('Could not create a canvas to edit a sprite.');
  }

  const column = frame % sheet.columns;
  const row = Math.floor(frame / sheet.columns);
  context.drawImage(
    sourceImage(scene, sheetKey),
    column * size,
    row * size,
    size,
    size,
    0,
    0,
    size,
    size,
  );
  const image = context.getImageData(0, 0, size, size);
  edit(image);
  context.putImageData(image, 0, 0);
  return canvas;
}

// --- Pixel helpers for editing ImageData. ------------------------------------------------

const hex = (color: string): Rgb => [
  parseInt(color.slice(1, 3), 16),
  parseInt(color.slice(3, 5), 16),
  parseInt(color.slice(5, 7), 16),
];

function isColor(image: ImageData, x: number, y: number, color: Rgb): boolean {
  const i = (y * image.width + x) * 4;
  const { data } = image;
  return (
    data[i + 3] > 0 && data[i] === color[0] && data[i + 1] === color[1] && data[i + 2] === color[2]
  );
}

function setPixel(image: ImageData, x: number, y: number, color: Rgb | null): void {
  const i = (y * image.width + x) * 4;
  image.data[i] = color ? color[0] : 0;
  image.data[i + 1] = color ? color[1] : 0;
  image.data[i + 2] = color ? color[2] : 0;
  image.data[i + 3] = color ? 255 : 0;
}

function isEmpty(image: ImageData, x: number, y: number): boolean {
  return image.data[(y * image.width + x) * 4 + 3] === 0;
}

/** First and last filled column of a row, or null if the row is empty. */
function rowSpan(image: ImageData, y: number): { left: number; right: number } | null {
  let left = -1;
  let right = -1;
  for (let x = 0; x < image.width; x++) {
    if (!isEmpty(image, x, y)) {
      if (left < 0) left = x;
      right = x;
    }
  }
  return left < 0 ? null : { left, right };
}

// --- The hero: the pack's beige character with the space helmet taken off. ----------------

const HELMET_COLORS = [hex('#bedef1'), hex('#ffffff')];
const HAIR = hex('#9f5a52');
const SKIN = hex('#f4cca1');
const SKIN_SHADE = hex('#eea160');
const SHIRT = hex('#d45734');
const SHIRT_SHADE = hex('#b03220');
const TROUSERS = hex('#5f79b0');
const TROUSERS_SHADE = hex('#48608f');

/**
 * Every hero in the pack wears a bubble helmet. Removing its pixels leaves a head
 * floating above the body, so the head is moved down to sit on the shoulders, the chin
 * gets the outline the helmet used to provide, and the bare body is given clothes.
 */
function removeHelmet(image: ImageData): void {
  const { width, height } = image;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (HELMET_COLORS.some((color) => isColor(image, x, y, color))) {
        setPixel(image, x, y, null);
      }
    }
  }

  // Find the head (first filled rows) and the empty band the helmet left under it.
  let headTop = 0;
  while (headTop < height && !rowSpan(image, headTop)) headTop++;
  let gapStart = headTop;
  while (gapStart < height && rowSpan(image, gapStart)) gapStart++;
  let gapEnd = gapStart;
  while (gapEnd + 1 < height && !rowSpan(image, gapEnd + 1)) gapEnd++;
  if (gapStart >= height || gapEnd + 1 >= height) {
    throw new Error('Hero sprite is not the shape the helmet removal expects.');
  }

  // Move the head down until one empty row is left; that row becomes the chin outline.
  const shift = gapEnd - gapStart;
  const rowBytes = width * 4;
  for (let y = gapStart - 1; y >= headTop; y--) {
    image.data.copyWithin((y + shift) * rowBytes, y * rowBytes, (y + 1) * rowBytes);
  }
  for (let y = headTop; y < headTop + shift; y++) {
    image.data.fill(0, y * rowBytes, (y + 1) * rowBytes);
  }

  const chinRow = gapEnd - 1;
  const chin = rowSpan(image, chinRow);
  const neck = rowSpan(image, gapEnd + 1);
  if (!chin || !neck) {
    throw new Error('Hero sprite is not the shape the helmet removal expects.');
  }
  setPixel(image, chin.left - 1, chinRow, HAIR);
  setPixel(image, chin.right + 1, chinRow, HAIR);
  for (let x = chin.left; x <= chin.right; x++) setPixel(image, x, gapEnd, HAIR);
  for (let x = neck.left; x <= neck.right; x++) setPixel(image, x, gapEnd + 1, HAIR);

  // Clothes: the first row of skin below the neck is the torso, the rest are legs.
  let torso = true;
  for (let y = gapEnd + 2; y < height; y++) {
    let recoloured = false;
    for (let x = 0; x < width; x++) {
      const shade = isColor(image, x, y, SKIN_SHADE);
      if (isColor(image, x, y, SKIN) || shade) {
        const [light, dark] = torso ? [SHIRT, SHIRT_SHADE] : [TROUSERS, TROUSERS_SHADE];
        setPixel(image, x, y, shade ? dark : light);
        recoloured = true;
      }
    }
    if (recoloured) torso = false;
  }
}

function createHero(scene: Phaser.Scene): void {
  const size = CHARACTER_SIZE;
  const sources = [SourceFrame.HeroStand, SourceFrame.HeroStep];
  const sheet = { columns: scene.textures.get(TextureKey.Characters).source[0].width / size };

  const texture = createTexture(scene, TextureKey.Hero, size * sources.length, size, (context) => {
    sources.forEach((frame, index) => {
      const edited = editFrame(scene, TextureKey.Characters, sheet, frame, size, removeHelmet);
      context.drawImage(edited, index * size, 0);
    });
  });
  sources.forEach((_, index) => texture?.add(index, 0, index * size, 0, size, size));
}

// --- Tiles drawn or derived in code (the custom row of the atlas). ------------------------

const BEER = hex('#f4b041');
const BEER_SHADE = hex('#d98a2b');
const BEER_SHINE = hex('#ffd76a');
const MUG_WHITE = hex('#ffffff');
const MUG_GREY = hex('#dce1e7');
/** The mug's body spans these columns; the handle is to the right of it. */
const MUG_BODY_RIGHT = 11;
/** Rows above this stay white, as the head on the pint. */
const FOAM_BOTTOM = 4;

/** Turns the pack's white mug into a pint: amber below a white head. */
function fillWithBeer(image: ImageData): void {
  for (let y = 0; y < image.height; y++) {
    for (let x = 0; x <= MUG_BODY_RIGHT; x++) {
      if (y <= FOAM_BOTTOM) continue;
      if (isColor(image, x, y, MUG_WHITE)) setPixel(image, x, y, BEER);
      else if (isColor(image, x, y, MUG_GREY)) setPixel(image, x, y, BEER_SHADE);
    }
  }
  for (let y = FOAM_BOTTOM + 2; y <= 12; y++) setPixel(image, 3, y, BEER_SHINE);
}

function drawLampPost(context: CanvasRenderingContext2D): void {
  box(context, 7, -1, 4, 16, STEEL);
  box(context, 4, 13, 10, 5, STEEL_DARK);
}

function drawLampHead(context: CanvasRenderingContext2D): void {
  box(context, 7, 11, 4, 8, STEEL);
  box(context, 5, 4, 8, 9, LAMP_GLOW);
  context.fillStyle = CREAM;
  context.fillRect(7, 6, 4, 5);
  box(context, 3, 1, 12, 4, STEEL_DARK);
}

function drawWindow(context: CanvasRenderingContext2D): void {
  box(context, 1, 1, 16, 14, CREAM);
  context.fillStyle = LAMP_GLOW;
  context.fillRect(3, 3, 12, 10);
  context.fillStyle = '#f4b041';
  context.fillRect(3, 9, 12, 4);
  // Glazing bars.
  context.fillStyle = CREAM;
  context.fillRect(8, 3, 2, 10);
  context.fillRect(3, 7, 12, 1);
  box(context, 0, 14, 18, 4, STEEL_LIGHT);
}

/** A pub sign board three tiles wide; the name is added as text on top of it. */
function drawSignBoard(context: CanvasRenderingContext2D): void {
  const width = TILE_SIZE * 3;
  box(context, 1, 2, width - 2, 14, '#2f6f5e');
  context.strokeStyle = '#f4b041';
  context.lineWidth = 1;
  context.strokeRect(3.5, 4.5, width - 7, 9);
}

function drawCustomTiles(context: CanvasRenderingContext2D, scene: Phaser.Scene): void {
  const top = SHEETS.custom.firstRow * TILE_SIZE;
  // Clipped to its own cells, so a shape that overhangs cannot mark a neighbouring tile.
  const drawAt = (tile: number, draw: Draw, tilesWide = 1) => {
    context.save();
    context.translate(tile * TILE_SIZE, top);
    context.beginPath();
    context.rect(0, 0, tilesWide * TILE_SIZE, TILE_SIZE);
    context.clip();
    draw(context);
    context.restore();
  };

  drawAt(CustomTile.LampPost, drawLampPost);
  drawAt(CustomTile.LampHead, drawLampHead);
  drawAt(CustomTile.Window, drawWindow);
  drawAt(CustomTile.SignLeft, drawSignBoard, 3);

  const pint = editFrame(
    scene,
    TextureKey.TilesFood,
    SHEETS.food,
    SourceFrame.Mug,
    TILE_SIZE,
    fillWithBeer,
  );
  context.drawImage(pint, CustomTile.Pint * TILE_SIZE, top);
}

/**
 * Stacks the loaded tile sheets into one texture, so a level layer (which draws from a
 * single tileset) and every tile-sized sprite can use tiles from any of them.
 */
function createTileAtlas(scene: Phaser.Scene): void {
  const size = TILE_SIZE;
  const sources: Array<[key: string, sheet: SheetLayout]> = [
    [TextureKey.TilesBase, SHEETS.base],
    [TextureKey.TilesIndustrial, SHEETS.industrial],
    [TextureKey.TilesFood, SHEETS.food],
    [TextureKey.TilesBricks, SHEETS.bricks],
  ];

  const texture = createTexture(
    scene,
    TextureKey.Tiles,
    ATLAS_COLUMNS * size,
    ATLAS_ROWS * size,
    (context) => {
      for (const [key, sheet] of sources) {
        context.drawImage(sourceImage(scene, key), 0, sheet.firstRow * size);
      }
      drawCustomTiles(context, scene);
    },
  );

  for (let frame = 0; frame < ATLAS_COLUMNS * ATLAS_ROWS; frame++) {
    const column = frame % ATLAS_COLUMNS;
    const row = Math.floor(frame / ATLAS_COLUMNS);
    texture?.add(frame, 0, column * size, row * size, size, size);
  }
}

export function createKenneyTextures(scene: Phaser.Scene): void {
  createTileAtlas(scene);
  createHero(scene);
}
