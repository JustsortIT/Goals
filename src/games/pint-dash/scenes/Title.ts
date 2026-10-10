import Phaser from 'phaser';
import {
  FONT_SIZE,
  FX,
  GAME_HEIGHT,
  GAME_TITLE,
  GAME_WIDTH,
  TILE_SIZE,
  TITLE,
} from '../config/constants';
import { SceneKey, TextureKey } from '../config/keys';
import { Collectible } from '../entities/Collectible';
import { TITLE_LEVEL } from '../levels/title';
import { Flyers } from '../systems/ambient';
import { ParallaxBackground } from '../systems/background';
import { parseLevel } from '../systems/level';
import { addPixelText, centerPixelText } from '../systems/pixelFont';
import { theme, themeArt } from '../themes';

const START_KEYS = ['SPACE', 'ENTER'];
const MARGIN = 8;

/** Drawn over the street, in this order. */
const Depth = { Vignette: 10, Text: 20 } as const;

/** The home screen: the game's name over a quiet stretch of street, waiting for a key or a tap. */
export class Title extends Phaser.Scene {
  private starting = false;

  constructor() {
    super(SceneKey.Title);
  }

  // The scene instance is reused if the game ever returns here, so reset state.
  create(): void {
    this.starting = false;

    this.buildStreet();
    this.add
      .image(0, 0, TextureKey.Vignette)
      .setOrigin(0, 0)
      .setScrollFactor(0)
      .setDepth(Depth.Vignette);
    this.addName();
    this.addPrompt();

    this.cameras.main.fadeIn(FX.fadeInMs);

    // A tap or click starts the game too.
    this.input.once(Phaser.Input.Events.POINTER_DOWN, () => this.startGame());
    for (const key of START_KEYS) {
      this.input.keyboard?.on(`keydown-${key}`, (event: KeyboardEvent) => {
        if (!event.repeat) {
          this.startGame();
        }
      });
    }
  }

  /** The theme's backdrop and a small piece of level, drawn the way the game draws them. */
  private buildStreet(): void {
    const level = parseLevel(TITLE_LEVEL, TILE_SIZE);
    const widthPx = level.width * TILE_SIZE;
    const heightPx = level.height * TILE_SIZE;

    // Look at the middle of the street, with the ground along the bottom of the screen.
    // The backdrop reads the camera's position, so the camera is placed first.
    const scrollY = heightPx - GAME_HEIGHT;
    this.cameras.main.setScroll(Math.round((widthPx - GAME_WIDTH) / 2), scrollY);
    new ParallaxBackground(this, scrollY);
    new Flyers(this);
    theme.renderLevel(this, level);

    const { hero, enemy } = themeArt();
    for (const object of level.objects) {
      switch (object.type) {
        case 'player':
          this.add.image(object.x, object.y, hero.texture, hero.idle[0]).setOrigin(0.5, 1);
          break;
        case 'enemy':
          this.add.image(object.x, object.y, enemy.texture, enemy.frame).setOrigin(0.5, 1);
          break;
        case 'coin':
          new Collectible(this, object.x, object.y);
          break;
        case 'goal':
          theme.buildGoal(this, object.x, object.y);
          break;
      }
    }
  }

  private addName(): void {
    const centerX = GAME_WIDTH / 2;
    const name = GAME_TITLE.toUpperCase();

    // A dark copy underneath, set down a little, lifts the name off the skyline.
    const shadow = addPixelText(this, 0, 0, name, FONT_SIZE.title)
      .setTint(0x000000)
      .setAlpha(TITLE.shadowAlpha);
    centerPixelText(shadow, centerX, TITLE.nameY + TITLE.shadowOffset);
    const title = addPixelText(this, 0, 0, name, FONT_SIZE.title).setTint(TITLE.nameColor);
    centerPixelText(title, centerX, TITLE.nameY);

    const tagline = addPixelText(this, 0, 0, TITLE.tagline);
    centerPixelText(tagline, centerX, TITLE.taglineY);

    for (const text of [shadow, title, tagline]) {
      text.setScrollFactor(0).setDepth(Depth.Text);
    }
  }

  private addPrompt(): void {
    const centerX = GAME_WIDTH / 2;
    const touch = this.sys.game.device.input.touch;

    const prompt = addPixelText(
      this,
      0,
      0,
      touch ? 'TAP TO START' : 'PRESS SPACE TO START',
      FONT_SIZE.medium,
    );
    centerPixelText(prompt, centerX, TITLE.promptY);
    prompt.setScrollFactor(0).setDepth(Depth.Text);
    this.time.addEvent({
      delay: TITLE.blinkMs,
      loop: true,
      callback: () => prompt.setVisible(!prompt.visible),
    });

    if (!touch) {
      const hint = addPixelText(this, 0, 0, 'ARROWS / WASD: MOVE    SPACE: JUMP');
      centerPixelText(hint, centerX, GAME_HEIGHT - MARGIN - hint.height / 2);
      hint.setScrollFactor(0).setDepth(Depth.Text);
    }
  }

  private startGame(): void {
    if (this.starting) {
      return;
    }
    this.starting = true;

    const camera = this.cameras.main;
    camera.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
      this.scene.start(SceneKey.Game);
    });
    camera.fadeOut(FX.fadeOutMs);
  }
}
