/**
 * The rules of the serving bonus, as plain sums with no Phaser in them (tested in
 * `bonusGames.test.ts`). Customers come to the bar one after another, each wanting a drink and
 * waiting a while. A pint is always ready for someone who is waiting; a tap on the customer who
 * wants it serves them. Serve enough of them and the bonus is cleared.
 *
 * `ServeRun` is the whole game, run by feeding it the time and the taps, so it can be played by a
 * test as well as by a scene.
 */
import { SERVE } from './config';
import type { ServeSettings } from './gameData';

/** One customer, as the round's rule makes them: where they stand, what they want, when they come. */
export interface CustomerSpec {
  id: number;
  slot: number;
  wants: number;
  arriveMs: number;
  patienceMs: number;
}

export interface ServeRound {
  customers: CustomerSpec[];
  needed: number;
  pintGapMs: number;
  wrongPenaltyMs: number;
  pointsEach: number;
  /** The pint's number the bonus comes after: it sets how hard the round is. */
  number: number;
}

/** A small seeded random, the same every time for the same pint. */
function seeded(seed: number): () => number {
  let state = seed * 7919 + 13;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * The round after pint `number`: the customers come quicker and wait less each pint further on,
 * by rule, and no one has to wait for a place at the bar (a customer is gone before the same place
 * is wanted again).
 */
export function serveRound(
  number: number,
  settings: ServeSettings,
  places: number = SERVE.slots.length,
): ServeRound {
  const random = seeded(number);
  const gap = Math.max(settings.minGapMs, settings.gapMs - settings.gapStep * (number - 1));
  const wanted = Math.max(
    settings.minPatienceMs,
    settings.patienceMs - settings.patienceStep * (number - 1),
  );
  // The place is free again when the next customer for it comes, a little after this one has gone.
  const patience = Math.min(wanted, places * gap - 400);
  let last = -1;
  const customers = Array.from({ length: settings.customers }, (_, id): CustomerSpec => {
    // Never the same drink three in a row, so the front pint is not always the one that is wanted.
    let wants = Math.floor(random() * 3);
    if (wants === last && random() < 0.5) wants = (wants + 1) % 3;
    last = wants;
    return {
      id,
      slot: id % places,
      wants,
      arriveMs: settings.firstMs + id * gap,
      patienceMs: patience,
    };
  });
  return {
    customers,
    needed: settings.needed,
    pintGapMs: settings.pintGapMs,
    wrongPenaltyMs: settings.wrongPenaltyMs,
    pointsEach: settings.pointsEach * number,
    number,
  };
}

export type CustomerState = 'later' | 'waiting' | 'served' | 'left';

export interface Customer extends CustomerSpec {
  state: CustomerState;
  /** How much of their patience is left. */
  leftMs: number;
}

/** What happened, for the scene to show: it reads these and clears them. */
export type ServeEvent =
  | { type: 'arrive'; customer: Customer }
  | { type: 'pint'; kind: number }
  | { type: 'pintLost' }
  | { type: 'served'; customer: Customer; points: number }
  | { type: 'wrong'; customer: Customer }
  | { type: 'left'; customer: Customer };

/** How long a pint takes to slide from where it is pulled to a place at the bar. */
export const slideTimeMs = (slotX: number): number =>
  Math.max(160, Math.abs(slotX - SERVE.pullX) / SERVE.slideSpeed);

/** How a customer feels, from how much patience they have left. */
export type Mood = 'happy' | 'content' | 'annoyed' | 'angry';
export function moodOf(customer: Customer): Mood {
  if (customer.state === 'served') return 'happy';
  const share = customer.leftMs / customer.patienceMs;
  return share > 0.55 ? 'content' : share > 0.25 ? 'annoyed' : 'angry';
}

export class ServeRun {
  readonly round: ServeRound;
  readonly customers: Customer[];
  /** What happened since the scene last looked. */
  events: ServeEvent[] = [];
  timeMs = 0;
  /** The pint at the front, or null if there is none yet, and when it came. */
  pint: { kind: number; sinceMs: number } | null = null;
  served = 0;
  missed = 0;
  wrong = 0;
  points = 0;

  private nextPintAt: number;
  /** Picks which waiting customer the next pint is for: seeded, so a round plays the same way each time. */
  private readonly pick: () => number;

  constructor(round: ServeRound) {
    this.round = round;
    this.customers = round.customers.map((spec) => ({
      ...spec,
      state: 'later',
      leftMs: spec.patienceMs,
    }));
    this.nextPintAt = 0;
    this.pick = seeded(round.number + 101);
  }

  /** Everyone has been served or has given up. */
  get finished(): boolean {
    return this.customers.every(
      (customer) => customer.state === 'served' || customer.state === 'left',
    );
  }

  /** Enough were served. */
  get cleared(): boolean {
    return this.served >= this.round.needed;
  }

  waiting(): Customer[] {
    return this.customers.filter((customer) => customer.state === 'waiting');
  }

  /** The customer in a place, if one is waiting there. */
  at(slot: number): Customer | null {
    return this.customers.find((c) => c.slot === slot && c.state === 'waiting') ?? null;
  }

  update(deltaMs: number): void {
    this.timeMs += deltaMs;
    for (const customer of this.customers) {
      if (customer.state === 'later' && this.timeMs >= customer.arriveMs) {
        customer.state = 'waiting';
        this.events.push({ type: 'arrive', customer });
      }
      if (customer.state === 'waiting') {
        // They have been waiting since they came, less what a wrong pint cost them.
        customer.leftMs = Math.min(
          customer.leftMs,
          customer.patienceMs - (this.timeMs - customer.arriveMs),
        );
        if (customer.leftMs <= 0) {
          customer.state = 'left';
          customer.leftMs = 0;
          this.missed += 1;
          this.events.push({ type: 'left', customer });
        }
      }
    }

    // A pint that no one waiting wants any more is poured away.
    if (this.pint && !this.waiting().some((customer) => customer.wants === this.pint?.kind)) {
      this.pint = null;
      this.nextPintAt = this.timeMs + this.round.pintGapMs;
      this.events.push({ type: 'pintLost' });
    }
    // The next pint is of a drink someone who is waiting wants, picked at random but the same each time.
    if (!this.pint && this.timeMs >= this.nextPintAt) {
      const waiting = this.waiting();
      if (waiting.length > 0) {
        const chosen = waiting[Math.floor(this.pick() * waiting.length)];
        this.pint = { kind: chosen.wants, sinceMs: this.timeMs };
        this.events.push({ type: 'pint', kind: chosen.wants });
      }
    }
  }

  /**
   * A tap on a place at the bar. Serves the pint to the customer there if it is what they want;
   * if it is not, it is wasted and costs them patience. Does nothing with no pint or no customer.
   */
  tap(slot: number): 'served' | 'wrong' | 'none' {
    const customer = this.at(slot);
    if (!this.pint || !customer) return 'none';
    const kind = this.pint.kind;
    this.pint = null;
    this.nextPintAt = this.timeMs + this.round.pintGapMs;

    if (customer.wants === kind) {
      // The quicker they are served, the more it is worth: up to twice as much.
      const points = Math.round(
        this.round.pointsEach * (1 + customer.leftMs / customer.patienceMs),
      );
      customer.state = 'served';
      this.served += 1;
      this.points += points;
      this.events.push({ type: 'served', customer, points });
      return 'served';
    }
    this.wrong += 1;
    customer.leftMs -= this.round.wrongPenaltyMs;
    customer.patienceMs -= this.round.wrongPenaltyMs;
    this.events.push({ type: 'wrong', customer });
    return 'wrong';
  }

  /** Takes what has happened, for the scene to show. */
  drain(): ServeEvent[] {
    const events = this.events;
    this.events = [];
    return events;
  }
}
