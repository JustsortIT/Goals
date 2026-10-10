import Phaser from 'phaser';
import { BACKGROUND_COLOR, GAME_HEIGHT, GAME_WIDTH, WORLD } from './config/constants';
import { Boot } from './scenes/Boot';
import { Game } from './scenes/Game';
import { GameOver } from './scenes/GameOver';
import { Preloader } from './scenes/Preloader';
import { Title } from './scenes/Title';
import { UI } from './scenes/UI';

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  parent: 'app',
  backgroundColor: BACKGROUND_COLOR,
  // Phaser 4: pixelArt turns off antialiasing and turns on roundPixels (now off by default).
  pixelArt: true,
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    width: GAME_WIDTH,
    height: GAME_HEIGHT,
  },
  // The game has no sound yet. Without this, phones log a warning about audio starting
  // before the first tap. Remove it when sounds are added.
  audio: { noAudio: true },
  input: {
    // Mouse plus three fingers, so the on-screen buttons can be held together.
    activePointers: 4,
  },
  physics: {
    default: 'arcade',
    arcade: {
      gravity: { x: 0, y: WORLD.gravity },
      // Toggle at runtime with the backtick key (see scenes/Game.ts).
      debug: false,
    },
  },
  // Scenes render in this order, so UI draws on top of Game. Only the first one auto-starts.
  scene: [Boot, Preloader, Title, Game, UI, GameOver],
};

const game = new Phaser.Game(config);

if (import.meta.env.DEV) {
  // Handy for poking at the running game from the browser console.
  Object.assign(window, { game });
}
