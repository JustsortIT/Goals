/**
 * A pretend kiosk, for the dev server: the few addresses of PubPixels' kiosk API that the shell
 * calls (pubpixels/docs/KIOSK_API.md), answered from memory. With it the shell here runs
 * unchanged, so a game made here meets coins, lives and scores exactly as it will on a kiosk.
 *
 * It is always in admin mode, so the shell shows its strip of pretend coins along the bottom of
 * the screen: that is how a coin goes in. A euro is 3 lives, whenever it goes in, as in PubPixels.
 *
 * Each game has a kiosk of its own (its name is in every address), and everything is forgotten when
 * the dev server stops. No money, no database, nothing to keep safe: this is not the real thing
 * and never checks who is asking.
 */

const BASE = '/api/kiosk/v1';
const EURO_CENTS = 100;
const EURO_LIVES = 3;
const COINS_CENTS = [10, 20, 50, 100, 200];
// A play whose score comes this high in the week is asked for initials.
const ASKS_INITIALS = 5;
const INITIALS = /^[A-Z]{3}$/;

/** What one game's pretend kiosk holds. */
function newKiosk() {
  return { balanceCents: 0, plays: [], coins: new Set(), starts: new Map(), topUps: new Map() };
}

/** How much of a balance turns into lives, and how many: every whole euro, at one rate. */
export function livesFor(balanceCents) {
  const euros = Math.floor(Math.max(balanceCents, 0) / EURO_CENTS);
  return { cents: euros * EURO_CENTS, lives: euros * EURO_LIVES };
}

/** The finished plays, best first, as the shell reads a leaderboard. */
function leaderboard(kiosk) {
  const finished = kiosk.plays
    .filter((play) => play.score !== null)
    .sort((a, b) => b.score - a.score);
  const entries = finished.slice(0, 10).map((play, index) => ({
    rank: index + 1,
    initials: play.initials ?? '---',
    score: play.score,
    play_id: play.id,
  }));
  const best = entries[0] ? { initials: entries[0].initials, score: entries[0].score } : null;
  return { entries, best };
}

/**
 * Answers one request. Returns [status, body]. Kept apart from the server so it can be read,
 * and tried, without one.
 */
export function answer(kiosk, method, path, body) {
  if (method === 'GET' && path === '/state') {
    return [
      200,
      {
        balance_cents: kiosk.balanceCents,
        price_cents: EURO_CENTS,
        lives: EURO_LIVES,
        admin_mode: { seconds_left: 900, coins_cents: COINS_CENTS },
        sound: true,
      },
    ];
  }

  if (method === 'POST' && path === '/mock_credits') {
    const cents = body.value_minor;
    if (!COINS_CENTS.includes(cents)) return [422, { error_code: 'NOT_A_COIN' }];
    // The same coin sent twice goes in once.
    if (!kiosk.coins.has(body.client_uuid)) {
      kiosk.coins.add(body.client_uuid);
      kiosk.balanceCents += cents;
    }
    return [201, { balance_cents: kiosk.balanceCents }];
  }

  if (method === 'POST' && path === '/plays') {
    const asked = kiosk.starts.get(body.client_uuid);
    if (asked) return [200, asked];

    const { cents, lives } = livesFor(kiosk.balanceCents);
    if (lives === 0) return [402, { error_code: 'INSUFFICIENT_CREDIT' }];
    kiosk.balanceCents -= cents;
    const play = {
      id: kiosk.plays.length + 1,
      lives,
      priceCents: cents,
      score: null,
      initials: null,
    };
    kiosk.plays.push(play);
    const said = { id: play.id, price_cents: cents, lives, balance_cents: kiosk.balanceCents };
    kiosk.starts.set(body.client_uuid, said);
    return [201, said];
  }

  if (method === 'GET' && path === '/leaderboard') return [200, leaderboard(kiosk)];

  const [, id, rest] = /^\/plays\/(\d+)(\/top_ups|\/initials)?$/.exec(path) ?? [];
  const play = kiosk.plays.find((one) => one.id === Number(id));
  if (!play) return [404, { error_code: 'NOT_FOUND' }];

  if (method === 'POST' && rest === '/top_ups') {
    const asked = kiosk.topUps.get(body.client_uuid);
    if (asked) return [200, asked];
    if (play.score !== null) return [409, { error_code: 'PLAY_ALREADY_FINISHED' }];

    const { cents, lives } = livesFor(kiosk.balanceCents);
    if (lives === 0) return [402, { error_code: 'INSUFFICIENT_CREDIT' }];
    kiosk.balanceCents -= cents;
    play.lives += lives;
    play.priceCents += cents;
    const said = { id: play.id, price_cents: cents, lives, balance_cents: kiosk.balanceCents };
    kiosk.topUps.set(body.client_uuid, said);
    return [201, said];
  }

  if (method === 'PATCH' && !rest) {
    const score = body.score;
    if (!Number.isInteger(score) || score < 0) return [422, { error_code: 'NOT_A_SCORE' }];
    if (play.score !== null && play.score !== score)
      return [409, { error_code: 'PLAY_ALREADY_FINISHED' }];
    play.score = score;
    const rank =
      leaderboard(kiosk).entries.find((entry) => entry.play_id === play.id)?.rank ?? null;
    return [200, { id: play.id, rank, asks_initials: rank !== null && rank <= ASKS_INITIALS }];
  }

  if (method === 'PUT' && rest === '/initials') {
    if (!INITIALS.test(body.initials ?? '')) return [422, { error_code: 'NOT_INITIALS' }];
    play.initials ??= body.initials;
    return [200, { id: play.id, initials: play.initials }];
  }

  return [404, { error_code: 'NOT_FOUND' }];
}

async function readJson(request) {
  let text = '';
  for await (const chunk of request) text += chunk;
  try {
    const json = JSON.parse(text || '{}');
    return typeof json === 'object' && json !== null ? json : {};
  } catch {
    return {};
  }
}

/** The Vite plugin: the same answers from `npm run dev` and `npm run preview`. */
export function pretendKiosk() {
  const kiosks = new Map();

  const serve = (server) => {
    server.middlewares.use(async (request, response, next) => {
      const url = new URL(request.url ?? '/', 'http://localhost');
      if (!url.pathname.startsWith(`${BASE}/`)) return next();

      // /api/kiosk/v1/<game>/state: the game's name is in the path, since the shell adds to
      // the addresses it is given (`<plays>/<id>/top_ups`).
      const [, game, path] = /^\/([^/]+)(\/.*)$/.exec(url.pathname.slice(BASE.length)) ?? [];
      if (!game) return next();
      if (!kiosks.has(game)) kiosks.set(game, newKiosk());
      const [status, body] = answer(
        kiosks.get(game),
        request.method ?? 'GET',
        path,
        await readJson(request),
      );
      response.statusCode = status;
      response.setHeader('Content-Type', 'application/json');
      response.setHeader('Cache-Control', 'no-store');
      response.end(JSON.stringify(body));
    });
  };

  return { name: 'pretend-kiosk', configureServer: serve, configurePreviewServer: serve };
}
