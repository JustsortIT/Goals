import Phaser from 'phaser';
import fontUrl from '../../../shell/fonts/kenney-mini.ttf?url';
import { FontKey } from '../../../shell/keys';
import { createPixelFont } from '../../../shell/pixelFont';
import { SceneKey } from '../config';

/** Loads what every scene needs. For now that is the pixel font, which all text is written in. */
export class Boot extends Phaser.Scene {
  constructor() {
    super(SceneKey.Boot);
  }

  preload(): void {
    this.load.font(FontKey.PixelSource, fontUrl, 'truetype');
  }

  create(): void {
    createPixelFont(this);
    this.scene.start(SceneKey.Title);
  }
}
