/**
 * Starts the game with its data, which the page's `boot.ts` read from `game.json`. This is the
 * one thing a game has to have: PubPixels will call the same `start(data)` with the data it
 * made for a pub. The data comes unchecked, so it is read and checked here first.
 */
import { readGameData } from './gameData';

export async function start(data: unknown): Promise<void> {
  const game = readGameData(data);
  // Phaser is loaded only now, after the data is known to be good.
  const { run } = await import('./main');
  run(game);
}
