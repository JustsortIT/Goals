/**
 * Which theme the game is using, decided once at start-up. No Phaser imports, because
 * the tile size it implies is needed by the constants and the tests.
 *
 * Pick a theme with `?theme=<name>` in the address, or `VITE_THEME=<name>` when starting
 * or building. Names are `kenney` or any folder under `packs/`. With neither, the game
 * uses `DEFAULT_THEME`.
 */
import { PACKS } from './packs';

export const KENNEY_THEME = 'kenney';
const KENNEY_TILE_SIZE = 18;
/** The look of the game unless another is asked for. Its level is also the default level. */
export const DEFAULT_THEME = 'dublin';

function requestedTheme(): string | null {
  const fromAddress =
    typeof location === 'undefined' ? null : new URLSearchParams(location.search).get('theme');
  return fromAddress ?? (import.meta.env.VITE_THEME as string | undefined) ?? null;
}

const isKnown = (name: string | null): name is string =>
  name !== null && (name === KENNEY_THEME || name in PACKS);

/** An unknown name is ignored, and Kenney needs no pack, so there is always a theme. */
export const ACTIVE_THEME: string = [requestedTheme(), DEFAULT_THEME].find(isKnown) ?? KENNEY_THEME;

/** Tiles are drawn at the art's native size, so the theme sets it. */
export const TILE_SIZE: number =
  ACTIVE_THEME === KENNEY_THEME ? KENNEY_TILE_SIZE : PACKS[ACTIVE_THEME].tileSize;
