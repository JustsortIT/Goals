import type Phaser from 'phaser';
import { ACTIVE_THEME, KENNEY_THEME } from './active';
import { createGeneratedTheme } from './generated';
import { kenneyTheme } from './kenney';
import type { Theme, ThemeArt } from './theme';

/** The theme the game is running with (see `active.ts` for how it is chosen). */
export const theme: Theme =
  ACTIVE_THEME === KENNEY_THEME ? kenneyTheme : createGeneratedTheme(ACTIVE_THEME);

let art: ThemeArt | null = null;

/** Builds the theme's textures. Call once, from the Preloader, after its files have loaded. */
export function createThemeArt(scene: Phaser.Scene): ThemeArt {
  art ??= theme.create(scene);
  return art;
}

/** The theme's sprites. Only available once the Preloader has run. */
export function themeArt(): ThemeArt {
  if (!art) {
    throw new Error('Theme art is not ready: the Preloader has not run yet.');
  }
  return art;
}
