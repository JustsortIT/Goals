import Phaser from 'phaser';
import fontUrl from '../../../shell/fonts/kenney-mini.ttf?url';
import { FontKey } from '../../../shell/keys';
import { createPixelFont } from '../../../shell/pixelFont';
import { createTextures } from '../art';
import { SceneKey } from '../config';

/** Loads what every scene needs: the pixel font all text is written in, and the pictures. */
export class Boot extends Phaser.Scene {
  constructor() {
    super(SceneKey.Boot);
  }

  preload(): void {
    this.load.font(FontKey.PixelSource, fontUrl, 'truetype');
  }

  create(): void {
    createPixelFont(this);
    createTextures(this);
    this.scene.start(SceneKey.Title);
  }
}
