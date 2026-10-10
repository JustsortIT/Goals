import Phaser from 'phaser';
import { WORLD } from '../config/constants';
import { TextureKey } from '../config/keys';
import { theme } from '../themes';
import { isSolid, type LevelData, type LevelObject } from './level';

export interface BuiltLevel {
  /** What things collide with: ground, blocks and one-way platforms. It is never drawn. */
  layer: Phaser.Tilemaps.TilemapLayer;
  objects: LevelObject[];
  widthPx: number;
  heightPx: number;
}

type ArcadeObject = Parameters<Phaser.Types.Physics.Arcade.ArcadePhysicsCallback>[0];

/** Tiles of the collision layer. They say how a cell collides, not what it looks like. */
const CollisionTile = { Empty: -1, Solid: 0, OneWay: 1 } as const;

/**
 * Builds the level in two parts: an invisible Tilemap layer that everything collides
 * with, and the picture, which the theme draws however its art needs. The rest of the
 * game only ever talks to the collision layer.
 *
 * To switch to a Tiled map: load it with `this.load.tilemapTiledJSON(key, url)` in the
 * Preloader and turn its layers and objects into `LevelData` in place of `parseLevel`.
 * Nothing else needs to change.
 */
export function buildLevel(scene: Phaser.Scene, level: LevelData): BuiltLevel {
  const map = scene.make.tilemap({
    data: level.cells.map((cells) =>
      cells.map((kind) => {
        if (kind === null) return CollisionTile.Empty;
        return isSolid(kind) ? CollisionTile.Solid : CollisionTile.OneWay;
      }),
    ),
    tileWidth: level.tileSize,
    tileHeight: level.tileSize,
  });

  const tileset = map.addTilesetImage(
    TextureKey.Collision,
    TextureKey.Collision,
    level.tileSize,
    level.tileSize,
  );
  if (!tileset) {
    throw new Error(`Tileset texture "${TextureKey.Collision}" is missing.`);
  }

  const layer = map.createLayer(0, tileset, 0, 0);
  if (!(layer instanceof Phaser.Tilemaps.TilemapLayer)) {
    throw new Error('Could not create the collision layer.');
  }
  layer.setVisible(false);
  layer.setCollision(CollisionTile.Solid);

  // One-way tiles collide on their top face only. Face recalculation is skipped
  // because it would mark all four faces of any colliding tile as solid again.
  layer.forEachTile((tile) => {
    if (tile.index === CollisionTile.OneWay) {
      tile.setCollision(false, false, true, false, false);
    }
  });

  theme.renderLevel(scene, level);

  return {
    layer,
    objects: level.objects,
    widthPx: map.widthInPixels,
    heightPx: map.heightInPixels,
  };
}

/**
 * Process callback for body-vs-layer colliders. Arcade would otherwise snap a body onto
 * a one-way tile whenever it is falling while overlapping it (for example at the top of
 * a jump from below), so only let the tile collide if the body's feet started this
 * physics step above the tile.
 */
export function shouldCollideWithTile(object: ArcadeObject, tile: ArcadeObject): boolean {
  if (!(tile instanceof Phaser.Tilemaps.Tile) || tile.index !== CollisionTile.OneWay) {
    return true;
  }
  if (!('body' in object) || !(object.body instanceof Phaser.Physics.Arcade.Body)) {
    return true;
  }

  const previousBottom = object.body.prev.y + object.body.height;
  return previousBottom <= tile.getTop() + WORLD.oneWayTolerance;
}
