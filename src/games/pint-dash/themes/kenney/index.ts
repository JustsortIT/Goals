import type Phaser from 'phaser';
import { BACKGROUND_COLOR } from '../../config/constants';
import { TextureKey } from '../../config/keys';
import { DEFAULT_BOARDS } from '../../systems/commonTextures';
import type { LevelData } from '../../systems/level';
import type { Theme, ThemeArt } from '../theme';
import { CHARACTER_SIZE, HeroFrame, TileFrame } from './frames';
import { buildPub } from './pub';
import { createKenneyTextures } from './textures';
import { decorTiles, levelTiles } from './tiles';

/** Collision boxes inside the pack's frames: 24x24 for the hero, 18x18 for tiles. */
const ART: ThemeArt = {
  // The box is one tile tall and a little narrower than the head. The pack has two frames
  // for each character, so the step doubles as the pose in the air.
  hero: {
    texture: TextureKey.Hero,
    body: { width: 12, height: 18, offsetX: 6, offsetY: 6 },
    idle: [HeroFrame.Stand],
    run: [HeroFrame.Step, HeroFrame.Stand],
    runFrameRate: 9,
    air: [HeroFrame.Step],
  },
  // The keg is 14px wide and stands on the bottom edge.
  enemy: {
    texture: TextureKey.Tiles,
    frame: TileFrame.Keg,
    body: { width: 12, height: 15, offsetX: 3, offsetY: 3 },
  },
  // The glass, without its handle.
  pickup: {
    texture: TextureKey.Tiles,
    frame: TileFrame.Pint,
    body: { width: 12, height: 14, offsetX: 1, offsetY: 2 },
  },
  heart: { texture: TextureKey.Tiles, full: TileFrame.HeartFull, empty: TileFrame.HeartEmpty },
  // The city skyline drawn in code (`systems/commonTextures.ts`).
  backdrop: { sky: BACKGROUND_COLOR, far: TextureKey.SkylineFar, near: TextureKey.SkylineNear },
  // The plain boards drawn in code, and nothing in the sky.
  ...DEFAULT_BOARDS,
  flyer: null,
};

function renderLevel(scene: Phaser.Scene, level: LevelData): void {
  const map = scene.make.tilemap({
    data: levelTiles(level),
    tileWidth: level.tileSize,
    tileHeight: level.tileSize,
  });
  const tileset = map.addTilesetImage(
    TextureKey.Tiles,
    TextureKey.Tiles,
    level.tileSize,
    level.tileSize,
  );
  if (!tileset) {
    throw new Error(`Tileset texture "${TextureKey.Tiles}" is missing.`);
  }

  // Scenery goes on its own layer, in front of the ground.
  const ground = map.createLayer(0, tileset, 0, 0);
  const decor = map.createBlankLayer('decor', tileset, 0, 0);
  if (!ground || !decor) {
    throw new Error('Could not create the level layers.');
  }
  decor.putTilesAt(decorTiles(level), 0, 0, false);
}

/**
 * The hand-assembled theme: Kenney's "Pixel Platformer" packs at 18px a tile, with a few
 * pieces drawn or recoloured in code. Sources and licences: public/assets/CREDITS.md.
 */
export const kenneyTheme: Theme = {
  name: 'kenney',

  preload(scene) {
    // Paths are relative to public/. The tile sheets are combined into one atlas in
    // create(), so they load as plain images.
    const tilesets = 'assets/tilesets/pixel-platformer';
    scene.load.image(TextureKey.TilesBase, `${tilesets}-tiles.png`);
    scene.load.image(TextureKey.TilesIndustrial, `${tilesets}-industrial.png`);
    scene.load.image(TextureKey.TilesFood, `${tilesets}-food.png`);
    scene.load.image(TextureKey.TilesBricks, `${tilesets}-blocks-sand.png`);
    scene.load.spritesheet(
      TextureKey.Characters,
      'assets/sprites/pixel-platformer-characters.png',
      {
        frameWidth: CHARACTER_SIZE,
        frameHeight: CHARACTER_SIZE,
      },
    );
  },

  create(scene) {
    createKenneyTextures(scene);
    return ART;
  },

  renderLevel,
  buildGoal: buildPub,
};
