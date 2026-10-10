/**
 * Draws the goal: the ground under it, the net with the targets hung in it, and the posts and
 * crossbar in front. They are three layers (the scenes put the bonus target between the last two)
 * so the posts stay in front of everything that moves behind them. Drawn again only when
 * something changes: a target hit, or the goal going back.
 */
import type Phaser from 'phaser';
import { GAME_WIDTH } from '../../shell/constants';
import { COLOUR } from './config';
import type { Target } from './gameData';
import { shade, type GoalGeometry, type Spot } from './logic';

type Graphics = Phaser.GameObjects.Graphics;
type Corner = readonly [number, number];

const quad = (g: Graphics, a: Corner, b: Corner, c: Corner, d: Corner): void => {
  g.fillTriangle(a[0], a[1], b[0], b[1], c[0], c[1]);
  g.fillTriangle(a[0], a[1], c[0], c[1], d[0], d[1]);
};

/** The sun is high on the right, so shadows fall to the left and towards the kicker. */
const SHADOW = { across: -0.34, down: 0.12 } as const;

/** The pitch markings round the goal, and the shadow the goal throws on the grass. */
export function drawGround(g: Graphics, geometry: GoalGeometry): void {
  const { left, right, top, baseY, mouthWidth, mouthHeight, postWidth, postTop, scale } = geometry;
  g.clear();

  // The shadow first, under the markings.
  const centre = (left + right) / 2;
  const postHeight = baseY - postTop;
  const barHeight = mouthHeight + postWidth / 2;
  const along = (x: number, height: number): Corner => [
    x + SHADOW.across * height,
    baseY + SHADOW.down * height,
  ];
  g.fillStyle(0x0a1a0a, 0.1);
  quad(g, [left, baseY], [right, baseY], along(right, barHeight), along(left, barHeight));
  g.lineStyle(Math.max(2, postWidth), 0x0a1a0a, 0.15);
  for (const x of [left - postWidth / 2, right + postWidth / 2]) {
    const end = along(x, postHeight);
    g.lineBetween(x, baseY, end[0], end[1]);
  }
  const barLeft = along(left - postWidth / 2, barHeight);
  const barRight = along(right + postWidth / 2, barHeight);
  g.lineBetween(barLeft[0], barLeft[1], barRight[0], barRight[1]);

  // The goal line, the small square and the line at 13 metres, which narrow with the distance.
  const unit = mouthWidth / 6.5;
  const squareDepth = Math.round(22 * scale);
  const farDepth = Math.round(64 * scale);
  const widen = (depth: number): number => 1 + depth * 0.0035;
  g.fillStyle(0xffffff, 0.82);
  g.fillRect(0, baseY, GAME_WIDTH, 1);
  g.lineStyle(1, 0xffffff, 0.78);
  g.lineBetween(
    centre - unit * 7,
    baseY,
    centre - unit * 7 * widen(squareDepth),
    baseY + squareDepth,
  );
  g.lineBetween(
    centre + unit * 7,
    baseY,
    centre + unit * 7 * widen(squareDepth),
    baseY + squareDepth,
  );
  g.lineBetween(
    centre - unit * 7 * widen(squareDepth),
    baseY + squareDepth,
    centre + unit * 7 * widen(squareDepth),
    baseY + squareDepth,
  );
  g.lineBetween(
    centre - unit * 9.5,
    baseY,
    centre - unit * 9.5 * widen(farDepth),
    baseY + farDepth,
  );
  g.lineBetween(
    centre + unit * 9.5,
    baseY,
    centre + unit * 9.5 * widen(farDepth),
    baseY + farDepth,
  );
  g.fillStyle(0xffffff, 0.6);
  g.fillRect(0, baseY + farDepth, GAME_WIDTH, 1);

  // Worn grass in the mouth, where the ball has come down all afternoon.
  g.fillStyle(0x6f6a3a, 0.16);
  g.fillEllipse(centre, baseY + 3 * scale, mouthWidth * 0.8, 7 * scale);
  void top;
}

/** One target as a painted board: shadowed, rimmed, banded, with a glint. */
function drawTarget(
  g: Graphics,
  x: number,
  y: number,
  r: number,
  colour: number,
  done: boolean,
): void {
  g.fillStyle(0x000000, 0.28);
  g.fillCircle(x + 1.5, y + 2.5, r);
  if (done) {
    g.fillStyle(shade(COLOUR.hit, 0.62), 1);
    g.fillCircle(x, y, r);
    g.fillStyle(0x3aa655, 1);
    g.fillCircle(x, y, Math.max(1, r - 1));
    g.lineStyle(Math.max(1, Math.round(r / 4)), 0xffffff, 0.95);
    g.lineBetween(x - r * 0.45, y, x - r * 0.1, y + r * 0.38);
    g.lineBetween(x - r * 0.1, y + r * 0.38, x + r * 0.5, y - r * 0.4);
    return;
  }
  g.fillStyle(shade(colour, 0.6), 1);
  g.fillCircle(x, y, r);
  g.fillStyle(colour, 1);
  g.fillCircle(x, y, Math.max(1, r - 0.9));
  g.fillStyle(0xffffff, 1);
  g.fillCircle(x, y, r * 0.66);
  g.fillStyle(shade(colour, 0.92), 1);
  g.fillCircle(x, y, r * 0.42);
  if (r >= 8) {
    g.fillStyle(0xffffff, 1);
    g.fillCircle(x, y, r * 0.16);
  }
  g.fillStyle(0xffffff, 0.4);
  g.fillCircle(x - r * 0.32, y - r * 0.36, Math.max(1, r * 0.2));
}

/** The net, seen from the front: the back of it smaller and higher, the sides running in to it. */
export function drawNet(
  g: Graphics,
  geometry: GoalGeometry,
  targets: readonly Target[],
  spots: readonly Spot[],
  cleared: readonly boolean[],
): void {
  const { left, right, top, baseY, mouthWidth, mouthHeight, scale } = geometry;
  g.clear();

  const inset = Math.max(3, Math.round(mouthWidth * 0.06));
  const backLeft = left + inset;
  const backRight = right - inset;
  const backTop = top + Math.round(mouthHeight * 0.12);
  const backBottom = baseY - Math.round(mouthHeight * 0.1);

  g.fillStyle(0x070d0a, 0.36);
  quad(g, [left, top], [backLeft, backTop], [backLeft, backBottom], [left, baseY]);
  quad(g, [right, top], [backRight, backTop], [backRight, backBottom], [right, baseY]);
  g.fillStyle(0x070d0a, 0.28);
  quad(g, [left, top], [right, top], [backRight, backTop], [backLeft, backTop]);
  g.fillStyle(0x070d0a, 0.5);
  g.fillRect(backLeft, backTop, backRight - backLeft, backBottom - backTop);

  // The mesh: fine on the back, running in along the sides and the roof.
  const gap = Math.max(2, Math.round(4 * scale));
  g.lineStyle(1, 0xffffff, 0.3);
  for (let x = backLeft + gap; x < backRight; x += gap) g.lineBetween(x, backTop, x, backBottom);
  const rows = Math.max(3, Math.round((backBottom - backTop) / gap));
  for (let row = 0; row <= rows; row += 1) {
    const back = backTop + ((backBottom - backTop) * row) / rows;
    const front = top + ((baseY - top) * row) / rows;
    g.lineBetween(backLeft, back, backRight, back);
    g.lineBetween(left, front, backLeft, back);
    g.lineBetween(right, front, backRight, back);
  }
  g.lineStyle(1, 0xffffff, 0.22);
  for (let step = 1; step <= 3; step += 1) {
    const t = step / 4;
    const xLeft = left + (backLeft - left) * t;
    const xRight = right + (backRight - right) * t;
    const yTop = top + (backTop - top) * t;
    const yBottom = baseY + (backBottom - baseY) * t;
    g.lineBetween(xLeft, yTop, xLeft, yBottom);
    g.lineBetween(xRight, yTop, xRight, yBottom);
    g.lineBetween(xLeft, yTop, xRight, yTop);
  }
  const columns = Math.max(4, Math.round(mouthWidth / (gap * 2)));
  for (let column = 0; column <= columns; column += 1) {
    const across = column / columns;
    g.lineBetween(
      left + mouthWidth * across,
      top,
      backLeft + (backRight - backLeft) * across,
      backTop,
    );
  }

  // The targets, hung in the net.
  targets.forEach((target, index) => {
    const { x, y, r } = spots[index];
    drawTarget(g, x, y, r, target.colour, cleared[index] === true);
  });

  // The bar's shadow on the net behind it.
  g.fillStyle(0x000000, 0.22);
  g.fillRect(left, top, mouthWidth, Math.max(2, Math.round(3 * scale)));
}

/** The posts and the crossbar: white tubes, lit from the right, with yellow padding at the foot. */
export function drawFrame(g: Graphics, geometry: GoalGeometry): void {
  const { left, right, top, baseY, mouthWidth, postWidth, postTop, scale } = geometry;
  g.clear();

  const padding = Math.round(30 * scale);
  const columnTone = (column: number): number => {
    const t = postWidth === 1 ? 0.5 : column / (postWidth - 1);
    return 0.66 + 0.42 * Math.sin(t * Math.PI * 0.85);
  };
  for (const x of [left - postWidth, right]) {
    for (let column = 0; column < postWidth; column += 1) {
      const tone = columnTone(column);
      g.fillStyle(shade(COLOUR.white, tone), 1);
      g.fillRect(x + column, postTop, 1, baseY - postTop - padding);
      g.fillStyle(shade(0xf2c230, tone), 1);
      g.fillRect(x + column, baseY - padding, 1, padding);
    }
    g.fillStyle(0x6b7580, 1);
    g.fillRect(x, baseY - padding, postWidth, 1);
    g.fillStyle(0xffffff, 0.9);
    g.fillRect(x, postTop, postWidth, 1);
  }

  for (let row = 0; row < postWidth; row += 1) {
    const tone = 1.08 - (0.4 * row) / Math.max(1, postWidth - 1);
    g.fillStyle(shade(COLOUR.white, tone), 1);
    g.fillRect(left - postWidth, top - postWidth + row, mouthWidth + postWidth * 2, 1);
  }
}

/** The three layers a goal is drawn on, back to front: the ground, the net, the posts. */
export interface GoalLayers {
  ground: Graphics;
  net: Graphics;
  frame: Graphics;
}

export function addGoalLayers(scene: Phaser.Scene): GoalLayers {
  return {
    ground: scene.add.graphics().setDepth(0.5),
    net: scene.add.graphics().setDepth(1),
    frame: scene.add.graphics().setDepth(2),
  };
}

/** Draws the whole goal. `spots` are where `targets` are on this geometry. */
export function drawGoal(
  layers: GoalLayers,
  geometry: GoalGeometry,
  targets: readonly Target[],
  spots: readonly Spot[],
  cleared: readonly boolean[],
): void {
  drawGround(layers.ground, geometry);
  drawNet(layers.net, geometry, targets, spots, cleared);
  drawFrame(layers.frame, geometry);
}
