/**
 * The venue's leaderboard as rows to draw: the best few of the week, with the player's own place
 * marked, and shown even if it came lower than the rows there is room for. Pure: no Phaser.
 */
import type { Leaderboard } from '../../shell/kiosk';

export interface ScoreRow {
  rank: number;
  initials: string;
  score: number;
  /** This is the play that has just ended. */
  mine: boolean;
}

export function scoreRows(
  board: Leaderboard | null,
  playId: number | null,
  most: number,
): ScoreRow[] {
  if (!board) return [];
  const rows = board.entries.map((entry) => ({
    rank: entry.rank,
    initials: entry.initials,
    score: entry.score,
    mine: playId !== null && entry.playId === playId,
  }));
  const shown = rows.slice(0, most);
  const own = rows.find((row) => row.mine);
  // A place lower down is shown in the last row, so the player always sees where they came.
  if (own && !shown.includes(own) && shown.length > 0) shown[shown.length - 1] = own;
  return shown;
}
