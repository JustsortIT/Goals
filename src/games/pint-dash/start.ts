/**
 * Starts Pint Dash, the first prototype (4 October 2026). It is kept as it was, as a worked
 * example of a whole game: it takes no data, since its level and art are in this folder, and it
 * knows nothing of the shell, coins or lives. PubPixels' platformer grew out of it and has left
 * it behind. Do not copy how it starts or scores: start a new game from `_template`.
 */
export async function start(): Promise<void> {
  await import('./main');
}
