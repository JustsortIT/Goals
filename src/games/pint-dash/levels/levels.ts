/**
 * Which level the game plays. No Phaser imports.
 *
 * A level is data, not code: it lives in a theme's description file
 * (tools/art/themes/<name>.json), under "level", next to the words that describe the
 * theme's art. So one file says what a theme looks like and what there is to play, and
 * a new theme can bring a level of its own. The format is described in
 * `systems/level.ts`.
 *
 * A theme whose description has no level, or that has no description at all (Kenney),
 * plays the default theme's level.
 */
import type { LevelDefinition } from '../systems/level';
import { ACTIVE_THEME, DEFAULT_THEME } from '../themes/active';

const descriptions = import.meta.glob<{ level?: LevelDefinition }>('../tools/art/themes/*.json', {
  eager: true,
  import: 'default',
});

/** The level of every theme whose description has one, by theme name. */
export const LEVELS: Record<string, LevelDefinition> = Object.fromEntries(
  Object.entries(descriptions).flatMap(([file, description]) => {
    const theme = file.slice(file.lastIndexOf('/') + 1, -'.json'.length);
    return description.level ? [[theme, description.level]] : [];
  }),
);

/** The level a theme plays: its own if it has one, the default theme's if not. */
export function levelFor(theme: string): LevelDefinition {
  const level = LEVELS[theme] ?? LEVELS[DEFAULT_THEME];
  if (!level) {
    throw new Error(
      `No level to play: neither "${theme}" nor the default theme "${DEFAULT_THEME}" ` +
        `has a "level" in its description (tools/art/themes/).`,
    );
  }
  return level;
}

/** The level of the theme the game is running with. */
export const ACTIVE_LEVEL: LevelDefinition = levelFor(ACTIVE_THEME);
