/**
 * One glass on the bar: its shadow, the back of the glass, the drink, the head on it, the mark,
 * and the front of the glass, all in one thing that slides along the bar. The drink is a picture
 * cropped from the bottom to show how full it is; what is drawn again each frame is the head, the
 * cloudy surge under it and the bubbles running down the glass.
 */
import Phaser from 'phaser';
import { GLASS_ART, STOUT_BOTTOM } from './art';
import { GLASS, GLASS_HEIGHT, TextureKey } from './config';
import { glassWidthAt } from './logic';

/** The bubbles that run down the inside of a pint of stout after the pour: how many, and for how long. */
const CASCADE = { count: 56, afterMs: 3400 } as const;
/** The cloudy surge under the head is drawn in this many slices, each fainter than the one above. */
const SURGE = { slices: 9, depth: 30 } as const;

type Rgb = [number, number, number];
const split = (hex: number): Rgb => [(hex >> 16) & 255, (hex >> 8) & 255, hex & 255];
const join = ([r, g, b]: Rgb): number =>
  (Math.min(255, Math.round(r)) << 16) |
  (Math.min(255, Math.round(g)) << 8) |
  Math.min(255, Math.round(b));
const mixHex = (a: number, b: number, t: number): number => {
  const x = split(a);
  const y = split(b);
  return join([x[0] + (y[0] - x[0]) * t, x[1] + (y[1] - x[1]) * t, x[2] + (y[2] - x[2]) * t]);
};

export class GlassView {
  readonly container: Phaser.GameObjects.Container;

  private readonly stout: Phaser.GameObjects.Image;
  private readonly body: Phaser.GameObjects.Graphics;
  private readonly mark: Phaser.GameObjects.Graphics;
  /** Each bubble's place across the glass, how far down it has run, and how fast. */
  private readonly bubbles = Array.from({ length: CASCADE.count }, () => ({
    across: Math.random(),
    down: Math.random(),
    speed: 0.1 + Math.random() * 0.3,
  }));
  /** Where along the head's underside each little bubble sits, so the edge looks frothy. */
  private readonly froth = Array.from({ length: 16 }, () => Math.random());
  /** Bubbles in the head itself: where, across and down it, and how big. */
  private readonly headDots = Array.from({ length: 30 }, () => ({
    across: Math.random(),
    down: Math.random(),
    size: 0.5 + Math.random() * 0.8,
  }));

  constructor(scene: Phaser.Scene, depth: number) {
    const x = GLASS.x - GLASS_ART.width / 2;
    const y = GLASS.top - GLASS_ART.above;
    const shadow = scene.add
      .image(GLASS.x - 70, GLASS.bottom - 6, TextureKey.Shadow)
      .setOrigin(0, 0);
    const back = scene.add.image(x, y, TextureKey.GlassBack).setOrigin(0, 0);
    this.stout = scene.add.image(x, y, TextureKey.Stout).setOrigin(0, 0).setVisible(false);
    this.body = scene.add.graphics();
    this.mark = scene.add.graphics();
    const front = scene.add.image(x, y, TextureKey.Glass).setOrigin(0, 0);
    this.container = scene.add
      .container(0, 0, [shadow, back, this.stout, this.body, this.mark, front])
      .setDepth(depth);
  }

  /** Where the middle of the glass is across the screen. */
  get centre(): number {
    return GLASS.x + this.container.x;
  }

  setCentre(x: number): void {
    this.container.x = x - GLASS.x;
  }

  setVisible(visible: boolean): void {
    this.container.setVisible(visible);
  }

  /** The drink and its head, as full as `fill` pixels, and the bubbles running down it for a while after a pour. */
  drawLiquid(
    fill: number,
    flow: number,
    colours: { liquid: number; head: number },
    sincePourMs: number,
    deltaMs: number,
  ): void {
    const g = this.body;
    g.clear();
    if (fill < 0.5) {
      this.stout.setVisible(false);
      return;
    }
    // Show the bottom `fill` pixels of the drink.
    this.stout.setVisible(true).setCrop(0, STOUT_BOTTOM - fill, GLASS_ART.width, fill);

    const { head } = colours;
    const cx = GLASS.x;
    const bottomY = GLASS.bottom;
    const topY = bottomY - fill;
    const widthAt = (y: number): number =>
      glassWidthAt(bottomY - y, GLASS_HEIGHT, GLASS.bottomInner, GLASS.topInner);
    const headHeight = Math.min(fill, 7 + Math.min(4, flow * 0.05));
    const cascade = Math.max(0, 1 - sincePourMs / CASCADE.afterMs);
    const tan = mixHex(head, 0x6b4a26, 0.55);

    // The cloudy surge under the head: tan that thins out as it goes down, and clears over time.
    if (cascade > 0 && fill > headHeight + 6) {
      const depth = Math.min(fill - headHeight, SURGE.depth);
      const slice = depth / SURGE.slices;
      for (let index = 0; index < SURGE.slices; index += 1) {
        const y = topY + headHeight + index * slice;
        const width = widthAt(y) - 3;
        g.fillStyle(tan, 0.55 * cascade * Math.pow(1 - index / SURGE.slices, 1.3));
        g.fillRect(cx - width / 2, y, width, slice + 0.5);
      }
    }

    // The bubbles of the surge, running down the walls and thinning out into the body.
    if (cascade > 0 && fill > 16) {
      const seconds = deltaMs / 1000;
      g.fillStyle(mixHex(head, tan, 0.3), 0.8 * Math.min(1, cascade * 1.5));
      for (const bubble of this.bubbles) {
        bubble.down += bubble.speed * seconds;
        if (bubble.down > 1) {
          bubble.down = 0;
          bubble.across = Math.random();
        }
        const y = topY + headHeight + bubble.down * (fill - headHeight - 4);
        const width = widthAt(y);
        const side = bubble.across < 0.5 ? -1 : 1;
        const x = cx + side * (width / 2 - 2 - (bubble.across % 0.5) * 11);
        g.fillRect(Math.round(x), Math.round(y), 1, 2);
      }
    }

    // The head, in bands: a bright top, cream, then tan where it meets the drink.
    const bands = [
      mixHex(head, 0xffffff, 0.35),
      head,
      mixHex(head, 0x000000, 0.06),
      mixHex(head, 0x8a6a3c, 0.28),
    ];
    const bandHeight = headHeight / bands.length;
    bands.forEach((colour, index) => {
      const y = topY + index * bandHeight;
      const width = widthAt(y);
      g.fillStyle(colour, 1);
      g.fillRect(cx - width / 2, y, width, bandHeight + 0.5);
    });
    // Little bubbles in the foam, light and dark, and its ragged lower edge.
    for (const dot of this.headDots) {
      const y = topY + 1 + dot.down * (headHeight - 2);
      const width = widthAt(y);
      g.fillStyle(dot.down < 0.5 ? 0xffffff : 0x8a6a3c, dot.down < 0.5 ? 0.35 : 0.22);
      g.fillCircle(cx + (dot.across - 0.5) * (width - 4), y, dot.size);
    }
    const wBottom = widthAt(topY + headHeight);
    g.fillStyle(mixHex(head, 0x8a6a3c, 0.3), 1);
    this.froth.forEach((offset, index) => {
      const x = cx - wBottom / 2 + (wBottom * (index + 0.5)) / this.froth.length;
      g.fillCircle(x, topY + headHeight + offset * 1.8, 1.5 + offset * 1.2);
    });

    // The top of it, seen from a little above: a ring of foam round a pale middle, and a gleam.
    const wTop = widthAt(topY);
    g.fillStyle(mixHex(head, 0x000000, 0.1), 1);
    g.fillEllipse(cx, topY, wTop + 1, 5.5);
    g.fillStyle(bands[0], 1);
    g.fillEllipse(cx, topY - 0.3, wTop - 3, 4);
    g.fillStyle(0xffffff, 0.5);
    g.fillEllipse(cx - wTop * 0.14, topY - 0.8, wTop * 0.5, 1.8);
  }

  /** The mark on the glass: a band the width it counts for, a bright line down its middle, and where it stopped. */
  drawMark(centre: number, band: number, colour: number, stoppedAt: number | null): void {
    const g = this.mark;
    g.clear();
    const y = GLASS.bottom - centre;
    const width = glassWidthAt(centre, GLASS_HEIGHT, GLASS.bottomInner, GLASS.topInner);
    const left = GLASS.x - width / 2;

    g.fillStyle(colour, 0.2);
    g.fillRect(left, y - band, width, band * 2);
    g.fillStyle(colour, 0.85);
    g.fillRect(left, y - band, width, 1);
    g.fillRect(left, y + band, width, 1);
    g.fillStyle(0xffffff, 0.95);
    g.fillRect(left - 2, y, width + 4, 1);
    // Arrows outside the glass, pointing at the middle of the mark.
    g.fillStyle(colour, 1);
    g.fillTriangle(left - 16, y - 5, left - 16, y + 5, left - 5, y);
    g.fillTriangle(left + width + 16, y - 5, left + width + 16, y + 5, left + width + 5, y);

    if (stoppedAt !== null) {
      const stopY = GLASS.bottom - stoppedAt;
      g.fillStyle(0xff5a4a, 0.95);
      g.fillRect(left - 6, stopY, width + 12, 1);
    }
  }
}
