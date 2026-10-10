/**
 * The pictures of the two mini bonus games, drawn in code once when the game loads, as everything
 * else is: the dartboard and the darts, five customers at the bar, and a pint of each of the three
 * drinks. There is no lettering in any of it: the numbers round the dartboard are written by the
 * game in the pixel font.
 */
import type Phaser from 'phaser';
import { BOARD, customerKey, DRINKS, LOOKS, pintKey, TextureKey } from './config';
import {
  createTexture,
  css,
  fromNumber,
  mix,
  rect,
  rgb,
  scaleRgb,
  seeded,
  type Ctx,
  type Rgb,
} from './art';

/* ------------------------------------------------------------------------------------------
 * The dartboard.
 * ---------------------------------------------------------------------------------------- */

/** The picture's size, and where its middle is. */
export const BOARD_ART = {
  size: Math.ceil(BOARD.outer * 2) + 2,
  middle: Math.ceil(BOARD.outer) + 1,
} as const;

/** A ring-shaped piece of a wedge: from angle `from` to `to` (radians, clockwise from the top), between two radii. */
function slice(ctx: Ctx, from: number, to: number, inner: number, outer: number): void {
  const c = BOARD_ART.middle;
  // Canvas angles run clockwise from the right, so the top is -90 degrees.
  const a = from - Math.PI / 2;
  const b = to - Math.PI / 2;
  ctx.beginPath();
  ctx.arc(c, c, outer, a, b);
  ctx.arc(c, c, inner, b, a, true);
  ctx.closePath();
}

function drawBoard(ctx: Ctx): void {
  const c = BOARD_ART.middle;
  const R = BOARD.radius;
  const wedge = Math.PI / 10;
  const black = rgb('#17191c');
  const cream = rgb('#e8ddc2');
  const red = rgb('#b4261d');
  const green = rgb('#1e7a40');

  // The surround: a dark wood ring with a bevel, and the black ring the numbers sit on.
  const wood = ctx.createRadialGradient(c - 24, c - 24, 60, c, c, BOARD.outer);
  wood.addColorStop(0, '#4a2f1c');
  wood.addColorStop(1, '#1b0f08');
  ctx.fillStyle = wood;
  ctx.beginPath();
  ctx.arc(c, c, BOARD.outer, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,214,160,0.3)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(c, c, BOARD.outer - 0.5, Math.PI * 0.95, Math.PI * 1.75);
  ctx.stroke();
  ctx.fillStyle = '#0d0e10';
  ctx.beginPath();
  ctx.arc(c, c, R * 1.17, 0, Math.PI * 2);
  ctx.fill();

  // The wedges: the single, treble, single and double of each, alternating colours.
  const rings = BOARD.rings;
  for (let index = 0; index < 20; index += 1) {
    const from = index * wedge - wedge / 2;
    const to = from + wedge;
    const dark = index % 2 === 0;
    const single = dark ? black : cream;
    const bonus = dark ? red : green;
    const paint = (colour: Rgb, inner: number, outer: number): void => {
      slice(ctx, from, to, inner * R, outer * R);
      ctx.fillStyle = css(colour);
      ctx.fill();
    };
    paint(single, rings.outerBull, rings.trebleIn);
    paint(bonus, rings.trebleIn, rings.trebleOut);
    paint(single, rings.trebleOut, rings.doubleIn);
    paint(bonus, rings.doubleIn, 1);
  }
  // The outer bull and the bull.
  ctx.fillStyle = css(green);
  ctx.beginPath();
  ctx.arc(c, c, rings.outerBull * R, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = css(red);
  ctx.beginPath();
  ctx.arc(c, c, rings.bull * R, 0, Math.PI * 2);
  ctx.fill();

  // The sisal of the board: fine short fibres that catch the light, a little darker in the black.
  const random = seeded(17);
  for (let fibre = 0; fibre < 2600; fibre += 1) {
    const a = random() * Math.PI * 2;
    const r = Math.sqrt(random()) * R;
    const x = c + Math.sin(a) * r;
    const y = c - Math.cos(a) * r;
    const turn = random() * Math.PI;
    ctx.strokeStyle = random() < 0.5 ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.09)';
    ctx.lineWidth = 0.6;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + Math.cos(turn) * 1.8, y + Math.sin(turn) * 1.8);
    ctx.stroke();
  }

  // The wires: a ring at every edge, and a spoke between the wedges, bright where the light hits them.
  ctx.lineWidth = 0.9;
  ctx.strokeStyle = 'rgba(214,220,226,0.8)';
  for (const share of [
    rings.bull,
    rings.outerBull,
    rings.trebleIn,
    rings.trebleOut,
    rings.doubleIn,
    1,
  ]) {
    ctx.beginPath();
    ctx.arc(c, c, share * R, 0, Math.PI * 2);
    ctx.stroke();
  }
  for (let index = 0; index < 20; index += 1) {
    const a = index * wedge - wedge / 2;
    ctx.beginPath();
    ctx.moveTo(c + Math.sin(a) * rings.outerBull * R, c - Math.cos(a) * rings.outerBull * R);
    ctx.lineTo(c + Math.sin(a) * R, c - Math.cos(a) * R);
    ctx.stroke();
  }

  // The light from above on the left, and the board's edge falling into shade.
  const sheen = ctx.createRadialGradient(c - 30, c - 36, 10, c, c, BOARD.outer);
  sheen.addColorStop(0, 'rgba(255,244,220,0.2)');
  sheen.addColorStop(0.55, 'rgba(255,244,220,0)');
  sheen.addColorStop(1, 'rgba(0,0,0,0.4)');
  ctx.fillStyle = sheen;
  ctx.beginPath();
  ctx.arc(c, c, BOARD.outer, 0, Math.PI * 2);
  ctx.fill();
}

/** A dart seen going away from the thrower: a tip, a brass barrel with grip rings, a shaft and a flight. Its tip is at the top. */
function drawDartFlying(ctx: Ctx): void {
  // The flight, red and white, at the foot.
  ctx.fillStyle = '#d6342a';
  ctx.beginPath();
  ctx.moveTo(5, 21);
  ctx.lineTo(0, 33);
  ctx.lineTo(5, 31);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#f2f2f2';
  ctx.beginPath();
  ctx.moveTo(5, 21);
  ctx.lineTo(10, 33);
  ctx.lineTo(5, 31);
  ctx.closePath();
  ctx.fill();
  // The shaft.
  rect(ctx, '#1c1c20', 4, 15, 2, 9);
  // The barrel, brass lit from the left, with grip rings.
  const barrel = ctx.createLinearGradient(3, 0, 8, 0);
  barrel.addColorStop(0, '#6a4a14');
  barrel.addColorStop(0.3, '#f2d27a');
  barrel.addColorStop(0.65, '#c19a3c');
  barrel.addColorStop(1, '#5a3d0e');
  ctx.fillStyle = barrel;
  ctx.fillRect(3, 5, 5, 11);
  for (let ring = 7; ring < 15; ring += 2) rect(ctx, 'rgba(60,40,6,0.55)', 3, ring, 5, 1);
  // The tip, steel.
  const tip = ctx.createLinearGradient(4, 0, 7, 0);
  tip.addColorStop(0, '#9aa3ab');
  tip.addColorStop(0.4, '#f4f8fa');
  tip.addColorStop(1, '#6a737b');
  ctx.fillStyle = tip;
  ctx.beginPath();
  ctx.moveTo(5.5, 0);
  ctx.lineTo(7.5, 6);
  ctx.lineTo(3.5, 6);
  ctx.closePath();
  ctx.fill();
}

/** A dart stuck in the board, seen from the front: three fins fanned out from a barrel. */
function drawDartStuck(ctx: Ctx): void {
  const c = 7;
  const fins = [
    [-Math.PI / 2, '#d6342a'],
    [Math.PI / 6, '#f2f2f2'],
    [(5 * Math.PI) / 6, '#d6342a'],
  ] as const;
  for (const [angle, colour] of fins) {
    ctx.save();
    ctx.translate(c, c);
    ctx.rotate(angle + Math.PI / 2);
    ctx.fillStyle = colour;
    ctx.beginPath();
    ctx.moveTo(-1, -1);
    ctx.lineTo(-3.4, -6.5);
    ctx.lineTo(3.4, -6.5);
    ctx.lineTo(1, -1);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.35)';
    ctx.lineWidth = 0.6;
    ctx.stroke();
    ctx.restore();
  }
  const metal = ctx.createRadialGradient(c - 0.8, c - 0.8, 0.2, c, c, 2.6);
  metal.addColorStop(0, '#ffffff');
  metal.addColorStop(1, '#6a737b');
  ctx.fillStyle = metal;
  ctx.beginPath();
  ctx.arc(c, c, 2.2, 0, Math.PI * 2);
  ctx.fill();
}

/* ------------------------------------------------------------------------------------------
 * The pints.
 * ---------------------------------------------------------------------------------------- */

/** The size of a pint's picture, as it slides along the bar and as it is asked for in a speech bubble. */
export const PINT_ART = { width: 24, height: 38 } as const;

/** A pint of one of the three drinks: a tapered glass, the drink with the light through its edge, and a head. */
function drawMiniPint(ctx: Ctx, kind: number): void {
  const drink = DRINKS[kind];
  const liquid = fromNumber(drink.liquid);
  const head = fromNumber(drink.head);
  const glow = fromNumber(drink.glow);
  const w = PINT_ART.width;
  const cx = w / 2;
  const top = 3;
  const bottom = 34;
  const half = (y: number): number => 10 - (5 * (y - top)) / (bottom - top);

  const outline = (grow = 0): void => {
    ctx.beginPath();
    ctx.moveTo(cx - half(top) - grow, top);
    ctx.lineTo(cx + half(top) + grow, top);
    ctx.lineTo(cx + half(bottom) + grow, bottom);
    ctx.lineTo(cx - half(bottom) - grow, bottom);
    ctx.closePath();
  };

  // The glass, a faint tint.
  outline();
  ctx.fillStyle = 'rgba(196,222,236,0.22)';
  ctx.fill();

  ctx.save();
  outline();
  ctx.clip();
  // The drink, with the light coming through the left and a little on the right.
  const body = ctx.createLinearGradient(cx - 10, 0, cx + 10, 0);
  body.addColorStop(0, css(mix(liquid, glow, 0.7)));
  body.addColorStop(0.2, css(mix(liquid, glow, 0.25)));
  body.addColorStop(0.7, css(scaleRgb(liquid, 0.82)));
  body.addColorStop(1, css(mix(liquid, glow, 0.5)));
  ctx.fillStyle = body;
  ctx.fillRect(0, 9, w, bottom - 9);
  // The thick foot darkens the bottom.
  const foot = ctx.createLinearGradient(0, bottom - 8, 0, bottom);
  foot.addColorStop(0, 'rgba(0,0,0,0)');
  foot.addColorStop(1, 'rgba(0,0,0,0.4)');
  ctx.fillStyle = foot;
  ctx.fillRect(0, bottom - 8, w, 8);
  // The head, cream with a darker band where it meets the drink.
  const foam = ctx.createLinearGradient(0, top, 0, 10);
  foam.addColorStop(0, css(mix(head, [255, 255, 255], 0.4)));
  foam.addColorStop(0.7, css(head));
  foam.addColorStop(1, css(mix(head, [140, 100, 56], 0.4)));
  ctx.fillStyle = foam;
  ctx.fillRect(0, top, w, 7);
  ctx.restore();

  // The walls of the glass, the lamp's gleam, the rim and the foot.
  ctx.lineWidth = 1;
  ctx.strokeStyle = 'rgba(236,248,255,0.7)';
  outline();
  ctx.stroke();
  rect(ctx, 'rgba(255,255,255,0.5)', cx - half(20) + 2, 12, 1, 18);
  ctx.strokeStyle = 'rgba(240,250,255,0.85)';
  ctx.beginPath();
  ctx.ellipse(cx, top, half(top), 1.5, 0, 0, Math.PI * 2);
  ctx.stroke();
  rect(ctx, 'rgba(206,230,242,0.55)', cx - half(bottom) - 1, bottom, half(bottom) * 2 + 2, 3);
  rect(ctx, 'rgba(255,255,255,0.7)', cx - half(bottom) - 1, bottom, half(bottom) * 2 + 2, 1);
}

/* ------------------------------------------------------------------------------------------
 * The customers: busts seen over the bar, in five looks. Their eyebrows and mouths are drawn by
 * the scene, since they change with how the customer feels.
 * ---------------------------------------------------------------------------------------- */

/** A customer's picture is this big, and its head and shoulders are here in it. */
export const CUSTOMER_ART = {
  width: 72,
  height: 100,
  headX: 36,
  headY: 38,
  eyeY: 36,
  mouthY: 50,
} as const;

interface Look {
  skin: string;
  hair: string;
  jacket: string;
  shirt: string;
  style: 'short' | 'bald' | 'cap' | 'long';
  extra: 'none' | 'moustache' | 'beard' | 'glasses';
}

const LOOK_SPECS: Look[] = [
  {
    skin: '#f1c8a4',
    hair: '#4a2f1c',
    jacket: '#2b3f5e',
    shirt: '#e8eef2',
    style: 'short',
    extra: 'none',
  },
  {
    skin: '#e0aa84',
    hair: '#d4d4d4',
    jacket: '#4b5a37',
    shirt: '#d9c9a0',
    style: 'bald',
    extra: 'moustache',
  },
  {
    skin: '#c88a62',
    hair: '#1a1410',
    jacket: '#7a2236',
    shirt: '#f0f0f0',
    style: 'short',
    extra: 'beard',
  },
  {
    skin: '#8e5a3a',
    hair: '#0f0c0a',
    jacket: '#2a2d33',
    shirt: '#c9d3dc',
    style: 'cap',
    extra: 'none',
  },
  {
    skin: '#f0c4a0',
    hair: '#b5651d',
    jacket: '#556b7a',
    shirt: '#f4ead2',
    style: 'long',
    extra: 'glasses',
  },
];

function drawCustomer(ctx: Ctx, look: Look): void {
  const { width: W, height: H, headX: cx, headY: cy } = CUSTOMER_ART;
  const skin = rgb(look.skin);
  const hair = rgb(look.hair);
  const jacket = rgb(look.jacket);
  const shirt = rgb(look.shirt);

  // Long hair falls behind the head, so it is drawn first.
  if (look.style === 'long') {
    ctx.fillStyle = css(hair);
    ctx.beginPath();
    ctx.moveTo(cx - 18, cy - 8);
    ctx.quadraticCurveTo(cx - 22, cy + 30, cx - 20, cy + 36);
    ctx.lineTo(cx + 20, cy + 36);
    ctx.quadraticCurveTo(cx + 22, cy + 30, cx + 18, cy - 8);
    ctx.closePath();
    ctx.fill();
  }

  // The shoulders: a jacket lit from the left, with the shirt and the lapels at its neck.
  const body = ctx.createLinearGradient(0, 0, W, 0);
  body.addColorStop(0, css(scaleRgb(jacket, 1.3)));
  body.addColorStop(0.5, css(jacket));
  body.addColorStop(1, css(scaleRgb(jacket, 0.62)));
  ctx.fillStyle = body;
  ctx.beginPath();
  ctx.moveTo(0, H);
  ctx.quadraticCurveTo(2, 76, 20, 68);
  ctx.lineTo(52, 68);
  ctx.quadraticCurveTo(70, 76, W, H);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = css(shirt);
  ctx.beginPath();
  ctx.moveTo(cx - 10, 66);
  ctx.lineTo(cx + 10, 66);
  ctx.lineTo(cx, 90);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = 'rgba(0,0,0,0.18)';
  ctx.beginPath();
  ctx.moveTo(cx - 10, 66);
  ctx.lineTo(cx, 90);
  ctx.lineTo(cx + 3, 66);
  ctx.closePath();
  ctx.fill();
  for (const side of [-1, 1]) {
    ctx.fillStyle = css(scaleRgb(jacket, side < 0 ? 1.18 : 0.78));
    ctx.beginPath();
    ctx.moveTo(cx + side * 10, 66);
    ctx.lineTo(cx, 92);
    ctx.lineTo(cx + side * 17, 78);
    ctx.closePath();
    ctx.fill();
  }
  // Where the jacket is shaded under the chin, and its seam down the middle.
  rect(ctx, 'rgba(0,0,0,0.25)', cx, 91, 1, H - 91);

  // The neck, shaded under the jaw.
  const neck = ctx.createLinearGradient(cx - 7, 0, cx + 7, 0);
  neck.addColorStop(0, css(scaleRgb(skin, 0.95)));
  neck.addColorStop(1, css(scaleRgb(skin, 0.7)));
  ctx.fillStyle = neck;
  ctx.fillRect(cx - 7, cy + 14, 14, 20);
  ctx.fillStyle = 'rgba(0,0,0,0.28)';
  ctx.fillRect(cx - 7, cy + 18, 14, 5);

  // The ears, then the head, lit from the upper left.
  ctx.fillStyle = css(scaleRgb(skin, 0.88));
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.ellipse(cx + side * 15.5, cy + 3, 3.2, 5, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  const face = ctx.createRadialGradient(cx - 6, cy - 7, 2, cx, cy, 20);
  face.addColorStop(0, css(scaleRgb(mix(skin, [255, 235, 215], 0.2), 1.05)));
  face.addColorStop(0.7, css(skin));
  face.addColorStop(1, css(scaleRgb(skin, 0.74)));
  ctx.fillStyle = face;
  ctx.beginPath();
  ctx.ellipse(cx, cy, 15, 18, 0, 0, Math.PI * 2);
  ctx.fill();

  // The hair, by style.
  ctx.fillStyle = css(hair);
  if (look.style === 'short' || look.style === 'long') {
    ctx.beginPath();
    ctx.ellipse(cx, cy - 8, 16, 12, 0, Math.PI, Math.PI * 2);
    ctx.lineTo(cx + 16, cy - 2);
    ctx.quadraticCurveTo(cx + 12, cy - 9, cx, cy - 9);
    ctx.quadraticCurveTo(cx - 12, cy - 9, cx - 16, cy - 2);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.14)';
    ctx.beginPath();
    ctx.ellipse(cx - 5, cy - 16, 7, 2.2, -0.3, 0, Math.PI * 2);
    ctx.fill();
  } else if (look.style === 'bald') {
    ctx.beginPath();
    ctx.ellipse(cx - 14.5, cy + 1, 2.4, 6, 0, 0, Math.PI * 2);
    ctx.ellipse(cx + 14.5, cy + 1, 2.4, 6, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.22)';
    ctx.beginPath();
    ctx.ellipse(cx - 5, cy - 14, 6, 3, -0.4, 0, Math.PI * 2);
    ctx.fill();
  } else if (look.style === 'cap') {
    const tweed = rgb('#3f4a3b');
    ctx.fillStyle = css(tweed);
    ctx.beginPath();
    ctx.ellipse(cx, cy - 11, 18, 9, 0, Math.PI, Math.PI * 2);
    ctx.lineTo(cx + 19, cy - 9);
    ctx.quadraticCurveTo(cx, cy - 4, cx - 19, cy - 9);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = css(scaleRgb(tweed, 0.62));
    ctx.beginPath();
    ctx.ellipse(cx + 2, cy - 7, 17, 3.4, 0, 0, Math.PI);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.13)';
    ctx.beginPath();
    ctx.ellipse(cx - 6, cy - 17, 8, 2.4, -0.2, 0, Math.PI * 2);
    ctx.fill();
  }

  // The eyes, nose and cheeks; the brows and mouth come from the scene.
  for (const side of [-1, 1]) {
    ctx.fillStyle = '#f7f4ee';
    ctx.beginPath();
    ctx.ellipse(cx + side * 6.2, CUSTOMER_ART.eyeY, 3.2, 2.2, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#1d1a18';
    ctx.beginPath();
    ctx.arc(cx + side * 6.2 + 0.4, CUSTOMER_ART.eyeY + 0.3, 1.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.8)';
    ctx.fillRect(cx + side * 6.2 - 0.2, CUSTOMER_ART.eyeY - 0.6, 1, 1);
    ctx.fillStyle = 'rgba(190,80,60,0.12)';
    ctx.beginPath();
    ctx.arc(cx + side * 9.5, cy + 8, 3.6, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.strokeStyle = css(scaleRgb(skin, 0.62), 0.8);
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(cx + 0.5, CUSTOMER_ART.eyeY + 2);
  ctx.lineTo(cx - 1, cy + 9);
  ctx.lineTo(cx + 2.2, cy + 10);
  ctx.stroke();

  // The extras.
  if (look.extra === 'moustache' || look.extra === 'beard') {
    ctx.fillStyle = css(hair);
    ctx.beginPath();
    ctx.moveTo(cx - 8, cy + 12);
    ctx.quadraticCurveTo(cx, cy + 8, cx + 8, cy + 12);
    ctx.quadraticCurveTo(cx, cy + 14.5, cx - 8, cy + 12);
    ctx.fill();
  }
  if (look.extra === 'beard') {
    ctx.beginPath();
    ctx.moveTo(cx - 14, cy + 6);
    ctx.quadraticCurveTo(cx - 14, cy + 26, cx, cy + 27);
    ctx.quadraticCurveTo(cx + 14, cy + 26, cx + 14, cy + 6);
    ctx.quadraticCurveTo(cx + 9, cy + 14, cx, cy + 15);
    ctx.quadraticCurveTo(cx - 9, cy + 14, cx - 14, cy + 6);
    ctx.fill();
  }
  if (look.extra === 'glasses') {
    ctx.strokeStyle = '#26211c';
    ctx.lineWidth = 1.2;
    for (const side of [-1, 1]) {
      ctx.strokeRect(cx + side * 6.2 - 5, CUSTOMER_ART.eyeY - 3.4, 10, 7);
    }
    ctx.beginPath();
    ctx.moveTo(cx - 1.2, CUSTOMER_ART.eyeY - 1);
    ctx.lineTo(cx + 1.2, CUSTOMER_ART.eyeY - 1);
    ctx.stroke();
    ctx.fillStyle = 'rgba(200,225,240,0.16)';
    for (const side of [-1, 1]) ctx.fillRect(cx + side * 6.2 - 5, CUSTOMER_ART.eyeY - 3.4, 10, 7);
  }
}

/** Draws the pictures of the mini games once, after `createTextures` has drawn the rest. */
export function createMiniTextures(scene: Phaser.Scene): void {
  createTexture(scene, TextureKey.Board, BOARD_ART.size, BOARD_ART.size, drawBoard);
  createTexture(scene, TextureKey.DartFlying, 11, 34, drawDartFlying);
  createTexture(scene, TextureKey.DartStuck, 14, 14, drawDartStuck);
  DRINKS.forEach((_, kind) =>
    createTexture(scene, pintKey(kind), PINT_ART.width, PINT_ART.height, (ctx) =>
      drawMiniPint(ctx, kind),
    ),
  );
  for (let look = 0; look < LOOKS; look += 1) {
    createTexture(scene, customerKey(look), CUSTOMER_ART.width, CUSTOMER_ART.height, (ctx) =>
      drawCustomer(ctx, LOOK_SPECS[look]),
    );
  }
}
