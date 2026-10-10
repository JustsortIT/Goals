/**
 * Starts a game on its page (play.html?game=<folder>), the way PubPixels' `boot.ts` does: sets
 * up the kiosk, fetches nothing it does not need, and hands the game's data to the game's own
 * `start`. A game is a folder in `games/` with a `start.ts`; this never looks inside one.
 *
 * Here the kiosk is pretended (tools/pretend-kiosk.mjs), with a strip of coins to press along
 * the bottom of the screen. `&free=1` leaves the kiosk out, as when a publican previews a game
 * or it is open to public play: the same game then runs with nothing to pay and no score kept.
 * A game has to work both ways.
 */
import './play.css';
import { kiosk, setKiosk } from './shell/kiosk';
import { installKioskAdmin } from './shell/kioskAdmin';

/** What a game gives this script: a way to start it with its data. */
interface Engine {
  start(data: unknown): Promise<void>;
}

const ENGINES = import.meta.glob<Engine>('./games/*/start.ts');
/** A game's content, apart from its code: what PubPixels will generate for each pub. */
const DATA = import.meta.glob<unknown>('./games/*/game.json', { import: 'default' });

async function boot(): Promise<void> {
  const asked = new URLSearchParams(window.location.search);
  const name = asked.get('game') ?? '';
  const engine = ENGINES[`./games/${name}/start.ts`];
  if (!engine) {
    throw new Error(`There is no game in src/games/${name || '?'} with a start.ts.`);
  }
  document.title = `${name} | phaseplay`;

  if (asked.get('free') !== '1') {
    const api = `/api/kiosk/v1/${encodeURIComponent(name)}`;
    setKiosk({
      kioskStateUrl: `${api}/state`,
      kioskPlaysUrl: `${api}/plays`,
      kioskMockCreditsUrl: `${api}/mock_credits`,
      kioskLeaderboardUrl: `${api}/leaderboard`,
      kioskGameVersion: '1',
    });
  }
  if (kiosk()) installKioskAdmin();

  const data = await DATA[`./games/${name}/game.json`]?.();
  await (await engine()).start(data ?? null);
}

const app = document.getElementById('app');
if (!app) {
  throw new Error('The page has no #app element for the game.');
}

boot().catch((error: unknown) => {
  const message = document.createElement('p');
  message.className = 'game-message';
  message.textContent = `The game could not be loaded. ${error instanceof Error ? error.message : ''}`;
  app.replaceChildren(message);
  throw error;
});
