import Phaser from 'phaser';
import { FONT_SIZE, GAME_HEIGHT, GAME_WIDTH, KIOSK } from '../../../shell/constants';
import { continueGate, type KioskState } from '../../../shell/kiosk';
import { addPixelText, centerPixelText } from '../../../shell/pixelFont';
import { GLASS_ART } from '../art';
import { sfx } from '../audio';
import {
  COLOUR,
  DATA_KEY,
  GLASS,
  GLASS_HEIGHT,
  PLAY,
  SceneKey,
  SPOUT,
  TextureKey,
} from '../config';
import { Controls } from '../controls';
import type { GameData } from '../gameData';
import {
  clearsRound,
  glassWidthAt,
  judge,
  newPour,
  roundFor,
  roundPoints,
  stepPour,
  type Pour,
  type Round,
  type Verdict,
} from '../logic';
import { CoinWatch, endPlay, onKiosk } from '../session';
import type { OverData } from './Over';

export interface PlayData {
  lives: number;
}

/**
 * ready: a glass on the bar, waiting for the finger. pouring: the tap is held open. settling: the
 * finger has lifted but the tap is still shutting. result: the pint is judged. sliding: one glass
 * goes and the next comes. waiting: out of lives on a kiosk, counting down for a coin.
 * ending: the play is being closed.
 */
type Phase = 'ready' | 'pouring' | 'settling' | 'result' | 'sliding' | 'waiting' | 'ending';

const VERDICT_WORDS: Record<Verdict, string> = {
  split: 'SPLIT!',
  close: 'CLOSE ENOUGH',
  short: 'SHORT',
  over: 'OVER',
  spill: 'SPILLED',
};

/** The bubbles that run down the inside of a pint of stout after the pour: how many, and for how long. */
const CASCADE = { count: 40, afterMs: 3200 } as const;

/**
 * The game itself: pull a pint. Hold the screen to pour and let go to stop, so the top of the
 * pint comes to rest on the middle of the mark on the glass. The tap does not stop the moment
 * you let go, and it surges as it runs, so the finger has to lift a little early. A pint stopped
 * inside the mark scores and moves the bar on to a harder pour; anything else is a life lost.
 *
 * What is worth keeping when this is replaced with a real game is how it meets the kiosk:
 * lives come from the play that was paid for (`init`), a coin put in at any time adds lives at
 * once (`CoinWatch`), running out of lives starts a count in which a coin carries the same play
 * on, and the play ends once, with one score.
 */
export class Play extends Phaser.Scene {
  private data_!: GameData;
  private controls!: Controls;
  private coins!: CoinWatch;
  private glass!: Phaser.GameObjects.Container;
  private liquid!: Phaser.GameObjects.Graphics;
  private markGfx!: Phaser.GameObjects.Graphics;
  private streamGfx!: Phaser.GameObjects.Graphics;
  private scoreText!: Phaser.GameObjects.BitmapText;
  private roundText!: Phaser.GameObjects.BitmapText;
  private livesText!: Phaser.GameObjects.BitmapText;
  private plaque!: Phaser.GameObjects.Rectangle;
  private bannerText!: Phaser.GameObjects.BitmapText;
  private bannerSub!: Phaser.GameObjects.BitmapText;
  private hintText!: Phaser.GameObjects.BitmapText;
  private hintSub!: Phaser.GameObjects.BitmapText;
  private wash!: Phaser.GameObjects.Rectangle;
  private countText!: Phaser.GameObjects.BitmapText;
  private continueText!: Phaser.GameObjects.BitmapText;

  private phase: Phase = 'ready';
  private score = 0;
  private lives = 0;
  private number = 1;
  private round!: Round;
  private pour: Pour = newPour();
  /** Where the pint stopped, once it has, for the line drawn across the glass. */
  private stoppedAt: number | null = null;
  private idleMs = 0;
  private sincePourMs = Infinity;
  private timeMs = 0;
  private leftMs = 0;
  private balanceCents = 0;
  /** Each bubble's place across the glass, how far down it has run, and how fast. */
  private bubbles: { across: number; down: number; speed: number }[] = [];
  /** Where along the head's underside each little bubble sits, so the edge looks frothy. */
  private froth: number[] = [];

  constructor() {
    super(SceneKey.Play);
  }

  // The scene object is used again for every play, so everything is set afresh here.
  init(data: PlayData): void {
    this.lives = data.lives;
    this.score = 0;
    this.number = 1;
    this.phase = 'ready';
    this.pour = newPour();
    this.stoppedAt = null;
    this.idleMs = 0;
    this.sincePourMs = Infinity;
    this.timeMs = 0;
    this.leftMs = 0;
    this.balanceCents = 0;
  }

  create(): void {
    this.data_ = this.registry.get(DATA_KEY) as GameData;
    this.controls = new Controls(this);
    // The tap that started this play may still be down: it is not a pour.
    this.controls.cancel();

    this.add.image(0, 0, TextureKey.Backdrop).setOrigin(0, 0);
    this.streamGfx = this.add.graphics().setDepth(1.5);

    // The glass is one thing that slides along the bar: the stout, the mark, then the glass.
    this.liquid = this.add.graphics();
    this.markGfx = this.add.graphics();
    const front = this.add
      .image(GLASS.x - GLASS_ART.width / 2, GLASS.top - GLASS_ART.above, TextureKey.Glass)
      .setOrigin(0, 0);
    this.glass = this.add.container(0, 0, [this.liquid, this.markGfx, front]).setDepth(2);

    this.bubbles = Array.from({ length: CASCADE.count }, () => ({
      across: Math.random(),
      down: Math.random(),
      speed: 0.12 + Math.random() * 0.3,
    }));
    this.froth = Array.from({ length: 14 }, () => Math.random());

    this.add.image(0, 0, TextureKey.Vignette).setOrigin(0, 0).setDepth(3.5);
    this.add.rectangle(0, 0, GAME_WIDTH, 16, 0x050301, 0.66).setOrigin(0, 0).setDepth(4);
    this.add.rectangle(0, 16, GAME_WIDTH, 1, COLOUR.gold, 0.4).setOrigin(0, 0).setDepth(4);
    this.scoreText = addPixelText(this, 8, 4, '').setDepth(5);
    this.roundText = addPixelText(this, 0, 4, '').setDepth(5).setTint(COLOUR.gold);
    this.livesText = addPixelText(this, 0, 4, '').setDepth(5);
    // A dark board behind the words, so they can be read against the shelves.
    this.plaque = this.add
      .rectangle(120, 122, 216, 66, 0x050301, 0.62)
      .setStrokeStyle(1, COLOUR.gold, 0.45)
      .setDepth(5.5)
      .setVisible(false);
    this.bannerText = addPixelText(this, 0, 0, '', FONT_SIZE.large)
      .setDepth(6)
      .setTint(COLOUR.gold)
      .setVisible(false);
    this.bannerSub = addPixelText(this, 0, 0, '', FONT_SIZE.medium).setDepth(6).setVisible(false);
    this.hintText = addPixelText(this, 0, 0, 'HOLD TO POUR', FONT_SIZE.medium)
      .setDepth(6)
      .setTint(COLOUR.gold)
      .setVisible(false);
    this.hintSub = addPixelText(this, 0, 0, 'LET GO ON THE MARK')
      .setDepth(6)
      .setTint(COLOUR.quiet)
      .setVisible(false);
    centerPixelText(this.hintText, 120, 118);
    centerPixelText(this.hintSub, 120, 140);
    this.tweens.add({
      targets: [this.hintText, this.hintSub],
      alpha: { from: 1, to: 0.45 },
      duration: 700,
      yoyo: true,
      repeat: -1,
    });

    this.wash = this.add
      .rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, COLOUR.wash, 0.8)
      .setOrigin(0, 0)
      .setDepth(8)
      .setVisible(false);
    this.countText = addPixelText(this, 0, 0, '', FONT_SIZE.title).setDepth(9).setVisible(false);
    this.continueText = addPixelText(this, 0, 0, '', FONT_SIZE.medium)
      .setDepth(9)
      .setVisible(false);

    this.startRound();
    this.showHud();

    this.coins = new CoinWatch(
      (lives) => this.addLives(lives),
      (state) => this.heard(state),
    );
    this.coins.start();
    sfx.ambience(true);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      sfx.pour(0);
      sfx.ambience(false);
      void this.coins.end();
    });
  }

  override update(_time: number, delta: number): void {
    this.controls.update();
    this.timeMs += delta;
    this.sincePourMs += delta;

    if (this.phase === 'ready') {
      this.idleMs = this.controls.holding ? 0 : this.idleMs + delta;
      if (this.controls.holding) this.beginPour();
    } else if (this.phase === 'pouring' || this.phase === 'settling') {
      this.runPour(delta);
    } else if (this.phase === 'waiting') {
      this.leftMs -= delta;
      this.showCount();
      if (this.leftMs <= 0) void this.end(false);
    }

    this.drawStream();
    this.drawGlass();
    const showHint =
      this.phase === 'ready' && (this.number === 1 || this.idleMs > PLAY.hintAfterMs);
    this.hintText.setVisible(showHint);
    this.hintSub.setVisible(showHint);
    this.plaque.setVisible(showHint || this.bannerText.visible);
  }

  /** A fresh glass on the bar, with this round's mark on it. */
  private startRound(): void {
    this.round = roundFor(this.number, this.data_.pour, GLASS_HEIGHT);
    this.pour = newPour();
    this.stoppedAt = null;
    this.sincePourMs = Infinity;
    this.drawMark();
  }

  private beginPour(): void {
    this.phase = 'pouring';
    this.idleMs = 0;
    this.sincePourMs = 0;
  }

  /** Runs the tap for a frame, and ends the pour when the glass is full or the stout has stopped rising. */
  private runPour(delta: number): void {
    const holding = this.phase === 'pouring' && this.controls.holding;
    if (this.phase === 'pouring' && !holding) this.phase = 'settling';
    stepPour(this.pour, holding, delta, this.round, GLASS_HEIGHT);
    this.sincePourMs = 0;
    sfx.pour(this.pour.flow / (this.round.flow * 1.4));

    if (this.pour.fill >= GLASS_HEIGHT) {
      this.finish();
    } else if (this.phase === 'settling' && this.pour.flow < PLAY.stoppedBelow) {
      this.finish();
    }
  }

  /** The pint has stopped: judge it, score it, and show which. */
  private finish(): void {
    sfx.pour(0);
    this.phase = 'result';
    this.stoppedAt = this.pour.fill;
    const { verdict, error } = judge(
      this.pour.fill,
      this.round,
      this.data_.splitTolerance,
      GLASS_HEIGHT,
    );
    const points = roundPoints(verdict, error, this.round, this.data_.points);
    this.score += points;
    const cleared = clearsRound(verdict);
    if (!cleared) this.lives -= 1;
    this.drawMark();

    const words = VERDICT_WORDS[verdict];
    this.say(words, points > 0 ? `+${points}` : 'A LIFE LOST');
    this.bannerText.setTint(cleared ? COLOUR.gold : COLOUR.bad);
    if (verdict === 'split') {
      sfx.play('split');
      this.cameras.main.flash(160, 255, 240, 170);
      this.sparkle(GLASS.x, GLASS.bottom - this.round.centre, [0xffd76a, 0xffffff, 0xffa31a], 34);
    } else if (verdict === 'close') {
      sfx.play('close');
      this.sparkle(GLASS.x, GLASS.bottom - this.round.centre, [0xffd76a, 0xffffff], 14);
    } else if (verdict === 'spill') {
      sfx.play('spill');
      this.spill();
    } else {
      sfx.play('miss');
    }
    this.showHud();
    this.time.delayedCall(PLAY.resultMs, () => this.after(cleared));
  }

  /** After a result: the next glass, a retry of the same one, or the end of the lives. */
  private after(cleared: boolean): void {
    this.say('', '');
    if (!cleared && this.lives <= 0) {
      // With no kiosk there is no coin to wait for.
      if (!onKiosk()) {
        void this.end(false);
        return;
      }
      this.phase = 'waiting';
      sfx.play('over');
      this.leftMs = KIOSK.continueMs;
      this.wash.setVisible(true);
      this.countText.setVisible(true);
      this.continueText.setVisible(true);
      this.showContinue(null);
      this.showCount();
      // What the kiosk holds now, so the count says what is wanted from its first second.
      void this.coins.ask();
      return;
    }

    if (cleared && this.number >= this.data_.rounds) {
      sfx.play('win');
      this.say('LAST ORDERS', 'EVERY PINT POURED');
      this.time.delayedCall(PLAY.winMs, () => void this.end(true));
      return;
    }
    if (cleared) {
      this.number += 1;
      sfx.play('clear');
    }
    this.slideGlass();
  }

  /** The glass slides away along the bar and the next one slides in. */
  private slideGlass(): void {
    this.phase = 'sliding';
    sfx.play('slide');
    this.tweens.add({
      targets: this.glass,
      x: GAME_WIDTH,
      duration: PLAY.slideMs,
      ease: 'Quad.easeIn',
      onComplete: () => {
        this.startRound();
        this.showHud();
        this.glass.x = -GAME_WIDTH;
        this.tweens.add({
          targets: this.glass,
          x: 0,
          duration: PLAY.slideMs,
          ease: 'Quad.easeOut',
          onComplete: () => this.ready(),
        });
      },
    });
  }

  private ready(): void {
    this.phase = 'ready';
    this.idleMs = 0;
    this.controls.cancel();
  }

  /** The stream from the tap to the top of the pint: thicker as the tap opens, with light running down it. */
  private drawStream(): void {
    const g = this.streamGfx;
    g.clear();
    const flow = this.pour.flow;
    const pouring =
      this.phase === 'pouring' || this.phase === 'settling' || this.phase === 'result';
    if (!pouring || flow < 1) return;

    const width = Math.max(1, Math.round(1 + (flow / (this.round.flow * 1.4)) * 5));
    const topY = GLASS.bottom - this.pour.fill;
    const x = SPOUT.x - Math.floor(width / 2);
    const length = topY - SPOUT.y;
    if (length <= 0) return;
    g.fillStyle(this.data_.drink.liquid, 1);
    g.fillRect(x, SPOUT.y, width, length);
    g.fillStyle(0x5a3320, 0.9);
    g.fillRect(x, SPOUT.y, 1, length);
    // Light running down the stream, so it looks like moving liquid.
    g.fillStyle(0xd9b48a, 0.55);
    for (let spot = 0; spot < length; spot += 11) {
      const y = SPOUT.y + ((spot + this.timeMs * 0.32) % length);
      g.fillRect(x + width - 1, y, 1, 3);
    }
    // Foam where it lands.
    g.fillStyle(this.data_.drink.head, 0.7);
    g.fillEllipse(SPOUT.x, topY, width * 2 + 8, 3);
  }

  /** The stout, its head and the bubbles running down it, in the glass. */
  private drawGlass(): void {
    const g = this.liquid;
    g.clear();
    const fill = this.pour.fill;
    if (fill < 0.5) return;
    const { liquid, head } = this.data_.drink;
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
    const cascade = Math.max(0, 1 - this.sincePourMs / CASCADE.afterMs);
    if (cascade > 0 && fill > 16) {
      const seconds = this.game.loop.delta / 1000;
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
    const headHeight = Math.min(fill, 6 + Math.min(4, this.pour.flow * 0.06));
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

  /** The mark on the glass: a band the width it counts for, a bright line down its middle, and the stop. */
  private drawMark(): void {
    const g = this.markGfx;
    g.clear();
    const { colour } = this.data_.mark;
    const y = GLASS.bottom - this.round.centre;
    const { band } = this.round;
    const width = glassWidthAt(this.round.centre, GLASS_HEIGHT, GLASS.bottomInner, GLASS.topInner);
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

    if (this.stoppedAt !== null) {
      const stopY = GLASS.bottom - this.stoppedAt;
      g.fillStyle(0xff5a4a, 0.95);
      g.fillRect(left - 6, stopY, width + 12, 1);
    }
  }

  /** A shower of sparks from a point: a good pour. */
  private sparkle(x: number, y: number, colours: readonly number[], count: number): void {
    for (let piece = 0; piece < count; piece += 1) {
      const angle = Math.random() * Math.PI * 2;
      const reach = 30 + Math.random() * 60;
      const bit = this.add.rectangle(x, y, 2, 2, colours[piece % colours.length]).setDepth(5);
      this.tweens.add({
        targets: bit,
        x: x + Math.cos(angle) * reach,
        y: { value: y + Math.sin(angle) * reach + 24, ease: 'Quad.easeIn' },
        alpha: 0,
        duration: 600 + Math.random() * 300,
        ease: 'Quad.easeOut',
        onComplete: () => bit.destroy(),
      });
    }
  }

  /** Foam and stout over the rim and down the glass. */
  private spill(): void {
    const { head, liquid } = this.data_.drink;
    const y = GLASS.top;
    for (let drop = 0; drop < 34; drop += 1) {
      const side = drop % 2 === 0 ? -1 : 1;
      const startX = GLASS.x + side * (GLASS.topInner / 2 - 2);
      const bit = this.add.rectangle(startX, y, 3, 3, drop % 3 === 0 ? liquid : head).setDepth(5);
      this.tweens.add({
        targets: bit,
        x: startX + side * (4 + Math.random() * 22),
        y: { value: GLASS.bottom + 4 + Math.random() * 8, ease: 'Quad.easeIn' },
        duration: 380 + Math.random() * 260,
        delay: Math.random() * 120,
        onComplete: () => bit.destroy(),
      });
    }
  }

  /** Lives bought by a coin, whenever it went in. In the count, they carry the play on. */
  private addLives(lives: number): void {
    this.lives += lives;
    this.showHud();
    if (this.phase === 'waiting') this.resume();
  }

  private resume(): void {
    this.wash.setVisible(false);
    this.countText.setVisible(false);
    this.continueText.setVisible(false);
    this.slideGlass();
  }

  /** What the kiosk holds, each time it is asked. Credit short of a life is said, and starts the count again. */
  private heard(state: KioskState): void {
    if (this.phase === 'waiting') {
      if (state.balanceCents > this.balanceCents) this.leftMs = KIOSK.continueMs;
      this.showContinue(state);
    }
    this.balanceCents = state.balanceCents;
    // The venue can be silenced at any time.
    sfx.enabled = state.sound;
    sfx.refresh();
  }

  private async end(won: boolean): Promise<void> {
    if (this.phase === 'ending') return;
    this.phase = 'ending';
    // A top-up may be out. Lives it buys were paid for, so the play carries on with them.
    await this.coins.end();
    if (!won && this.lives > 0) {
      this.resume();
      this.coins.start();
      return;
    }
    const finished = await endPlay(this.score);
    this.scene.start(SceneKey.Over, {
      score: this.score,
      rank: finished?.rank ?? null,
      won,
      playId: finished?.id ?? null,
      asksInitials: finished?.asksInitials ?? false,
    } satisfies OverData);
  }

  private showHud(): void {
    this.scoreText.setText(`SCORE ${this.score}`);
    this.roundText.setText(`PINT ${this.number} OF ${this.data_.rounds}`);
    centerPixelText(this.roundText, GAME_WIDTH / 2, 9);
    this.livesText.setText(`LIVES ${this.lives}`);
    this.livesText.setX(GAME_WIDTH - 8 - this.livesText.width);
  }

  private showCount(): void {
    const text = String(Math.max(0, Math.ceil(this.leftMs / 1000)));
    if (this.countText.text === text) return;
    this.countText.setText(text);
    centerPixelText(this.countText, GAME_WIDTH / 2, GAME_HEIGHT * 0.5);
  }

  private showContinue(state: KioskState | null): void {
    const gate = continueGate(state);
    this.continueText.setText(`${gate.prompt}  ${gate.detail}`);
    centerPixelText(this.continueText, GAME_WIDTH / 2, GAME_HEIGHT * 0.28);
  }

  /** Big words over the wall to the left of the glass; empty words clear them. */
  private say(main: string, sub: string): void {
    this.bannerText
      .setText(main)
      .setVisible(main !== '')
      .setTint(COLOUR.gold);
    this.bannerSub.setText(sub).setVisible(sub !== '');
    centerPixelText(this.bannerText, 120, 104);
    centerPixelText(this.bannerSub, 120, 132);
  }
}
