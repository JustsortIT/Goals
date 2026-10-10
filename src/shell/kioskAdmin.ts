/**
 * Two things a kiosk's page has for whoever looks after the kiosk, which has no keyboard and
 * may have no coin mechanism. Both are plain page elements over the game, not part of it, so
 * they work whatever the game is doing, and when it has not loaded at all.
 *
 * - Reloading the page: tap the four corners of the screen in a circle, twice
 *   (`refreshGesture` in `kiosk.ts`).
 * - Admin mode: while an admin has turned it on for this kiosk (a quarter of an hour at a
 *   time, at /admin/kiosks), a strip along the bottom of the screen with a button for each coin,
 *   which pretends that coin went in. The server says whether the kiosk is in admin mode, with
 *   the rest of its state, and refuses a pretend coin when it is not.
 *
 * Its few styles are in `app/frontend/entrypoints/game.css`.
 */
import { cornerAt, formatCoin, refreshGesture, type KioskState } from './kiosk';
import { fetchKioskState, insertMockCoin, onKioskState } from './kioskLink';

/** How often the server is asked whether admin mode is on, whatever the game is showing. */
const ASK_EVERY_MS = 15_000;

let strip: HTMLElement | null = null;
let hideTimer: number | undefined;

/** Called once by `boot.ts`, on a kiosk's page only. */
export function installKioskAdmin(): void {
  const tap = refreshGesture();
  window.addEventListener(
    'pointerdown',
    (event) => {
      const corner = cornerAt(event.clientX, event.clientY, window.innerWidth, window.innerHeight);
      if (tap(corner, performance.now())) {
        window.location.reload();
      }
    },
    { capture: true },
  );

  onKioskState(showAdminMode);
  // The title screen asks too, but the game is not always on its title screen.
  window.setInterval(() => void fetchKioskState(), ASK_EVERY_MS);
  void fetchKioskState();
}

/** Shows the strip while the state says admin mode is on, and takes it away when its time is up. */
function showAdminMode(state: KioskState | null): void {
  // No answer says nothing either way: what is showing stays until its own time runs out.
  if (!state) return;

  window.clearTimeout(hideTimer);
  strip?.remove();
  strip = null;
  const admin = state.adminMode;
  if (!admin) return;

  strip = document.createElement('div');
  strip.className = 'kiosk-admin';
  const label = document.createElement('span');
  label.className = 'kiosk-admin__label';
  label.textContent = `ADMIN MODE  ${Math.ceil(admin.secondsLeft / 60)} MIN LEFT`;
  strip.append(label);

  for (const cents of admin.coinsCents) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'kiosk-admin__coin';
    button.textContent = formatCoin(cents);
    // The game listens for taps anywhere to start: a tap on a coin is not one of those.
    button.addEventListener('pointerdown', (event) => event.stopPropagation());
    button.addEventListener('click', () => void insertMockCoin(cents));
    strip.append(button);
  }
  document.body.append(strip);

  hideTimer = window.setTimeout(() => {
    strip?.remove();
    strip = null;
  }, admin.secondsLeft * 1000);
}
