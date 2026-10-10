import Phaser from 'phaser';
import { FONT_SIZE, GAME_HEIGHT, GAME_WIDTH, KIOSK } from '../../../shell/constants';
import { continueGate, type KioskState } from '../../../shell/kiosk';
import { addPixelText, centerPixelText } from '../../../shell/pixelFont';
import { COLOUR, DATA_KEY, PLAY, SceneKey } from '../config';
import { Controls } from '../controls';
import type { Drop, GameData } from '../gameData';
import { everyMs, isCaught, movePaddle, pickDrop } from '../logic';
import { CoinWatch, endPlay, onKiosk } from '../session';
import type { OverData } from './Over';

export interface PlayData {
  lives: number;
}

interface Falling {
  shape: Phaser.GameObjects.Rectangle;
  drop: Drop;
}

/**
 * The game itself: catch what falls. A drop caught scores; one missed costs a life.
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
  private paddle!: Phaser.GameObjects.Rectangle;
  private falling: Falling[] = [];
  private scoreText!: Phaser.GameObjects.BitmapText;
  private livesText!: Phaser.GameObjects.BitmapText;
  private wash!: Phaser.GameObjects.Rectangle;
  private countText!: Phaser.GameObjects.BitmapText;
  private continueText!: Phaser.GameObjects.BitmapText;

  private score = 0;
  private lives = 0;
  private nextDropMs = 0;
  /** Out of lives on a kiosk: counting down for a coin. */
  private waiting = false;
  private leftMs = 0;
  private balanceCents = 0;
  private over = false;

  constructor() {
    super(SceneKey.Play);
  }

  // The scene object is used again for every play, so everything is set afresh here.
  init(data: PlayData): void {
    this.lives = data.lives;
    this.score = 0;
    this.falling = [];
    this.nextDropMs = PLAY.firstEveryMs;
    this.waiting = false;
    this.over = false;
    this.balanceCents = 0;
  }

  create(): void {
    this.data_ = this.registry.get(DATA_KEY) as GameData;
    this.controls = new Controls(this);
    this.paddle = this.add.rectangle(
      GAME_WIDTH / 2,
      PLAY.paddleY,
      PLAY.paddleWidth,
      PLAY.paddleHeight,
      COLOUR.paddle,
    );

    this.scoreText = addPixelText(this, 8, 6, '').setDepth(2);
    this.livesText = addPixelText(this, 0, 6, '').setDepth(2);
    this.wash = this.add
      .rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, COLOUR.wash, 0.8)
      .setOrigin(0, 0)
      .setDepth(3)
      .setVisible(false);
    this.countText = addPixelText(this, 0, 0, '', FONT_SIZE.title).setDepth(4).setVisible(false);
    this.continueText = addPixelText(this, 0, 0, '', FONT_SIZE.medium)
      .setDepth(4)
      .setVisible(false);
    this.showHud();

    this.coins = new CoinWatch(
      (lives) => this.addLives(lives),
      (state) => this.heard(state),
    );
    this.coins.start();
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => void this.coins.end());
  }

  override update(_time: number, delta: number): void {
    if (this.over) return;
    if (this.waiting) {
      this.leftMs -= delta;
      this.showCount();
      if (this.leftMs <= 0) void this.end();
      return;
    }

    this.paddle.x = movePaddle(
      this.paddle.x,
      this.controls.target(this.paddle.x),
      PLAY.paddleSpeed,
      delta,
      PLAY.paddleWidth,
      GAME_WIDTH,
    );

    this.nextDropMs -= delta;
    if (this.nextDropMs <= 0) {
      this.nextDropMs = everyMs(
        this.score,
        PLAY.firstEveryMs,
        PLAY.quickestEveryMs,
        PLAY.quickestAtScore,
      );
      this.addDrop();
    }

    // Backwards, so one can be taken out of the list while going through it.
    for (let index = this.falling.length - 1; index >= 0; index -= 1) {
      const { shape, drop } = this.falling[index];
      shape.y += (drop.fall * delta) / 1000;
      const atPaddle =
        shape.y >= PLAY.paddleY - PLAY.paddleHeight / 2 &&
        shape.y <= PLAY.paddleY + PLAY.paddleHeight;
      if (atPaddle && isCaught(shape.x, this.paddle.x, PLAY.paddleWidth, PLAY.dropSize)) {
        this.score += drop.points;
        this.remove(index);
      } else if (shape.y > GAME_HEIGHT + PLAY.dropSize) {
        this.remove(index);
        this.loseLife();
        if (this.waiting || this.over) return;
      }
    }
    this.showHud();
  }

  private addDrop(): void {
    const drop = pickDrop(this.data_.drops, Math.random());
    const x = Phaser.Math.Between(PLAY.dropSize, GAME_WIDTH - PLAY.dropSize);
    const shape = this.add.rectangle(x, -PLAY.dropSize, PLAY.dropSize, PLAY.dropSize, drop.colour);
    this.falling.push({ shape, drop });
  }

  private remove(index: number): void {
    this.falling[index].shape.destroy();
    this.falling.splice(index, 1);
  }

  private loseLife(): void {
    this.lives -= 1;
    this.showHud();
    if (this.lives > 0) return;

    // With no kiosk there is no coin to wait for.
    if (!onKiosk()) {
      void this.end();
      return;
    }
    this.waiting = true;
    this.leftMs = KIOSK.continueMs;
    for (const { shape } of this.falling) shape.destroy();
    this.falling = [];
    this.wash.setVisible(true);
    this.countText.setVisible(true);
    this.continueText.setVisible(true);
    this.showContinue(null);
    this.showCount();
    // What the kiosk holds now, so the count says what is wanted from its first second.
    void this.coins.ask();
  }

  /** Lives bought by a coin, whenever it went in. In the count, they carry the play on. */
  private addLives(lives: number): void {
    if (this.over) return;
    this.lives += lives;
    if (this.waiting) {
      this.waiting = false;
      this.wash.setVisible(false);
      this.countText.setVisible(false);
      this.continueText.setVisible(false);
      this.nextDropMs = PLAY.firstEveryMs;
    }
    this.showHud();
  }

  /** What the kiosk holds, each time it is asked. Credit short of a life is said, and starts the count again. */
  private heard(state: KioskState): void {
    if (this.waiting) {
      if (state.balanceCents > this.balanceCents) this.leftMs = KIOSK.continueMs;
      this.showContinue(state);
    }
    this.balanceCents = state.balanceCents;
  }

  private async end(): Promise<void> {
    if (this.over) return;
    this.over = true;
    // A top-up may be out. Lives it buys were paid for, so the play carries on with them.
    await this.coins.end();
    if (this.lives > 0) {
      this.over = false;
      this.coins.start();
      return;
    }
    const finished = await endPlay(this.score);
    this.scene.start(SceneKey.Over, {
      score: this.score,
      rank: finished?.rank ?? null,
    } satisfies OverData);
  }

  private showHud(): void {
    this.scoreText.setText(`SCORE ${this.score}`);
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
}
