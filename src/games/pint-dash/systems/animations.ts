import type Phaser from 'phaser';
import { AnimKey } from '../config/keys';
import type { ThemeArt } from '../themes/theme';

interface AnimationSpec {
  key: string;
  texture: string;
  /** Frame numbers within the texture, in playback order. */
  frames: number[];
  frameRate: number;
}

/**
 * Every sprite animation in the game. Being in the air is not one of them: the Player
 * picks a pose by how fast it is rising or falling.
 */
function animations({ texture, idle, run, runFrameRate }: ThemeArt['hero']): AnimationSpec[] {
  return [
    { key: AnimKey.PlayerIdle, texture, frames: idle, frameRate: 1 },
    { key: AnimKey.PlayerRun, texture, frames: run, frameRate: runFrameRate },
  ];
}

/** Animations are global to the game, so this only needs to run once (from the Preloader). */
export function createAnimations(scene: Phaser.Scene, art: ThemeArt): void {
  for (const { key, texture, frames, frameRate } of animations(art.hero)) {
    if (!scene.anims.exists(key)) {
      scene.anims.create({
        key,
        frames: frames.map((frame) => ({ key: texture, frame })),
        frameRate,
        repeat: -1,
      });
    }
  }
}
