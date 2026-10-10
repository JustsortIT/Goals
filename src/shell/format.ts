/** Small formatting helpers for text shown to the player. Pure, no Phaser imports. */

/** A length of time as minutes and seconds, such as `1:27`. Fractions of a second are dropped. */
export function formatTime(milliseconds: number): string {
  const totalSeconds = Math.max(0, Math.floor(milliseconds / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}
