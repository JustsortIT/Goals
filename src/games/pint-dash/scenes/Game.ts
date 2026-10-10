import Phaser from 'phaser';
import {
  CAMERA,
  CHECKPOINT,
  ENEMY,
  FX,
  GAME_HEIGHT,
  PLAYER,
  TILE_SIZE,
  WORLD,
} from '../config/constants';
import { RegistryKey, SceneKey } from '../config/keys';
import { Collectible } from '../entities/Collectible';
import { Enemy } from '../entities/Enemy';
import { Player, PlayerEvent } from '../entities/Player';
import { ACTIVE_LEVEL } from '../levels/levels';
import { Flyers } from '../systems/ambient';
import { ParallaxBackground } from '../systems/background';
import { addNoticeBoard } from '../systems/boards';
import { Effects } from '../systems/effects';
import { PlayerInput, type InputState } from '../systems/input';
import { parseSections, sectionStarts } from '../systems/level';
import { buildLevel, shouldCollideWithTile, type BuiltLevel } from '../systems/levelLoader';
import { isStomp } from '../systems/movement';
import { theme } from '../themes';

type Phase = 'playing' | 'dying' | 'finished';

/** A sign that moves the respawn point to itself once the player has passed it. */
interface Checkpoint {
  x: number;
  y: number;
  reached: boolean;
}

/** What the end screen is told about the run. */
export interface RunSummary {
  won: boolean;
  score: number;
  timeMs: number;
  pints: number;
  pintsTotal: number;
}

const NO_INPUT: InputState = { moveX: 0, jumpPressed: false, jumpHeld: false };

/** The level itself: builds the map, owns the entities and decides win/lose. */
export class Game extends Phaser.Scene {
  private level!: BuiltLevel;
  private player!: Player;
  private playerInput!: PlayerInput;
  private effects!: Effects;
  private enemies!: Phaser.GameObjects.Group;
  private coins!: Phaser.GameObjects.Group;
  /** The doorway of the goal building: touching it finishes the level. */
  private goal!: Phaser.GameObjects.Zone;
  private spawnPoint = { x: 0, y: 0 };
  private checkpoints: Checkpoint[] = [];
  private readonly sections = sectionStarts(ACTIVE_LEVEL.sections);
  /** The furthest section reached. Only ever goes up, so going back does not name it again. */
  private sectionIndex = -1;
  private pints = 0;
  private pintsTotal = 0;
  private startedAt = 0;
  private finishedAt = 0;
  private phase: Phase = 'playing';
  private tileDebug: Phaser.GameObjects.Graphics | null = null;

  constructor() {
    super(SceneKey.Game);
  }

  // The scene instance is reused across restarts, so reset all state here.
  create(): void {
    this.phase = 'playing';
    this.tileDebug = null;
    this.checkpoints = [];
    this.pints = 0;
    this.pintsTotal = 0;
    this.startedAt = this.time.now;
    this.sectionIndex = -1;
    this.registry.set(RegistryKey.Section, '');
    this.registry.set(RegistryKey.Score, 0);
    this.registry.set(RegistryKey.Lives, PLAYER.lives);

    const levelData = parseSections(ACTIVE_LEVEL.sections, TILE_SIZE);
    new ParallaxBackground(this, levelData.height * TILE_SIZE - GAME_HEIGHT);
    new Flyers(this);

    this.level = buildLevel(this, levelData);
    this.physics.world.setBounds(0, 0, this.level.widthPx, this.level.heightPx);
    // Open at the bottom so the player can fall out of the world.
    this.physics.world.setBoundsCollision(true, true, true, false);

    this.effects = new Effects(this);
    this.spawnEntities();
    this.addCollisions();
    this.addPlayerEffects();
    this.setupCamera();
    this.setupKeys();

    this.scene.launch(SceneKey.UI);
    this.setPhysicsDebug(this.registry.get(RegistryKey.PhysicsDebug) === true);
  }

  override update(_time: number, delta: number): void {
    // Phaser 4: Group#children is a native Set.
    for (const enemy of this.enemies.children) {
      if (enemy instanceof Enemy) {
        enemy.patrol(this.level.layer);
      }
    }

    if (this.phase === 'finished') {
      // Let friction bring the player to a stop while the level-complete effects play.
      this.player.tick(NO_INPUT, delta);
      return;
    }
    if (this.phase !== 'playing') {
      return;
    }

    this.player.tick(this.playerInput.read(), delta);
    this.passCheckpoints();
    this.enterSections();

    if (this.player.y > this.level.heightPx + WORLD.fallDeathMargin) {
      this.killPlayer();
    }
  }

  /** Tells the HUD when the player gets to a new section of the level, so it can name it. */
  private enterSections(): void {
    const column = this.player.x / TILE_SIZE;
    let index = this.sectionIndex;
    while (index + 1 < this.sections.length && this.sections[index + 1].column <= column) {
      index++;
    }
    if (index !== this.sectionIndex) {
      this.sectionIndex = index;
      this.registry.set(RegistryKey.Section, this.sections[index].name);
    }
  }

  /** Passing a checkpoint sign, at any height, moves the respawn point to it. */
  private passCheckpoints(): void {
    for (const checkpoint of this.checkpoints) {
      if (checkpoint.reached || this.player.x < checkpoint.x) {
        continue;
      }
      checkpoint.reached = true;
      this.spawnPoint = { x: checkpoint.x, y: checkpoint.y };
      this.effects.sparkle(checkpoint.x, checkpoint.y - TILE_SIZE);
      this.effects.popup(checkpoint.x, checkpoint.y - TILE_SIZE * 2, 'CHECKPOINT');
    }
  }

  private spawnEntities(): void {
    this.enemies = this.add.group();
    this.coins = this.add.group();

    for (const object of this.level.objects) {
      switch (object.type) {
        case 'player':
          this.spawnPoint = { x: object.x, y: object.y };
          break;
        case 'enemy':
          this.enemies.add(new Enemy(this, object.x, object.y));
          break;
        case 'fastEnemy':
          this.enemies.add(new Enemy(this, object.x, object.y, ENEMY.fastPatrolSpeed));
          break;
        case 'coin':
          this.coins.add(new Collectible(this, object.x, object.y));
          this.pintsTotal++;
          break;
        case 'life':
          this.coins.add(new Collectible(this, object.x, object.y, 'life'));
          break;
        case 'checkpoint':
          this.checkpoints.push({ x: object.x, y: object.y, reached: false });
          break;
        case 'notice':
          addNoticeBoard(this, object.x, object.y, object.text ?? '');
          break;
        case 'goal':
          // The theme draws the building; the doorway is one cell, the same in all of them.
          theme.buildGoal(this, object.x, object.y);
          this.goal = this.add.zone(object.x, object.y - TILE_SIZE / 2, TILE_SIZE, TILE_SIZE);
          this.physics.add.existing(this.goal, true);
          break;
      }
    }

    // A sign right by the start is not a checkpoint: the player starts there anyway.
    for (const checkpoint of this.checkpoints) {
      checkpoint.reached = checkpoint.x <= this.spawnPoint.x + CHECKPOINT.nearStart;
    }

    // Created last so the player draws in front of everything else.
    this.player = new Player(this, this.spawnPoint.x, this.spawnPoint.y);
  }

  private addCollisions(): void {
    const { layer } = this.level;

    this.physics.add.collider(this.player, layer, undefined, shouldCollideWithTile);
    this.physics.add.collider(this.enemies, layer, undefined, shouldCollideWithTile);

    this.physics.add.overlap(this.player, this.coins, (_player, coin) => {
      if (coin instanceof Collectible) {
        this.collectCoin(coin);
      }
    });

    this.physics.add.overlap(this.player, this.enemies, (_player, enemy) => {
      if (enemy instanceof Enemy) {
        this.hitEnemy(enemy);
      }
    });

    this.physics.add.overlap(this.player, this.goal, () => this.reachGoal());
  }

  private addPlayerEffects(): void {
    this.player.on(PlayerEvent.Jumped, () => {
      this.effects.dust(this.player.x, this.player.y, 4);
    });
    this.player.on(PlayerEvent.Landed, (fallSpeed: number) => {
      if (fallSpeed >= FX.landDustMinSpeed) {
        this.effects.dust(this.player.x, this.player.y, 6);
      }
    });
  }

  private setupCamera(): void {
    const camera = this.cameras.main;
    camera.setBounds(0, 0, this.level.widthPx, this.level.heightPx);
    camera.startFollow(this.player, true, CAMERA.lerp, CAMERA.lerp);
    camera.setDeadzone(CAMERA.deadzoneWidth, CAMERA.deadzoneHeight);
    camera.fadeIn(FX.fadeInMs);
  }

  private setupKeys(): void {
    this.playerInput = new PlayerInput(this);

    // Keyboard listeners are removed automatically when the scene shuts down.
    const keyboard = this.input.keyboard;
    keyboard?.on('keydown-R', (event: KeyboardEvent) => {
      if (!event.repeat) {
        this.scene.restart();
      }
    });
    keyboard?.on('keydown-BACKTICK', (event: KeyboardEvent) => {
      if (!event.repeat) {
        this.setPhysicsDebug(!this.physics.world.drawDebug);
      }
    });
  }

  private collectCoin(coin: Collectible): void {
    const { x, y, kind } = coin;
    const value = coin.collect();
    this.effects.sparkle(x, y);

    if (kind === 'life') {
      const lives = this.registry.get(RegistryKey.Lives) as number;
      if (lives < PLAYER.lives) {
        this.registry.set(RegistryKey.Lives, lives + 1);
        this.effects.popup(x, y - 4, '+1 LIFE', 0xff9a9a);
        return;
      }
      // No life to give back, so the heart is worth points instead.
    } else {
      this.pints++;
    }

    this.registry.inc(RegistryKey.Score, value);
    this.effects.popup(x, y - 4, `+${value}`);
  }

  private hitEnemy(enemy: Enemy): void {
    if (this.phase !== 'playing') {
      return;
    }

    if (isStomp(this.player.previousBottom, enemy.body.top, PLAYER.stompTolerance)) {
      this.effects.enemyBurst(enemy.x, enemy.body.center.y);
      this.cameras.main.shake(FX.stompShake.durationMs, FX.stompShake.intensity);
      enemy.smash();
      this.player.bounce();
    } else {
      this.killPlayer();
    }
  }

  private killPlayer(): void {
    if (this.phase !== 'playing') {
      return;
    }
    this.phase = 'dying';

    this.effects.playerBurst(this.player.x, this.player.body.center.y);
    this.player.die();
    this.cameras.main.shake(FX.deathShake.durationMs, FX.deathShake.intensity);

    const lives = (this.registry.get(RegistryKey.Lives) as number) - 1;
    this.registry.set(RegistryKey.Lives, lives);

    this.time.delayedCall(PLAYER.respawnDelayMs, () => {
      if (lives <= 0) {
        this.finish(false);
        return;
      }
      this.player.respawn(this.spawnPoint.x, this.spawnPoint.y);
      this.phase = 'playing';
    });
  }

  private reachGoal(): void {
    if (this.phase !== 'playing') {
      return;
    }
    this.phase = 'finished';

    this.effects.confetti(this.goal.x, this.goal.y - TILE_SIZE * 1.5);
    this.time.delayedCall(FX.goalCelebrationMs, () => this.fadeToGameOver(true));
  }

  private finish(won: boolean): void {
    if (this.phase === 'finished') {
      return;
    }
    this.phase = 'finished';
    this.fadeToGameOver(won);
  }

  private fadeToGameOver(won: boolean): void {
    // The clock stops here, not when the fade ends.
    this.finishedAt = this.time.now;
    const camera = this.cameras.main;
    camera.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
      this.scene.stop(SceneKey.UI);
      const summary: RunSummary = {
        won,
        score: this.registry.get(RegistryKey.Score) as number,
        timeMs: this.finishedAt - this.startedAt,
        pints: this.pints,
        pintsTotal: this.pintsTotal,
      };
      this.scene.start(SceneKey.GameOver, summary);
    });
    camera.fadeOut(FX.fadeOutMs);
  }

  /** Arcade body outlines plus an overlay of colliding tiles (tiles are not bodies). */
  private setPhysicsDebug(enabled: boolean): void {
    const world = this.physics.world;

    if (enabled && !world.debugGraphic) {
      world.createDebugGraphic();
    }
    world.drawDebug = enabled;
    if (world.debugGraphic) {
      world.debugGraphic.clear();
    }

    if (enabled && !this.tileDebug) {
      this.tileDebug = this.add.graphics().setDepth(1000);
      this.level.layer.renderDebug(this.tileDebug, {
        tileColor: null,
        collidingTileColor: new Phaser.Display.Color(255, 160, 0, 70),
        faceColor: new Phaser.Display.Color(255, 255, 255, 255),
      });
    }
    this.tileDebug?.setVisible(enabled);

    this.registry.set(RegistryKey.PhysicsDebug, enabled);
  }
}
