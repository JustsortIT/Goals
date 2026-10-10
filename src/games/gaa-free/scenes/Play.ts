import Phaser from 'phaser';
import { FONT_SIZE, GAME_HEIGHT, GAME_WIDTH, KIOSK } from '../../../shell/constants';
import { continueGate, type KioskState } from '../../../shell/kiosk';
import { addPixelText, centerPixelText } from '../../../shell/pixelFont';
import { sfx } from '../audio';
import { addGoalLayers, drawGoal, type GoalLayers } from '../goalArt';
import { BALL, COLOUR, DATA_KEY, KICK, PLAY, SceneKey, TextureKey, WIND } from '../config';
import { Controls } from '../controls';
import type { GameData } from '../gameData';
import {
  ballAt,
  bonusSpot,
  clampPull,
  goalGeometry,
  isKick,
  landingPoint,
  landScale,
  levelPoints,
  levelScale,
  resolveShot,
  targetSpots,
  windAt,
  type GoalGeometry,
  type Point,
  type ShotKind,
  type Spot,
} from '../logic';
import { CoinWatch, endPlay, onKiosk } from '../session';
import type { OverData } from './Over';

export interface PlayData {
  lives: number;
}

/**
 * ready: waiting for a kick. flying: the ball is in the air. pause: a result is on show.
 * waiting: out of lives on a kiosk, counting down for a coin. ending: the play is being closed.
 */
type Phase = 'ready' | 'flying' | 'pause' | 'waiting' | 'ending';

const MISS_WORDS: Record<Exclude<ShotKind, 'hit' | 'bonus'>, string> = {
  repeat: 'DONE',
  net: 'MISS',
  over: 'OVER',
  wide: 'WIDE',
  short: 'SHORT',
};

/** How long nobody touches the screen before the game shows how to kick. */
const HINT_AFTER_MS = 6000;

/** How many ghosts follow the bonus target, and how far apart in time. */
const TRAIL = { count: 3, gapMs: 55 } as const;

/**
 * The game itself: pull back and let go to land the ball on the five targets in the goal. Hit
 * all five to clear the goal, which then goes back a little, with smaller targets. A golden
 * target also circles in the goal: it is not needed, but it is worth a lot, and the ball takes
 * a moment to get there, so it has to be aimed at where the target will be. A ball that hits
 * none costs a life, a goal cleared gives one back, and clearing the last goal wins.
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
  private layers!: GoalLayers;
  private aimGfx!: Phaser.GameObjects.Graphics;
  private windGfx!: Phaser.GameObjects.Graphics;
  private windLabel!: Phaser.GameObjects.BitmapText;
  private hintText!: Phaser.GameObjects.BitmapText;
  private hintDot!: Phaser.GameObjects.Arc;
  private ball!: Phaser.GameObjects.Image;
  private shadow!: Phaser.GameObjects.Ellipse;
  private restShadow!: Phaser.GameObjects.Ellipse;
  private bonusImage!: Phaser.GameObjects.Image;
  private bonusGlow!: Phaser.GameObjects.Image;
  private bonusTrail: Phaser.GameObjects.Image[] = [];
  private scoreText!: Phaser.GameObjects.BitmapText;
  private levelText!: Phaser.GameObjects.BitmapText;
  private livesText!: Phaser.GameObjects.BitmapText;
  private popText!: Phaser.GameObjects.BitmapText;
  private bannerText!: Phaser.GameObjects.BitmapText;
  private bannerSub!: Phaser.GameObjects.BitmapText;
  private wash!: Phaser.GameObjects.Rectangle;
  private countText!: Phaser.GameObjects.BitmapText;
  private continueText!: Phaser.GameObjects.BitmapText;

  private phase: Phase = 'ready';
  private score = 0;
  private lives = 0;
  private level = 1;
  private geometry: GoalGeometry = goalGeometry(1);
  private spots: Spot[] = [];
  private cleared: boolean[] = [];
  /** Where the kick was aimed, and how far the wind carried the ball from it. */
  private landing: Point = { x: 0, y: 0 };
  private drift = 0;
  /** How long it has been since the player touched the screen, ready for a kick. */
  private idleMs = 0;
  private flightMs = 0;
  private aiming = false;
  private leftMs = 0;
  private balanceCents = 0;
  /** The bonus target is in the goal. `levelTime` is how long this goal has been up: the bonus and the wind go by it. */
  private bonusLive = false;
  private levelTime = 0;
  /** The goal is going back: nothing but the goal is shown. */
  private goalMoving = false;
  private readonly bonusNow: Spot = { x: 0, y: 0, r: 0 };
  private readonly bonusPast: Spot = { x: 0, y: 0, r: 0 };

  constructor() {
    super(SceneKey.Play);
  }

  // The scene object is used again for every play, so everything is set afresh here.
  init(data: PlayData): void {
    this.lives = data.lives;
    this.score = 0;
    this.level = 1;
    this.phase = 'ready';
    this.flightMs = 0;
    this.drift = 0;
    this.idleMs = 0;
    this.aiming = false;
    this.leftMs = 0;
    this.balanceCents = 0;
    this.bonusLive = false;
    this.levelTime = 0;
    this.goalMoving = false;
    this.bonusTrail = [];
  }

  create(): void {
    this.data_ = this.registry.get(DATA_KEY) as GameData;
    this.controls = new Controls(this);
    // The tap that started this play may still be down: it is not a kick.
    this.controls.cancel();

    this.add.image(0, 0, TextureKey.Backdrop).setOrigin(0, 0);
    this.layers = addGoalLayers(this);

    this.bonusGlow = this.add
      .image(0, 0, TextureKey.Glow)
      .setDepth(1.4)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setVisible(false);
    for (let ghost = 0; ghost < TRAIL.count; ghost += 1) {
      this.bonusTrail.push(this.add.image(0, 0, TextureKey.Bonus).setDepth(1.45).setVisible(false));
    }
    this.bonusImage = this.add.image(0, 0, TextureKey.Bonus).setDepth(1.5).setVisible(false);

    this.aimGfx = this.add.graphics().setDepth(2.5);
    this.windGfx = this.add.graphics().setDepth(2.4);
    this.restShadow = this.add
      .ellipse(KICK.origin.x, KICK.origin.y + BALL.size * 0.45, BALL.size * 0.9, 5, 0x000000, 0.3)
      .setDepth(2.6);
    this.shadow = this.add.ellipse(0, 0, 14, 5, 0x000000, 0.35).setDepth(2.6).setVisible(false);
    this.ball = this.add.image(KICK.origin.x, KICK.origin.y, TextureKey.Ball, '0').setDepth(3);
    this.add.image(0, 0, TextureKey.Vignette).setOrigin(0, 0).setDepth(3.5);

    this.add.rectangle(0, 0, GAME_WIDTH, 16, 0x050a08, 0.62).setOrigin(0, 0).setDepth(4);
    this.add.rectangle(0, 16, GAME_WIDTH, 1, COLOUR.gold, 0.4).setOrigin(0, 0).setDepth(4);
    this.scoreText = addPixelText(this, 8, 4, '').setDepth(5);
    this.levelText = addPixelText(this, 0, 4, '').setDepth(5).setTint(COLOUR.gold);
    this.livesText = addPixelText(this, 0, 4, '').setDepth(5);
    this.windLabel = addPixelText(
      this,
      WIND.gauge.x - WIND.gauge.half - 34,
      WIND.gauge.y - 4,
      'WIND',
    )
      .setDepth(5)
      .setTint(COLOUR.quiet);
    this.hintText = addPixelText(this, 0, 0, 'PULL BACK AND LET GO')
      .setDepth(5)
      .setTint(COLOUR.gold)
      .setVisible(false);
    centerPixelText(this.hintText, GAME_WIDTH / 2, GAME_HEIGHT - 12);
    // A finger that drags down, over and over: how the ball is kicked.
    this.hintDot = this.add
      .circle(GAME_WIDTH / 2, 214, 6, 0xffffff, 0.75)
      .setDepth(5)
      .setVisible(false);
    this.tweens.add({
      targets: this.hintDot,
      y: 250,
      alpha: { from: 0.8, to: 0 },
      duration: 1100,
      repeat: -1,
    });
    this.popText = addPixelText(this, 0, 0, '', FONT_SIZE.medium).setDepth(6).setVisible(false);
    this.bannerText = addPixelText(this, 0, 0, '', FONT_SIZE.large)
      .setDepth(6)
      .setTint(COLOUR.gold)
      .setVisible(false);
    this.bannerSub = addPixelText(this, 0, 0, '', FONT_SIZE.medium).setDepth(6).setVisible(false);

    this.wash = this.add
      .rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, COLOUR.wash, 0.8)
      .setOrigin(0, 0)
      .setDepth(8)
      .setVisible(false);
    this.countText = addPixelText(this, 0, 0, '', FONT_SIZE.title).setDepth(9).setVisible(false);
    this.continueText = addPixelText(this, 0, 0, '', FONT_SIZE.medium)
      .setDepth(9)
      .setVisible(false);

    this.setupLevel();
    this.showHud();

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
    this.controls.update(delta);
    // The bonus target keeps going round while the player aims, the ball flies and a result shows.
    if (this.phase !== 'waiting' && this.phase !== 'ending') this.levelTime += delta;
    this.moveBonus();
    this.drawWind();
    this.showHint(delta);

    if (this.phase === 'ready') {
      this.aim();
    } else if (this.phase === 'flying') {
      this.fly(delta);
    } else if (this.phase === 'waiting') {
      this.leftMs -= delta;
      this.showCount();
      if (this.leftMs <= 0) void this.end(false);
    }
  }

  /** Lays out the goal for the current level, every target still to hit and the bonus going. */
  private setupLevel(): void {
    const scale = levelScale(this.level, this.data_.shrink);
    this.geometry = goalGeometry(scale);
    this.spots = targetSpots(this.geometry, this.data_.targets);
    this.cleared = this.data_.targets.map(() => false);
    this.bonusLive = this.data_.bonus !== null;
    this.levelTime = 0;
    this.drawGoalAt(scale);
  }

  private drawGoalAt(scale: number): void {
    const geometry = goalGeometry(scale);
    drawGoal(
      this.layers,
      geometry,
      this.data_.targets,
      targetSpots(geometry, this.data_.targets),
      this.cleared,
    );
  }

  /** Where the bonus target is now, or null if it is not in the goal. */
  private bonusSpotNow(): Spot | null {
    const { bonus } = this.data_;
    if (!bonus || !this.bonusLive) return null;
    return bonusSpot(this.levelTime, bonus, this.level, this.geometry, this.bonusNow);
  }

  /** Shows how to kick if the screen has been left alone a while, and takes it away at a touch. */
  private showHint(delta: number): void {
    const waiting = this.phase === 'ready' && !this.controls.held;
    this.idleMs = waiting ? this.idleMs + delta : 0;
    const show = this.idleMs > HINT_AFTER_MS;
    this.hintText.setVisible(show);
    this.hintDot.setVisible(show);
  }

  /** The wind, as a flag on a pole by the pitch and a gauge under the top bar. Both follow the gusts. */
  private drawWind(): void {
    const g = this.windGfx;
    g.clear();
    const { wind } = this.data_;
    this.windLabel.setVisible(wind !== null);
    if (!wind) return;

    const now = windAt(this.levelTime, wind, this.level);
    const strength = Math.min(1, Math.abs(now) / WIND.most);
    const dir = now >= 0 ? 1 : -1;

    // The gauge: a bar out from the middle, the way the wind blows, to the strength of it.
    const { x, y, half } = WIND.gauge;
    g.fillStyle(0x050a08, 0.55);
    g.fillRect(x - half - 2, y - 3, half * 2 + 4, 7);
    g.fillStyle(0xffffff, 0.4);
    g.fillRect(x, y - 4, 1, 9);
    const length = Math.round(half * strength);
    if (length > 0) {
      g.fillStyle(strength > 0.66 ? 0xffa31a : strength > 0.33 ? COLOUR.gold : 0x9be7ff, 1);
      g.fillRect(dir > 0 ? x + 1 : x - length, y - 2, length, 4);
    }

    // The flag: out straight in a strong wind, hanging from the pole in none, rippling.
    const flag = WIND.flag;
    const top = flag.baseY - flag.height;
    g.fillStyle(0x000000, 0.25);
    g.fillEllipse(flag.x, flag.baseY, 9, 3);
    g.fillStyle(0xd5dbe0, 1);
    g.fillRect(flag.x, top, 1, flag.height);
    const pieces = 9;
    const step = (6 + 26 * strength) / pieces;
    for (let piece = 0; piece < pieces; piece += 1) {
      const along = piece / pieces;
      const wave = Math.sin(this.levelTime / 110 + piece * 0.9) * (0.6 + strength * 2.2) * along;
      const droop = (1 - strength) * piece * 1.8;
      const width = Math.ceil(step) + 1;
      const px = Math.round(dir > 0 ? flag.x + 1 + piece * step : flag.x - (piece + 1) * step);
      const py = Math.round(top + wave + droop);
      const height = Math.round(9 - piece * 0.4);
      g.fillStyle(0x1f8a4c, 1);
      g.fillRect(px, py, width, Math.ceil(height * 0.55));
      g.fillStyle(0xf2b920, 1);
      g.fillRect(px, py + Math.ceil(height * 0.55), width, Math.floor(height * 0.45));
    }
  }

  /** Puts the golden target, its glow and the ghosts behind it where they belong this frame. */
  private moveBonus(): void {
    const { bonus } = this.data_;
    const spot = this.goalMoving ? null : this.bonusSpotNow();
    this.bonusImage.setVisible(spot !== null);
    this.bonusGlow.setVisible(spot !== null);
    if (!spot || !bonus) {
      for (const ghost of this.bonusTrail) ghost.setVisible(false);
      return;
    }

    const pulse = 1 + 0.06 * Math.sin(this.levelTime / 160);
    const size = (spot.r * 2) / 32;
    this.bonusImage.setPosition(spot.x, spot.y).setScale(size * pulse);
    this.bonusGlow
      .setPosition(spot.x, spot.y)
      .setScale((spot.r * 4.4) / 64)
      .setAlpha(0.5 + 0.2 * Math.sin(this.levelTime / 160));
    this.bonusTrail.forEach((ghost, index) => {
      const past = bonusSpot(
        Math.max(0, this.levelTime - (index + 1) * TRAIL.gapMs),
        bonus,
        this.level,
        this.geometry,
        this.bonusPast,
      );
      ghost
        .setPosition(past.x, past.y)
        .setScale(size * (1 - 0.14 * (index + 1)))
        .setAlpha(0.34 - 0.1 * index)
        .setVisible(true);
    });
  }

  /** While the player holds: the ball goes back with the finger, and a dotted line shows the way. */
  private aim(): void {
    const { held, released } = this.controls;
    if (released) {
      this.kick(released);
      return;
    }
    if (!held) {
      if (this.aiming) this.resetBall();
      return;
    }

    this.aiming = true;
    const pull = clampPull(held, KICK.maxPull, KICK.maxPullY);
    const { origin } = KICK;
    this.ball.setPosition(origin.x + pull.x * KICK.drawBack, origin.y + pull.y * KICK.drawBack);
    const g = this.aimGfx;
    g.clear();
    g.lineStyle(2, 0xffffff, 0.55);
    g.lineBetween(origin.x, origin.y, this.ball.x, this.ball.y);
    if (!isKick(pull)) return;

    const to = landingPoint(origin, pull);
    const dots = 8;
    for (let dot = 1; dot <= dots; dot += 1) {
      const along = (KICK.guide * dot) / dots;
      g.fillStyle(0xffffff, 0.95 - along * 0.6);
      g.fillRect(
        Math.round(origin.x + (to.x - origin.x) * along) - 1,
        Math.round(origin.y + (to.y - origin.y) * along) - 1,
        3,
        3,
      );
    }
  }

  private kick(released: Point): void {
    const pull = clampPull(released, KICK.maxPull, KICK.maxPullY);
    if (!isKick(pull)) {
      this.resetBall();
      return;
    }
    this.aimGfx.clear();
    this.aiming = false;
    this.landing = landingPoint(KICK.origin, pull);
    // The wind as it is now carries the ball, the whole way: what the flag and gauge show.
    this.drift = windAt(this.levelTime, this.data_.wind, this.level);
    this.flightMs = 0;
    this.phase = 'flying';
    this.ball.setPosition(KICK.origin.x, KICK.origin.y);
    sfx.play('kick');
    this.restShadow.setVisible(false);
    this.shadow.setVisible(true);
  }

  private fly(delta: number): void {
    this.flightMs += delta;
    const along = Math.min(this.flightMs / KICK.flightMs, 1);
    const at = ballAt(KICK.origin, this.landing, along, KICK.arcHeight);
    // The wind takes more of the ball the longer it is in the air.
    const blown = this.drift * along * along;
    at.x += blown;
    const scale = 1 + (landScale(this.geometry.scale) - 1) * along;
    // The ball tumbles on the way.
    this.ball
      .setFrame(String(Math.floor(along * 16) % BALL.frames))
      .setPosition(at.x, at.y)
      .setScale(scale);
    this.shadow
      .setPosition(
        KICK.origin.x + (this.landing.x - KICK.origin.x) * along + blown,
        KICK.origin.y + (this.landing.y - KICK.origin.y) * along + 7 * scale,
      )
      .setScale(scale);
    if (along >= 1) this.land();
  }

  /** The ball has come down: score it or lose a life, and show which. */
  private land(): void {
    this.phase = 'pause';
    this.shadow.setVisible(false);
    const here = this.bonusSpotNow();
    const bonusAtLanding = here ? { ...here } : null;
    const down = { x: this.landing.x + this.drift, y: this.landing.y };
    const shot = resolveShot(
      down,
      this.geometry,
      this.spots,
      this.cleared,
      KICK.reach,
      bonusAtLanding,
    );
    const popX = Phaser.Math.Clamp(down.x, 56, GAME_WIDTH - 56);
    const popY = Phaser.Math.Clamp(down.y - 14, 28, GAME_HEIGHT - 20);

    if (shot.kind === 'hit') {
      const target = this.data_.targets[shot.index];
      const points = levelPoints(target.points, this.level);
      this.score += points;
      this.cleared[shot.index] = true;
      this.drawGoalAt(this.geometry.scale);
      this.ring(this.spots[shot.index], target.colour);
      this.burst(down.x, down.y, [target.colour, 0xffffff], 10, 34);
      sfx.play('hit');
      this.pop(`+${points}`, popX, popY, COLOUR.gold);
    } else if (shot.kind === 'bonus' && this.data_.bonus && bonusAtLanding) {
      const { bonus } = this.data_;
      const points = levelPoints(bonus.points, this.level);
      this.score += points;
      this.bonusLive = false;
      this.ring(bonusAtLanding, bonus.colour);
      this.burst(bonusAtLanding.x, bonusAtLanding.y, [bonus.colour, 0xffffff, 0xffa31a], 22, 60);
      this.cameras.main.flash(140, 255, 240, 170);
      sfx.play('bonus');
      this.pop(`BONUS ${points}`, popX, popY, COLOUR.gold);
    } else if (shot.kind === 'repeat') {
      sfx.play('click');
      this.pop(MISS_WORDS.repeat, popX, popY, COLOUR.quiet);
    } else if (shot.kind !== 'bonus') {
      this.lives -= 1;
      sfx.play('miss');
      this.pop(MISS_WORDS[shot.kind], popX, popY, COLOUR.miss);
    }
    this.showHud();

    const done = this.cleared.every(Boolean);
    this.time.delayedCall(PLAY.resultMs, () => (done ? this.levelCleared() : this.next()));
  }

  /** After a shot that did not clear the goal: another go, or the end of the lives. */
  private next(): void {
    if (this.lives > 0) {
      this.ready();
      return;
    }
    // With no kiosk there is no coin to wait for.
    if (!onKiosk()) {
      void this.end(false);
      return;
    }
    this.phase = 'waiting';
    sfx.play('over');
    this.leftMs = KIOSK.continueMs;
    this.ball.setVisible(false);
    this.wash.setVisible(true);
    this.countText.setVisible(true);
    this.continueText.setVisible(true);
    this.showContinue(null);
    this.showCount();
    // What the kiosk holds now, so the count says what is wanted from its first second.
    void this.coins.ask();
  }

  private levelCleared(): void {
    this.lives += PLAY.bonusLives;
    this.showHud();
    this.ball.setVisible(false);
    this.restShadow.setVisible(false);
    const middle = this.geometry.top + this.geometry.mouthHeight / 2;
    this.burst(GAME_WIDTH / 2, middle, [0x169b62, 0xffffff, 0xff883e], 40, 110);
    if (this.level >= this.data_.levels) {
      sfx.play('win');
      this.say('FULL TIME', 'ALL THE GOALS CLEARED');
      this.time.delayedCall(PLAY.winMs, () => void this.end(true));
      return;
    }

    sfx.play('clear');
    this.say('GOAL CLEARED', '+1 LIFE');
    this.time.delayedCall(PLAY.clearMs, () => {
      this.say('', '');
      this.level += 1;
      this.cleared = this.data_.targets.map(() => false);
      this.showHud();
      this.goalMoving = true;
      const to = levelScale(this.level, this.data_.shrink);
      this.tweens.addCounter({
        from: this.geometry.scale,
        to,
        duration: PLAY.goalBackMs,
        ease: 'Sine.easeInOut',
        onUpdate: (tween) => this.drawGoalAt(tween.getValue() ?? to),
        onComplete: () => {
          this.goalMoving = false;
          this.setupLevel();
          this.ready();
          const { wind } = this.data_;
          if (wind && this.level === wind.fromLevel) {
            this.say('WIND', 'WATCH THE FLAG');
            this.time.delayedCall(2200, () => {
              if (this.bannerText.text === 'WIND') this.say('', '');
            });
          }
        },
      });
    });
  }

  /** Puts the ball back to be kicked. */
  private ready(): void {
    this.resetBall();
    this.phase = 'ready';
    this.controls.cancel();
  }

  private resetBall(): void {
    this.aimGfx.clear();
    this.aiming = false;
    this.ball.setFrame('0').setPosition(KICK.origin.x, KICK.origin.y).setScale(1).setVisible(true);
    this.restShadow.setVisible(true);
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
    this.ready();
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
    this.levelText.setText(`GOAL ${this.level} OF ${this.data_.levels}`);
    centerPixelText(this.levelText, GAME_WIDTH / 2, 9);
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

  /** A word that rises from a point and fades: what the shot was worth, or how it missed. */
  private pop(text: string, x: number, y: number, tint: number): void {
    this.tweens.killTweensOf(this.popText);
    this.popText.setText(text).setTint(tint).setAlpha(1).setVisible(true);
    centerPixelText(this.popText, x, y);
    this.tweens.add({
      targets: this.popText,
      y: this.popText.y - 14,
      alpha: 0,
      duration: PLAY.resultMs,
      ease: 'Quad.easeOut',
    });
  }

  /** A ring that opens out from a target that was hit. */
  private ring(spot: Spot, colour: number): void {
    const ring = this.add
      .circle(spot.x, spot.y, spot.r, 0xffffff, 0)
      .setStrokeStyle(2, colour)
      .setDepth(5);
    this.tweens.add({
      targets: ring,
      scale: 2.6,
      alpha: 0,
      duration: 450,
      onComplete: () => ring.destroy(),
    });
  }

  /** Little squares thrown out from a point, falling as they fade. */
  private burst(
    x: number,
    y: number,
    colours: readonly number[],
    count: number,
    force: number,
  ): void {
    for (let piece = 0; piece < count; piece += 1) {
      const angle = Math.random() * Math.PI * 2;
      const reach = force * (0.4 + Math.random() * 0.6);
      const bit = this.add.rectangle(x, y, 2, 2, colours[piece % colours.length]).setDepth(5);
      this.tweens.add({
        targets: bit,
        x: x + Math.cos(angle) * reach,
        y: { value: y + Math.sin(angle) * reach + 28, ease: 'Quad.easeIn' },
        alpha: 0,
        duration: 520 + Math.random() * 260,
        ease: 'Quad.easeOut',
        onComplete: () => bit.destroy(),
      });
    }
  }

  /** Big words in the middle of the sky; empty words clear them. */
  private say(main: string, sub: string): void {
    this.bannerText.setText(main).setVisible(main !== '');
    this.bannerSub.setText(sub).setVisible(sub !== '');
    centerPixelText(this.bannerText, GAME_WIDTH / 2, 50);
    centerPixelText(this.bannerSub, GAME_WIDTH / 2, 76);
  }
}
