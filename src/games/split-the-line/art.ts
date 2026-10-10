/**
 * The pictures, drawn in code once when the game loads: the inside of a pub seen across the bar,
 * and the pint glass with the stout in it. Nothing is downloaded, and there is no lettering in any
 * of it: the bottle labels, the tap handles and the beer mats are blank.
 *
 * The aim is a photograph's look, not pixel art's: soft light from copper lamps, a brick wall and
 * a mirrored back-bar a little out of focus (the way a camera focused on the glass would see it),
 * chrome taps with proper highlights, a polished bar that shines under the lamps, and a glass of
 * stout that is dark ruby at the edges, with a cream head and a cloudy surge. Everything is drawn
 * from seeded random numbers, so the picture is the same every time.
 */
import type Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH } from '../../shell/constants';
import { BOARD, GLASS, GLASS_HEIGHT, HANDLE, handleKey, SPOUT, TAPS, TextureKey } from './config';
import { glassWidthAt } from './logic';

export type Ctx = CanvasRenderingContext2D;
export type Rgb = [number, number, number];

export function createTexture(
  scene: Phaser.Scene,
  key: string,
  width: number,
  height: number,
  draw: (context: Ctx) => void,
): void {
  if (scene.textures.exists(key)) return;
  const texture = scene.textures.createCanvas(key, width, height);
  if (!texture) throw new Error(`Could not create texture "${key}".`);
  draw(texture.getContext());
  texture.refresh();
}

/* ------------------------------------------------------------------------------------------
 * Small tools: colour, a seeded random, a canvas of our own.
 * ---------------------------------------------------------------------------------------- */

export const rgb = (hex: string): Rgb => [
  parseInt(hex.slice(1, 3), 16),
  parseInt(hex.slice(3, 5), 16),
  parseInt(hex.slice(5, 7), 16),
];
export const fromNumber = (hex: number): Rgb => [(hex >> 16) & 255, (hex >> 8) & 255, hex & 255];
export const css = ([r, g, b]: Rgb, alpha = 1): string =>
  `rgba(${Math.round(r)},${Math.round(g)},${Math.round(b)},${alpha})`;
export const mix = (a: Rgb, b: Rgb, t: number): Rgb => [
  a[0] + (b[0] - a[0]) * t,
  a[1] + (b[1] - a[1]) * t,
  a[2] + (b[2] - a[2]) * t,
];
export const scaleRgb = (a: Rgb, k: number): Rgb => [
  Math.min(255, a[0] * k),
  Math.min(255, a[1] * k),
  Math.min(255, a[2] * k),
];

export const rect = (
  ctx: Ctx,
  colour: string,
  x: number,
  y: number,
  w: number,
  h: number,
): void => {
  ctx.fillStyle = colour;
  ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
};

/** The same numbers every time: a small seeded random. */
export function seeded(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A number from 0 to 1 for a point on a grid, the same every time. */
function lattice(x: number, y: number, seed: number): number {
  let n = Math.imul(x, 374761393) + Math.imul(y, 668265263) + Math.imul(seed, 1442695041);
  n = Math.imul(n ^ (n >>> 13), 1274126177);
  return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
}

function makeCanvas(width: number, height: number): [HTMLCanvasElement, Ctx] {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Could not make a canvas to draw on.');
  return [canvas, ctx];
}

/** Where the wall ends and the bar's top begins. */
const BAR_BACK = 196;
/** Where the wood panelling begins, below the bricks. */
const PANEL_TOP = 148;

/* ------------------------------------------------------------------------------------------
 * The wall behind the bar: brick, panelling, the mirrored shelves and their bottles.
 * ---------------------------------------------------------------------------------------- */

const BRICKS = ['#6a3226', '#5f2b21', '#733a2b', '#5a2921', '#683025'].map(rgb);

function drawBricks(ctx: Ctx, bottom: number = PANEL_TOP): void {
  rect(ctx, '#20120d', 0, 0, GAME_WIDTH, bottom + 4);
  const brickW = 18;
  const brickH = 8;
  for (let row = 0, y = 0; y < bottom; row += 1, y += brickH) {
    const offset = row % 2 === 0 ? 0 : brickW / 2;
    for (let x = -offset, column = 0; x < GAME_WIDTH; x += brickW, column += 1) {
      const tone = BRICKS[Math.floor(lattice(column, row, 4) * BRICKS.length)];
      const light = 0.92 + lattice(column, row, 9) * 0.16;
      const gradient = ctx.createLinearGradient(0, y + 1, 0, y + brickH);
      gradient.addColorStop(0, css(scaleRgb(mix(tone, [255, 205, 170], 0.08), light)));
      gradient.addColorStop(1, css(scaleRgb(tone, light * 0.85)));
      ctx.fillStyle = gradient;
      ctx.fillRect(x + 1, y + 1, brickW - 1, brickH - 1);
    }
  }
  // Dim the wall overall, so the lamps are what light it.
  rect(ctx, 'rgba(18,7,3,0.3)', 0, 0, GAME_WIDTH, bottom + 4);
}
function drawPanelling(ctx: Ctx, top: number = PANEL_TOP, bottom: number = BAR_BACK): void {
  for (let x = 0; x < GAME_WIDTH; x += 14) {
    const board = ctx.createLinearGradient(x, 0, x + 14, 0);
    board.addColorStop(0, '#2a180d');
    board.addColorStop(0.16, '#4a2d1a');
    board.addColorStop(0.62, '#3a2214');
    board.addColorStop(1, '#201109');
    ctx.fillStyle = board;
    ctx.fillRect(x, top, 14, bottom - top);
  }
  // Shaded where the bar stands in front of it, and the rail along the top.
  const foot = ctx.createLinearGradient(0, top, 0, bottom);
  foot.addColorStop(0, 'rgba(0,0,0,0)');
  foot.addColorStop(1, 'rgba(0,0,0,0.5)');
  ctx.fillStyle = foot;
  ctx.fillRect(0, top, GAME_WIDTH, bottom - top);
  const rail = ctx.createLinearGradient(0, top - 3, 0, top + 2);
  rail.addColorStop(0, '#b27a44');
  rail.addColorStop(0.4, '#7a4c26');
  rail.addColorStop(1, '#2a160a');
  ctx.fillStyle = rail;
  ctx.fillRect(0, top - 3, GAME_WIDTH, 5);
  rect(ctx, 'rgba(255,214,160,0.45)', 0, top - 3, GAME_WIDTH, 1);
}
/** A glass bottle, lit from the left: a bright band, the dark of its far side, a blank paper label. */
function bottle(
  ctx: Ctx,
  x: number,
  base: number,
  height: number,
  width: number,
  colour: Rgb,
  level: number,
): void {
  const neckW = Math.max(2, Math.round(width * 0.36));
  const neckX = x + (width - neckW) / 2;
  const bodyTop = base - height * 0.62;
  const top = base - height;

  const outline = (): void => {
    ctx.beginPath();
    ctx.moveTo(x, base);
    ctx.lineTo(x, bodyTop + 3);
    ctx.quadraticCurveTo(x, bodyTop - 1, neckX, bodyTop - 4);
    ctx.lineTo(neckX, top + 2);
    ctx.lineTo(neckX + neckW, top + 2);
    ctx.lineTo(neckX + neckW, bodyTop - 4);
    ctx.quadraticCurveTo(x + width, bodyTop - 1, x + width, bodyTop + 3);
    ctx.lineTo(x + width, base);
    ctx.closePath();
  };

  const body = ctx.createLinearGradient(x, 0, x + width, 0);
  body.addColorStop(0, css(scaleRgb(colour, 0.5)));
  body.addColorStop(0.22, css(scaleRgb(colour, 1.35)));
  body.addColorStop(0.55, css(colour));
  body.addColorStop(1, css(scaleRgb(colour, 0.42)));
  outline();
  ctx.fillStyle = body;
  ctx.fill();

  ctx.save();
  outline();
  ctx.clip();
  // The drink in it: darker and richer than the glass above it.
  const drinkTop = base - (base - bodyTop + 6) * level;
  rect(ctx, css(scaleRgb(colour, 0.55), 0.55), x, drinkTop, width, base - drinkTop);
  rect(ctx, css(scaleRgb(colour, 1.6), 0.5), x, drinkTop, width, 1);
  ctx.restore();

  // The label: cream paper, a little shaded at its right, with no words on it.
  const labelTop = base - Math.round(height * 0.38);
  const labelHeight = Math.max(3, Math.round(height * 0.2));
  const label = ctx.createLinearGradient(x, 0, x + width, 0);
  label.addColorStop(0, '#f0e6cc');
  label.addColorStop(1, '#a89a7c');
  ctx.fillStyle = label;
  ctx.fillRect(x, labelTop, width, labelHeight);
  // The cap, and the highlight down the glass.
  rect(ctx, css(scaleRgb(colour, 0.4)), neckX - 0.5, top, neckW + 1, 3);
  rect(ctx, 'rgba(255,255,255,0.55)', x + 1, bodyTop + 2, 1, base - bodyTop - 4);
}

function drawShelves(ctx: Ctx): void {
  const random = seeded(21);
  const glassColours = [
    '#b5701c',
    '#2f6b3a',
    '#a9bcc6',
    '#3a302a',
    '#2a4f8a',
    '#8a1f3d',
    '#c28a2c',
  ].map(rgb);
  for (const [from, to] of [
    [14, 206],
    [384, 466],
  ] as const) {
    // The mirrored back of the shelves, dark bronze with a diagonal sheen.
    const mirror = ctx.createLinearGradient(from, 36, to, 128);
    mirror.addColorStop(0, '#33231a');
    mirror.addColorStop(0.5, '#4a3426');
    mirror.addColorStop(1, '#1d130d');
    ctx.fillStyle = mirror;
    ctx.fillRect(from - 4, 34, to - from + 8, 96);
    ctx.fillStyle = 'rgba(255,228,196,0.07)';
    ctx.beginPath();
    ctx.moveTo(from + 30, 34);
    ctx.lineTo(from + 62, 34);
    ctx.lineTo(from + 22, 130);
    ctx.lineTo(from - 10, 130);
    ctx.closePath();
    ctx.fill();
    // The frame around it.
    rect(ctx, '#5a3820', from - 6, 32, to - from + 12, 3);
    rect(ctx, '#2a170b', from - 6, 130, to - from + 12, 3);
    rect(ctx, '#4a2e19', from - 6, 32, 3, 101);
    rect(ctx, '#4a2e19', to + 3, 32, 3, 101);

    for (const shelfY of [76, 118]) {
      for (let x = from + 3; x < to - 10; x += 9 + Math.floor(random() * 6)) {
        bottle(
          ctx,
          x,
          shelfY,
          16 + Math.floor(random() * 14),
          5 + Math.floor(random() * 4),
          glassColours[Math.floor(random() * glassColours.length)],
          0.35 + random() * 0.55,
        );
      }
      // The plank, lit along its front edge, with its shadow on the mirror below.
      const shadow = ctx.createLinearGradient(0, shelfY + 5, 0, shelfY + 14);
      shadow.addColorStop(0, 'rgba(0,0,0,0.45)');
      shadow.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = shadow;
      ctx.fillRect(from - 4, shelfY + 5, to - from + 8, 9);
      const plank = ctx.createLinearGradient(0, shelfY, 0, shelfY + 5);
      plank.addColorStop(0, '#c78b50');
      plank.addColorStop(0.4, '#8a5a30');
      plank.addColorStop(1, '#3a2212');
      ctx.fillStyle = plank;
      ctx.fillRect(from - 4, shelfY, to - from + 8, 5);
    }
  }
}

/** Which of the pub's rooms is drawn: the back-bar with the taps, the room across the bar, or a bare wall. */
type Variant = 'bar' | 'room' | 'wall';
/** Where the wall's panelling begins on the bare wall, which has no bar. */
const WALL_PANEL = 200;

/** A picture in a frame, blank of any words: a painted view of hills under a sky. */
function drawFrame(ctx: Ctx, x: number, y: number, w: number, h: number, mood: number): void {
  const depth = 4;
  const sky = ctx.createLinearGradient(0, y, 0, y + h);
  sky.addColorStop(0, mood === 0 ? '#8fb3cf' : '#d9a56b');
  sky.addColorStop(1, mood === 0 ? '#d8e4e8' : '#f0d9a6');
  ctx.fillStyle = sky;
  ctx.fillRect(x, y, w, h);
  for (const [colour, base, amp, seed] of [
    ['#6f8f6a', 0.62, 9, 1],
    ['#4d6b4c', 0.78, 7, 4],
  ] as const) {
    ctx.fillStyle = colour;
    ctx.beginPath();
    ctx.moveTo(x, y + h);
    for (let px = 0; px <= w; px += 2) {
      ctx.lineTo(
        x + px,
        y + h * base + Math.sin(px / 11 + seed + mood) * amp * 0.5 + Math.sin(px / 5 + seed) * 2,
      );
    }
    ctx.lineTo(x + w, y + h);
    ctx.closePath();
    ctx.fill();
  }
  // The frame: a gilt bevel, lit from the top left, and a cream mount.
  const frame = ctx.createLinearGradient(x - depth, y - depth, x + w + depth, y + h + depth);
  frame.addColorStop(0, '#d8b36a');
  frame.addColorStop(0.5, '#8a5f26');
  frame.addColorStop(1, '#4a3010');
  ctx.strokeStyle = frame;
  ctx.lineWidth = depth;
  ctx.strokeRect(x - depth / 2, y - depth / 2, w + depth, h + depth);
  ctx.strokeStyle = '#e9e0c8';
  ctx.lineWidth = 2;
  ctx.strokeRect(x + 1, y + 1, w - 2, h - 2);
  rect(ctx, 'rgba(0,0,0,0.28)', x - depth, y + h + depth, w + depth * 2, 2);
}

/** A round wall clock with ticks and no numerals. */
function drawClock(ctx: Ctx, x: number, y: number): void {
  const rim = ctx.createRadialGradient(x - 3, y - 3, 2, x, y, 15);
  rim.addColorStop(0, '#f6efdc');
  rim.addColorStop(1, '#d6ccb0');
  ctx.fillStyle = '#3a2210';
  ctx.beginPath();
  ctx.arc(x, y, 15, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = rim;
  ctx.beginPath();
  ctx.arc(x, y, 12.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#2a2014';
  ctx.lineWidth = 1;
  for (let tick = 0; tick < 12; tick += 1) {
    const a = (tick * Math.PI) / 6;
    ctx.beginPath();
    ctx.moveTo(x + Math.sin(a) * 9.5, y - Math.cos(a) * 9.5);
    ctx.lineTo(x + Math.sin(a) * 11.5, y - Math.cos(a) * 11.5);
    ctx.stroke();
  }
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x + Math.sin(2.2) * 6, y - Math.cos(2.2) * 6);
  ctx.moveTo(x, y);
  ctx.lineTo(x + Math.sin(5.9) * 9, y - Math.cos(5.9) * 9);
  ctx.stroke();
  ctx.fillStyle = '#7a1f2a';
  ctx.fillRect(x - 1, y - 1, 2, 2);
}

/** The wall, drawn on a canvas of its own so it can be put a little out of focus. */
function drawWall(variant: Variant): HTMLCanvasElement {
  const [canvas, ctx] = makeCanvas(GAME_WIDTH, GAME_HEIGHT);
  if (variant === 'wall') {
    drawBricks(ctx, WALL_PANEL);
    drawPanelling(ctx, WALL_PANEL, GAME_HEIGHT);
    return canvas;
  }
  drawBricks(ctx);
  drawPanelling(ctx);
  if (variant === 'bar') {
    drawShelves(ctx);
  } else {
    drawFrame(ctx, 40, 38, 62, 46, 0);
    drawFrame(ctx, 378, 38, 62, 46, 1);
    drawClock(ctx, 240, 58);
  }
  return canvas;
}
/* ------------------------------------------------------------------------------------------
 * The lamps, the taps and the bar.
 * ---------------------------------------------------------------------------------------- */

function drawLamp(ctx: Ctx, x: number, y: number): void {
  rect(ctx, '#17100d', x, 0, 1, y);
  // The cone of light on the wall.
  const cone = ctx.createLinearGradient(0, y + 12, 0, y + 130);
  cone.addColorStop(0, 'rgba(255,208,134,0.3)');
  cone.addColorStop(1, 'rgba(255,190,110,0)');
  ctx.fillStyle = cone;
  ctx.beginPath();
  ctx.moveTo(x - 14, y + 12);
  ctx.lineTo(x + 14, y + 12);
  ctx.lineTo(x + 78, y + 132);
  ctx.lineTo(x - 78, y + 132);
  ctx.closePath();
  ctx.fill();

  // The shade: a dome of copper, bright where it faces the light and dark on its far side.
  const shade = ctx.createLinearGradient(x - 16, 0, x + 16, 0);
  shade.addColorStop(0, '#4d2808');
  shade.addColorStop(0.28, '#e89a4c');
  shade.addColorStop(0.55, '#b9692b');
  shade.addColorStop(1, '#3d1f06');
  ctx.fillStyle = shade;
  ctx.beginPath();
  ctx.moveTo(x - 3, y);
  ctx.lineTo(x + 3, y);
  ctx.quadraticCurveTo(x + 8, y + 6, x + 16, y + 12);
  ctx.lineTo(x - 16, y + 12);
  ctx.quadraticCurveTo(x - 8, y + 6, x - 3, y);
  ctx.closePath();
  ctx.fill();
  rect(ctx, 'rgba(255,236,200,0.6)', x - 12, y + 3, 1, 6);
  rect(ctx, '#f6c27a', x - 16, y + 12, 33, 1);

  // The bulb under it.
  const bulb = ctx.createRadialGradient(x, y + 14, 0, x, y + 14, 8);
  bulb.addColorStop(0, '#ffffff');
  bulb.addColorStop(0.4, '#fff1bf');
  bulb.addColorStop(1, 'rgba(255,214,130,0)');
  ctx.fillStyle = bulb;
  ctx.fillRect(x - 9, y + 8, 19, 13);

  // The glow it throws on everything round it.
  const glow = ctx.createRadialGradient(x, y + 16, 2, x, y + 16, 150);
  glow.addColorStop(0, 'rgba(255,214,140,0.6)');
  glow.addColorStop(0.3, 'rgba(255,190,110,0.22)');
  glow.addColorStop(1, 'rgba(255,170,80,0)');
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.fillStyle = glow;
  ctx.fillRect(x - 150, y - 100, 300, 280);
  ctx.restore();
}

/** Chrome tube, lit from the left: a dark edge, a bright band, a soft body and a dark far edge. */
function chromeTube(ctx: Ctx, x: number, y: number, width: number, height: number): void {
  const tube = ctx.createLinearGradient(x, 0, x + width, 0);
  tube.addColorStop(0, '#3d444d');
  tube.addColorStop(0.2, '#f6fafc');
  tube.addColorStop(0.42, '#b9c2ca');
  tube.addColorStop(0.75, '#6a737c');
  tube.addColorStop(1, '#2b3239');
  ctx.fillStyle = tube;
  ctx.fillRect(x, y, width, height);
}

/**
 * A tap handle, drawn standing up from its pin at the bottom of the picture: a slim stem that
 * flares into a lacquered grip with a rounded top, a gleam down it, a blank cream badge, and a
 * chrome ferrule where it meets the faucet. The game tips it towards the player to open the tap.
 */
function drawHandle(ctx: Ctx, colour: Rgb): void {
  const w = HANDLE.width;
  const h = HANDLE.height;
  const cx = w / 2;

  const outline = (): void => {
    ctx.beginPath();
    ctx.moveTo(cx - 2.5, h);
    ctx.lineTo(cx - 2.5, h - 12);
    ctx.bezierCurveTo(cx - 2.5, h - 19, cx - 4.5, h - 19, cx - 4.5, h - 26);
    ctx.lineTo(cx - 4.5, 6);
    ctx.quadraticCurveTo(cx - 4.5, 0.5, cx, 0.5);
    ctx.quadraticCurveTo(cx + 4.5, 0.5, cx + 4.5, 6);
    ctx.lineTo(cx + 4.5, h - 26);
    ctx.bezierCurveTo(cx + 4.5, h - 19, cx + 2.5, h - 19, cx + 2.5, h - 12);
    ctx.lineTo(cx + 2.5, h);
    ctx.closePath();
  };

  const lacquer = ctx.createLinearGradient(cx - 4.5, 0, cx + 4.5, 0);
  lacquer.addColorStop(0, css(scaleRgb(colour, 0.45)));
  lacquer.addColorStop(0.24, css(scaleRgb(colour, 1.7)));
  lacquer.addColorStop(0.6, css(colour));
  lacquer.addColorStop(1, css(scaleRgb(colour, 0.38)));
  ctx.fillStyle = lacquer;
  outline();
  ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.4)';
  ctx.lineWidth = 1;
  outline();
  ctx.stroke();

  // The gleam down the grip, and the shine on its rounded top.
  rect(ctx, 'rgba(255,255,255,0.5)', cx - 2, 5, 1, h - 26);
  rect(ctx, 'rgba(255,255,255,0.32)', cx - 2, 2, 3, 1);
  // The badge: cream, blank, with a shadow under it.
  rect(ctx, '#f0e8d4', cx - 3, 9, 6, 9);
  rect(ctx, 'rgba(255,255,255,0.6)', cx - 3, 9, 6, 1);
  rect(ctx, 'rgba(0,0,0,0.3)', cx - 3, 17, 6, 1);
  // The ferrule at the foot.
  chromeTube(ctx, cx - 3, h - 5, 6, 5);
  rect(ctx, 'rgba(0,0,0,0.4)', cx - 3, h - 5, 6, 1);
}

/** A draught faucet under the bar: its bonnet nut, collar, barrel, reducer and nozzle, all chrome. */
function drawFaucet(ctx: Ctx, x: number): void {
  // The bonnet nut, with a dark line under it, and the collar.
  chromeTube(ctx, x - 8, 55, 16, 3);
  rect(ctx, 'rgba(0,0,0,0.4)', x - 8, 58, 16, 1);
  chromeTube(ctx, x - 5, 59, 11, 2);
  // The barrel, with a seam round it and a shadow under it.
  chromeTube(ctx, x - 7, 61, 14, 6);
  rect(ctx, 'rgba(0,0,0,0.3)', x - 7, 64, 14, 1);
  rect(ctx, 'rgba(0,0,0,0.4)', x - 7, 67, 14, 1);
  // The reducer and the nozzle, with the dark of its mouth.
  chromeTube(ctx, x - 4, 68, 9, 2);
  chromeTube(ctx, x - 5, 70, 11, 2);
  rect(ctx, '#0b0d10', x - 3, 71, 7, 1);
}

/** The taps' fixed parts: a chrome bar on two brackets, and under it a faucet for each tap. */
function drawTaps(ctx: Ctx): void {
  // The brackets up into the ceiling, and the bar between them.
  chromeTube(ctx, 222, 0, 5, 46);
  chromeTube(ctx, 366, 0, 5, 46);
  const beam = ctx.createLinearGradient(0, 44, 0, 54);
  beam.addColorStop(0, '#6b737c');
  beam.addColorStop(0.28, '#fafcfd');
  beam.addColorStop(0.55, '#b9c2ca');
  beam.addColorStop(1, '#2f363d');
  ctx.fillStyle = beam;
  ctx.fillRect(214, 44, 164, 10);
  rect(ctx, 'rgba(0,0,0,0.3)', 214, 54, 164, 1);
  for (const tap of TAPS) drawFaucet(ctx, SPOUT.x + tap.dx);
}
function drawDripTray(ctx: Ctx): void {
  const tray = { x: GLASS.x - 98, y: GLASS.bottom + 2, w: 196, h: 14 };
  // A steel frame round a black grate with plain slots.
  const steel = ctx.createLinearGradient(0, tray.y, 0, tray.y + tray.h);
  steel.addColorStop(0, '#e0e6ea');
  steel.addColorStop(0.5, '#8f98a0');
  steel.addColorStop(1, '#3f464d');
  ctx.fillStyle = steel;
  ctx.fillRect(tray.x - 2, tray.y - 1, tray.w + 4, tray.h + 2);
  rect(ctx, '#101114', tray.x, tray.y + 1, tray.w, tray.h - 2);
  for (let y = tray.y + 3; y < tray.y + tray.h - 2; y += 3) {
    rect(ctx, '#23262b', tray.x + 2, y, tray.w - 4, 1);
  }
}

function drawBar(ctx: Ctx, tray = true): void {
  const rows = GAME_HEIGHT - BAR_BACK;
  const image = ctx.createImageData(GAME_WIDTH, rows);
  const dark = rgb('#3a1c0e');
  const light = rgb('#80492a');
  // The seams between the planks, which get farther apart as the bar comes towards us.
  const seams = new Set([10, 24, 42, 64]);
  for (let row = 0; row < rows; row += 1) {
    const t = row / rows;
    const base = mix(dark, light, Math.pow(t, 0.7));
    for (let x = 0; x < GAME_WIDTH; x += 1) {
      // The lamps shine in the polish: soft, wide pools of light under each.
      const pool = (centre: number): number => {
        const across = (x - centre) / 95;
        const down = (row - 16) / 24;
        return Math.exp(-(across * across + down * down));
      };
      const shine = Math.min(0.5, (pool(120) + pool(420)) * 0.42);
      let colour = mix(base, [255, 214, 150], shine);
      if (seams.has(row)) colour = scaleRgb(colour, 0.7);
      const at = (row * GAME_WIDTH + x) * 4;
      image.data[at] = colour[0];
      image.data[at + 1] = colour[1];
      image.data[at + 2] = colour[2];
      image.data[at + 3] = 255;
    }
  }
  ctx.putImageData(image, 0, BAR_BACK);

  // The brass rail along the back edge, with its bright line and its shadow on the wood.
  const brass = ctx.createLinearGradient(0, BAR_BACK - 1, 0, BAR_BACK + 4);
  brass.addColorStop(0, '#6a4e15');
  brass.addColorStop(0.35, '#f1cf62');
  brass.addColorStop(0.55, '#c39a2c');
  brass.addColorStop(1, '#4f3a0c');
  ctx.fillStyle = brass;
  ctx.fillRect(0, BAR_BACK - 1, GAME_WIDTH, 5);
  rect(ctx, 'rgba(255,248,200,0.7)', 0, BAR_BACK, GAME_WIDTH, 1);
  const under = ctx.createLinearGradient(0, BAR_BACK + 4, 0, BAR_BACK + 12);
  under.addColorStop(0, 'rgba(0,0,0,0.4)');
  under.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = under;
  ctx.fillRect(0, BAR_BACK + 4, GAME_WIDTH, 8);
  if (tray) drawDripTray(ctx);
}
function drawBackdrop(ctx: Ctx, variant: Variant = 'bar'): void {
  // The wall is a little out of focus, as a camera focused on the glass would have it.
  ctx.save();
  ctx.filter = 'blur(0.8px)';
  ctx.drawImage(drawWall(variant), 0, 0);
  ctx.restore();

  drawLamp(ctx, 120, 20);
  drawLamp(ctx, 420, 20);
  if (variant === 'bar') drawTaps(ctx);
  if (variant !== 'wall') drawBar(ctx, variant === 'bar');

  if (variant === 'wall') {
    // A lamp over the dartboard, which puts a pool of light on it and a shadow under it.
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const pool = ctx.createRadialGradient(BOARD.x, BOARD.y - 6, 20, BOARD.x, BOARD.y, 170);
    pool.addColorStop(0, 'rgba(255,226,170,0.34)');
    pool.addColorStop(1, 'rgba(255,200,130,0)');
    ctx.fillStyle = pool;
    ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
    ctx.restore();
  }

  // A warm grade over the whole of it.
  ctx.fillStyle = 'rgba(255,160,70,0.05)';
  ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
}
/* ------------------------------------------------------------------------------------------
 * The glass. It is made of three pictures that line up: the back of it, the drink, and the
 * front. The drink is cropped from the bottom to show how full it is, so it is all one picture
 * with nothing to draw again each frame but the head.
 * ---------------------------------------------------------------------------------------- */

/** The glass's picture is this much bigger than its inside, each side, and above and below. */
export const GLASS_ART = { wall: 3, above: 6, below: 8, width: 104 } as const;

const CENTRE = GLASS_ART.width / 2;
const INSIDE_BOTTOM = GLASS_ART.above + GLASS_HEIGHT;
/** Where the drink ends at the foot, in the glass picture: the line the crop is measured from. */
export const STOUT_BOTTOM = INSIDE_BOTTOM;

const insideWidth = (up: number): number =>
  glassWidthAt(up, GLASS_HEIGHT, GLASS.bottomInner, GLASS.topInner);

/** The inside edges of the glass at a row of its picture. */
function edgesAt(y: number): { left: number; right: number; width: number } {
  const width = insideWidth(INSIDE_BOTTOM - y - 0.5);
  return { left: Math.round(CENTRE - width / 2), right: Math.round(CENTRE + width / 2), width };
}

/** The inside of the glass as an outline (it tapers evenly), grown outwards by \grow\ pixels each side. */
function glassOutline(ctx: Ctx, grow = 0): void {
  const { above } = GLASS_ART;
  const top = GLASS.topInner / 2 + grow;
  const bottom = GLASS.bottomInner / 2 + grow;
  ctx.beginPath();
  ctx.moveTo(CENTRE - top, above);
  ctx.lineTo(CENTRE + top, above);
  ctx.lineTo(CENTRE + bottom, INSIDE_BOTTOM);
  ctx.lineTo(CENTRE - bottom, INSIDE_BOTTOM);
  ctx.closePath();
}

/** A line down one wall of the glass, \offset\ pixels outside (or, if less than 0, inside) its inside edge. */
function wallLine(ctx: Ctx, side: -1 | 1, offset: number, colour: string, width = 1): void {
  const { above } = GLASS_ART;
  ctx.strokeStyle = colour;
  ctx.lineWidth = width;
  ctx.beginPath();
  ctx.moveTo(CENTRE + side * (GLASS.topInner / 2 + offset), above);
  ctx.lineTo(CENTRE + side * (GLASS.bottomInner / 2 + offset), INSIDE_BOTTOM);
  ctx.stroke();
}

/** The part of the glass behind the drink: a faint tint on its far wall, and the far half of its rim. */
function drawGlassBack(ctx: Ctx): void {
  const { above, wall } = GLASS_ART;
  glassOutline(ctx);
  const tint = ctx.createLinearGradient(CENTRE - 42, 0, CENTRE + 42, 0);
  tint.addColorStop(0, 'rgba(196,222,236,0.13)');
  tint.addColorStop(0.5, 'rgba(176,204,220,0.05)');
  tint.addColorStop(1, 'rgba(196,222,236,0.1)');
  ctx.fillStyle = tint;
  ctx.fill();

  ctx.strokeStyle = 'rgba(214,236,248,0.4)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.ellipse(CENTRE, above, GLASS.topInner / 2 + wall, 3.2, 0, Math.PI, Math.PI * 2);
  ctx.stroke();
}

/**
 * The drink, full to the top of the glass. The edges are ruby where the light comes through the
 * thin of it, and it goes black in the middle. Tiny bubbles cling to the glass.
 */
function drawStout(ctx: Ctx, liquid: number): void {
  const { above } = GLASS_ART;
  const base = fromNumber(liquid);
  const ruby: Rgb = [140, 58, 26];
  const random = seeded(91);

  ctx.save();
  glassOutline(ctx);
  ctx.clip();
  for (let y = above; y < INSIDE_BOTTOM; y += 1) {
    const width = insideWidth(INSIDE_BOTTOM - y - 0.5);
    const left = CENTRE - width / 2;
    const row = ctx.createLinearGradient(left, 0, left + width, 0);
    row.addColorStop(0, css(mix(base, ruby, 0.55)));
    row.addColorStop(0.06, css(mix(base, ruby, 0.22)));
    row.addColorStop(0.24, css(scaleRgb(base, 0.8)));
    row.addColorStop(0.7, css(scaleRgb(base, 0.55)));
    row.addColorStop(0.94, css(mix(base, ruby, 0.2)));
    row.addColorStop(1, css(mix(base, ruby, 0.46)));
    ctx.fillStyle = row;
    ctx.fillRect(left - 1, y, width + 2, 1);

    // Light coming through the left side of the glass, and a little on the right.
    const fade = 1 - (y - above) / GLASS_HEIGHT;
    ctx.fillStyle = `rgba(160,72,32,${0.1 + 0.14 * fade})`;
    ctx.fillRect(left + 4, y, 2, 1);
    ctx.fillStyle = `rgba(120,54,24,${0.06 + 0.08 * fade})`;
    ctx.fillRect(left + width - 6, y, 1, 1);
  }
  // The thick glass at the foot makes the bottom of the drink darker.
  const foot = ctx.createLinearGradient(0, INSIDE_BOTTOM - 26, 0, INSIDE_BOTTOM);
  foot.addColorStop(0, 'rgba(0,0,0,0)');
  foot.addColorStop(1, 'rgba(0,0,0,0.55)');
  ctx.fillStyle = foot;
  ctx.fillRect(CENTRE - 40, INSIDE_BOTTOM - 26, 80, 26);

  // Bubbles on the glass: many by the walls, a few in the body.
  for (let bubble = 0; bubble < 110; bubble += 1) {
    const y = above + Math.floor(random() * GLASS_HEIGHT);
    const { left, right } = edgesAt(y);
    const near = random() < 0.82;
    const x = near
      ? random() < 0.5
        ? left + 1 + Math.floor(Math.pow(random(), 2) * 12)
        : right - 2 - Math.floor(Math.pow(random(), 2) * 12)
      : left + 8 + Math.floor(random() * (right - left - 16));
    ctx.fillStyle = `rgba(214,172,124,${near ? 0.14 + random() * 0.2 : 0.05 + random() * 0.08})`;
    ctx.fillRect(x, y, 1, 1);
  }
  ctx.restore();
}
/** The front of the glass: its thick walls, the light along them, the foot, the rim and the cold on it. */
function drawGlassFront(ctx: Ctx): void {
  const { wall, above } = GLASS_ART;
  const random = seeded(77);

  // Thick glass: bright at the outer face, clearer inside, with a thin dark edge so the glass
  // holds its shape against the bright wall. Drawn as lines, so the taper is smooth.
  wallLine(ctx, -1, 4, 'rgba(8,14,20,0.4)');
  wallLine(ctx, 1, 4, 'rgba(8,14,20,0.4)');
  wallLine(ctx, -1, 3, 'rgba(240,250,255,0.66)');
  wallLine(ctx, -1, 2, 'rgba(214,234,246,0.36)');
  wallLine(ctx, -1, 1, 'rgba(190,214,228,0.16)');
  wallLine(ctx, 1, 1, 'rgba(190,214,228,0.16)');
  wallLine(ctx, 1, 2, 'rgba(214,234,246,0.28)');
  wallLine(ctx, 1, 3, 'rgba(240,250,255,0.46)');
  // A long soft reflection down the inside of each wall.
  wallLine(ctx, -1, -3, 'rgba(255,255,255,0.2)', 2);
  wallLine(ctx, 1, -4.5, 'rgba(255,255,255,0.08)');
  // The lamps, reflected as bright lozenges on the left wall and a dimmer one on the right.
  for (let y = above + 16; y < above + 50; y += 1) {
    const { left, right } = edgesAt(y);
    const bright = 0.7 - Math.abs(y - (above + 33)) * 0.03;
    rect(ctx, `rgba(255,255,255,${bright})`, left + 1, y, 2, 1);
    if (y > above + 22 && y < above + 40) rect(ctx, 'rgba(255,244,222,0.3)', right - 3, y, 1, 1);
  }

  // The thick glass of the foot, a lens that catches the light.
  const footWidth = insideWidth(0);
  const x0 = Math.round(CENTRE - footWidth / 2) - wall - 2;
  const width = Math.round(footWidth) + wall * 2 + 4;
  const foot = ctx.createLinearGradient(0, INSIDE_BOTTOM, 0, INSIDE_BOTTOM + 6);
  foot.addColorStop(0, 'rgba(232,246,252,0.62)');
  foot.addColorStop(0.5, 'rgba(150,186,206,0.4)');
  foot.addColorStop(1, 'rgba(68,98,118,0.55)');
  ctx.fillStyle = foot;
  ctx.fillRect(x0, INSIDE_BOTTOM, width, 6);
  rect(ctx, 'rgba(255,255,255,0.75)', x0, INSIDE_BOTTOM, width, 1);
  rect(ctx, 'rgba(34,54,70,0.6)', x0, INSIDE_BOTTOM + 5, width, 1);
  rect(ctx, 'rgba(255,255,255,0.28)', x0 + 8, INSIDE_BOTTOM + 2, 14, 1);

  // The rim: the near half of the lip, bright, with the inner edge of it a little less so.
  ctx.lineWidth = 1.2;
  ctx.strokeStyle = 'rgba(238,250,255,0.88)';
  ctx.beginPath();
  ctx.ellipse(CENTRE, above, GLASS.topInner / 2 + wall, 3.2, 0, 0, Math.PI);
  ctx.stroke();
  ctx.lineWidth = 1;
  ctx.strokeStyle = 'rgba(214,236,248,0.4)';
  ctx.beginPath();
  ctx.ellipse(CENTRE, above, GLASS.topInner / 2 - 0.5, 2.5, 0, 0, Math.PI);
  ctx.stroke();

  // Drops of condensation clinging to the glass.
  for (let drop = 0; drop < 10; drop += 1) {
    const y = above + 34 + Math.floor(random() * (GLASS_HEIGHT - 48));
    const { left, right } = edgesAt(y);
    const x = left + 4 + Math.floor(random() * (right - left - 8));
    rect(ctx, 'rgba(210,232,248,0.18)', x, y, 1, 2);
    rect(ctx, 'rgba(255,255,255,0.55)', x, y, 1, 1);
  }
}

/** The soft shadow the glass throws on the bar, and the dark of it under the glass. */
function drawShadow(ctx: Ctx): void {
  ctx.save();
  ctx.translate(70, 14);
  ctx.scale(1, 0.2);
  const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, 66);
  gradient.addColorStop(0, 'rgba(0,0,0,0.62)');
  gradient.addColorStop(0.6, 'rgba(0,0,0,0.28)');
  gradient.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = gradient;
  ctx.fillRect(-70, -70, 140, 140);
  ctx.restore();
}

function drawVignette(ctx: Ctx): void {
  const gradient = ctx.createRadialGradient(240, 130, 90, 240, 135, 320);
  gradient.addColorStop(0, 'rgba(8,4,2,0)');
  gradient.addColorStop(1, 'rgba(8,4,2,0.62)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
}

/**
 * Draws every picture once, before the first scene that wants one. `drink` is the colour of the
 * liquid (the stout's body is drawn from it).
 */
export function createTextures(scene: Phaser.Scene, drink: { liquid: number }): void {
  const glassHeight = GLASS_ART.above + GLASS_HEIGHT + GLASS_ART.below;
  createTexture(scene, TextureKey.Backdrop, GAME_WIDTH, GAME_HEIGHT, (ctx) =>
    drawBackdrop(ctx, 'bar'),
  );
  createTexture(scene, TextureKey.BackdropRoom, GAME_WIDTH, GAME_HEIGHT, (ctx) =>
    drawBackdrop(ctx, 'room'),
  );
  createTexture(scene, TextureKey.BackdropWall, GAME_WIDTH, GAME_HEIGHT, (ctx) =>
    drawBackdrop(ctx, 'wall'),
  );
  TAPS.forEach((tap, index) =>
    createTexture(scene, handleKey(index), HANDLE.width, HANDLE.height, (ctx) =>
      drawHandle(ctx, fromNumber(tap.colour)),
    ),
  );
  createTexture(scene, TextureKey.GlassBack, GLASS_ART.width, glassHeight, drawGlassBack);
  createTexture(scene, TextureKey.Stout, GLASS_ART.width, glassHeight, (ctx) =>
    drawStout(ctx, drink.liquid),
  );
  createTexture(scene, TextureKey.Glass, GLASS_ART.width, glassHeight, drawGlassFront);
  createTexture(scene, TextureKey.Shadow, 140, 28, drawShadow);
  createTexture(scene, TextureKey.Vignette, GAME_WIDTH, GAME_HEIGHT, drawVignette);
}
