/**
 * Makes the Phaser game. Every game on a kiosk is 480 by 270, pixel art with no smoothing,
 * scaled to fit the screen: keep those as they are.
 */
import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH } from '../../shell/constants';
import { COLOUR, DATA_KEY } from './config';
import type { GameData } from './gameData';
import { Boot } from './scenes/Boot';
import { Over } from './scenes/Over';
import { Play } from './scenes/Play';
import { Title } from './scenes/Title';

export function run(data: GameData): void {
  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent: 'app',
    backgroundColor: COLOUR.background,
    pixelArt: true,
    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH,
      width: GAME_WIDTH,
      height: GAME_HEIGHT,
    },
    // This game has no sound. Take this out when it gets some.
    audio: { noAudio: true },
    // One finger is all this game uses.
    input: { activePointers: 1 },
    scene: [Boot, Title, Play, Over],
  });
  game.registry.set(DATA_KEY, data);

  if (import.meta.env.DEV) {
    // Handy for poking at the running game from the browser console.
    Object.assign(window, { game });
  }
}
