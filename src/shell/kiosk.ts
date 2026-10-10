/**
 * The game on a kiosk: what the page knows of the kiosk's credit, and what the title screen
 * says about it. A play on a kiosk is paid for, so the game waits for a coin.
 *
 * The page says it is a kiosk's by giving `#app` the addresses to ask (`data-kiosk-state-url`,
 * `data-kiosk-plays-url`, `data-kiosk-mock-credits-url`, `data-kiosk-leaderboard-url`) and the
 * version it is playing
 * (`data-kiosk-game-version`), which `boot.ts` reads. Only the kiosk's own page (`/kiosk`) has them. Without them `kiosk()` is null
 * and nothing here is used: a publican's preview and public play are as they always were.
 *
 * The credit is held by the server, never by the page (docs/KIOSK_API.md). While an admin has
 * the kiosk in admin mode, a quarter of an hour at a time, the page shows buttons that pretend a
 * coin went in (`kioskAdmin.ts`), for trying a kiosk with no coin mechanism; the server
 * decides whether it is, and refuses a pretend coin when it is not. This file decides and formats; `systems/kioskLink.ts` does the asking. No Phaser imports.
 */

/** Where a kiosk's page asks, and which version of the game it has loaded. */
export interface Kiosk {
  stateUrl: string;
  playsUrl: string;
  mockCreditsUrl: string;
  leaderboardUrl: string;
  gameVersion: number;
}

/** Admin mode, while it lasts: how long is left, and the coins the page may pretend to take. */
export interface KioskAdminMode {
  secondsLeft: number;
  coinsCents: number[];
}

/**
 * What the server says the kiosk holds, in cents, and the rate it becomes lives at: every
 * `priceCents` of it is `lives` lives. A coin is lives: there is nothing to choose.
 */
export interface KioskState {
  balanceCents: number;
  priceCents: number;
  lives: number;
  /** Null unless an admin has the kiosk in admin mode. */
  adminMode: KioskAdminMode | null;
  /** False when an admin has silenced the venue: the game makes no sound. */
  sound: boolean;
}

/** What the title screen shows on a kiosk: two lines, and whether a tap starts a play. */
export interface KioskGate {
  canStart: boolean;
  prompt: string;
  detail: string;
}

let current: Kiosk | null = null;

/** What `#app` says of a kiosk, as its `data-kiosk-*` attributes arrive. */
export interface KioskData {
  kioskStateUrl?: string;
  kioskPlaysUrl?: string;
  kioskMockCreditsUrl?: string;
  kioskLeaderboardUrl?: string;
  kioskGameVersion?: string;
}

/** Called by `boot.ts` with what the page says. Anything missing means this is no kiosk. */
export function setKiosk(data: KioskData): void {
  const {
    kioskStateUrl: stateUrl,
    kioskPlaysUrl: playsUrl,
    kioskMockCreditsUrl: mockCreditsUrl,
    kioskLeaderboardUrl: leaderboardUrl,
  } = data;
  const version = Number(data.kioskGameVersion);
  current =
    stateUrl && playsUrl && mockCreditsUrl && leaderboardUrl && Number.isInteger(version) && version > 0
      ? { stateUrl, playsUrl, mockCreditsUrl, leaderboardUrl, gameVersion: version }
      : null;
}

/** The kiosk this page is on, or null on any other page. */
export function kiosk(): Kiosk | null {
  return current;
}

const isCents = (value: unknown): value is number => Number.isInteger(value) && (value as number) >= 0;

/** Reads the server's answer. Null for anything that is not a state, which is treated as not knowing. */
export function readKioskState(json: unknown): KioskState | null {
  if (typeof json !== 'object' || json === null) return null;
  const { balance_cents: balance, price_cents: price, lives, admin_mode: admin, sound } = json as Record<string, unknown>;
  if (!isCents(balance) || !isCents(price) || price === 0 || !isCents(lives) || lives === 0) return null;
  // Sound is on unless the server says it is off.
  return { balanceCents: balance, priceCents: price, lives, adminMode: readAdminMode(admin), sound: sound !== false };
}

/** Anything that is not admin mode with time left and coins to offer is no admin mode. */
function readAdminMode(json: unknown): KioskAdminMode | null {
  if (typeof json !== 'object' || json === null) return null;
  const { seconds_left: secondsLeft, coins_cents: coins } = json as Record<string, unknown>;
  if (typeof secondsLeft !== 'number' || !(secondsLeft > 0) || !Array.isArray(coins)) return null;
  const coinsCents = coins.filter((coin): coin is number => isCents(coin) && coin > 0);
  return coinsCents.length > 0 ? { secondsLeft, coinsCents } : null;
}

/** A coin's face, in letters the pixel font and any other has: 10C, 50C, EUR 1, EUR 2. */
export function formatCoin(cents: number): string {
  return cents < 100 ? `${cents}C` : `EUR ${cents / 100}`;
}

/** Money as the pixel font can write it: the font has no euro sign. */
export function formatEuros(cents: number): string {
  return `EUR ${Math.floor(cents / 100)}.${String(cents % 100).padStart(2, '0')}`;
}

type Credit = Pick<KioskState, 'balanceCents' | 'priceCents' | 'lives'>;

/** How many lives the credit on the kiosk comes to: so many for every whole price of it. */
export function livesFor({ balanceCents, priceCents, lives }: Credit): number {
  return Math.floor(balanceCents / priceCents) * lives;
}

const livesWords = (count: number) => `${count} ${count === 1 ? 'LIFE' : 'LIVES'}`;

/** The rate, as the screen says it: EUR 1 FOR 3 LIVES. */
export function rateWords({ priceCents, lives }: Pick<KioskState, 'priceCents' | 'lives'>): string {
  return `${formatCoin(priceCents)} FOR ${livesWords(lives)}`;
}

/**
 * What to show for a state, or for none while the server has not answered. With enough credit
 * for any lives, a tap starts a play with all of them. Credit that is short of that stays on the
 * kiosk, and the screen says how much more is wanted.
 */
export function kioskGate(state: Credit | null): KioskGate {
  if (!state) {
    return { canStart: false, prompt: 'ONE MOMENT', detail: '' };
  }
  const { balanceCents, priceCents } = state;
  const lives = livesFor(state);
  if (lives > 0) {
    return { canStart: true, prompt: 'TAP TO START', detail: livesWords(lives) };
  }
  if (balanceCents > 0) {
    return {
      canStart: false,
      prompt: `INSERT ${formatEuros(priceCents - balanceCents)} MORE`,
      detail: `CREDIT ${formatEuros(balanceCents)}`,
    };
  }
  return { canStart: false, prompt: 'INSERT COIN', detail: rateWords(state) };
}

/**
 * What to show when the lives have run out: a coin carries the play on, so the screen asks for
 * one, and says what is still wanted if some has gone in. There is nothing to press: the lives
 * are bought as soon as the credit covers them.
 */
export function continueGate(state: Credit | null): KioskGate {
  if (!state) return { canStart: false, prompt: 'CONTINUE?', detail: 'ONE MOMENT' };
  const { balanceCents, priceCents } = state;
  const short = balanceCents % priceCents;
  return {
    canStart: livesFor(state) > 0,
    prompt: 'CONTINUE?',
    detail: short > 0 ? `INSERT ${formatEuros(priceCents - short)} MORE` : `INSERT COIN  ${rateWords(state)}`,
  };
}

/** The kiosk's messages that mean its credit may have changed. */
const CREDIT_MESSAGES = new Set(['coin_credit', 'bill_credit', 'refresh_session']);

/** Whether a message from the kiosk's bridge, as it arrives (JSON text), is one of those. */
export function isCreditMessage(message: unknown): boolean {
  if (typeof message !== 'string') return false;
  try {
    const data: unknown = JSON.parse(message);
    return (
      typeof data === 'object' &&
      data !== null &&
      CREDIT_MESSAGES.has((data as Record<string, unknown>).type as string)
    );
  } catch {
    return false;
  }
}

/** An id for a play, made before the server is asked and sent again on every retry. */
export function newPlayId(): string {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  // An older browser, or a page not served over https: the same thing by hand.
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/**
 * The gesture that reloads a kiosk's page, for a kiosk with no keyboard: tap the four corners of
 * the screen in a circle, top left, top right, bottom right, bottom left, and round again, all
 * within `withinMs`. A tap anywhere else, or out of turn, starts it over.
 */
export const REFRESH_GESTURE = {
  /** How much of the screen's width and height, from each corner, counts as that corner. */
  corner: 0.15,
  rounds: 2,
  withinMs: 10_000,
} as const;

/** Which corner a tap is in: 0 top left, then clockwise to 3 bottom left. Null for none. */
export function cornerAt(x: number, y: number, width: number, height: number): number | null {
  const { corner } = REFRESH_GESTURE;
  const left = x <= width * corner;
  const right = x >= width * (1 - corner);
  const top = y <= height * corner;
  const bottom = y >= height * (1 - corner);
  if (top && left) return 0;
  if (top && right) return 1;
  if (bottom && right) return 2;
  if (bottom && left) return 3;
  return null;
}

/** Follows taps, one call each. Returns true on the tap that completes the gesture. */
export function refreshGesture(): (corner: number | null, timeMs: number) => boolean {
  const needed = REFRESH_GESTURE.rounds * 4;
  let done = 0;
  let startedAt = 0;

  return (corner, timeMs) => {
    if (done > 0 && timeMs - startedAt > REFRESH_GESTURE.withinMs) {
      done = 0;
    }
    if (corner === done % 4) {
      if (done === 0) startedAt = timeMs;
      done += 1;
    } else {
      // Out of turn. A tap on the first corner is a fresh start.
      done = corner === 0 ? 1 : 0;
      startedAt = timeMs;
    }
    if (done < needed) return false;
    done = 0;
    return true;
  };
}

/** One place on the venue's leaderboard. `playId` is how a play finds its own row. */
export interface LeaderboardEntry {
  rank: number;
  initials: string;
  score: number;
  playId: number;
}

/** The venue's scores for this game: the best of the week, and the best there has ever been. */
export interface Leaderboard {
  entries: LeaderboardEntry[];
  best: { initials: string; score: number } | null;
}

/** Reads the server's leaderboard. Null for anything that is not one. */
export function readLeaderboard(json: unknown): Leaderboard | null {
  if (typeof json !== 'object' || json === null) return null;
  const { entries, best } = json as Record<string, unknown>;
  if (!Array.isArray(entries)) return null;

  const read: LeaderboardEntry[] = [];
  for (const entry of entries as Record<string, unknown>[]) {
    if (typeof entry !== 'object' || entry === null) return null;
    const { rank, initials, score, play_id: playId } = entry;
    if (!isCents(rank) || typeof initials !== 'string' || !isCents(score) || !isCents(playId)) return null;
    read.push({ rank, initials, score, playId });
  }

  const top = best as Record<string, unknown> | null | undefined;
  const hasBest = typeof top === 'object' && top !== null && typeof top.initials === 'string' && isCents(top.score);
  return {
    entries: read,
    best: hasBest ? { initials: top.initials as string, score: top.score as number } : null,
  };
}

/** How a play that has just ended did: the server's id for it, and where it stands in the week. */
export interface FinishedPlay {
  id: number;
  /** Null for a play that no leaderboard counts, such as one made in admin mode. */
  rank: number | null;
  /** Whether it came high enough for the player to be asked for initials. */
  asksInitials: boolean;
}

/** Reads the server's answer to a play's score. Null for anything else. */
export function readFinishedPlay(json: unknown): FinishedPlay | null {
  if (typeof json !== 'object' || json === null) return null;
  const { id, rank, asks_initials: asks } = json as Record<string, unknown>;
  if (!isCents(id)) return null;
  return { id, rank: isCents(rank) && rank > 0 ? rank : null, asksInitials: asks === true };
}

/** Initials are three of these, and start as the first. */
export const INITIAL_LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

/** The letter `steps` on from `letter`, going round from Z to A and back. */
export function stepLetter(letter: string, steps: number): string {
  const count = INITIAL_LETTERS.length;
  const index = Math.max(0, INITIAL_LETTERS.indexOf(letter));
  return INITIAL_LETTERS[(((index + steps) % count) + count) % count];
}
