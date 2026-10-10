/**
 * A play, as the kiosk sees it: paid for with what is on the kiosk when it starts, given more
 * lives by any coin that goes in while it lasts, and ended with one score. This is the shell's
 * coin model put in one place for a game to use (see CLAUDE.md at the top of the repo):
 *
 * - a coin is lives: every whole euro on the kiosk is 3 lives, whenever it goes in;
 * - there is nothing to choose and no button: credit becomes lives as soon as it covers any;
 * - when the lives run out the player has `KIOSK.continueMs` to put in a coin and carry on;
 * - one score is sent at the end, and nothing is ever given for it.
 *
 * With no kiosk (a preview, or public play) none of this happens: the game is free and its
 * score goes nowhere. A game must work both ways, so ask `onKiosk()` and never assume.
 */
import { KIOSK } from '../../shell/constants';
import { kiosk, livesFor, type FinishedPlay, type KioskState } from '../../shell/kiosk';
import {
  fetchKioskState,
  finishPlay,
  onKioskCredit,
  startPlay,
  topUpPlay,
} from '../../shell/kioskLink';

export const onKiosk = (): boolean => kiosk() !== null;

/** Starts a play. Gives its lives, or null if the kiosk would not start one (not enough credit). */
export async function beginPlay(freeLives: number): Promise<number | null> {
  if (!onKiosk()) return freeLives;
  const result = await startPlay();
  return result.status === 'started' ? result.lives : null;
}

/** Sends the play's score. Gives where it came in the week, or null with no kiosk or no answer. */
export async function endPlay(score: number): Promise<FinishedPlay | null> {
  return onKiosk() ? finishPlay(score) : null;
}

/**
 * Watches the kiosk while a play lasts: asks what it holds when it says a coin went in, and
 * every so often in case that was not heard. Credit that comes to any lives is turned into
 * them at once. Does nothing with no kiosk.
 */
export class CoinWatch {
  private asking: Promise<void> | null = null;
  private stop: (() => void) | null = null;
  private readonly bought: (lives: number) => void;
  private readonly heard: (state: KioskState) => void;

  /** `bought` is told of lives as they are bought; `heard` of what the kiosk holds each time it is asked. */
  constructor(bought: (lives: number) => void, heard: (state: KioskState) => void = () => {}) {
    this.bought = bought;
    this.heard = heard;
  }

  start(): void {
    if (!onKiosk() || this.stop) return;
    const stopListening = onKioskCredit(() => void this.ask());
    const timer = window.setInterval(() => void this.ask(), KIOSK.pollMs);
    this.stop = () => {
      stopListening();
      window.clearInterval(timer);
    };
    void this.ask();
  }

  /**
   * Stops watching, and waits for a top-up that is already out. Lives that one buys are still
   * told to `bought`: they have been paid for, so the game has to look at its lives again
   * after this before it ends.
   */
  async end(): Promise<void> {
    this.stop?.();
    this.stop = null;
    await this.asking;
  }

  /** Asks the kiosk now, without waiting for a coin or the next turn of the clock. */
  ask(): Promise<void> {
    this.asking ??= this.askOnce().finally(() => {
      this.asking = null;
    });
    return this.asking;
  }

  private async askOnce(): Promise<void> {
    const state = await fetchKioskState();
    if (!state) return;
    this.heard(state);
    if (livesFor(state) === 0) return;

    const result = await topUpPlay();
    if (result.status === 'bought') this.bought(result.lives);
  }
}
