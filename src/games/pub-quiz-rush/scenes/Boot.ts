import Phaser from 'phaser';
import { createTextures } from '../art';
import { SceneKey } from '../config';

/** Makes the pictures every scene needs. */
export class Boot extends Phaser.Scene {
  constructor() {
    super(SceneKey.Boot);
  }

  create(): void {
    createTextures(this);
    this.scene.start(SceneKey.Title);
  }
}
