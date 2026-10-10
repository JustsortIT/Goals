/**
 * The kiosk page's dealings with the server and with the kiosk itself (docs/KIOSK_API.md):
 * asking for the credit, starting a play, sending its score and its player's initials, asking
 * for the leaderboard, and hearing from the kiosk that a coin went in. What any of it means on screen is decided in `kiosk.ts`.
 *
 * The page never holds credit and cannot add any. It carries no token: SentinelKiosk puts the
 * kiosk's own headers on every request the page makes to this app.
 */
import { KIOSK } from './constants';
import {
  isCreditMessage,
  kiosk,
  newPlayId,
  readFinishedPlay,
  readKioskState,
  readLeaderboard,
  type FinishedPlay,
  type KioskState,
  type Leaderboard,
} from './kiosk';

/**
 * How starting a play went: started, refused for want of credit, or not known (try again). A
 * play that was started says how many lives the kiosk's credit came to.
 */
export type StartResult = { status: 'started'; lives: number } | { status: 'short' | 'failed' };

/**
 * How topping a play up went: the lives the credit that had come in was turned into, nothing
 * because there was not enough of it, not known (try again), or over, when the server will add
 * nothing to the play.
 */
export type TopUpResult = { status: 'bought'; lives: number } | { status: 'short' | 'failed' | 'over' };

const JSON_HEADERS = { Accept: 'application/json', 'Content-Type': 'application/json' };

/** The id of the play being asked for, kept until the server gives an answer about it. */
let pendingPlay: string | null = null;
/** The id of the top-up being asked for, kept until the server gives an answer about it. */
let pendingTopUp: string | null = null;
/** The server's id for the play in progress, which its score is sent to. */
let playing: number | null = null;

const stateListeners = new Set<(state: KioskState | null) => void>();

/** Calls `listener` with every answer about the kiosk's state, whoever asked. */
export function onKioskState(listener: (state: KioskState | null) => void): void {
  stateListeners.add(listener);
}

/** The kiosk's credit and the price, or null if the server could not be asked. */
export async function fetchKioskState(): Promise<KioskState | null> {
  const here = kiosk();
  if (!here) return null;
  let state: KioskState | null = null;
  try {
    const response = await fetch(here.stateUrl, { headers: { Accept: 'application/json' }, cache: 'no-store' });
    state = response.ok ? readKioskState(await response.json()) : null;
  } catch {
    state = null;
  }
  for (const listener of stateListeners) listener(state);
  return state;
}

/**
 * A pretend coin, from the buttons shown in admin mode. The server takes it only while the kiosk
 * is in admin mode. Whatever it answers, everything showing the credit is told to ask again.
 */
export async function insertMockCoin(cents: number): Promise<void> {
  const here = kiosk();
  if (!here) return;
  try {
    await fetch(here.mockCreditsUrl, {
      method: 'POST',
      headers: JSON_HEADERS,
      body: JSON.stringify({ client_uuid: newPlayId(), value_minor: cents }),
    });
  } catch {
    // Not taken: the credit shown will not change, which says so.
  }
  if (listeners.size === 0) {
    void fetchKioskState();
  }
  for (const listener of listeners) listener();
}

/**
 * Asks the server to start a play, with every whole euro on the kiosk turned into lives. With
 * no answer the same id is kept and sent on the next go, so a play that was started, and paid
 * for, unheard is the one that begins, and is not paid for twice.
 */
export async function startPlay(): Promise<StartResult> {
  const here = kiosk();
  if (!here) return { status: 'failed' };

  pendingPlay ??= newPlayId();
  let response: Response;
  try {
    response = await fetch(here.playsUrl, {
      method: 'POST',
      headers: JSON_HEADERS,
      body: JSON.stringify({ client_uuid: pendingPlay, game_version: here.gameVersion }),
    });
  } catch {
    return { status: 'failed' };
  }
  // The server is in trouble, or wants fewer requests: it may yet have started the play.
  if (response.status >= 500 || response.status === 429) return { status: 'failed' };

  pendingPlay = null;
  if (!response.ok) return { status: response.status === 402 ? 'short' : 'failed' };

  const { id, lives } = (await response.json()) as { id?: unknown; lives?: unknown };
  if (typeof id !== 'number' || typeof lives !== 'number' || !(lives > 0)) return { status: 'failed' };
  playing = id;
  return { status: 'started', lives };
}

/**
 * Asks the server to turn the credit that has come in since the play started into more lives
 * for it. As with starting a play, the id first asked with is kept until the server answers, so
 * a top-up that was taken unheard is not paid for twice.
 */
export async function topUpPlay(): Promise<TopUpResult> {
  const here = kiosk();
  if (!here || playing === null) return { status: 'over' };

  pendingTopUp ??= newPlayId();
  let response: Response;
  try {
    response = await fetch(`${here.playsUrl}/${playing}/top_ups`, {
      method: 'POST',
      headers: JSON_HEADERS,
      body: JSON.stringify({ client_uuid: pendingTopUp }),
    });
  } catch {
    return { status: 'failed' };
  }
  if (response.status >= 500 || response.status === 429) return { status: 'failed' };

  pendingTopUp = null;
  if (response.status === 402) return { status: 'short' };
  // No such play, or it has its score already: nothing more can be bought for it.
  if (response.status === 404) return { status: 'over' };
  if (response.status === 409) {
    const code = ((await response.json().catch(() => null)) as { error_code?: unknown } | null)?.error_code;
    return { status: code === 'PLAY_ALREADY_FINISHED' ? 'over' : 'failed' };
  }
  if (!response.ok) return { status: 'failed' };

  const { lives } = (await response.json()) as { lives?: unknown };
  return typeof lives === 'number' && lives > 0 ? { status: 'bought', lives } : { status: 'failed' };
}

/**
 * Sends the score of the play that has just ended, and gives the server's answer: where the
 * play stands in the week. With no answer it is sent a few more times, and the answer given is
 * the one that comes in the end, or null if none does or the server refuses it. The play is
 * paid for either way, and a play with no score is one the server never heard the end of.
 */
export async function finishPlay(score: number): Promise<FinishedPlay | null> {
  const here = kiosk();
  const id = playing;
  playing = null;
  pendingTopUp = null;
  if (!here || id === null) return null;

  for (let triesLeft = KIOSK.scoreRetries; triesLeft >= 0; triesLeft -= 1) {
    try {
      const response = await fetch(`${here.playsUrl}/${id}`, {
        method: 'PATCH',
        headers: JSON_HEADERS,
        body: JSON.stringify({ score }),
      });
      if (response.ok) return readFinishedPlay(await response.json());
      // Refused: sending it again will not help.
      if (response.status < 500 && response.status !== 429) return null;
    } catch {
      // No answer: try again below.
    }
    if (triesLeft > 0) {
      await new Promise((resolve) => window.setTimeout(resolve, KIOSK.scoreRetryMs));
    }
  }
  return null;
}

/** The venue's leaderboard, or null if the server could not be asked. */
export async function fetchLeaderboard(): Promise<Leaderboard | null> {
  const here = kiosk();
  if (!here) return null;
  try {
    const response = await fetch(here.leaderboardUrl, { headers: { Accept: 'application/json' }, cache: 'no-store' });
    return response.ok ? readLeaderboard(await response.json()) : null;
  } catch {
    return null;
  }
}

/** How sending a play's initials went: kept, refused as not allowed (ask again), or not known. */
export type InitialsResult = 'kept' | 'refused' | 'failed';

export async function sendInitials(playId: number, initials: string): Promise<InitialsResult> {
  const here = kiosk();
  if (!here) return 'failed';
  try {
    const response = await fetch(`${here.playsUrl}/${playId}/initials`, {
      method: 'PUT',
      headers: JSON_HEADERS,
      body: JSON.stringify({ initials }),
    });
    if (response.ok) return 'kept';
    return response.status === 422 ? 'refused' : 'failed';
  } catch {
    return 'failed';
  }
}

/** What Qt's own client gives the page: the kiosk's object, with a signal of JSON messages. */
interface QtChannel {
  objects: { pyBackend?: { dataReceived?: { connect(listener: (message: unknown) => void): void } } };
}
type QtWindow = Window & {
  qt?: { webChannelTransport?: unknown };
  QWebChannel?: new (transport: unknown, ready: (channel: QtChannel) => void) => unknown;
};

/** Qt's client for the bridge, served by the kiosk's own browser from inside itself. */
const QT_CHANNEL_SCRIPT = 'qrc:///qtwebchannel/qwebchannel.js';

const listeners = new Set<() => void>();
let connecting = false;

/**
 * Calls `listener` whenever the kiosk says its credit may have changed. Returns how to stop.
 * In a browser that is not a kiosk's there is no bridge and it is never called.
 */
export function onKioskCredit(listener: () => void): () => void {
  listeners.add(listener);
  connectToKiosk();
  return () => listeners.delete(listener);
}

function connectToKiosk(): void {
  const qtWindow = window as QtWindow;
  const transport = qtWindow.qt?.webChannelTransport;
  if (connecting || !transport) return;
  connecting = true;

  const open = () => {
    if (!qtWindow.QWebChannel) return;
    new qtWindow.QWebChannel(transport, (channel) => {
      channel.objects.pyBackend?.dataReceived?.connect((message) => {
        if (isCreditMessage(message)) {
          for (const listener of listeners) listener();
        }
      });
    });
  };

  if (qtWindow.QWebChannel) {
    open();
    return;
  }
  const script = document.createElement('script');
  script.src = QT_CHANNEL_SCRIPT;
  script.onload = open;
  script.onerror = () => console.warn(`Could not load ${QT_CHANNEL_SCRIPT}: coins will show a little late.`);
  document.head.append(script);
}
