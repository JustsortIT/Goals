import { describe, expect, it } from 'vitest';
import { answer, livesFor } from './pretend-kiosk.mjs';

const newKiosk = () => ({
  balanceCents: 0,
  plays: [],
  coins: new Set(),
  starts: new Map(),
  topUps: new Map(),
});
const coin = (kiosk, cents, id = crypto.randomUUID()) =>
  answer(kiosk, 'POST', '/mock_credits', { client_uuid: id, value_minor: cents });

describe('the pretend kiosk', () => {
  it('turns every whole euro into three lives', () => {
    expect(livesFor(0)).toEqual({ cents: 0, lives: 0 });
    expect(livesFor(190)).toEqual({ cents: 100, lives: 3 });
    expect(livesFor(250)).toEqual({ cents: 200, lives: 6 });
  });

  it('says what it holds in the shape the shell reads', () => {
    const kiosk = newKiosk();
    coin(kiosk, 50);
    const [status, state] = answer(kiosk, 'GET', '/state', {});
    expect(status).toBe(200);
    expect(state).toMatchObject({ balance_cents: 50, price_cents: 100, lives: 3 });
    expect(state.admin_mode.coins_cents).toContain(100);
  });

  it('takes a coin once however often it is sent, and only a coin there is', () => {
    const kiosk = newKiosk();
    coin(kiosk, 100, 'a');
    coin(kiosk, 100, 'a');
    expect(kiosk.balanceCents).toBe(100);
    expect(coin(kiosk, 500)[0]).toBe(422);
  });

  it('starts a play with all the credit there is, once, and none without a euro', () => {
    const kiosk = newKiosk();
    expect(answer(kiosk, 'POST', '/plays', { client_uuid: 'p' })[0]).toBe(402);
    coin(kiosk, 200);
    coin(kiosk, 50);
    const [status, play] = answer(kiosk, 'POST', '/plays', { client_uuid: 'p' });
    expect([status, play.lives, play.balance_cents]).toEqual([201, 6, 50]);
    expect(answer(kiosk, 'POST', '/plays', { client_uuid: 'p' })[1]).toEqual(play);
    expect(kiosk.plays).toHaveLength(1);
  });

  it('tops a play up until it has its score, and keeps one score', () => {
    const kiosk = newKiosk();
    coin(kiosk, 100);
    const [, play] = answer(kiosk, 'POST', '/plays', { client_uuid: 'p' });
    expect(answer(kiosk, 'POST', `/plays/${play.id}/top_ups`, { client_uuid: 't' })[0]).toBe(402);
    coin(kiosk, 100);
    expect(answer(kiosk, 'POST', `/plays/${play.id}/top_ups`, { client_uuid: 't' })[1].lives).toBe(
      3,
    );

    const [, finished] = answer(kiosk, 'PATCH', `/plays/${play.id}`, { score: 120 });
    expect(finished).toEqual({ id: play.id, rank: 1, asks_initials: true });
    expect(answer(kiosk, 'PATCH', `/plays/${play.id}`, { score: 999 })[0]).toBe(409);
    coin(kiosk, 100);
    expect(answer(kiosk, 'POST', `/plays/${play.id}/top_ups`, { client_uuid: 'u' })[1]).toEqual({
      error_code: 'PLAY_ALREADY_FINISHED',
    });

    expect(answer(kiosk, 'PUT', `/plays/${play.id}/initials`, { initials: 'abc' })[0]).toBe(422);
    answer(kiosk, 'PUT', `/plays/${play.id}/initials`, { initials: 'ABC' });
    expect(answer(kiosk, 'GET', '/leaderboard', {})[1].best).toEqual({
      initials: 'ABC',
      score: 120,
    });
  });
});
