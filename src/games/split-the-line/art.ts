/**
 * The pictures, drawn in code once when the game loads: the inside of a pub seen from the bar (a
 * brick wall with shelves of bottles, pendant lamps with a warm glow, a row of taps, a polished
 * bar with a drip mat), the pint glass, and a vignette. Everything is drawn from seeded random
 * numbers, so the picture is the same every time. There is no lettering in any of it: the bottle
 * labels and the tap handles are blank.
 */
import type Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH } from '../../shell/constants';
import { GLASS, GLASS_HEIGHT, SPOUT, TextureKey } from './config';
import { glassWidthAt } from './logic';

type Draw = (context: CanvasRenderingContext2D) => void;
type Rgb = [number, number, number];

function createTexture(
  scene: Phaser.Scene,
  key: string,
  width: number,
  height: number,
  draw: Draw,
): void {
  if (scene.textures.exists(key)) return;
  const texture = scene.textures.createCanvas(key, width, height);
  if (!texture) throw new Error(`Could not create texture "${key}".`);
  draw(texture.getContext());
  texture.refresh();
}

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

/** Where the wall ends and the bar's top begins. */
const BAR_BACK = 196;

/* ------------------------------------------------------------------------------------------
 * The wall, the shelves and the lamps.
 * ---------------------------------------------------------------------------------------- */

function drawWall(context: CanvasRenderingContext2D): void {
  const tones = ['#6b3226', '#5e2a20', '#74392b', '#582720', '#683024', '#7b4030'].map(rgb);
  const mortar = '#2a1914';
  rect(context, mortar, 0, 0, GAME_WIDTH, BAR_BACK);
  const brickW = 16;
  const brickH = 7;
  for (let row = 0, y = 0; y < BAR_BACK; row += 1, y += brickH) {
    const offset = row % 2 === 0 ? 0 : brickW / 2;
    for (let x = -offset, column = 0; x < GAME_WIDTH; x += brickW, column += 1) {
      const tone = tones[Math.floor(lattice(column, row, 4) * tones.length)];
      const light = 0.92 + lattice(column, row, 9) * 0.16;
      rect(context, css(scaleRgb(tone, light)), x + 1, y + 1, brickW - 1, brickH - 1);
      // The top edge of each brick catches the light.
      rect(context, css(mix(tone, [255, 220, 190], 0.14)), x + 1, y + 1, brickW - 1, 1);
    }
  }
  // Wood panelling on the lower wall, above the bar.
  rect(context, '#2e1c13', 0, 150, GAME_WIDTH, BAR_BACK - 150);
  for (let x = 0; x < GAME_WIDTH; x += 12) {
    rect(context, '#3e271a', x + 1, 152, 10, BAR_BACK - 154);
    rect(context, '#523620', x + 1, 152, 1, BAR_BACK - 154);
    rect(context, '#20130d', x + 11, 150, 1, BAR_BACK - 150);
  }
  rect(context, '#6a4528', 0, 148, GAME_WIDTH, 3);
  rect(context, '#27160e', 0, 151, GAME_WIDTH, 1);
}

function bottle(
  context: CanvasRenderingContext2D,
  x: number,
  base: number,
  height: number,
  width: number,
  colour: Rgb,
): void {
  const neck = Math.max(2, Math.round(width / 3));
  const shoulder = base - Math.round(height * 0.6);
  rect(context, css(scaleRgb(colour, 0.55)), x - 1, base - height + 4, width + 2, 1);
  rect(context, css(colour), x, shoulder, width, base - shoulder);
  rect(
    context,
    css(colour),
    x + Math.floor((width - neck) / 2),
    base - height + 2,
    neck,
    shoulder - (base - height + 2),
  );
  rect(
    context,
    css(scaleRgb(colour, 0.6)),
    x + Math.floor((width - neck) / 2),
    base - height,
    neck,
    3,
  );
  // A blank label, and the light down one side.
  rect(
    context,
    '#d8cfb8',
    x,
    base - Math.round(height * 0.36),
    width,
    Math.max(3, Math.round(height * 0.2)),
  );
  rect(
    context,
    css(mix(colour, [255, 255, 255], 0.35)),
    x + 1,
    shoulder + 1,
    1,
    base - shoulder - 2,
  );
  rect(context, css(scaleRgb(colour, 0.6)), x + width - 1, shoulder, 1, base - shoulder);
}

function drawShelves(context: CanvasRenderingContext2D): void {
  const random = seeded(21);
  const glassColours = [
    '#2f6b3a',
    '#9a5b1d',
    '#aeb9c0',
    '#2a2220',
    '#2a4f8a',
    '#7a1f3d',
    '#c28a2c',
  ].map(rgb);
  for (const [from, to] of [
    [14, 206],
    [384, 466],
  ] as const) {
    for (const shelfY of [76, 118]) {
      // The shelf's shadow on the wall, then the plank.
      rect(context, 'rgba(0,0,0,0.32)', from, shelfY - 28, to - from, 28);
      for (let x = from + 3; x < to - 10; x += 9 + Math.floor(random() * 6)) {
        const height = 16 + Math.floor(random() * 14);
        bottle(
          context,
          x,
          shelfY,
          height,
          5 + Math.floor(random() * 4),
          glassColours[Math.floor(random() * glassColours.length)],
        );
      }
      rect(context, '#8a5a30', from - 2, shelfY, to - from + 4, 4);
      rect(context, '#b17a45', from - 2, shelfY, to - from + 4, 1);
      rect(context, '#3a2212', from - 2, shelfY + 4, to - from + 4, 2);
    }
  }
}

function drawLamp(context: CanvasRenderingContext2D, x: number, y: number): void {
  rect(context, '#1a1210', x, 0, 1, y);
  // The shade, a cone of copper with a bright lip.
  for (let row = 0; row < 11; row += 1) {
    const half = 3 + row;
    rect(context, row < 2 ? '#d38a3a' : '#a3621f', x - half, y + row, half * 2 + 1, 1);
    rect(context, '#7b4813', x + half - 2, y + row, 3, 1);
  }
  rect(context, '#f0b45a', x - 14, y + 10, 29, 1);
  rect(context, '#fff1c8', x - 8, y + 11, 17, 2);
  const glow = context.createRadialGradient(x, y + 16, 2, x, y + 16, 130);
  glow.addColorStop(0, 'rgba(255,214,140,0.55)');
  glow.addColorStop(0.35, 'rgba(255,190,110,0.2)');
  glow.addColorStop(1, 'rgba(255,170,80,0)');
  context.save();
  context.globalCompositeOperation = 'lighter';
  context.fillStyle = glow;
  context.fillRect(x - 130, y - 100, 260, 260);
  context.restore();
}

/* ------------------------------------------------------------------------------------------
 * The taps and the bar.
 * ---------------------------------------------------------------------------------------- */

/** Chrome, lit from the left: a bright edge, a soft body and a dark edge. */
function chrome(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
): void {
  rect(context, '#59606a', x, y, width, height);
  rect(context, '#aab2bb', x + 1, y, Math.max(1, width - 2), height);
  rect(context, '#f2f6f9', x + 1, y, Math.max(1, Math.floor(width / 3)), height);
  rect(context, '#38404a', x + width - 1, y, 1, height);
}

function drawTaps(context: CanvasRenderingContext2D): void {
  // The beam the taps hang from, with its brackets going up into the ceiling.
  chrome(context, 218, 36, 156, 6);
  chrome(context, 226, 0, 5, 36);
  chrome(context, 362, 0, 5, 36);
  const handles: [number, string][] = [
    [SPOUT.x - 50, '#a3262b'],
    [SPOUT.x, '#22262c'],
    [SPOUT.x + 50, '#1d5a34'],
  ];
  for (const [x, colour] of handles) {
    // A blank handle above the beam, a body and a spout below it.
    rect(context, colour, x - 3, 10, 7, 26);
    rect(context, 'rgba(255,255,255,0.28)', x - 3, 10, 2, 26);
    rect(context, '#000000', x + 3, 10, 1, 26);
    rect(context, '#d9dde1', x - 3, 8, 7, 3);
    chrome(context, x - 4, 42, 9, 9);
    chrome(context, x - 2, 51, 5, SPOUT.y - 51);
  }
}

function drawBar(context: CanvasRenderingContext2D): void {
  const random = seeded(33);
  const rows = GAME_HEIGHT - BAR_BACK;
  const image = context.createImageData(GAME_WIDTH, rows);
  const dark = rgb('#3a1d10');
  const light = rgb('#7a4524');
  for (let row = 0; row < rows; row += 1) {
    const t = row / rows;
    const base = mix(dark, light, Math.pow(t, 0.8));
    for (let x = 0; x < GAME_WIDTH; x += 1) {
      // Long grain along the bar, and a sheen where the lamps shine on it.
      const grain = lattice(Math.floor(x / 60), row, 6) * 0.1 + lattice(x, row, 2) * 0.04;
      const lamp =
        Math.max(0, 1 - Math.abs(x - 120) / 110) + Math.max(0, 1 - Math.abs(x - 420) / 110);
      const colour = mix(
        scaleRgb(base, 0.9 + grain),
        [255, 205, 140],
        Math.min(0.4, lamp * 0.22 * (0.3 + t)),
      );
      const at = (row * GAME_WIDTH + x) * 4;
      image.data[at] = colour[0];
      image.data[at + 1] = colour[1];
      image.data[at + 2] = colour[2];
      image.data[at + 3] = 255;
    }
  }
  context.putImageData(image, 0, BAR_BACK);
  // The brass rail along the back of the bar.
  rect(context, '#6e5217', 0, BAR_BACK - 1, GAME_WIDTH, 1);
  rect(context, '#e0b94a', 0, BAR_BACK, GAME_WIDTH, 2);
  rect(context, '#fbe9a0', 0, BAR_BACK, GAME_WIDTH, 1);
  rect(context, '#3a2a08', 0, BAR_BACK + 2, GAME_WIDTH, 1);
  // Rings where glasses have stood.
  for (let ring = 0; ring < 10; ring += 1) {
    const x = 24 + random() * (GAME_WIDTH - 48);
    const y = BAR_BACK + 14 + random() * (rows - 30);
    context.strokeStyle = 'rgba(30,14,6,0.16)';
    context.beginPath();
    context.ellipse(x, y, 8, 2.6, 0, 0, Math.PI * 2);
    context.stroke();
  }
  // The drip mat under the glass: dark rubber with a grid of holes.
  const mat = { x: GLASS.x - 98, y: GLASS.bottom + 2, w: 196, h: 16 };
  rect(context, '#0d0d0f', mat.x, mat.y, mat.w, mat.h);
  rect(context, '#1b1c20', mat.x + 1, mat.y + 1, mat.w - 2, 1);
  for (let x = mat.x + 4; x < mat.x + mat.w - 3; x += 5) {
    for (let y = mat.y + 4; y < mat.y + mat.h - 2; y += 4) rect(context, '#050506', x, y, 2, 1);
  }
}

function drawBackdrop(context: CanvasRenderingContext2D): void {
  drawWall(context);
  drawShelves(context);
  drawLamp(context, 120, 8);
  drawLamp(context, 420, 8);
  drawTaps(context);
  drawBar(context);
  // A warm tint over everything.
  context.fillStyle = 'rgba(255,160,70,0.05)';
  context.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
}

/* ------------------------------------------------------------------------------------------
 * The glass: its front, with the stout drawn behind it by the Play scene.
 * ---------------------------------------------------------------------------------------- */

/** The glass's picture is this much bigger than its inside, each side, and above and below. */
export const GLASS_ART = { wall: 3, above: 6, below: 8, width: 104 } as const;

function drawGlassFront(context: CanvasRenderingContext2D): void {
  const { wall, above, width } = GLASS_ART;
  const centre = width / 2;
  const insideTop = above;
  const insideBottom = above + GLASS_HEIGHT;

  for (let y = insideTop; y < insideBottom; y += 1) {
    const up = insideBottom - y;
    const inner = glassWidthAt(up, GLASS_HEIGHT, GLASS.bottomInner, GLASS.topInner);
    const left = Math.round(centre - inner / 2);
    const right = Math.round(centre + inner / 2);
    // The walls of the glass: thick, pale, and lit more on the left.
    rect(context, 'rgba(214,236,246,0.5)', left - wall, y, wall, 1);
    rect(context, 'rgba(214,236,246,0.32)', right, y, wall, 1);
    rect(context, 'rgba(255,255,255,0.62)', left - 1, y, 1, 1);
    // A long highlight down the inside of the left wall, and a faint one on the right.
    rect(context, 'rgba(255,255,255,0.22)', left + 4, y, 3, 1);
    rect(context, 'rgba(255,255,255,0.1)', right - 6, y, 2, 1);
  }

  // The thick glass of the foot.
  const foot = Math.round(glassWidthAt(0, GLASS_HEIGHT, GLASS.bottomInner, GLASS.topInner));
  rect(
    context,
    'rgba(206,230,242,0.42)',
    centre - foot / 2 - wall,
    insideBottom,
    foot + wall * 2,
    6,
  );
  rect(
    context,
    'rgba(255,255,255,0.55)',
    centre - foot / 2 - wall,
    insideBottom,
    foot + wall * 2,
    1,
  );
  rect(
    context,
    'rgba(90,120,140,0.5)',
    centre - foot / 2 - wall,
    insideBottom + 5,
    foot + wall * 2,
    1,
  );

  // The rim, seen from a little above.
  const rimWidth = GLASS.topInner + wall * 2;
  context.strokeStyle = 'rgba(226,244,252,0.7)';
  context.lineWidth = 1;
  context.beginPath();
  context.ellipse(centre, insideTop, rimWidth / 2, 3, 0, 0, Math.PI * 2);
  context.stroke();
}

function drawVignette(context: CanvasRenderingContext2D): void {
  const gradient = context.createRadialGradient(240, 130, 90, 240, 135, 320);
  gradient.addColorStop(0, 'rgba(8,4,2,0)');
  gradient.addColorStop(1, 'rgba(8,4,2,0.6)');
  context.fillStyle = gradient;
  context.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
}

/** Draws every picture once, before the first scene that wants one. */
export function createTextures(scene: Phaser.Scene): void {
  createTexture(scene, TextureKey.Backdrop, GAME_WIDTH, GAME_HEIGHT, drawBackdrop);
  createTexture(
    scene,
    TextureKey.Glass,
    GLASS_ART.width,
    GLASS_ART.above + GLASS_HEIGHT + GLASS_ART.below,
    drawGlassFront,
  );
  createTexture(scene, TextureKey.Vignette, GAME_WIDTH, GAME_HEIGHT, drawVignette);
}
