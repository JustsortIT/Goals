import Phaser from 'phaser';
import { FONT_SIZE, GAME_HEIGHT, GAME_WIDTH, KIOSK } from '../../../shell/constants';
import { continueGate, type KioskState } from '../../../shell/kiosk';
import { addPixelText, centerPixelText } from '../../../shell/pixelFont';
import { sfx } from '../audio';
import { BUTTON_COLOURS, COLOUR, DATA_KEY, LAYOUT, PLAY, SceneKey, TextureKey } from '../config';
import type { GameData } from '../gameData';
import { answerPoints, ask, questionOrder, streakGivesLife, timeFor, type Asked } from '../logic';
import { CoinWatch, endPlay, onKiosk } from '../session';
import type { OverData } from './Over';

export interface PlayData {
  lives: number;
}

/**
 * thinking: the question is up and its clock is running. result: the right answer is shown.
 * waiting: out of lives on a kiosk, counting down for a coin. ending: the play is being closed.
 */
type Phase = 'thinking' | 'result' | 'waiting' | 'ending';

interface Button {
  face: Phaser.GameObjects.Rectangle;
  shine: Phaser.GameObjects.Rectangle;
  label: Phaser.GameObjects.BitmapText;
}

/**
 * The game itself: a question on the chalkboard and four big coloured buttons. Tap the right one
 * before the clock on the board runs out. A right answer scores (more for a quick one and more
 * again on a streak); a wrong one, or none in time, costs a life. The questions go from easy to
 * hard and the clock gets shorter.
 *
 * What is worth keeping when this is replaced with a real game is how it meets the kiosk: lives
 * come from the play that was paid for (`init`), a coin put in at any time adds lives at once
 * (`CoinWatch`), running out of lives starts a count in which a coin carries the same play on,
 * and the play ends once, with one score.
 */
export class Play extends Phaser.Scene {
  private data_!: GameData;
  private coins!: CoinWatch;
  private buttons: Button[] = [];
  private question!: Phaser.GameObjects.BitmapText;
  private timerBar!: Phaser.GameObjects.Graphics;
  private scoreText!: Phaser.GameObjects.BitmapText;
  private numberText!: Phaser.GameObjects.BitmapText;
  private livesText!: Phaser.GameObjects.BitmapText;
  private streakText!: Phaser.GameObjects.BitmapText;
  private popText!: Phaser.GameObjects.BitmapText;
  private wash!: Phaser.GameObjects.Rectangle;
  private countText!: Phaser.GameObjects.BitmapText;
  private continueText!: Phaser.GameObjects.BitmapText;

  private phase: Phase = 'thinking';
  private score = 0;
  private lives = 0;
  private streak = 0;
  /** Which question this is, from 1, which of the game's they are, and the seed they were picked with. */
  private number = 1;
  private order: number[] = [];
  private seed = 0;
  private asked!: Asked;
  private clockMs = 0;
  private limitMs = 0;
  private leftMs = 0;
  private balanceCents = 0;

  constructor() {
    super(SceneKey.Play);
  }

  // The scene object is used again for every play, so everything is set afresh here.
  init(data: PlayData): void {
    this.lives = data.lives;
    this.score = 0;
    this.streak = 0;
    this.number = 1;
    this.phase = 'thinking';
    this.clockMs = 0;
    this.limitMs = 0;
    this.leftMs = 0;
    this.balanceCents = 0;
    this.buttons = [];
    // Every play is a different set of questions in a different order.
    this.seed = Math.floor(Math.random() * 0x7fffffff);
  }

  create(): void {
    this.data_ = this.registry.get(DATA_KEY) as GameData;
    this.order = questionOrder(this.data_.questions, this.data_.rounds, this.seed);

    this.add.image(0, 0, TextureKey.Backdrop).setOrigin(0, 0);
    this.add.image(0, 0, TextureKey.Vignette).setOrigin(0, 0).setDepth(6);
    this.add.rectangle(0, 0, GAME_WIDTH, 16, 0x050301, 0.66).setOrigin(0, 0).setDepth(7);
    this.add.rectangle(0, 16, GAME_WIDTH, 1, COLOUR.gold, 0.4).setOrigin(0, 0).setDepth(7);
    this.scoreText = addPixelText(this, 8, 4, '').setDepth(8);
    this.numberText = addPixelText(this, 0, 4, '').setDepth(8).setTint(COLOUR.gold);
    this.livesText = addPixelText(this, 0, 4, '').setDepth(8);

    const { board } = LAYOUT;
    this.question = addPixelText(
      this,
      board.x + board.width / 2,
      board.y + board.height / 2,
      '',
      FONT_SIZE.medium,
    )
      .setDepth(2)
      .setTint(COLOUR.chalk)
      .setMaxWidth(LAYOUT.questionWidth)
      .setCenterAlign();
    this.timerBar = this.add.graphics().setDepth(2);
    this.streakText = addPixelText(this, LAYOUT.bar.x, LAYOUT.bar.y + 7, '')
      .setDepth(2)
      .setTint(COLOUR.gold);

    // The four buttons, each a colour of its own, with a light edge so they look pressed in.
    const { button } = LAYOUT;
    for (let index = 0; index < 4; index += 1) {
      const x = button.xs[index % 2];
      const y = button.ys[Math.floor(index / 2)];
      const face = this.add
        .rectangle(x, y, button.width, button.height, BUTTON_COLOURS[index])
        .setOrigin(0, 0)
        .setStrokeStyle(2, 0x000000, 0.45)
        .setDepth(3)
        .setInteractive();
      const shine = this.add
        .rectangle(x + 3, y + 3, button.width - 6, 6, 0xffffff, 0.22)
        .setOrigin(0, 0)
        .setDepth(4);
      const label = addPixelText(
        this,
        x + button.width / 2,
        y + button.height / 2,
        '',
        FONT_SIZE.medium,
      )
        .setDepth(5)
        .setMaxWidth(LAYOUT.answerWidth)
        .setCenterAlign();
      face.on(Phaser.Input.Events.POINTER_DOWN, () => this.choose(index));
      this.buttons.push({ face, shine, label });
    }
    this.input.keyboard?.on('keydown', (event: KeyboardEvent) => {
      const index = Number(event.key) - 1;
      if (index >= 0 && index < 4) this.choose(index);
    });

    this.popText = addPixelText(this, 0, 0, '', FONT_SIZE.large).setDepth(9).setVisible(false);
    this.wash = this.add
      .rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, COLOUR.wash, 0.82)
      .setOrigin(0, 0)
      .setDepth(10)
      .setVisible(false);
    this.countText = addPixelText(this, 0, 0, '', FONT_SIZE.title).setDepth(11).setVisible(false);
    this.continueText = addPixelText(this, 0, 0, '', FONT_SIZE.medium)
      .setDepth(11)
      .setVisible(false);

    this.showQuestion();

    this.coins = new CoinWatch(
      (lives) => this.addLives(lives),
      (state) => this.heard(state),
    );
    this.coins.start();
    sfx.ambience(true);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      sfx.ambience(false);
      void this.coins.end();
    });
  }

  override update(_time: number, delta: number): void {
    if (this.phase === 'thinking') {
      this.clockMs += delta;
      this.drawTimer();
      if (this.clockMs >= this.limitMs) this.timeUp();
    } else if (this.phase === 'waiting') {
      this.leftMs -= delta;
      this.showCount();
      if (this.leftMs <= 0) void this.end(false);
    }
  }

  /** Puts the next question and its four answers up, and starts its clock. */
  private showQuestion(): void {
    const question = this.data_.questions[this.order[this.number - 1]];
    this.asked = ask(question, this.seed + this.number * 31);
    this.limitMs = timeFor(this.number, this.data_.time);
    // A short breath before the clock runs, so the first words can be read.
    this.clockMs = -PLAY.startMs;
    this.phase = 'thinking';

    const { board } = LAYOUT;
    this.question.setText(this.asked.text);
    centerPixelText(this.question, board.x + board.width / 2, board.y + board.height / 2);
    this.buttons.forEach((button, index) => {
      const { x, y } = button.face;
      button.label.setText(this.asked.answers[index]);
      centerPixelText(button.label, x + LAYOUT.button.width / 2, y + LAYOUT.button.height / 2);
      button.face.setFillStyle(BUTTON_COLOURS[index]).setAlpha(1);
      button.label.setAlpha(1);
      button.face.setInteractive();
    });
    this.showHud();
    this.drawTimer();
  }

  /** A tap on a button: right or wrong. */
  private choose(index: number): void {
    if (this.phase !== 'thinking' || this.clockMs < 0) return;
    const right = index === this.asked.correct;
    if (right) {
      const result = answerPoints(
        this.limitMs - this.clockMs,
        this.limitMs,
        this.streak,
        this.data_.points,
      );
      this.streak = result.streak;
      this.score += result.points;
      const life = streakGivesLife(this.streak, this.data_.streakLife);
      if (life) this.lives += 1;
      sfx.play(this.streak >= 3 ? 'split' : 'close');
      this.pop(life ? `+${result.points}  +1 LIFE` : `+${result.points}`, COLOUR.gold);
      this.reveal(index);
    } else {
      this.fail(index, 'WRONG');
    }
  }

  private timeUp(): void {
    if (this.phase !== 'thinking') return;
    this.fail(-1, 'TIME UP');
  }

  /** A wrong answer, or none in time: a life lost, and the right answer shown. */
  private fail(chosen: number, words: string): void {
    this.streak = 0;
    this.lives -= 1;
    sfx.play('miss');
    this.pop(words, COLOUR.bad);
    this.reveal(chosen);
  }

  /** Shows the right answer: it stays bright and the rest dim, with the wrong one tapped marked red. */
  private reveal(chosen: number): void {
    this.phase = 'result';
    this.buttons.forEach((button, index) => {
      button.face.disableInteractive();
      if (index === this.asked.correct) {
        button.face.setFillStyle(COLOUR.good);
      } else if (index === chosen) {
        button.face.setFillStyle(COLOUR.bad).setAlpha(0.9);
      } else {
        button.face.setAlpha(0.35);
        button.label.setAlpha(0.35);
      }
    });
    this.showHud();
    this.time.delayedCall(PLAY.resultMs, () => this.after());
  }

  /** After a result: the next question, the win, or the end of the lives. */
  private after(): void {
    if (this.lives <= 0) {
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
    if (this.number >= this.data_.rounds) {
      this.phase = 'ending';
      sfx.play('win');
      this.pop('LAST ORDERS', COLOUR.gold);
      this.time.delayedCall(PLAY.winMs, () => void this.end(true));
      return;
    }
    this.number += 1;
    this.showQuestion();
  }

  /** Lives bought by a coin, whenever it went in. In the count, they carry the play on. */
  private addLives(lives: number): void {
    this.lives += lives;
    this.showHud();
    if (this.phase === 'waiting') this.resume();
  }

  /** The coin has come: the play goes on with the next question. */
  private resume(): void {
    this.wash.setVisible(false);
    this.countText.setVisible(false);
    this.continueText.setVisible(false);
    if (this.number >= this.data_.rounds) {
      this.phase = 'ending';
      void this.end(true);
      return;
    }
    this.number += 1;
    this.showQuestion();
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
    if (this.phase === 'ending' && !won) return;
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

  /** The clock under the board: a bar that shrinks, green going to amber going to red. */
  private drawTimer(): void {
    const g = this.timerBar;
    g.clear();
    const { bar } = LAYOUT;
    const share = Math.min(1, Math.max(0, 1 - Math.max(0, this.clockMs) / this.limitMs));
    const colour = share > 0.5 ? 0x3aa655 : share > 0.25 ? 0xe0a63a : 0xd6342a;
    g.fillStyle(0x000000, 0.45);
    g.fillRect(bar.x, bar.y, bar.width, bar.height);
    g.fillStyle(colour, 1);
    g.fillRect(bar.x, bar.y, bar.width * share, bar.height);
  }

  private showHud(): void {
    this.scoreText.setText(`SCORE ${this.score}`);
    this.numberText.setText(`QUESTION ${this.number} OF ${this.data_.rounds}`);
    centerPixelText(this.numberText, GAME_WIDTH / 2, 9);
    this.livesText.setText(`LIVES ${Math.max(0, this.lives)}`);
    this.livesText.setX(GAME_WIDTH - 8 - this.livesText.width);
    this.streakText.setText(this.streak >= 2 ? `STREAK ${this.streak}` : '');
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

  /** A word that rises from the middle of the board and fades: what the answer was worth, or that it was wrong. */
  private pop(words: string, tint: number): void {
    this.tweens.killTweensOf(this.popText);
    this.popText.setText(words).setTint(tint).setAlpha(1).setVisible(true);
    const { board } = LAYOUT;
    centerPixelText(this.popText, board.x + board.width / 2, board.y + board.height - 14);
    this.tweens.add({
      targets: this.popText,
      y: this.popText.y - 10,
      alpha: 0,
      duration: PLAY.resultMs,
      ease: 'Quad.easeOut',
    });
  }
}
