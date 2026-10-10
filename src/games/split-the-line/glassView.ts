/**
 * One glass on the bar: the stout and its head and bubbles, the mark on the glass, and the glass's
 * own picture over them, all in one thing that slides along the bar. The scene asks it to draw
 * what is in it and where the mark is, and moves it with `setCentre`.
 */
import Phaser from 'phaser';
import { GLASS_ART } from './art';
import { GLASS, GLASS_HEIGHT, TextureKey } from './config';
import { glassWidthAt } from './logic';

/** The bubbles that run down the inside of a pint of stout after the pour: how many, and for how long. */
const CASCADE = { count: 40, afterMs: 3200 } as const;

export class GlassView {
  readonly container: Phaser.GameObjects.Container;

  private readonly liquid: Phaser.GameObjects.Graphics;
  private readonly mark: Phaser.GameObjects.Graphics;
  /** Each bubble's place across the glass, how far down it has run, and how fast. */
  private readonly bubbles = Array.from({ length: CASCADE.count }, () => ({
    across: Math.random(),
    down: Math.random(),
    speed: 0.12 + Math.random() * 0.3,
  }));
  /** Where along the head's underside each little bubble sits, so the edge looks frothy. */
  private readonly froth = Array.from({ length: 14 }, () => Math.random());

  constructor(scene: Phaser.Scene, depth: number) {
    this.liquid = scene.add.graphics();
    this.mark = scene.add.graphics();
    const front = scene.add
      .image(GLASS.x - GLASS_ART.width / 2, GLASS.top - GLASS_ART.above, TextureKey.Glass)
      .setOrigin(0, 0);
    this.container = scene.add.container(0, 0, [this.liquid, this.mark, front]).setDepth(depth);
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

  /** The stout, its head, and the bubbles running down it (for a while after a pour). */
  drawLiquid(
    fill: number,
    flow: number,
    colours: { liquid: number; head: number },
    sincePourMs: number,
    deltaMs: number,
  ): void {
    const g = this.liquid;
    g.clear();
    if (fill < 0.5) return;
    const { liquid, head } = colours;
    const cx = GLASS.x;
    const bottomY = GLASS.bottom;
    const topY = bottomY - fill;
    const wBottom = GLASS.bottomInner;
    const wTop = glassWidthAt(fill, GLASS_HEIGHT, GLASS.bottomInner, GLASS.topInner);

    // The body: nearly black, with a ruby edge where the light comes through at the left.
    g.fillStyle(liquid, 1);
    g.fillTriangle(cx - wBottom / 2, bottomY, cx + wBottom / 2, bottomY, cx + wTop / 2, topY);
    g.fillTriangle(cx - wBottom / 2, bottomY, cx + wTop / 2, topY, cx - wTop / 2, topY);
    g.fillStyle(0x6b2a14, 0.4);
    g.fillTriangle(
      cx - wBottom / 2,
      bottomY,
      cx - wBottom / 2 + 3,
      bottomY,
      cx - wTop / 2 + 3,
      topY,
    );
    g.fillTriangle(cx - wBottom / 2, bottomY, cx - wTop / 2 + 3, topY, cx - wTop / 2, topY);

    // The bubbles of the surge, running down the inside: only after a pour, and fading away.
    const cascade = Math.max(0, 1 - sincePourMs / CASCADE.afterMs);
    if (cascade > 0 && fill > 16) {
      const seconds = deltaMs / 1000;
      g.fillStyle(head, 0.75 * Math.min(1, cascade * 1.5));
      for (const bubble of this.bubbles) {
        bubble.down += bubble.speed * seconds;
        if (bubble.down > 1) {
          bubble.down = 0;
          bubble.across = Math.random();
        }
        const y = topY + 9 + bubble.down * (fill - 11);
        const width = glassWidthAt(bottomY - y, GLASS_HEIGHT, GLASS.bottomInner, GLASS.topInner);
        // Bubbles run down the walls: the left and the right edges are where they are.
        const x = cx + (bubble.across < 0.5 ? -1 : 1) * (width / 2 - 2 - (bubble.across % 0.5) * 8);
        g.fillRect(Math.round(x), Math.round(y), 1, 2);
      }
    }

    // The head: cream, thick and bubbly at its lower edge, with the surface seen from above.
    const headHeight = Math.min(fill, 6 + Math.min(4, flow * 0.06));
    g.fillStyle(head, 1);
    g.fillRect(cx - wTop / 2, topY, wTop, headHeight);
    this.froth.forEach((offset, index) => {
      const x = cx - wTop / 2 + (wTop * (index + 0.5)) / this.froth.length;
      g.fillCircle(x, topY + headHeight + offset * 2, 2.4);
    });
    g.fillStyle(0xffffff, 0.35);
    g.fillRect(cx - wTop / 2 + 2, topY + 1, wTop - 4, 1);
    g.fillStyle(head, 1);
    g.fillEllipse(cx, topY, wTop, 5);
    g.fillStyle(0xfff8e6, 0.7);
    g.fillEllipse(cx - wTop * 0.12, topY - 0.5, wTop * 0.6, 2.6);
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
