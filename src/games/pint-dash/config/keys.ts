/** String keys shared across scenes. Reference these instead of typing the literals. */

export const SceneKey = {
  Boot: 'Boot',
  Preloader: 'Preloader',
  Title: 'Title',
  Game: 'Game',
  UI: 'UI',
  GameOver: 'GameOver',
} as const;

export const TextureKey = {
  /** Kenney theme: sheets loaded from public/assets. */
  TilesBase: 'tiles-base',
  TilesIndustrial: 'tiles-industrial',
  TilesFood: 'tiles-food',
  TilesBricks: 'tiles-bricks',
  Characters: 'characters',
  /** Kenney theme: built at boot (`themes/kenney/textures.ts`). */
  Tiles: 'tiles',
  Hero: 'hero',
  /** Shared by every theme, drawn in code (`systems/commonTextures.ts`). */
  Collision: 'collision',
  NoticeBoard: 'notice-board',
  Banner: 'banner',
  SkylineFar: 'bg-skyline-far',
  SkylineNear: 'bg-skyline-near',
  PixelFont: 'pixel-font',
  Particle: 'particle',
  Vignette: 'vignette',
} as const;

export const FontKey = {
  /** The bitmap font all in-game text uses (`systems/pixelFont.ts`). */
  Pixel: 'pixel',
  /** The TTF it is built from. Loaded in the Preloader; the key is its CSS font-family. */
  PixelSource: 'Kenney Mini',
} as const;

/** Global animation keys, defined once in `systems/animations.ts`. */
export const AnimKey = {
  PlayerIdle: 'player-idle',
  PlayerRun: 'player-run',
} as const;

/** Keys in the game-wide registry (`scene.registry`), which the HUD listens to. */
export const RegistryKey = {
  Score: 'score',
  Lives: 'lives',
  /** The name of the section of the level the player is in. */
  Section: 'section',
  PhysicsDebug: 'physicsDebug',
} as const;
