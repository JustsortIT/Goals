/**
 * The pictures, drawn in code once when the game loads, kept plain: a brick wall with warm light,
 * a chalkboard in a wooden frame for the questions, and a vignette. No lettering in any of it.
 */
import type Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH } from '../../shell/constants';
import { LAYOUT, TextureKey } from './config';

type Ctx = CanvasRenderingContext2D;

function createTexture(scene: Phaser.Scene, key: string, draw: (ctx: Ctx) => void): void {
  if (scene.textures.exists(key)) return;
  const texture = scene.textures.createCanvas(key, GAME_WIDTH, GAME_HEIGHT);
  if (!texture) throw new Error(`Could not create texture "${key}".`);
  draw(texture.getContext());
  texture.refresh();
}

/** A number from 0 to 1 for a point on a grid, the same every time. */
function lattice(x: number, y: number): number {
  let n = Math.imul(x, 374761393) + Math.imul(y, 668265263);
  n = Math.imul(n ^ (n >>> 13), 1274126177);
  return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
}

function drawBackdrop(ctx: Ctx): void {
  // Brick, a few tones, dimmed so the board and buttons stand out.
  const tones = ['#5a2a21', '#4f241c', '#63302a', '#552820'];
  ctx.fillStyle = '#1f110c';
  ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
  for (let row = 0, y = 0; y < GAME_HEIGHT; row += 1, y += 8) {
    const offset = row % 2 === 0 ? 0 : 9;
    for (let x = -offset, column = 0; x < GAME_WIDTH; x += 18, column += 1) {
      ctx.fillStyle = tones[Math.floor(lattice(column, row) * tones.length)];
      ctx.fillRect(x + 1, y + 1, 17, 7);
    }
  }
  const light = ctx.createRadialGradient(240, 40, 20, 240, 120, 300);
  light.addColorStop(0, 'rgba(255,200,130,0.22)');
  light.addColorStop(1, 'rgba(255,200,130,0)');
  ctx.fillStyle = light;
  ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

  // The chalkboard: a wooden frame round dark green, with a soft smear of chalk dust.
  const { x, y, width, height } = LAYOUT.board;
  const frame = ctx.createLinearGradient(0, y - 5, 0, y + height + 5);
  frame.addColorStop(0, '#b27a44');
  frame.addColorStop(1, '#5a3418');
  ctx.fillStyle = frame;
  ctx.fillRect(x - 5, y - 5, width + 10, height + 10);
  const board = ctx.createLinearGradient(0, y, 0, y + height);
  board.addColorStop(0, '#24402f');
  board.addColorStop(1, '#183024');
  ctx.fillStyle = board;
  ctx.fillRect(x, y, width, height);
  ctx.fillStyle = 'rgba(255,255,255,0.05)';
  ctx.fillRect(x, y + height - 14, width, 14);
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.fillRect(x - 5, y + height + 5, width + 10, 2);
}

function drawVignette(ctx: Ctx): void {
  const gradient = ctx.createRadialGradient(240, 130, 90, 240, 135, 320);
  gradient.addColorStop(0, 'rgba(8,4,2,0)');
  gradient.addColorStop(1, 'rgba(8,4,2,0.55)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
}

/** Draws every picture once, before the first scene that wants one. */
export function createTextures(scene: Phaser.Scene): void {
  createTexture(scene, TextureKey.Backdrop, drawBackdrop);
  createTexture(scene, TextureKey.Vignette, drawVignette);
}
