import { afterEach, describe, expect, it } from 'vitest';
import {
  cornerAt,
  formatCoin,
  formatEuros,
  readFinishedPlay,
  readLeaderboard,
  REFRESH_GESTURE,
  refreshGesture,
  stepLetter,
  isCreditMessage,
  kiosk,
  continueGate,
  kioskGate,
  livesFor,
  newPlayId,
  readKioskState,
  setKiosk,
} from './kiosk';

afterEach(() => setKiosk({}));

describe('setKiosk', () => {
  it('is a kiosk only when the page gives both addresses and a version', () => {
    expect(kiosk()).toBeNull();

    const data = {
      kioskStateUrl: '/api/kiosk/v1/state',
      kioskPlaysUrl: '/api/kiosk/v1/plays',
      kioskMockCreditsUrl: '/api/kiosk/v1/mock_credits',
      kioskLeaderboardUrl: '/api/kiosk/v1/leaderboard',
      kioskGameVersion: '3',
    };
    setKiosk(data);
    expect(kiosk()).toEqual({
      stateUrl: '/api/kiosk/v1/state',
      playsUrl: '/api/kiosk/v1/plays',
      mockCreditsUrl: '/api/kiosk/v1/mock_credits',
      leaderboardUrl: '/api/kiosk/v1/leaderboard',
      gameVersion: 3,
    });

    setKiosk({ ...data, kioskPlaysUrl: undefined });
    expect(kiosk()).toBeNull();
    setKiosk({ ...data, kioskGameVersion: 'three' });
    expect(kiosk()).toBeNull();
  });
});

/** The rate, as the server sends it and as the page keeps it: a euro is three lives. */
const RATE_JSON = { price_cents: 100, lives: 3 };
const RATE = { priceCents: 100, lives: 3 };

describe('readKioskState', () => {
  it('reads the credit and the rate it becomes lives at', () => {
    expect(readKioskState({ balance_cents: 400, ...RATE_JSON, venue: {}, game: null })).toEqual({
      balanceCents: 400,
      ...RATE,
      adminMode: null,
      sound: true,
    });
  });

  it('has sound unless the server says the venue is silenced', () => {
    const state = (sound: unknown) => readKioskState({ balance_cents: 0, ...RATE_JSON, sound });

    expect(state(false)?.sound).toBe(false);
    for (const sound of [true, undefined, null, 'off', 0]) {
      expect(state(sound)?.sound).toBe(true);
    }
  });

  it('reads admin mode while it has time left and coins to offer', () => {
    const state = (admin_mode: unknown) => readKioskState({ balance_cents: 0, ...RATE_JSON, admin_mode });

    expect(state({ seconds_left: 840, coins_cents: [10, 20, 50, 100, 200] })?.adminMode).toEqual({
      secondsLeft: 840,
      coinsCents: [10, 20, 50, 100, 200],
    });
    for (const admin of [null, true, {}, { seconds_left: 0, coins_cents: [10] }, { seconds_left: 60, coins_cents: [] }, { seconds_left: 60 }]) {
      expect(state(admin)?.adminMode).toBeNull();
    }
  });

  it('takes anything else as not knowing', () => {
    for (const json of [
      null,
      'ok',
      {},
      { balance_cents: 400 },
      { balance_cents: 400, price_cents: 100 },
      { balance_cents: 400, lives: 3 },
      { balance_cents: -100, ...RATE_JSON },
      { balance_cents: 1.5, ...RATE_JSON },
      { balance_cents: '400', ...RATE_JSON },
      { balance_cents: 400, price_cents: 0, lives: 3 },
      { balance_cents: 400, price_cents: 100, lives: 0 },
    ]) {
      expect(readKioskState(json)).toBeNull();
    }
  });
});

describe('formatEuros', () => {
  it('writes cents as euros, in letters the pixel font has', () => {
    expect(formatEuros(200)).toBe('EUR 2.00');
    expect(formatEuros(50)).toBe('EUR 0.50');
    expect(formatEuros(1205)).toBe('EUR 12.05');
  });
});

describe('livesFor', () => {
  it('is so many lives for every whole price of the credit', () => {
    const lives = (balanceCents: number) => livesFor({ balanceCents, ...RATE });

    expect([0, 99, 100, 190, 200, 750].map(lives)).toEqual([0, 0, 3, 3, 6, 21]);
  });
});

describe('kioskGate', () => {
  it('asks for a coin when there is no credit, and says what a coin is worth', () => {
    expect(kioskGate({ balanceCents: 0, ...RATE })).toEqual({
      canStart: false,
      prompt: 'INSERT COIN',
      detail: 'EUR 1 FOR 3 LIVES',
    });
  });

  it('says what is there and how much more is wanted when the credit is short of any lives', () => {
    expect(kioskGate({ balanceCents: 50, ...RATE })).toEqual({
      canStart: false,
      prompt: 'INSERT EUR 0.50 MORE',
      detail: 'CREDIT EUR 0.50',
    });
  });

  it('lets a play start with every life the credit comes to', () => {
    expect(kioskGate({ balanceCents: 100, ...RATE })).toEqual({ canStart: true, prompt: 'TAP TO START', detail: '3 LIVES' });
    expect(kioskGate({ balanceCents: 250, ...RATE }).detail).toBe('6 LIVES');
    expect(kioskGate({ balanceCents: 100, priceCents: 100, lives: 1 }).detail).toBe('1 LIFE');
  });

  it('starts nothing while the server has not answered', () => {
    expect(kioskGate(null)).toEqual({ canStart: false, prompt: 'ONE MOMENT', detail: '' });
  });
});

describe('continueGate', () => {
  it('asks for a coin to carry on, and says what one is worth', () => {
    expect(continueGate({ balanceCents: 0, ...RATE })).toEqual({
      canStart: false,
      prompt: 'CONTINUE?',
      detail: 'INSERT COIN  EUR 1 FOR 3 LIVES',
    });
  });

  it('says how much more is wanted once some has gone in', () => {
    expect(continueGate({ balanceCents: 30, ...RATE }).detail).toBe('INSERT EUR 0.70 MORE');
  });

  it('knows when the credit covers lives, which are then bought without being asked for', () => {
    expect(continueGate({ balanceCents: 100, ...RATE }).canStart).toBe(true);
    expect(continueGate({ balanceCents: 99, ...RATE }).canStart).toBe(false);
  });

  it('waits while the server has not answered', () => {
    expect(continueGate(null)).toEqual({ canStart: false, prompt: 'CONTINUE?', detail: 'ONE MOMENT' });
  });
});

describe('isCreditMessage', () => {
  it('knows the messages that mean the credit may have changed', () => {
    for (const type of ['coin_credit', 'bill_credit', 'refresh_session']) {
      expect(isCreditMessage(JSON.stringify({ type, value_minor: 200 }))).toBe(true);
    }
  });

  it('ignores everything else', () => {
    for (const message of [JSON.stringify({ type: 'pong' }), 'not json', '"coin_credit"', 'null', 12]) {
      expect(isCreditMessage(message)).toBe(false);
    }
  });
});

describe('newPlayId', () => {
  it('makes an id the server takes, different every time', () => {
    const ids = new Set(Array.from({ length: 50 }, newPlayId));

    expect(ids.size).toBe(50);
    for (const id of ids) {
      expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    }
  });
});

describe('formatCoin', () => {
  it('writes a coin as its face', () => {
    expect([10, 20, 50, 100, 200].map(formatCoin)).toEqual(['10C', '20C', '50C', 'EUR 1', 'EUR 2']);
  });
});

describe('cornerAt', () => {
  it('names the four corners clockwise from the top left, and nowhere else', () => {
    expect(cornerAt(10, 10, 1920, 1080)).toBe(0);
    expect(cornerAt(1900, 10, 1920, 1080)).toBe(1);
    expect(cornerAt(1900, 1070, 1920, 1080)).toBe(2);
    expect(cornerAt(10, 1070, 1920, 1080)).toBe(3);
    expect(cornerAt(960, 540, 1920, 1080)).toBeNull();
    expect(cornerAt(960, 10, 1920, 1080)).toBeNull();
    expect(cornerAt(10, 540, 1920, 1080)).toBeNull();
  });
});

describe('refreshGesture', () => {
  const circle = [0, 1, 2, 3];
  const tapAll = (tap: ReturnType<typeof refreshGesture>, corners: (number | null)[], stepMs = 300) =>
    corners.map((corner, index) => tap(corner, index * stepMs));

  it('is the four corners in a circle, twice', () => {
    const results = tapAll(refreshGesture(), [...circle, ...circle]);

    expect(results).toEqual([false, false, false, false, false, false, false, true]);
  });

  it('is not once round, the wrong way round, or with a tap elsewhere on the way', () => {
    expect(tapAll(refreshGesture(), circle)).not.toContain(true);
    expect(tapAll(refreshGesture(), [0, 3, 2, 1, 0, 3, 2, 1])).not.toContain(true);
    expect(tapAll(refreshGesture(), [0, 1, 2, 3, null, 0, 1, 2, 3])).not.toContain(true);
    expect(tapAll(refreshGesture(), [0, 1, 2, 3, 0, 1, 1, 2, 3])).not.toContain(true);
  });

  it('starts over after a slip, and works when done again', () => {
    const results = tapAll(refreshGesture(), [0, 1, null, ...circle, ...circle]);

    expect(results.at(-1)).toBe(true);
    expect(results.slice(0, -1)).not.toContain(true);
  });

  it('has to be done in time', () => {
    const slow = REFRESH_GESTURE.withinMs / 4;

    expect(tapAll(refreshGesture(), [...circle, ...circle], slow)).not.toContain(true);
  });

  it('can be done again after it has been done', () => {
    const tap = refreshGesture();
    tapAll(tap, [...circle, ...circle]);

    expect(tapAll(tap, [...circle, ...circle]).at(-1)).toBe(true);
  });
});

describe('readLeaderboard', () => {
  it('reads the week\'s places and the best ever', () => {
    const board = readLeaderboard({
      week_starts_on: '2026-10-05',
      entries: [
        { rank: 1, initials: 'ADA', score: 4200, play_id: 57 },
        { rank: 2, initials: '---', score: 300, play_id: 58 },
      ],
      best: { initials: 'PAT', score: 9100 },
    });

    expect(board).toEqual({
      entries: [
        { rank: 1, initials: 'ADA', score: 4200, playId: 57 },
        { rank: 2, initials: '---', score: 300, playId: 58 },
      ],
      best: { initials: 'PAT', score: 9100 },
    });
  });

  it('reads an empty table, with no best yet', () => {
    expect(readLeaderboard({ entries: [], best: null })).toEqual({ entries: [], best: null });
  });

  it('takes anything else as no table', () => {
    for (const json of [null, 'ok', {}, { entries: 'none' }, { entries: [{ rank: 1 }] }, { entries: [null] }]) {
      expect(readLeaderboard(json)).toBeNull();
    }
  });
});

describe('readFinishedPlay', () => {
  it('reads where a play stands and whether to ask for initials', () => {
    expect(readFinishedPlay({ status: 'ok', id: 57, score: 1250, rank: 3, asks_initials: true })).toEqual({
      id: 57,
      rank: 3,
      asksInitials: true,
    });
  });

  it('has no place for a play that does not count', () => {
    expect(readFinishedPlay({ id: 57, rank: null, asks_initials: false })).toEqual({
      id: 57,
      rank: null,
      asksInitials: false,
    });
  });

  it('takes anything without an id as no answer', () => {
    expect(readFinishedPlay({ rank: 1 })).toBeNull();
    expect(readFinishedPlay(null)).toBeNull();
  });
});

describe('stepLetter', () => {
  it('goes through the alphabet both ways, and round the ends', () => {
    expect(stepLetter('A', 1)).toBe('B');
    expect(stepLetter('B', -1)).toBe('A');
    expect(stepLetter('Z', 1)).toBe('A');
    expect(stepLetter('A', -1)).toBe('Z');
    expect(stepLetter('?', 1)).toBe('B');
  });
});
