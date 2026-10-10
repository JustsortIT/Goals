import Phaser from 'phaser';
import { FONT_SIZE, GAME_WIDTH } from '../../../shell/constants';
import { addPixelText, centerPixelText } from '../../../shell/pixelFont';
import { CUSTOMER_ART } from '../artMini';
import { sfx } from '../audio';
import {
  COLOUR,
  customerKey,
  DATA_KEY,
  LOOKS,
  pintKey,
  SceneKey,
  SERVE,
  TextureKey,
  THROW,
} from '../config';
import type { GameData } from '../gameData';
import { returnToPlay } from '../mini';
import { moodOf, ServeRun, serveRound, slideTimeMs, type Customer, type Mood } from '../serve';

export interface ServeData {
  /** The number of the pint the bonus came after. */
  number: number;
}

/** One place at the bar: the customer there, and what is drawn for them. */
interface Place {
  x: number;
  sprite: Phaser.GameObjects.Image;
  want: Phaser.GameObjects.Image;
  customer: Customer | null;
  /** Nothing is drawn for them: they have not come, or have gone. */
  shown: boolean;
}

const HEAD_TOP = SERVE.standY - CUSTOMER_ART.height;
const EYE_Y = HEAD_TOP + CUSTOMER_ART.eyeY;
const MOUTH_Y = HEAD_TOP + CUSTOMER_ART.mouthY;
const BUBBLE = { top: 54, height: 44, half: 17 } as const;
const BROW = 0x2a1c12;

/**
 * The serving bonus: customers come up to the bar one after another, each wanting stout, lager or
 * red ale, and a pint is always ready for someone who is waiting. A tap on the customer who wants
 * it sends it sliding along the bar to them; a tap on the wrong one wastes the pint and costs them
 * patience. It plays while the Play scene is paused and gives it the result. It never costs a life.
 */
export class Serve extends Phaser.Scene {
  private run!: ServeRun;
  private number = 1;
  private places: Place[] = [];
  private ui!: Phaser.GameObjects.Graphics;
  private front!: Phaser.GameObjects.Image;
  private scoreText!: Phaser.GameObjects.BitmapText;
  private lostText!: Phaser.GameObjects.BitmapText;
  private titleText!: Phaser.GameObjects.BitmapText;
  private hintText!: Phaser.GameObjects.BitmapText;
  private finished = false;

  constructor() {
    super(SceneKey.Serve);
  }

  // The scene object is used again each time, so everything is set afresh here.
  init(data: ServeData): void {
    this.number = data.number;
    this.places = [];
    this.finished = false;
  }

  create(): void {
    const data = this.registry.get(DATA_KEY) as GameData;
    const settings = data.bonus?.serve;
    if (!settings) throw new Error('The serving bonus has no settings.');
    this.run = new ServeRun(serveRound(this.number, settings));

    this.add.image(0, 0, TextureKey.BackdropRoom).setOrigin(0, 0);
    this.ui = this.add.graphics().setDepth(5);
    this.places = SERVE.slots.map((x) => {
      const sprite = this.add
        .image(x, SERVE.standY, customerKey(0))
        .setOrigin(0.5, 1)
        .setDepth(2)
        .setVisible(false);
      const want = this.add
        .image(x, BUBBLE.top + 20, pintKey(0))
        .setDepth(6)
        .setScale(0.8)
        .setVisible(false);
      return { x, sprite, want, customer: null, shown: false };
    });
    // The pint that is ready, at the foot of the bar on the left, and the tray it is pulled on.
    this.front = this.add
      .image(-30, SERVE.barY, pintKey(0))
      .setDepth(4)
      .setScale(1.25)
      .setVisible(false);
    this.add.image(0, 0, TextureKey.Vignette).setOrigin(0, 0).setDepth(7);

    this.add.rectangle(0, 0, GAME_WIDTH, 16, 0x050301, 0.66).setOrigin(0, 0).setDepth(8);
    this.add.rectangle(0, 16, GAME_WIDTH, 1, COLOUR.gold, 0.4).setOrigin(0, 0).setDepth(8);
    this.scoreText = addPixelText(this, 8, 4, '').setDepth(9);
    this.titleText = addPixelText(this, 0, 4, 'SERVE THE PINTS').setDepth(9).setTint(COLOUR.gold);
    centerPixelText(this.titleText, GAME_WIDTH / 2, 9);
    this.lostText = addPixelText(this, 0, 4, '').setDepth(9);
    this.hintText = addPixelText(this, 0, 0, 'TAP WHO WANTS IT', FONT_SIZE.small)
      .setDepth(9)
      .setTint(COLOUR.gold);
    centerPixelText(this.hintText, GAME_WIDTH / 2, 252);
    this.tweens.add({
      targets: this.hintText,
      alpha: { from: 1, to: 0.4 },
      duration: 600,
      yoyo: true,
      repeat: -1,
    });

    this.showHud();
    this.input.on(Phaser.Input.Events.POINTER_DOWN, (pointer: Phaser.Input.Pointer) =>
      this.tapAt(pointer.x, pointer.y),
    );
    // While making it: the keys 1 to 4 serve the places from the left.
    this.input.keyboard?.on('keydown', (event: KeyboardEvent) => {
      const slot = Number(event.key) - 1;
      if (slot >= 0 && slot < SERVE.slots.length) this.serveSlot(slot);
    });
  }

  override update(_time: number, delta: number): void {
    if (this.finished) return;
    this.run.update(Math.min(delta, 100));
    for (const event of this.run.drain()) this.show(event);
    this.draw();
    this.showHud();

    if (this.run.finished) this.finish();
  }

  /* ----------------------------------------------------------------------------------------
   * Input
   * -------------------------------------------------------------------------------------- */

  private tapAt(x: number, y: number): void {
    if (this.finished || y < SERVE.hitTop) return;
    const slot = this.places.findIndex((place) => Math.abs(place.x - x) <= SERVE.hitHalf);
    if (slot >= 0) this.serveSlot(slot);
  }

  private serveSlot(slot: number): void {
    if (this.finished) return;
    const place = this.places[slot];
    const pint = this.run.pint;
    const result = this.run.tap(slot);
    if (result === 'none' || !pint) return;
    // The pint leaves the tray, and slides along the bar to them.
    this.front.setVisible(false);
    this.slide(pint.kind, place, result === 'served');
  }

  /* ----------------------------------------------------------------------------------------
   * What the rules say happened
   * -------------------------------------------------------------------------------------- */

  private show(event: ReturnType<ServeRun['drain']>[number]): void {
    switch (event.type) {
      case 'arrive': {
        const place = this.places[event.customer.slot];
        place.customer = event.customer;
        place.shown = true;
        sfx.play('arrive');
        // Each customer has a look of their own, different from the one before.
        place.sprite
          .setTexture(customerKey((event.customer.id * 3 + this.number) % LOOKS))
          .setVisible(true)
          .setAlpha(0)
          .setTint(0xffffff)
          .setPosition(place.x, SERVE.standY + 14);
        this.tweens.add({
          targets: place.sprite,
          alpha: 1,
          y: SERVE.standY,
          duration: 240,
          ease: 'Quad.easeOut',
        });
        place.want.setTexture(pintKey(event.customer.wants)).setVisible(true).setAlpha(1);
        break;
      }
      case 'pint':
        this.front
          .setTexture(pintKey(event.kind))
          .setVisible(true)
          .setAlpha(1)
          .setPosition(-24, SERVE.barY);
        this.tweens.add({
          targets: this.front,
          x: SERVE.pullX,
          duration: 150,
          ease: 'Quad.easeOut',
        });
        break;
      case 'pintLost':
        this.front.setVisible(false);
        break;
      case 'served': {
        const place = this.places[event.customer.slot];
        // They are happy as soon as the pint is on its way; it takes a moment to arrive.
        this.time.delayedCall(slideTimeMs(place.x), () => {
          this.pop(`+${event.points}`, place.x, HEAD_TOP + 4, COLOUR.gold);
          this.leave(place, 0xffffff);
        });
        this.hintText.setVisible(false);
        place.want.setVisible(false);
        break;
      }
      case 'wrong': {
        const place = this.places[event.customer.slot];
        this.time.delayedCall(slideTimeMs(place.x), () => {
          this.pop('NO', place.x, HEAD_TOP + 4, COLOUR.bad);
          sfx.play('buzz');
          this.tweens.add({
            targets: place.sprite,
            x: { from: place.x - 3, to: place.x + 3 },
            duration: 55,
            yoyo: true,
            repeat: 3,
            onComplete: () => place.sprite.setX(place.x),
          });
        });
        break;
      }
      case 'left': {
        const place = this.places[event.customer.slot];
        place.want.setVisible(false);
        sfx.play('buzz');
        this.leave(place, 0xff8a7a);
        break;
      }
    }
  }

  /** A pint slides along the bar to a place, and is taken, or refused and left to fall off the bar. */
  private slide(kind: number, place: Place, accepted: boolean): void {
    const pint = this.add.image(SERVE.pullX, SERVE.barY, pintKey(kind)).setDepth(4).setScale(1.25);
    sfx.play('slide');
    this.tweens.add({
      targets: pint,
      x: place.x,
      duration: slideTimeMs(place.x),
      ease: 'Quad.easeOut',
      onComplete: () => {
        if (accepted) {
          sfx.play('clink');
          // The customer takes it up: it rises to them and goes.
          this.tweens.add({
            targets: pint,
            y: HEAD_TOP + 70,
            alpha: 0,
            duration: 420,
            ease: 'Quad.easeIn',
            onComplete: () => pint.destroy(),
          });
        } else {
          // Refused: it goes over the front of the bar.
          this.tweens.add({
            targets: pint,
            y: pint.y + 34,
            alpha: 0,
            angle: 24,
            duration: 360,
            ease: 'Quad.easeIn',
            onComplete: () => pint.destroy(),
          });
        }
      },
    });
  }

  /** A customer who has been served, or has given up, goes: faded, and in the colour of how they feel. */
  private leave(place: Place, tint: number): void {
    place.sprite.setTint(tint);
    this.tweens.add({
      targets: place.sprite,
      alpha: 0,
      y: SERVE.standY + 10,
      duration: SERVE.leaveMs,
      delay: 220,
      ease: 'Quad.easeIn',
      onComplete: () => {
        place.shown = false;
        place.sprite.setVisible(false);
      },
    });
  }

  /* ----------------------------------------------------------------------------------------
   * Drawing: the speech bubbles, the patience bars, the faces, the tray
   * -------------------------------------------------------------------------------------- */

  private draw(): void {
    const g = this.ui;
    g.clear();

    // The tray the next pint comes on: dark rubber with a steel edge.
    g.fillStyle(0x000000, 0.35);
    g.fillRoundedRect(SERVE.pullX - 22, SERVE.barY + 17, 44, 9, 3);
    g.fillStyle(0x15161a, 1);
    g.fillRoundedRect(SERVE.pullX - 21, SERVE.barY + 15, 42, 8, 3);
    g.lineStyle(1, 0x9aa3ab, 0.9);
    g.strokeRoundedRect(SERVE.pullX - 21, SERVE.barY + 15, 42, 8, 3);

    for (const place of this.places) {
      const { customer } = place;
      if (!customer || !place.shown || !place.sprite.visible || place.sprite.alpha < 0.02) continue;
      const alpha = place.sprite.alpha;
      // The drink they want fades in and out with them.
      place.want.setAlpha(customer.state === 'waiting' ? alpha : 0);
      const waiting = customer.state === 'waiting';
      if (waiting) this.bubble(g, place, customer, alpha);
      this.face(g, place.x, moodOf(customer), alpha);
    }
  }

  /** The bubble over a customer's head: the drink they want, and how much patience they have left. */
  private bubble(
    g: Phaser.GameObjects.Graphics,
    place: Place,
    customer: Customer,
    alpha: number,
  ): void {
    const { x } = place;
    const left = x - BUBBLE.half;
    g.fillStyle(0x000000, 0.3 * alpha);
    g.fillRoundedRect(left + 1, BUBBLE.top + 2, BUBBLE.half * 2, BUBBLE.height, 6);
    g.fillStyle(0xfaf6ea, alpha);
    g.fillRoundedRect(left, BUBBLE.top, BUBBLE.half * 2, BUBBLE.height, 6);
    g.fillTriangle(
      x - 5,
      BUBBLE.top + BUBBLE.height - 1,
      x + 5,
      BUBBLE.top + BUBBLE.height - 1,
      x,
      BUBBLE.top + BUBBLE.height + 7,
    );
    g.lineStyle(1, 0x3a2a1a, 0.5 * alpha);
    g.strokeRoundedRect(left, BUBBLE.top, BUBBLE.half * 2, BUBBLE.height, 6);

    // The patience bar, green going to amber going to red, at the foot of the bubble.
    const share = Math.max(0, Math.min(1, customer.leftMs / customer.patienceMs));
    const colour = share > 0.55 ? 0x3aa655 : share > 0.25 ? 0xe0a63a : 0xd6342a;
    g.fillStyle(0x2a2118, 0.35 * alpha);
    g.fillRect(left + 5, BUBBLE.top + BUBBLE.height - 8, BUBBLE.half * 2 - 10, 3);
    g.fillStyle(colour, alpha);
    g.fillRect(left + 5, BUBBLE.top + BUBBLE.height - 8, (BUBBLE.half * 2 - 10) * share, 3);
  }

  /** The eyebrows and mouth for how a customer feels. */
  private face(g: Phaser.GameObjects.Graphics, x: number, mood: Mood, alpha: number): void {
    // How far each eyebrow's inner end is raised (negative is lowered), and the shape of the mouth.
    const slant = mood === 'angry' ? -3.2 : mood === 'annoyed' ? -1.4 : mood === 'happy' ? 1.2 : 0;
    const lift = mood === 'happy' ? -1.2 : 0;
    g.lineStyle(1.6, BROW, alpha);
    for (const side of [-1, 1]) {
      const inner = x + side * 2.6;
      const outer = x + side * 9.8;
      g.lineBetween(
        inner,
        EYE_Y - 5.5 - slant + lift,
        outer,
        EYE_Y - 5.5 + (slant > 0 ? -slant * 0.6 : 0) + lift,
      );
    }
    g.lineStyle(1.4, 0x5a2a22, alpha);
    g.beginPath();
    if (mood === 'happy') g.arc(x, MOUTH_Y - 3, 5.5, 0.25, Math.PI - 0.25);
    else if (mood === 'angry') g.arc(x, MOUTH_Y + 4, 4.8, Math.PI + 0.4, Math.PI * 2 - 0.4);
    else if (mood === 'annoyed') {
      g.moveTo(x - 3.5, MOUTH_Y + 1);
      g.lineTo(x + 3.5, MOUTH_Y + 1);
    } else g.arc(x, MOUTH_Y - 1, 3.5, 0.5, Math.PI - 0.5);
    g.strokePath();
  }

  /** A word rising from a point. */
  private pop(words: string, x: number, y: number, tint: number): void {
    const text = addPixelText(this, 0, 0, words, FONT_SIZE.medium).setDepth(10).setTint(tint);
    centerPixelText(text, x, y);
    this.tweens.add({
      targets: text,
      y: text.y - 18,
      alpha: 0,
      duration: 800,
      ease: 'Quad.easeOut',
      onComplete: () => text.destroy(),
    });
  }

  private showHud(): void {
    this.scoreText.setText(`SERVED ${this.run.served} OF ${this.run.round.needed}`);
    this.lostText.setText(`LOST ${this.run.missed}`);
    this.lostText.setX(GAME_WIDTH - 8 - this.lostText.width);
    this.lostText.setTint(this.run.missed > 0 ? COLOUR.bad : 0xffffff);
  }

  /** Every customer has been served or has gone: show how it came out, then go back to the play. */
  private finish(): void {
    if (this.finished) return;
    this.finished = true;
    const cleared = this.run.cleared;
    const points = this.run.points;
    // A moment for the last customer to go.
    this.time.delayedCall(900, () => {
      this.add
        .rectangle(GAME_WIDTH / 2, 130, 210, 34, 0x050301, 0.8)
        .setStrokeStyle(1, COLOUR.gold, 0.55)
        .setDepth(11);
      const words = addPixelText(
        this,
        0,
        0,
        `SERVED ${this.run.served} OF ${this.run.customers.length}  ${cleared ? 'CLEARED' : 'SHORT'}`,
        FONT_SIZE.small,
      )
        .setDepth(12)
        .setTint(cleared ? COLOUR.gold : COLOUR.bad);
      centerPixelText(words, GAME_WIDTH / 2, 130);
      sfx.play(cleared ? 'clear' : 'miss');
      this.time.delayedCall(THROW.resultMs, () => returnToPlay(this, { points, cleared }));
    });
  }
}
