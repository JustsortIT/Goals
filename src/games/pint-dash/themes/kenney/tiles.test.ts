import { describe, expect, it } from 'vitest';
import { levelFor } from '../../levels/levels';
import { DECOR_HEIGHT, parseLevel, parseSections, type DecorKind } from '../../systems/level';
import { BLOCK_TILES, DECK_TILES, DECOR_TILES, ONE_WAY_TILES, TERRAIN_TILES } from './frames';
import { decorTiles, EMPTY_TILE, levelTiles } from './tiles';

const TILE = 18;
const [ALONE, LEFT, MIDDLE, RIGHT] = [0, 1, 2, 3];
const tilesOf = (rows: string[]) => levelTiles(parseLevel(rows, TILE));

describe('levelTiles', () => {
  it('gives a floating row of ground thin pieces with left and right ends', () => {
    expect(tilesOf(['P...G', '.###.', '.....'])[1]).toEqual([
      EMPTY_TILE,
      TERRAIN_TILES.thin[LEFT],
      TERRAIN_TILES.thin[MIDDLE],
      TERRAIN_TILES.thin[RIGHT],
      EMPTY_TILE,
    ]);
  });

  it('stacks top, middle and bottom pieces by what is above and below', () => {
    const tiles = tilesOf(['P.G', '.#.', '.#.', '.#.', '...']);
    expect(tiles.map((row) => row[1])).toEqual([
      EMPTY_TILE,
      TERRAIN_TILES.top[ALONE],
      TERRAIN_TILES.middle[ALONE],
      TERRAIN_TILES.bottom[ALONE],
      EMPTY_TILE,
    ]);
  });

  it('treats the level as continuing past its sides and bottom', () => {
    const tiles = tilesOf(['P.G', '###', '###']);
    expect(tiles[1]).toEqual(Array(3).fill(TERRAIN_TILES.top[MIDDLE]));
    expect(tiles[2]).toEqual(Array(3).fill(TERRAIN_TILES.middle[MIDDLE]));
  });

  it('outlines the side of a step that rises out of flat ground', () => {
    const tiles = tilesOf(['P...G', '..#..', '#####']);
    expect(tiles[1][2]).toBe(TERRAIN_TILES.top[ALONE]);
    // The ground under the step is covered; its neighbours are still surface.
    expect(tiles[2][2]).toBe(TERRAIN_TILES.middle[MIDDLE]);
    expect(tiles[2][1]).toBe(TERRAIN_TILES.top[MIDDLE]);
  });

  it('picks one-way and deck pieces by position in the run', () => {
    const tiles = tilesOf(['P....G', '===.=.', 'HHH.H.']);
    expect(tiles[1]).toEqual([
      ONE_WAY_TILES[LEFT],
      ONE_WAY_TILES[MIDDLE],
      ONE_WAY_TILES[RIGHT],
      EMPTY_TILE,
      ONE_WAY_TILES[ALONE],
      EMPTY_TILE,
    ]);
    expect(tiles[2]).toEqual([
      DECK_TILES[LEFT],
      DECK_TILES[MIDDLE],
      DECK_TILES[RIGHT],
      EMPTY_TILE,
      DECK_TILES[ALONE],
      EMPTY_TILE,
    ]);
  });

  it('places solid blocks, and keeps paving on the ground under them', () => {
    const tiles = tilesOf(['P..G', '.BC.', '####']);
    expect(tiles[1]).toEqual([EMPTY_TILE, BLOCK_TILES.brick, BLOCK_TILES.crate, EMPTY_TILE]);
    expect(tiles[2]).toEqual(Array(4).fill(TERRAIN_TILES.top[MIDDLE]));
  });

  it('leaves scenery and objects out', () => {
    expect(tilesOf(['PbfG', '####'])[0]).toEqual(Array(4).fill(EMPTY_TILE));
  });
});

describe('decorTiles', () => {
  it('puts scenery in its own cell only', () => {
    const tiles = decorTiles(parseLevel(['PbfG', '####'], TILE));
    expect(tiles[0]).toEqual([EMPTY_TILE, DECOR_TILES.barrel[0], DECOR_TILES.fence[0], EMPTY_TILE]);
    expect(tiles[1]).toEqual(Array(4).fill(EMPTY_TILE));
  });

  it('stacks tall scenery upwards from its cell', () => {
    const tiles = decorTiles(parseLevel(['....', 'PL.G', '####'], TILE));
    const [post, head] = DECOR_TILES.lampPost;
    expect(tiles[1][1]).toBe(post);
    expect(tiles[0][1]).toBe(head);
  });

  it('has as many tiles for each piece as the level format leaves room for, or none', () => {
    for (const kind of Object.keys(DECOR_TILES) as DecorKind[]) {
      // An empty list is a piece this theme does not draw.
      expect([0, DECOR_HEIGHT[kind]]).toContain(DECOR_TILES[kind].length);
    }
  });

  it('draws every piece of scenery in the level this theme plays', () => {
    const level = parseSections(levelFor('kenney').sections, TILE);
    const drawn = decorTiles(level)
      .flat()
      .filter((tile) => tile !== EMPTY_TILE);
    // Apart from the set pieces, which this theme has no art for.
    const expected = level.decor.reduce((sum, item) => sum + DECOR_TILES[item.kind].length, 0);
    expect(drawn).toHaveLength(expected);
    expect(expected).toBeGreaterThan(20);
  });
});
