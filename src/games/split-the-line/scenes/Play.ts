import Phaser from 'phaser';
import { FONT_SIZE, GAME_HEIGHT, GAME_WIDTH, KIOSK } from '../../../shell/constants';
import { continueGate, type KioskState } from '../../../shell/kiosk';
import { addPixelText, centerPixelText } from '../../../shell/pixelFont';
import { sfx } from '../audio';
import {
  CATCH_HALF,
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
import {
  isMini,
  type BonusKind,
  type GameData,
  type MiniBonusKind,
  type PourBonusKind,
} from '../gameData';
import type { MiniResult } from '../mini';
import { GlassView } from '../glassView';
import { TapsView } from '../tapsView';
import {
  bonusAfter,
  bonusCleared,
  bonusRounds,
  bonusScore,
  clearsRound,
  judge,
  newPour,
  roundFor,
  roundPoints,
  stepPour,
  swingOffset,
  underTap,
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
 * ready: a glass on the bar, waiting for the finger. pouring: a tap is open or still shutting.
 * result: the pint is judged. sliding: the glasses go and the next come. intro: a bonus game is
 * announced. waiting: out of lives on a kiosk, counting down for a coin. ending: the play is
 * being closed.
 */
type Phase = 'ready' | 'pouring' | 'result' | 'sliding' | 'intro' | 'waiting' | 'ending';
type Mode = 'normal' | PourBonusKind;

/** One glass being poured: its view, its round, where its tap is, and how far the pour has got. */
interface Slot {
  view: GlassView;
  round: Round;
  pour: Pour;
  /** Where its spout is across the screen, and which part of the screen holds its tap open. */
  spoutX: number;
  side: 'any' | 'left' | 'right';
  started: boolean;
  /** The finger has lifted, so the tap is shutting and the pour is as good as over. */
  released: boolean;
  done: boolean;
  stoppedAt: number | null;
  sincePourMs: number;
}

const VERDICT_WORDS: Record<Verdict, string> = {
  split: 'SPLIT!',
  close: 'CLOSE ENOUGH',
  short: 'SHORT',
  over: 'OVER',
  spill: 'SPILLED',
};

const BONUS_WORDS: Record<BonusKind, { name: string; how: string }> = {
  rapid: { name: 'RAPID POUR', how: 'QUICK TAP, NARROW MARK' },
  moving: { name: 'MOVING GLASS', how: 'POUR WHEN UNDER THE TAP' },
  two: { name: 'TWO PINTS', how: 'LEFT AND RIGHT HALVES' },
  darts: { name: 'DARTS', how: 'TAP TO THROW' },
  serve: { name: 'SERVE THE PINTS', how: 'TAP WHO WANTS IT' },
};

/** The two side taps, for the two-pint bonus. */
const SIDE_TAPS = { left: SPOUT.x - 50, right: SPOUT.x + 50 } as const;
/** The bar's top, where a stream that misses the glass lands. */
const BAR_Y = GLASS.bottom + 6;
/** Where the words go: on the wall to the left of the glass. */
const PANEL_X = 104;

/**
 * The game itself: pull a pint. Hold the screen to pour and let go to stop, so the top of the
 * pint comes to rest on the middle of the mark on the glass. The tap does not stop the moment
 * you let go, and it surges as it runs, so the finger has to lift a little early. A pint stopped
 * inside the mark scores and moves the bar on to a harder pour; anything else is a life lost.
 * Between some pints there is a bonus game: a rapid pour against the clock, a glass that slides
 * along the bar, or two pints at once. A bonus never costs a life, and one cleared gives one
 * back.
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
  private views: GlassView[] = [];
  private streamGfx!: Phaser.GameObjects.Graphics;
  private taps!: TapsView;
  /** How far each of the three taps is held open this frame, used again each frame. */
  private readonly tapTargets = [0, 0, 0];
  private scoreText!: Phaser.GameObjects.BitmapText;
  private roundText!: Phaser.GameObjects.BitmapText;
  private livesText!: Phaser.GameObjects.BitmapText;
  private plaque!: Phaser.GameObjects.Rectangle;
  private bannerText!: Phaser.GameObjects.BitmapText;
  private bannerSub!: Phaser.GameObjects.BitmapText;
  private bannerExtra!: Phaser.GameObjects.BitmapText;
  private hintText!: Phaser.GameObjects.BitmapText;
  private hintSub!: Phaser.GameObjects.BitmapText;
  private wash!: Phaser.GameObjects.Rectangle;
  private countText!: Phaser.GameObjects.BitmapText;
  private continueText!: Phaser.GameObjects.BitmapText;

  private phase: Phase = 'ready';
  private mode: Mode = 'normal';
  private score = 0;
  private lives = 0;
  private number = 1;
  private slots: Slot[] = [];
  /** The pint the bonus came after: its round sets how hard the bonus is. */
  private bonusFor = 1;
  /** How long a bonus's clock has run (from the first finger down), and its limit. */
  private clockMs = 0;
  private limitMs: number | null = null;
  private swingMs = 0;
  private idleMs = 0;
  private timeMs = 0;
  private leftMs = 0;
  private balanceCents = 0;

  constructor() {
    super(SceneKey.Play);
  }

  // The scene object is used again for every play, so everything is set afresh here.
  init(data: PlayData): void {
    this.lives = data.lives;
    this.score = 0;
    this.number = 1;
    this.phase = 'ready';
    this.mode = 'normal';
    this.slots = [];
    this.views = [];
    this.bonusFor = 1;
    this.clockMs = 0;
    this.limitMs = null;
    this.swingMs = 0;
    this.idleMs = 0;
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
    this.taps = new TapsView(this, 1.2, this.data_.drink);
    this.streamGfx = this.add.graphics().setDepth(1.5);
    // Two glasses, for the two-pint bonus; the second is only shown then.
    this.views = [new GlassView(this, 2), new GlassView(this, 2)];

    this.add.image(0, 0, TextureKey.Vignette).setOrigin(0, 0).setDepth(3.5);
    this.add.rectangle(0, 0, GAME_WIDTH, 16, 0x050301, 0.66).setOrigin(0, 0).setDepth(4);
    this.add.rectangle(0, 16, GAME_WIDTH, 1, COLOUR.gold, 0.4).setOrigin(0, 0).setDepth(4);
    this.scoreText = addPixelText(this, 8, 4, '').setDepth(5);
    this.roundText = addPixelText(this, 0, 4, '').setDepth(5).setTint(COLOUR.gold);
    this.livesText = addPixelText(this, 0, 4, '').setDepth(5);

    // A dark board behind the words, so they can be read against the shelves.
    this.plaque = this.add
      .rectangle(PANEL_X, 122, 188, 66, 0x050301, 0.62)
      .setStrokeStyle(1, COLOUR.gold, 0.45)
      .setDepth(5.5)
      .setVisible(false);
    this.bannerText = addPixelText(this, 0, 0, '', FONT_SIZE.large)
      .setDepth(6)
      .setTint(COLOUR.gold)
      .setVisible(false);
    this.bannerSub = addPixelText(this, 0, 0, '', FONT_SIZE.small).setDepth(6).setVisible(false);
    this.bannerExtra = addPixelText(this, 0, 0, '', FONT_SIZE.small)
      .setDepth(6)
      .setTint(COLOUR.quiet)
      .setVisible(false);
    this.hintText = addPixelText(this, 0, 0, 'HOLD TO POUR', FONT_SIZE.medium)
      .setDepth(6)
      .setTint(COLOUR.gold)
      .setVisible(false);
    this.hintSub = addPixelText(this, 0, 0, 'LET GO ON THE MARK')
      .setDepth(6)
      .setTint(COLOUR.quiet)
      .setVisible(false);
    centerPixelText(this.hintText, PANEL_X, 114);
    centerPixelText(this.hintSub, PANEL_X, 136);
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

    this.setupNormal();
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

    if (this.phase === 'ready') {
      this.idleMs = this.controls.holding ? 0 : this.idleMs + delta;
      if (this.slots.some((slot) => this.inputFor(slot))) this.beginPour();
    }
    if (this.phase === 'pouring') this.runSlots(delta);
    if (this.phase === 'waiting') {
      this.leftMs -= delta;
      this.showCount();
      if (this.leftMs <= 0) void this.end(false);
    }

    // The sliding glass moves from when it arrives until it is judged.
    if (this.mode === 'moving' && (this.phase === 'ready' || this.phase === 'pouring')) {
      this.swingMs += delta;
      this.slots[0].view.setCentre(SPOUT.x + this.swingOffset());
    }

    this.taps.update(delta, this.pullTargets());
    this.drawStreams();
    for (const slot of this.slots) {
      slot.sincePourMs = slot.pour.flow > 1 ? 0 : slot.sincePourMs + delta;
      slot.view.drawLiquid(
        slot.pour.fill,
        slot.pour.flow,
        this.data_.drink,
        slot.sincePourMs,
        delta,
      );
    }
    this.showTimer();
    const showHint =
      this.mode === 'normal' &&
      this.phase === 'ready' &&
      (this.number === 1 || this.idleMs > PLAY.hintAfterMs);
    this.hintText.setVisible(showHint);
    this.hintSub.setVisible(showHint);
    this.plaque.setVisible(showHint || this.bannerText.visible);
  }

  /* ----------------------------------------------------------------------------------------
   * Setting up the glasses
   * -------------------------------------------------------------------------------------- */

  private makeSlot(
    index: number,
    round: Round,
    spoutX: number,
    side: Slot['side'],
    centre: number,
  ): Slot {
    const view = this.views[index];
    view.setVisible(true);
    view.setCentre(centre);
    view.drawMark(round.centre, round.band, this.data_.mark.colour, null);
    return {
      view,
      round,
      pour: newPour(),
      spoutX,
      side,
      started: false,
      released: false,
      done: false,
      stoppedAt: null,
      sincePourMs: Infinity,
    };
  }

  /** One glass for the pint that is next. */
  private setupNormal(): void {
    this.mode = 'normal';
    this.limitMs = null;
    this.clockMs = 0;
    this.views[1].setVisible(false);
    const round = roundFor(this.number, this.data_.pour, GLASS_HEIGHT);
    this.slots = [this.makeSlot(0, round, SPOUT.x, 'any', GLASS.x)];
    this.showHud();
  }

  /** The glasses of a bonus game that comes after pint `cleared`. */
  private setupBonus(kind: PourBonusKind, cleared: number): void {
    const bonus = this.data_.bonus;
    if (!bonus) return;
    const rounds = bonusRounds(kind, cleared, this.data_.pour, bonus, GLASS_HEIGHT);
    this.mode = kind;
    this.bonusFor = cleared;
    this.clockMs = 0;
    this.swingMs = 0;
    this.limitMs = bonus[kind].timeMs;
    if (kind === 'two') {
      this.slots = [
        this.makeSlot(0, rounds[0], SIDE_TAPS.left, 'left', SIDE_TAPS.left),
        this.makeSlot(1, rounds[1], SIDE_TAPS.right, 'right', SIDE_TAPS.right),
      ];
    } else {
      this.views[1].setVisible(false);
      this.slots = [this.makeSlot(0, rounds[0], SPOUT.x, 'any', SPOUT.x)];
    }
    this.showHud();
  }

  /**
   * The glasses slide away along the bar, `setup` puts the next ones out of sight at the other
   * side, and they slide in, and then `after` runs.
   */
  private slideTo(setup: () => void, after: () => void): void {
    this.phase = 'sliding';
    sfx.play('slide');
    const out = this.slots.map((slot) => slot.view.container);
    out.forEach((container, index) => {
      this.tweens.add({
        targets: container,
        x: container.x + GAME_WIDTH,
        duration: PLAY.slideMs,
        ease: 'Quad.easeIn',
        onComplete: index > 0 ? undefined : () => this.slideIn(setup, after),
      });
    });
  }

  /** The next glasses come in from the left, to where `setup` puts them. */
  private slideIn(setup: () => void, after: () => void): void {
    setup();
    const containers = this.slots.map((slot) => slot.view.container);
    containers.forEach((container, index) => {
      const home = container.x;
      container.x = home - GAME_WIDTH;
      this.tweens.add({
        targets: container,
        x: home,
        duration: PLAY.slideMs,
        ease: 'Quad.easeOut',
        onComplete: index > 0 ? undefined : after,
      });
    });
  }

  private ready(): void {
    this.phase = 'ready';
    this.idleMs = 0;
    this.controls.cancel();
  }

  /**
   * A mini bonus game: the glass slides away, the game is announced, and then it runs as a scene of
   * its own while this one is paused. It gives its result back to \miniDone\.
   */
  private startMini(kind: MiniBonusKind, cleared: number): void {
    this.phase = 'sliding';
    sfx.play('slide');
    const out = this.slots.map((slot) => slot.view.container);
    const go = (): void => {
      this.phase = 'intro';
      sfx.play('clear');
      const words = BONUS_WORDS[kind];
      this.say(words.name, 'BONUS GAME', words.how);
      this.time.delayedCall(PLAY.introMs, () => {
        this.say('', '');
        this.scene.launch(kind === 'darts' ? SceneKey.Darts : SceneKey.Serve, { number: cleared });
        this.scene.pause();
      });
    };
    if (out.length === 0) {
      go();
      return;
    }
    out.forEach((container, index) => {
      this.tweens.add({
        targets: container,
        x: container.x + GAME_WIDTH,
        duration: PLAY.slideMs,
        ease: 'Quad.easeIn',
        onComplete: index > 0 ? undefined : go,
      });
    });
  }

  /**
   * The mini game is over and this scene is about to carry on: it scores, gives a life back for a
   * bonus cleared, says how it went, and brings the next glass in. Called by the mini game, which
   * resumes this scene straight after.
   */
  miniDone(result: MiniResult): void {
    const bonus = this.data_.bonus;
    if (!bonus) return;
    const total = bonusScore([result.points], bonus);
    this.score += total;
    const life = result.cleared && bonus.lifeOnSuccess;
    if (life) this.lives += 1;
    this.showHud();
    this.phase = 'result';
    this.say(
      result.cleared ? 'BONUS CLEARED' : 'BONUS MISSED',
      total > 0 ? `+${total}` : 'NO LIFE LOST',
      life ? '+1 LIFE' : '',
    );
    this.bannerText.setTint(result.cleared ? COLOUR.gold : COLOUR.bad);
    sfx.play(result.cleared ? 'split' : 'miss');
    // The finger that ended the mini game is not a pour.
    this.controls.cancel();
    this.time.delayedCall(PLAY.resultMs, () => {
      this.say('', '');
      this.phase = 'sliding';
      this.slideIn(
        () => this.setupNormal(),
        () => this.ready(),
      );
    });
  }

  /** A bonus game is announced before it starts. */
  private intro(kind: BonusKind): void {
    this.phase = 'intro';
    sfx.play('clear');
    const words = BONUS_WORDS[kind];
    this.say(words.name, 'BONUS GAME', words.how);
    this.time.delayedCall(PLAY.introMs, () => {
      this.say('', '');
      this.ready();
    });
  }

  /* ----------------------------------------------------------------------------------------
   * The pour
   * -------------------------------------------------------------------------------------- */

  private swingOffset(): number {
    const moving = this.data_.bonus?.moving;
    return moving ? swingOffset(this.swingMs, moving.amplitude, moving.periodMs) : 0;
  }

  /** Whether the finger that works this glass's tap is down. */
  private inputFor(slot: Slot): boolean {
    if (slot.side === 'left') return this.controls.left;
    if (slot.side === 'right') return this.controls.right;
    return this.controls.holding;
  }

  /** Whether a sliding glass is under the tap, so that what pours goes in it. */
  private catching(): boolean {
    return underTap(this.swingOffset(), CATCH_HALF);
  }

  /** Which taps are being held open: the left slot works the left tap, the right the right, any the middle. */
  private pullTargets(): number[] {
    const targets = this.tapTargets;
    targets.fill(0);
    for (const slot of this.slots) {
      const index = slot.side === 'left' ? 0 : slot.side === 'right' ? 2 : 1;
      if (slot.started && !slot.released) targets[index] = 1;
    }
    return targets;
  }

  private beginPour(): void {
    this.phase = 'pouring';
    this.idleMs = 0;
  }

  /** Runs every tap for a frame; when every glass has stopped filling the pour is over. */
  private runSlots(delta: number): void {
    this.clockMs += delta;
    const timeUp = this.limitMs !== null && this.clockMs >= this.limitMs;
    let loudest = 0;

    for (const slot of this.slots) {
      if (slot.done) continue;
      const input = !timeUp && this.inputFor(slot);
      if (!slot.started && (input || timeUp)) slot.started = true;
      if (!slot.started) continue;
      // The finger lifting, or the time running out, shuts the tap for good: one pour a pint.
      if (!input) slot.released = true;

      const before = slot.pour.fill;
      stepPour(slot.pour, !slot.released, delta, slot.round, GLASS_HEIGHT);
      // A sliding glass only fills while it is under the tap: the rest goes on the bar.
      if (this.mode === 'moving' && !this.catching()) slot.pour.fill = before;
      loudest = Math.max(loudest, slot.pour.flow / (slot.round.flow * 1.4));

      if (slot.pour.fill >= GLASS_HEIGHT || (slot.released && slot.pour.flow < PLAY.stoppedBelow)) {
        slot.done = true;
        slot.stoppedAt = slot.pour.fill;
      }
    }
    sfx.pour(loudest);
    if (this.slots.every((slot) => slot.done)) this.finish();
  }

  /** Every glass has stopped: judge them, score them, and show which. */
  private finish(): void {
    sfx.pour(0);
    this.phase = 'result';
    const colour = this.data_.mark.colour;
    const results = this.slots.map((slot) => {
      const fill = slot.stoppedAt ?? slot.pour.fill;
      slot.view.drawMark(slot.round.centre, slot.round.band, colour, fill);
      return { slot, ...judge(fill, slot.round, this.data_.splitTolerance, GLASS_HEIGHT) };
    });
    if (this.mode === 'normal') this.finishPint(results[0].verdict, results[0].error);
    else
      this.finishBonus(
        results.map((result) => result.verdict),
        results,
      );
    this.showHud();
  }

  private finishPint(verdict: Verdict, error: number): void {
    const slot = this.slots[0];
    const points = roundPoints(verdict, error, slot.round, this.data_.points);
    this.score += points;
    const cleared = clearsRound(verdict);
    if (!cleared) this.lives -= 1;

    this.say(VERDICT_WORDS[verdict], points > 0 ? `+${points}` : 'A LIFE LOST');
    this.bannerText.setTint(cleared ? COLOUR.gold : COLOUR.bad);
    const markY = GLASS.bottom - slot.round.centre;
    if (verdict === 'split') {
      sfx.play('split');
      this.cameras.main.flash(160, 255, 240, 170);
      this.sparkle(slot.view.centre, markY, [0xffd76a, 0xffffff, 0xffa31a], 34);
    } else if (verdict === 'close') {
      sfx.play('close');
      this.sparkle(slot.view.centre, markY, [0xffd76a, 0xffffff], 14);
    } else if (verdict === 'spill') {
      sfx.play('spill');
      this.spill(slot.view.centre);
    } else {
      sfx.play('miss');
    }
    this.time.delayedCall(PLAY.resultMs, () => this.after(cleared));
  }

  /** A bonus game is over: it scores, and gives a life back if every glass was stopped in its mark. */
  private finishBonus(
    verdicts: Verdict[],
    results: { slot: Slot; verdict: Verdict; error: number }[],
  ): void {
    const bonus = this.data_.bonus;
    if (!bonus) return;
    const points = results.map(({ slot, verdict, error }) =>
      roundPoints(verdict, error, { ...slot.round, number: this.bonusFor }, this.data_.points),
    );
    const total = bonusScore(points, bonus);
    this.score += total;
    const cleared = bonusCleared(verdicts);
    const life = cleared && bonus.lifeOnSuccess;
    if (life) this.lives += 1;

    this.say(
      cleared ? 'BONUS CLEARED' : 'BONUS MISSED',
      total > 0 ? `+${total}` : 'NO LIFE LOST',
      life ? '+1 LIFE' : '',
    );
    this.bannerText.setTint(cleared ? COLOUR.gold : COLOUR.bad);
    if (cleared) {
      sfx.play(verdicts.every((verdict) => verdict === 'split') ? 'split' : 'close');
      this.cameras.main.flash(140, 255, 240, 170);
      for (const { slot } of results) {
        this.sparkle(slot.view.centre, GLASS.bottom - slot.round.centre, [0xffd76a, 0xffffff], 22);
      }
    } else {
      sfx.play('miss');
    }
    this.time.delayedCall(PLAY.resultMs, () => {
      this.say('', '');
      this.slideTo(
        () => this.setupNormal(),
        () => this.ready(),
      );
    });
  }

  /** After a pint: the next glass, a bonus game, a retry of the same pint, or the end of the lives. */
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
      const justCleared = this.number;
      this.number += 1;
      sfx.play('clear');
      const kind = bonusAfter(justCleared, this.data_.bonus);
      if (kind && isMini(kind)) {
        this.startMini(kind, justCleared);
        return;
      }
      if (kind) {
        this.slideTo(
          () => this.setupBonus(kind, justCleared),
          () => this.intro(kind),
        );
        return;
      }
    }
    this.slideTo(
      () => this.setupNormal(),
      () => this.ready(),
    );
  }

  /* ----------------------------------------------------------------------------------------
   * Drawing
   * -------------------------------------------------------------------------------------- */

  /** The streams from the taps to the tops of the pints: thicker as a tap opens, with light running down them. */
  private drawStreams(): void {
    const g = this.streamGfx;
    g.clear();
    for (const slot of this.slots) {
      const flow = slot.pour.flow;
      if (!slot.started || flow < 1) continue;
      const missing = this.mode === 'moving' && !this.catching();
      const width = Math.max(1, Math.round(1 + (flow / (slot.round.flow * 1.4)) * 5));
      const landY = missing ? BAR_Y : GLASS.bottom - slot.pour.fill;
      const x = slot.spoutX - Math.floor(width / 2);
      const length = landY - SPOUT.y;
      if (length <= 0) continue;
      g.fillStyle(this.data_.drink.liquid, 1);
      g.fillRect(x, SPOUT.y, width, length);
      g.fillStyle(0x5a3320, 0.9);
      g.fillRect(x, SPOUT.y, 1, length);
      // A clean gleam down the stream, on the side the light comes from.
      g.fillStyle(0xb08a62, 0.5);
      g.fillRect(x + (width > 2 ? 1 : 0), SPOUT.y, 1, length);
      // Foam where it lands: on the stout, or splashing on the bar.
      g.fillStyle(missing ? this.data_.drink.liquid : this.data_.drink.head, 0.7);
      g.fillEllipse(slot.spoutX, landY, width * 2 + 8, 3);
    }
  }

  /** A bonus game's clock, in the status bar where the round is told, going red in its last two seconds. */
  private showTimer(): void {
    const running = this.limitMs !== null && (this.phase === 'ready' || this.phase === 'pouring');
    if (!running || this.limitMs === null) return;
    const left = Math.max(0, this.limitMs - this.clockMs);
    this.roundText.setText(`BONUS  TIME ${(left / 1000).toFixed(1)}`);
    this.roundText.setTint(left < 2000 ? COLOUR.bad : COLOUR.gold);
    centerPixelText(this.roundText, GAME_WIDTH / 2, 9);
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
  private spill(centre: number): void {
    const { head, liquid } = this.data_.drink;
    const y = GLASS.top;
    for (let drop = 0; drop < 34; drop += 1) {
      const side = drop % 2 === 0 ? -1 : 1;
      const startX = centre + side * (GLASS.topInner / 2 - 2);
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

  /* ----------------------------------------------------------------------------------------
   * The kiosk
   * -------------------------------------------------------------------------------------- */

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
    this.slideTo(
      () => this.setupNormal(),
      () => this.ready(),
    );
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
    this.roundText.setText(
      this.mode === 'normal' ? `PINT ${this.number} OF ${this.data_.rounds}` : 'BONUS GAME',
    );
    centerPixelText(this.roundText, GAME_WIDTH / 2, 9);
    this.roundText.setTint(COLOUR.gold);
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

  /** Words over the wall to the left of the glasses, in up to three lines; empty words clear them. */
  private say(main: string, sub: string, extra = ''): void {
    // The long ones are written smaller, to stay on the board.
    this.bannerText
      .setText(main)
      .setFontSize(main.length > 8 ? FONT_SIZE.medium : FONT_SIZE.large)
      .setVisible(main !== '')
      .setTint(COLOUR.gold);
    this.bannerSub.setText(sub).setVisible(sub !== '');
    this.bannerExtra.setText(extra).setVisible(extra !== '');
    // Two lines sit as a pair in the middle of the board; three spread out to fit.
    const lines = extra ? [100, 120, 138] : [104, 128, 0];
    centerPixelText(this.bannerText, PANEL_X, lines[0]);
    centerPixelText(this.bannerSub, PANEL_X, lines[1]);
    centerPixelText(this.bannerExtra, PANEL_X, lines[2]);
  }
}
