/**
 * What the place gives a plug to: its sponsors, what is on, what it offers. They arrive
 * beside the game bundle, from an address of their own (`boot.ts`), and are the one part
 * of a game that changes without a new version: the page fetches the plugs that are
 * current each time it loads. A game may have none. No Phaser imports.
 *
 * The game shows them on the title screen (a line that changes every few seconds), on
 * hoardings at the start of each later part of the level, and on the end screen
 * (`platformer/systems/plugs.ts`). Which plug goes where is decided here.
 */

export type PlugKind = 'sponsor' | 'event' | 'offer';

export interface Plug {
  kind: PlugKind;
  name: string;
  line: string;
  /** The logo's two pictures as addresses the loader can fetch, or null for none. */
  logo: { large: string; small: string } | null;
}

const KINDS: readonly PlugKind[] = ['sponsor', 'event', 'offer'];

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/**
 * The plugs in what the server sent, `{ plugs: [...] }`. Anything that is not a plug is
 * left out rather than stopping the game: a plug is not worth that.
 */
export function readPlugs(data: unknown): Plug[] {
  if (!isRecord(data) || !Array.isArray(data.plugs)) return [];

  return data.plugs.flatMap((entry): Plug[] => {
    if (!isRecord(entry) || typeof entry.name !== 'string' || entry.name.trim() === '') return [];
    const kind = KINDS.find((known) => known === entry.kind) ?? 'offer';
    const logo = isRecord(entry.logo) ? entry.logo : null;
    const pictures =
      logo && typeof logo.large === 'string' && typeof logo.small === 'string'
        ? { large: logo.large, small: logo.small }
        : null;
    return [
      {
        kind,
        name: entry.name.trim(),
        line: typeof entry.line === 'string' ? entry.line.trim() : '',
        logo: pictures,
      },
    ];
  });
}

let loaded: Plug[] = [];

export function setPlugs(data: unknown): Plug[] {
  loaded = readPlugs(data);
  return loaded;
}

/** The plugs of the game that is loaded. None, in the unit tests. */
export function plugs(): Plug[] {
  return loaded;
}

/**
 * Which plug goes on each of `count` hoardings: the sponsors first, in their order, then
 * the rest, and round again when there are fewer plugs than hoardings. No plugs, no
 * hoardings.
 */
export function forHoardings(all: readonly Plug[], count: number): Plug[] {
  if (all.length === 0 || count <= 0) return [];

  const inOrder = [
    ...all.filter((plug) => plug.kind === 'sponsor'),
    ...all.filter((plug) => plug.kind !== 'sponsor'),
  ];
  return Array.from({ length: count }, (_, index) => inOrder[index % inOrder.length]);
}

/**
 * What the title screen says about each plug, in capitals for the pixel font: a sponsor
 * is thanked, an event or an offer is named, and the line follows if there is one.
 */
export function tickerLines(all: readonly Plug[]): string[] {
  return all.map((plug) => {
    const name = plug.kind === 'sponsor' ? `THANKS TO ${plug.name}` : plug.name;
    return [name, plug.line].filter(Boolean).join('  ').toUpperCase();
  });
}

/** One plug for the end of a play, chosen by `pick`, a number from 0 up to 1. Null for none. */
export function plugForTheEnd(all: readonly Plug[], pick: number): Plug | null {
  if (all.length === 0) return null;
  const index = Math.min(all.length - 1, Math.max(0, Math.floor(pick * all.length)));
  return all[index];
}
