import Phaser from 'phaser';
import { PLAYER } from '../config/constants';
import { RegistryKey, SceneKey } from '../config/keys';

/** First scene: one-off global setup, then straight to the Preloader. */
export class Boot extends Phaser.Scene {
  constructor() {
    super(SceneKey.Boot);
  }

  create(): void {
    this.registry.set(RegistryKey.Score, 0);
    this.registry.set(RegistryKey.Lives, PLAYER.lives);
    this.registry.set(RegistryKey.Section, '');
    this.registry.set(RegistryKey.PhysicsDebug, false);

    this.scene.start(SceneKey.Preloader);
  }
}
