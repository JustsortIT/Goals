/**
 * The pictures, drawn in code once when the game loads: a Gaelic football ground in Ireland
 * seen from the kick, and the ball and the bonus target. The goal itself is drawn by
 * `goalArt.ts`, since it moves. There is no lettering in any of it.
 *
 * The ground: a soft sky with cloud, hills in the haze with fields, trees, farmhouses and a
 * church, floodlights, a stand with a crowd under its roof, advertising boards (blank) with
 * stewards in front, and a mown pitch with grain. Everything is drawn from seeded random
 * numbers, so the picture is the same every time.
 */
import type Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH } from '../../shell/constants';
import { BALL, ROOF_FLAG_TOP, ROOF_FLAGS, TextureKey } from './config';

type Draw = (context: CanvasRenderingContext2D) => void;
type Rgb = [number, number, number];

function createTexture(
  scene: Phaser.Scene,
  key: string,
  width: number,
  height: number,
  draw: Draw,
): CanvasTextureLike | null {
  if (scene.textures.exists(key)) return null;
  const texture = scene.textures.createCanvas(key, width, height);
  if (!texture) throw new Error(`Could not create texture "${key}".`);
  draw(texture.getContext());
  texture.refresh();
  return texture;
}

/** The part of a canvas texture this file uses: adding frames to it. */
interface CanvasTextureLike {
  add(name: string, source: number, x: number, y: number, width: number, height: number): unknown;
}

/* ------------------------------------------------------------------------------------------
 * Small tools: colour, a seeded random, and smooth noise.
 * ---------------------------------------------------------------------------------------- */

const rgb = (hex: string): Rgb => [
  parseInt(hex.slice(1, 3), 16),
  parseInt(hex.slice(3, 5), 16),
  parseInt(hex.slice(5, 7), 16),
];
const css = ([r, g, b]: Rgb, alpha = 1): string =>
  `rgba(${Math.round(r)},${Math.round(g)},${Math.round(b)},${alpha})`;
const mix = (a: Rgb, b: Rgb, t: number): Rgb => [
  a[0] + (b[0] - a[0]) * t,
  a[1] + (b[1] - a[1]) * t,
  a[2] + (b[2] - a[2]) * t,
];
const scaleRgb = (a: Rgb, k: number): Rgb => [a[0] * k, a[1] * k, a[2] * k];
const clamp = (x: number, low = 0, high = 1): number => Math.min(high, Math.max(low, x));
const smooth = (low: number, high: number, x: number): number => {
  const t = clamp((x - low) / (high - low));
  return t * t * (3 - 2 * t);
};

const rect = (
  context: CanvasRenderingContext2D,
  colour: string,
  x: number,
  y: number,
  w: number,
  h: number,
): void => {
  context.fillStyle = colour;
  context.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
};

/** The same numbers every time: a small seeded random. */
function seeded(seed: number): () => number {
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

function valueNoise(x: number, y: number, seed: number): number {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const fx = x - ix;
  const fy = y - iy;
  const sx = fx * fx * (3 - 2 * fx);
  const sy = fy * fy * (3 - 2 * fy);
  const top = lattice(ix, iy, seed) * (1 - sx) + lattice(ix + 1, iy, seed) * sx;
  const bottom = lattice(ix, iy + 1, seed) * (1 - sx) + lattice(ix + 1, iy + 1, seed) * sx;
  return top * (1 - sy) + bottom * sy;
}

/** Layers of noise, from broad to fine: what clouds and hills are made of. */
function fbm(x: number, y: number, seed: number, octaves = 4): number {
  let sum = 0;
  let amplitude = 0.5;
  let frequency = 1;
  for (let octave = 0; octave < octaves; octave += 1) {
    sum += valueNoise(x * frequency, y * frequency, seed + octave * 17) * amplitude;
    amplitude /= 2;
    frequency *= 2;
  }
  return sum;
}

/** Where the pitch begins: the sky, hills and stand are above it. */
const HORIZON = 109;

/* ------------------------------------------------------------------------------------------
 * The sky and the land behind the ground.
 * ---------------------------------------------------------------------------------------- */

function drawSky(context: CanvasRenderingContext2D): void {
  const top = rgb('#4a82bd');
  const middle = rgb('#8dbbe2');
  const low = rgb('#dce9ee');
  const cloudLight = rgb('#fdfeff');
  const cloudShade = rgb('#a9bccf');
  const image = context.createImageData(GAME_WIDTH, HORIZON + 1);

  for (let y = 0; y <= HORIZON; y += 1) {
    const t = y / HORIZON;
    const sky = t < 0.6 ? mix(top, middle, t / 0.6) : mix(middle, low, (t - 0.6) / 0.4);
    for (let x = 0; x < GAME_WIDTH; x += 1) {
      const density = fbm(x / 80 + 3.1, y / 26 + 1.7, 5);
      const cover = smooth(0.5, 0.7, density) * (0.4 + 0.6 * (1 - t * 0.6));
      let colour = sky;
      if (cover > 0.01) {
        // Lit on top, grey underneath: look a little way down to see which side of an edge it is.
        const below = fbm(x / 80 + 3.1, (y + 5) / 26 + 1.7, 5);
        const lit = clamp(0.64 + (below - density) * 5, 0.3, 1);
        colour = mix(sky, mix(cloudShade, cloudLight, lit), cover * 0.96);
      }
      const at = (y * GAME_WIDTH + x) * 4;
      image.data[at] = colour[0];
      image.data[at + 1] = colour[1];
      image.data[at + 2] = colour[2];
      image.data[at + 3] = 255;
    }
  }
  context.putImageData(image, 0, 0);

  // The sun behind the cloud, upper right: a warm wash that puts light on everything below.
  const sun = context.createRadialGradient(385, 44, 4, 385, 44, 150);
  sun.addColorStop(0, 'rgba(255,246,214,0.55)');
  sun.addColorStop(0.4, 'rgba(255,238,200,0.18)');
  sun.addColorStop(1, 'rgba(255,238,200,0)');
  context.fillStyle = sun;
  context.fillRect(0, 0, GAME_WIDTH, HORIZON + 1);
}

/** The height of a ridge at a column: noise with a base and a size. */
const ridge = (x: number, seed: number, base: number, size: number, scale: number): number =>
  base - size * fbm(x / scale, 0.5, seed, 4);

function tree(context: CanvasRenderingContext2D, x: number, base: number, size: number): void {
  const dark = '#27502f';
  const mid = '#376b3d';
  const light = '#4f8a4d';
  for (let row = 0; row < size * 2; row += 1) {
    const span = Math.round(Math.sin(((row + 0.5) / (size * 2)) * Math.PI) * size);
    rect(context, row < size * 0.8 ? mid : dark, x - span, base - size * 2 + row, span * 2 + 1, 1);
  }
  rect(context, light, x - Math.round(size * 0.5), base - size * 2 + 1, Math.max(1, size - 1), 1);
  rect(context, '#3a2a1c', x, base, 1, 1);
}

function drawLand(context: CanvasRenderingContext2D): void {
  const random = seeded(31);

  // Far mountains, blue in the haze.
  for (let x = 0; x < GAME_WIDTH; x += 1) {
    const top = ridge(x, 11, HORIZON - 30, 46, 120);
    const height = HORIZON - top;
    const gradient = context.createLinearGradient(0, top, 0, HORIZON);
    gradient.addColorStop(0, '#8aa3ba');
    gradient.addColorStop(1, '#b4c8d4');
    context.fillStyle = gradient;
    context.fillRect(x, Math.round(top), 1, Math.ceil(height) + 1);
  }

  // Rounder green hills in front, with the fields of the farms on them.
  const fields = ['#648c62', '#72975f', '#5d8660', '#7d9c64', '#69915e', '#85a36b'].map(rgb);
  for (let x = 0; x < GAME_WIDTH; x += 1) {
    const top = Math.round(ridge(x, 23, HORIZON - 6, 50, 90));
    for (let y = top; y < HORIZON; y += 3) {
      const cell = lattice(Math.floor((x + y * 1.9) / 21), Math.floor(y / 6), 3);
      const haze = (1 - clamp((y - top) / 30)) * 0.12;
      const colour = mix(fields[Math.floor(cell * fields.length)], rgb('#b4c8d4'), haze);
      context.fillStyle = css(colour);
      context.fillRect(x, y, 1, Math.min(3, HORIZON - y));
    }
    // A hedge between two fields now and then.
    if (lattice(Math.floor(x / 21), 9, 4) < 0.35 && x % 21 === 0) {
      rect(context, '#3c6a3f', x, top + 4, 1, HORIZON - top - 4);
    }
  }

  // Trees along the near ridge, and farmhouses with a church.
  for (let x = 4; x < GAME_WIDTH; x += 5 + Math.floor(random() * 6)) {
    const top = Math.round(ridge(x, 23, HORIZON - 6, 50, 90));
    tree(context, x, top + 3 + Math.floor(random() * 5), 2 + Math.floor(random() * 3));
  }
  const houses = [96, 142, 208, 322, 350, 452];
  for (const x of houses) {
    const top = Math.round(ridge(x, 23, HORIZON - 6, 50, 90)) + 9;
    rect(context, '#ecefe9', x, top, 6, 4);
    rect(context, '#4a4f58', x - 1, top - 2, 8, 2);
    rect(context, '#b8bcb6', x + 1, top + 1, 1, 2);
  }
  const churchX = 404;
  const churchTop = Math.round(ridge(churchX, 23, HORIZON - 6, 50, 90)) + 8;
  rect(context, '#e4e6e1', churchX, churchTop - 8, 5, 12);
  rect(context, '#4a4f58', churchX - 1, churchTop - 10, 7, 2);
  rect(context, '#4a4f58', churchX + 1, churchTop - 14, 3, 4);
  rect(context, '#4a4f58', churchX + 2, churchTop - 17, 1, 3);
  rect(context, '#9aa19d', churchX + 2, churchTop - 5, 1, 3);
}

function drawFloodlight(context: CanvasRenderingContext2D, x: number): void {
  const steel = '#7f8993';
  const dark = '#4f5862';
  // Two legs with cross bracing.
  rect(context, steel, x, 24, 1, HORIZON - 22);
  rect(context, steel, x + 5, 24, 1, HORIZON - 22);
  for (let y = 30; y < HORIZON - 4; y += 9) {
    for (let step = 0; step < 6; step += 1) rect(context, dark, x + step, y + step, 1, 1);
    for (let step = 0; step < 6; step += 1) rect(context, dark, x + 5 - step, y + 4 + step, 1, 1);
  }
  rect(context, '#9aa4ae', x - 8, 20, 22, 5);
  rect(context, '#5a636d', x - 8, 24, 22, 2);
  for (let lamp = 0; lamp < 5; lamp += 1) {
    rect(context, '#fffbe0', x - 7 + lamp * 4, 21, 3, 2);
  }
  const glow = context.createRadialGradient(x + 3, 22, 1, x + 3, 22, 28);
  glow.addColorStop(0, 'rgba(255,252,225,0.5)');
  glow.addColorStop(1, 'rgba(255,252,225,0)');
  context.fillStyle = glow;
  context.fillRect(x - 28, -6, 62, 56);
}

/* ------------------------------------------------------------------------------------------
 * The stand and its crowd.
 * ---------------------------------------------------------------------------------------- */

const SKIN = ['#f2cba8', '#e2ae88', '#c78a64', '#8e5b3d'].map(rgb);
const HAIR = ['#2b1d14', '#5a3a22', '#c9a24a', '#8d8d8d', '#d9d9d9', '#7a2e12'].map(rgb);
const JERSEY = [
  '#1f8a4c',
  '#f2b920',
  '#c7282e',
  '#ffffff',
  '#1f5fb4',
  '#7a1f3d',
  '#f28c28',
  '#2a2f38',
  '#e9eef1',
  '#3aa0c8',
].map(rgb);

/** One person, from behind a rail: hair, face and a jersey, lit from above. */
function person(
  context: CanvasRenderingContext2D,
  random: () => number,
  x: number,
  y: number,
  dim: number,
): void {
  const jersey = JERSEY[Math.floor(random() * JERSEY.length)];
  const skin = SKIN[Math.floor(random() * SKIN.length)];
  const hair = HAIR[Math.floor(random() * HAIR.length)];
  rect(context, css(scaleRgb(hair, dim)), x + 1, y, 2, 1);
  rect(context, css(scaleRgb(skin, dim)), x + 1, y + 1, 2, 1);
  rect(context, css(scaleRgb(jersey, dim)), x, y + 2, 4, 2);
  rect(context, css(scaleRgb(jersey, dim * 0.72)), x, y + 4, 4, 1);
  // An arm up, now and then: someone is cheering.
  if (random() < 0.06) rect(context, css(scaleRgb(skin, dim)), x + 3, y - 1, 1, 3);
}

function crowdTier(
  context: CanvasRenderingContext2D,
  random: () => number,
  from: number,
  to: number,
  y: number,
  fill: number,
  dim: number,
): void {
  rect(context, '#262b33', from, y + 2, to - from, 7);
  rect(context, '#3c434d', from, y + 2, to - from, 1);
  for (let x = from + 1; x < to - 4; x += 5) {
    if (random() > fill) continue;
    person(context, random, x + Math.floor(random() * 2), y + Math.floor(random() * 2), dim);
  }
  rect(context, '#12151a', from, y + 8, to - from, 1);
}

function drawStand(context: CanvasRenderingContext2D): void {
  const random = seeded(7);
  const left = 58;
  const right = 422;
  const roofTop = 58;

  // The back wall, then the crowd from the top tier down, so a lower row covers the one above.
  rect(context, '#20242b', left, roofTop + 6, right - left, 42);
  for (let tier = 0; tier < 4; tier += 1) {
    crowdTier(context, random, left, right, 69 + tier * 9, 0.9, 1 - tier * 0.03);
  }
  // The terraces at each end, lower and stepped, with fewer people standing.
  for (const [from, to] of [
    [0, left],
    [right, GAME_WIDTH],
  ] as const) {
    rect(context, '#20242b', from, 88, to - from, 20);
    for (let tier = 0; tier < 3; tier += 1) {
      crowdTier(context, random, from, to, 87 + tier * 7, 0.72, 0.95);
    }
  }

  // The roof throws a shadow over the top rows.
  const shade = context.createLinearGradient(0, roofTop + 6, 0, roofTop + 40);
  shade.addColorStop(0, 'rgba(8,10,14,0.62)');
  shade.addColorStop(1, 'rgba(8,10,14,0)');
  context.fillStyle = shade;
  context.fillRect(left, roofTop + 6, right - left, 36);

  // The roof: a bright edge, the steel front, and the supports under it.
  rect(context, '#aeb7c1', left - 4, roofTop - 2, right - left + 8, 2);
  rect(context, '#6c7681', left - 4, roofTop, right - left + 8, 3);
  rect(context, '#454d57', left - 4, roofTop + 3, right - left + 8, 3);
  rect(context, '#2a3037', left - 4, roofTop + 6, right - left + 8, 1);
  for (let x = left + 12; x < right - 6; x += 44) {
    rect(context, '#171a1f', x, roofTop + 6, 3, 38);
    rect(context, '#454d57', x, roofTop + 6, 1, 38);
  }

  // The poles for the roof flags; the flags themselves move with the wind (`flags.ts`).
  for (const flag of ROOF_FLAGS) {
    rect(context, '#d5dbe0', flag.x, ROOF_FLAG_TOP, 1, 22);
  }
}

/** Blank advertising boards along the foot of the stand, with stewards in front of them. */
function drawBoards(context: CanvasRenderingContext2D): void {
  const random = seeded(13);
  const colours = ['#1d5a34', '#c79a2b', '#a3262b', '#1f4f93', '#e4e9ec', '#2b2f36'].map(rgb);
  const top = HORIZON - 6;
  for (let x = 0, index = 0; x < GAME_WIDTH; x += 30, index += 1) {
    const colour = colours[(index * 5) % colours.length];
    rect(context, css(colour), x, top, 29, 6);
    rect(context, css(mix(colour, [255, 255, 255], 0.28)), x, top, 29, 1);
    rect(context, css(scaleRgb(colour, 0.7)), x, top + 5, 29, 1);
    rect(context, '#0d1014', x + 29, top, 1, 6);
  }
  rect(context, '#0d1014', 0, top - 1, GAME_WIDTH, 1);

  for (let x = 24; x < GAME_WIDTH - 10; x += 34 + Math.floor(random() * 20)) {
    rect(context, '#2a2f38', x, HORIZON + 1, 1, 3);
    rect(context, '#2a2f38', x + 2, HORIZON + 1, 1, 3);
    rect(context, '#e6d93a', x, HORIZON - 3, 3, 4);
    rect(context, '#b3a722', x, HORIZON, 3, 1);
    rect(context, '#e2ae88', x, HORIZON - 5, 3, 2);
  }
}

/* ------------------------------------------------------------------------------------------
 * The pitch.
 * ---------------------------------------------------------------------------------------- */

function drawPitch(context: CanvasRenderingContext2D): void {
  const far = rgb('#2d6a34');
  const near = rgb('#4f9d41');
  const haze = rgb('#9bb89c');
  const rows = GAME_HEIGHT - HORIZON;
  const image = context.createImageData(GAME_WIDTH, rows);

  // Mown stripes: nearer bands are taller, which is what makes the ground go back.
  const band: number[] = [];
  let y = 0;
  let height = 5;
  for (let index = 0; y < rows; index += 1) {
    for (let row = 0; row < Math.ceil(height) && y + row < rows; row += 1) band[y + row] = index;
    y += Math.ceil(height);
    height *= 1.22;
  }

  for (let row = 0; row < rows; row += 1) {
    const t = row / rows;
    const base = mix(far, near, Math.pow(t, 0.75));
    const stripe = band[row] % 2 === 0 ? 1.06 : 0.95;
    const fog = Math.pow(1 - t, 3) * 0.42;
    for (let x = 0; x < GAME_WIDTH; x += 1) {
      const grain = (lattice(x, row, 2) - 0.5) * (0.04 + 0.12 * t);
      // Long, soft patches of light across the stripes, as a roller leaves.
      const sheen = (fbm(x / 120, row / 14, 9, 3) - 0.5) * 0.16;
      const colour = mix(scaleRgb(base, stripe * (1 + grain + sheen)), haze, fog);
      const at = (row * GAME_WIDTH + x) * 4;
      image.data[at] = colour[0];
      image.data[at + 1] = colour[1];
      image.data[at + 2] = colour[2];
      image.data[at + 3] = 255;
    }
  }
  context.putImageData(image, 0, HORIZON);

  // Blades of grass in the foreground, standing up in the light.
  const random = seeded(3);
  for (let blade = 0; blade < 1800; blade += 1) {
    const t = Math.pow(random(), 0.55);
    const by = HORIZON + 16 + t * (rows - 18);
    const bx = random() * GAME_WIDTH;
    const light = random() < 0.5;
    context.fillStyle = light ? 'rgba(168,214,120,0.32)' : 'rgba(18,56,24,0.3)';
    context.fillRect(Math.round(bx), Math.round(by), 1, 1 + Math.round(t * 2.2));
  }

  rect(context, '#1f4b25', 0, HORIZON, GAME_WIDTH, 1);
}

function drawBackdrop(context: CanvasRenderingContext2D): void {
  drawSky(context);
  drawLand(context);
  drawFloodlight(context, 26);
  drawFloodlight(context, 448);
  drawStand(context);
  drawPitch(context);
  drawBoards(context);

  // A little haze where the ground meets the sky.
  const haze = context.createLinearGradient(0, 60, 0, HORIZON + 14);
  haze.addColorStop(0, 'rgba(222,234,238,0)');
  haze.addColorStop(1, 'rgba(222,234,238,0.2)');
  context.fillStyle = haze;
  context.fillRect(0, 60, GAME_WIDTH, HORIZON - 46);
}

/* ------------------------------------------------------------------------------------------
 * The ball, the bonus target, and the light that goes with them.
 * ---------------------------------------------------------------------------------------- */

const LIGHT = (() => {
  const length = Math.hypot(-0.5, -0.62, 0.6);
  return [-0.5 / length, -0.62 / length, 0.6 / length] as const;
})();

/** The seams of the ball are great circles, found by these directions. */
const SEAMS = [
  [1, 0, 0],
  [0, 1, 0],
  [0, 0, 1],
  [0.577, 0.577, 0.577],
  [0.577, -0.577, 0.577],
] as const;

/** One picture of the ball turned over by `angle`, drawn into a strip at `offset`. */
function drawBallFrame(
  context: CanvasRenderingContext2D,
  offset: number,
  size: number,
  angle: number,
): void {
  const radius = size / 2;
  const image = context.createImageData(size, size);
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const white = rgb('#f8f6ee');
  const cream = rgb('#e6e2d2');
  const seam = rgb('#98a0a8');

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const nx = (x + 0.5 - radius) / radius;
      const ny = (y + 0.5 - radius) / radius;
      const edge = nx * nx + ny * ny;
      if (edge > 1) continue;
      const nz = Math.sqrt(1 - edge);

      // Where this spot is on the ball, which has tumbled forward by `angle`.
      const tumbledY = ny * cos - nz * sin;
      const tumbledZ = ny * sin + nz * cos;
      // Turned a fixed way as well, so the seams do not line up with the screen.
      const px = nx * 0.825 - tumbledY * 0.565;
      const py = nx * 0.497 + tumbledY * 0.726 - tumbledZ * 0.48;
      const pz = nx * 0.271 + tumbledY * 0.396 + tumbledZ * 0.88;
      const dots = SEAMS.map((axis) => px * axis[0] + py * axis[1] + pz * axis[2]);
      const onSeam = dots.some((dot) => Math.abs(dot) < 0.06);
      const panel = Math.sign(dots[0]) * Math.sign(dots[1]) * Math.sign(dots[2]) > 0;

      const lambert = Math.max(0, nx * LIGHT[0] + ny * LIGHT[1] + nz * LIGHT[2]);
      const bright = 0.72 + 0.38 * lambert;
      let colour = scaleRgb(onSeam ? seam : panel ? white : cream, bright);
      colour = mix(colour, [255, 255, 255], Math.pow(lambert, 24) * 0.55);
      if (Math.sqrt(edge) > 1 - 1.15 / radius) colour = mix(colour, [38, 44, 52], 0.7);

      const at = (y * size + x) * 4;
      image.data[at] = colour[0];
      image.data[at + 1] = colour[1];
      image.data[at + 2] = colour[2];
      image.data[at + 3] = 255;
    }
  }
  context.putImageData(image, offset, 0);
}

/** The bonus target: a golden disc with a star struck on it, lit from the top left. */
function drawBonus(context: CanvasRenderingContext2D): void {
  const size = 32;
  const radius = size / 2;
  const image = context.createImageData(size, size);
  const gold = rgb('#ffc933');
  const deep = rgb('#b87400');
  const pale = rgb('#fff3b0');

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const dx = (x + 0.5 - radius) / radius;
      const dy = (y + 0.5 - radius) / radius;
      const distance = Math.hypot(dx, dy);
      if (distance > 1) continue;
      const nz = Math.sqrt(1 - distance * distance);
      const lambert = Math.max(0, dx * LIGHT[0] + dy * LIGHT[1] + nz * LIGHT[2]);

      // The star: the edge of it is a sawtooth in the angle round the middle.
      const turn = (Math.atan2(dy, dx) + Math.PI / 2 + Math.PI * 2) % ((Math.PI * 2) / 5);
      const half = Math.PI / 5;
      const starEdge = 0.66 + (0.3 - 0.66) * (Math.min(turn, 2 * half - turn) / half);
      const inStar = distance <= starEdge;
      const onRing = Math.abs(distance - 0.82) < 0.05;

      let colour = mix(deep, gold, 0.35 + 0.65 * lambert);
      if (inStar) colour = mix(gold, pale, 0.45 + 0.55 * lambert);
      if (onRing) colour = scaleRgb(deep, 0.85);
      colour = mix(colour, [255, 255, 255], Math.pow(lambert, 18) * 0.6);
      if (distance > 1 - 1.2 / radius) colour = mix(colour, [88, 48, 0], 0.8);

      const at = (y * size + x) * 4;
      image.data[at] = colour[0];
      image.data[at + 1] = colour[1];
      image.data[at + 2] = colour[2];
      image.data[at + 3] = 255;
    }
  }
  context.putImageData(image, 0, 0);
}

function drawGlow(context: CanvasRenderingContext2D): void {
  const gradient = context.createRadialGradient(32, 32, 0, 32, 32, 32);
  gradient.addColorStop(0, 'rgba(255,236,150,0.95)');
  gradient.addColorStop(0.35, 'rgba(255,214,90,0.4)');
  gradient.addColorStop(1, 'rgba(255,200,60,0)');
  context.fillStyle = gradient;
  context.fillRect(0, 0, 64, 64);
}

/** Darkens the corners and the foot of the picture, as a lens does. */
function drawVignette(context: CanvasRenderingContext2D): void {
  const gradient = context.createRadialGradient(240, 120, 100, 240, 135, 320);
  gradient.addColorStop(0, 'rgba(6,12,10,0)');
  gradient.addColorStop(1, 'rgba(6,12,10,0.55)');
  context.fillStyle = gradient;
  context.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
  const foot = context.createLinearGradient(0, GAME_HEIGHT - 70, 0, GAME_HEIGHT);
  foot.addColorStop(0, 'rgba(6,12,10,0)');
  foot.addColorStop(1, 'rgba(6,12,10,0.28)');
  context.fillStyle = foot;
  context.fillRect(0, GAME_HEIGHT - 70, GAME_WIDTH, 70);
}

/** Draws every picture once, before the first scene that wants one. */
export function createTextures(scene: Phaser.Scene): void {
  createTexture(scene, TextureKey.Backdrop, GAME_WIDTH, GAME_HEIGHT, drawBackdrop);
  const ball = createTexture(
    scene,
    TextureKey.Ball,
    BALL.size * BALL.frames,
    BALL.size,
    (context) => {
      for (let frame = 0; frame < BALL.frames; frame += 1) {
        drawBallFrame(context, frame * BALL.size, BALL.size, (frame / BALL.frames) * Math.PI * 2);
      }
    },
  );
  // The strip is cut into frames, named 0, 1, 2 ...: one picture of the ball for each.
  for (let frame = 0; ball && frame < BALL.frames; frame += 1) {
    ball.add(String(frame), 0, frame * BALL.size, 0, BALL.size, BALL.size);
  }
  createTexture(scene, TextureKey.Bonus, 32, 32, drawBonus);
  createTexture(scene, TextureKey.Glow, 64, 64, drawGlow);
  createTexture(scene, TextureKey.Vignette, GAME_WIDTH, GAME_HEIGHT, drawVignette);
}
