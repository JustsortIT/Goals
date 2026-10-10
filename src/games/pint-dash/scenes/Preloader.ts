import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH } from '../config/constants';
import { FontKey, SceneKey } from '../config/keys';
import { createAnimations } from '../systems/animations';
import { createCommonTextures } from '../systems/commonTextures';
import { createPixelFont } from '../systems/pixelFont';
import { createThemeArt, theme } from '../themes';

const BAR_WIDTH = 120;
const BAR_HEIGHT = 6;

/** Loads every asset the game needs, builds what is derived from them, then shows the title. */
export class Preloader extends Phaser.Scene {
  constructor() {
    super(SceneKey.Preloader);
  }

  preload(): void {
    const bar = this.add
      .rectangle((GAME_WIDTH - BAR_WIDTH) / 2, GAME_HEIGHT / 2, 0, BAR_HEIGHT, 0xffffff)
      .setOrigin(0, 0.5);
    this.load.on(Phaser.Loader.Events.PROGRESS, (progress: number) => {
      bar.setSize(BAR_WIDTH * progress, BAR_HEIGHT);
    });
    this.load.on(Phaser.Loader.Events.FILE_LOAD_ERROR, (file: Phaser.Loader.File) => {
      throw new Error(`Could not load asset "${file.key}" from ${file.url}.`);
    });

    // The art depends on the theme; the font is the same under all of them.
    theme.preload(this);
    // Phaser 4 loads fonts natively; the key becomes the CSS font-family.
    // Path relative to public/. Source and licence: public/assets/CREDITS.md.
    this.load.font(FontKey.PixelSource, 'assets/fonts/kenney-mini.ttf', 'truetype');
  }

  create(): void {
    createCommonTextures(this);
    createPixelFont(this);
    createAnimations(this, createThemeArt(this));
    this.scene.start(SceneKey.Title);
  }
}
