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

/**
 * How much to enlarge the 480 by 270 screen. A whole number keeps every font pixel the same size, which
 * is what makes the text look clean; where that would leave wide empty borders, fit the window instead.
 */
function crispZoom(): number {
  const fit = Math.min(window.innerWidth / GAME_WIDTH, window.innerHeight / GAME_HEIGHT);
  const whole = Math.max(1, Math.floor(fit));
  return fit / whole <= 1.34 ? whole : fit;
}

export function run(data: GameData): void {
  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent: 'app',
    backgroundColor: COLOUR.background,
    pixelArt: true,
    scale: {
      mode: Phaser.Scale.NONE,
      autoCenter: Phaser.Scale.CENTER_BOTH,
      width: GAME_WIDTH,
      height: GAME_HEIGHT,
      zoom: crispZoom(),
    },
    // This game has no sound. Take this out when it gets some.
    audio: { noAudio: true },
    // The mouse and two fingers. A game with on-screen buttons held together needs more.
    input: { activePointers: 1 },
    scene: [Boot, Title, Play, Over],
  });
  game.registry.set(DATA_KEY, data);
  window.addEventListener('resize', () => game.scale.setZoom(crispZoom()));

  if (import.meta.env.DEV) {
    // Handy for poking at the running game from the browser console.
    Object.assign(window, { game });
  }
}
