/**
 * What a bonus mini game gives back to the Play scene when it is over, and the way back to it. A
 * mini game is a scene of its own that runs while Play is paused; it hands over its result, and
 * Play takes up the play where it left off (see `Play.miniDone`).
 */
import type Phaser from 'phaser';
import { SceneKey } from './config';

export interface MiniResult {
  /** What the game was worth before the bonus's multiplier. */
  points: number;
  /** Every glass, dart or customer it asked for was done well enough. */
  cleared: boolean;
}

/** The part of the Play scene a mini game calls. */
interface Returning {
  miniDone(result: MiniResult): void;
}

/** Gives the result to Play, lets it carry on and stops this scene. */
export function returnToPlay(scene: Phaser.Scene, result: MiniResult): void {
  const play = scene.scene.get(SceneKey.Play) as unknown as Returning;
  play.miniDone(result);
  scene.scene.resume(SceneKey.Play);
  scene.scene.stop();
}
