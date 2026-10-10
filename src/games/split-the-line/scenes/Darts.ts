import Phaser from 'phaser';
import { FONT_SIZE, GAME_HEIGHT, GAME_WIDTH } from '../../../shell/constants';
import { addPixelText, centerPixelText } from '../../../shell/pixelFont';
import { sfx } from '../audio';
import { BOARD, COLOUR, DATA_KEY, SceneKey, TextureKey, THROW } from '../config';
import {
  BOARD_ORDER,
  crosshairAt,
  dartHit,
  dartsCleared,
  dartsPoints,
  dartsRound,
  hitName,
  type DartsRound,
} from '../darts';
import type { GameData } from '../gameData';
import { returnToPlay } from '../mini';

export interface DartsData {
  /** The number of the pint the bonus came after. */
  number: number;
}

type Phase = 'aim' | 'flying' | 'done';

/** Where a thrown dart starts from: the bottom of the screen, the middle. */
const FROM = { x: GAME_WIDTH / 2, y: GAME_HEIGHT + 30 } as const;

/**
 * The darts bonus: a crosshair sways over the board, and a tap throws a dart where it is. Three
 * darts have to add up to the target. It plays while the Play scene is paused, and gives it the
 * result when it is over. It never costs a life.
 */
export class Darts extends Phaser.Scene {
  private data_!: GameData;
  private round!: DartsRound;
  private number = 1;
  private crosshair!: Phaser.GameObjects.Graphics;
  private scoreText!: Phaser.GameObjects.BitmapText;
  private timeText!: Phaser.GameObjects.BitmapText;
  private needText!: Phaser.GameObjects.BitmapText;
  private hintText!: Phaser.GameObjects.BitmapText;
  private popText!: Phaser.GameObjects.BitmapText;
  private icons: Phaser.GameObjects.Image[] = [];

  private finished = false;
  private phase: Phase = 'aim';
  private thrown = 0;
  private total = 0;
  private timeMs = 0;

  constructor() {
    super(SceneKey.Darts);
  }

  // The scene object is used again each time, so everything is set afresh here.
  init(data: DartsData): void {
    this.number = data.number;
    this.phase = 'aim';
    this.thrown = 0;
    this.total = 0;
    this.timeMs = 0;
    this.finished = false;
    this.icons = [];
  }

  create(): void {
    this.data_ = this.registry.get(DATA_KEY) as GameData;
    const settings = this.data_.bonus?.darts;
    if (!settings) throw new Error('The darts bonus has no settings.');
    this.round = dartsRound(this.number, settings);

    this.add.image(0, 0, TextureKey.BackdropWall).setOrigin(0, 0);
    // The board hangs on the wall, with a soft shadow behind it.
    this.add.circle(BOARD.x + 3, BOARD.y + 5, BOARD.outer, 0x000000, 0.4).setDepth(1);
    this.add.image(BOARD.x, BOARD.y, TextureKey.Board).setDepth(2);
    this.writeNumbers();

    this.crosshair = this.add.graphics().setDepth(6);
    this.add.image(0, 0, TextureKey.Vignette).setOrigin(0, 0).setDepth(7);

    // The status bar, as in the Play scene.
    this.add.rectangle(0, 0, GAME_WIDTH, 16, 0x050301, 0.66).setOrigin(0, 0).setDepth(8);
    this.add.rectangle(0, 16, GAME_WIDTH, 1, COLOUR.gold, 0.4).setOrigin(0, 0).setDepth(8);
    this.scoreText = addPixelText(this, 8, 4, '').setDepth(9);
    this.timeText = addPixelText(this, 0, 4, '').setDepth(9).setTint(COLOUR.gold);
    this.needText = addPixelText(this, 8, 22, '').setDepth(9).setTint(COLOUR.quiet);
    this.hintText = addPixelText(this, 0, 0, 'TAP TO THROW', FONT_SIZE.small)
      .setDepth(9)
      .setTint(COLOUR.gold);
    centerPixelText(this.hintText, 60, 150);
    this.popText = addPixelText(this, 0, 0, '', FONT_SIZE.medium).setDepth(10).setVisible(false);

    // One small dart for each throw there is, dimmed as they are thrown.
    for (let dart = 0; dart < this.round.throws; dart += 1) {
      const x = GAME_WIDTH / 2 + (dart - (this.round.throws - 1) / 2) * 18;
      this.icons.push(this.add.image(x, 8, TextureKey.DartStuck).setDepth(9).setScale(0.8));
    }
    this.tweens.add({
      targets: this.hintText,
      alpha: { from: 1, to: 0.4 },
      duration: 600,
      yoyo: true,
      repeat: -1,
    });

    this.showHud();
    this.input.on(Phaser.Input.Events.POINTER_DOWN, () => this.throwDart());
    this.input.keyboard?.on('keydown-SPACE', () => this.throwDart());
  }

  override update(_time: number, delta: number): void {
    if (this.phase === 'done') return;
    this.timeMs += delta;
    // The clock ends the round, whether or not a dart is in the air.
    if (this.timeMs >= this.round.timeMs && this.phase === 'aim') {
      this.finish();
      return;
    }
    this.drawCrosshair();
    this.showHud();
  }

  /** The numbers round the board, written by the game in the pixel font. */
  private writeNumbers(): void {
    BOARD_ORDER.forEach((number, index) => {
      const angle = (index * Math.PI) / 10;
      const text = addPixelText(this, 0, 0, String(number), FONT_SIZE.small).setDepth(3);
      centerPixelText(
        text,
        BOARD.x + Math.sin(angle) * BOARD.numbers,
        BOARD.y - Math.cos(angle) * BOARD.numbers,
      );
    });
  }

  private aim(): { x: number; y: number } {
    const spot = crosshairAt(this.timeMs, this.round.periodMs);
    return { x: BOARD.x + spot.x, y: BOARD.y + spot.y };
  }

  /** The crosshair: a ring with ticks and a red dot, over a dark ring so it shows on any colour. */
  private drawCrosshair(): void {
    const g = this.crosshair;
    g.clear();
    if (this.phase !== 'aim') return;
    const { x, y } = this.aim();
    for (const [colour, width, grow] of [
      [0x000000, 3, 0.5],
      [0xffffff, 1.4, 0],
    ] as const) {
      g.lineStyle(width, colour, 0.9);
      g.strokeCircle(x, y, 7 + grow);
      g.lineBetween(x - 12 - grow, y, x - 4, y);
      g.lineBetween(x + 4, y, x + 12 + grow, y);
      g.lineBetween(x, y - 12 - grow, x, y - 4);
      g.lineBetween(x, y + 4, x, y + 12 + grow);
    }
    g.fillStyle(0xff3b2e, 1);
    g.fillCircle(x, y, 1.6);
  }

  /** Throws a dart to where the crosshair is now. */
  private throwDart(): void {
    if (this.phase !== 'aim' || this.thrown >= this.round.throws) return;
    this.phase = 'flying';
    this.hintText.setVisible(false);
    const target = this.aim();
    sfx.play('throw');
    this.drawCrosshair();

    const dart = this.add
      .image(FROM.x, FROM.y, TextureKey.DartFlying)
      .setOrigin(0.5, 0)
      .setDepth(5);
    this.tweens.addCounter({
      from: 0,
      to: 1,
      duration: THROW.flightMs,
      ease: 'Sine.easeOut',
      onUpdate: (tween) => {
        const p = tween.getValue() ?? 0;
        dart.setPosition(FROM.x + (target.x - FROM.x) * p, FROM.y + (target.y - FROM.y) * p);
        // Going away it gets smaller, and leans over towards where it is going.
        dart.setScale(THROW.startScale + (THROW.landScale - THROW.startScale) * p);
        dart.setRotation(((target.x - FROM.x) / 600) * (1 - p));
      },
      onComplete: () => this.land(dart, target),
    });
  }

  /** The dart has hit the board: score it, and show which. */
  private land(dart: Phaser.GameObjects.Image, at: { x: number; y: number }): void {
    dart.destroy();
    const hit = dartHit(at.x - BOARD.x, at.y - BOARD.y);
    this.thrown += 1;
    this.total += hit.score;
    this.icons[this.thrown - 1]?.setAlpha(0.25);

    // The dart stays where it landed, a little different each time as the flights fall.
    if (hit.ring !== 'miss') {
      this.add
        .image(at.x, at.y, TextureKey.DartStuck)
        .setDepth(4)
        .setScale(THROW.landScale)
        .setRotation(Phaser.Math.FloatBetween(-0.6, 0.6));
      sfx.play(hit.ring === 'bull' ? 'bull' : 'stick');
    } else {
      sfx.play('miss');
    }
    const good = hit.ring === 'bull' || hit.ring === 'treble' || hit.score >= 40;
    this.pop(
      hitName(hit),
      at.x,
      at.y,
      hit.ring === 'miss' ? COLOUR.bad : good ? COLOUR.gold : 0xffffff,
    );
    if (hit.ring === 'bull' || hit.ring === 'treble') this.cameras.main.flash(100, 255, 235, 170);
    this.showHud();

    if (this.thrown >= this.round.throws) {
      this.phase = 'done';
      this.time.delayedCall(THROW.pauseMs, () => this.finish());
    } else {
      this.time.delayedCall(THROW.pauseMs * 0.35, () => {
        if (this.phase === 'flying') this.phase = 'aim';
      });
    }
  }

  /** A word rising from where a dart landed. */
  private pop(words: string, x: number, y: number, tint: number): void {
    this.tweens.killTweensOf(this.popText);
    this.popText.setText(words).setTint(tint).setAlpha(1).setVisible(true);
    centerPixelText(
      this.popText,
      Phaser.Math.Clamp(x, 30, GAME_WIDTH - 30),
      Phaser.Math.Clamp(y - 16, 30, GAME_HEIGHT - 20),
    );
    this.tweens.add({
      targets: this.popText,
      y: this.popText.y - 12,
      alpha: 0,
      duration: 700,
      ease: 'Quad.easeOut',
    });
  }

  private showHud(): void {
    this.scoreText.setText(`SCORE ${this.total}`);
    this.needText.setText(`NEED ${this.round.target}`);
    const left = Math.max(0, this.round.timeMs - this.timeMs);
    this.timeText.setText(`TIME ${(left / 1000).toFixed(1)}`);
    this.timeText.setTint(left < 4000 ? COLOUR.bad : COLOUR.gold);
    this.timeText.setX(GAME_WIDTH - 8 - this.timeText.width);
  }

  /** The darts are all thrown, or the time has gone: show how it came out, then go back to the play. */
  private finish(): void {
    if (this.finished) return;
    this.finished = true;
    this.phase = 'done';
    this.crosshair.clear();
    const cleared = dartsCleared(this.total, this.round);
    const points = dartsPoints(this.total, this.number, this.round);
    this.hintText.setVisible(false);

    this.add
      .rectangle(GAME_WIDTH / 2, 238, 188, 30, 0x050301, 0.78)
      .setStrokeStyle(1, COLOUR.gold, 0.55)
      .setDepth(11);
    const words = addPixelText(
      this,
      0,
      0,
      cleared
        ? `${this.total} OF ${this.round.target}  CLEARED`
        : `${this.total} OF ${this.round.target}  SHORT`,
      FONT_SIZE.small,
    )
      .setDepth(12)
      .setTint(cleared ? COLOUR.gold : COLOUR.bad);
    centerPixelText(words, GAME_WIDTH / 2, 238);
    sfx.play(cleared ? 'clear' : 'miss');
    this.time.delayedCall(THROW.resultMs, () => returnToPlay(this, { points, cleared }));
  }
}
