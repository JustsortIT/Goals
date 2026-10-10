# Assets

The font, and the art of the Kenney theme (loaded by `src/themes/kenney/index.ts`). Everything in `public/` is served
from the site root, so `public/assets/sprites/player.png` loads as
`assets/sprites/player.png`.

Where each file came from and its licence: [CREDITS.md](CREDITS.md). Add a row there
for anything new, and only add assets whose licence allows it.

## Layout

```
assets/
  sprites/      characters, enemies, pickups (spritesheets or atlases)
  tilesets/     tileset images used by maps
  maps/         Tiled JSON exports
  ui/           HUD and menu images
  fonts/        TTF sources and bitmap fonts
  audio/
    sfx/        short sound effects
    music/      looping tracks
  licenses/     licence files shipped with third-party packs
```

## What is in the sheets

Frame numbers count left to right, top to bottom, from 0. The ones the game uses are
named in `src/themes/kenney/frames.ts`; nothing else in the code refers to a raw frame number.

- `tilesets/pixel-platformer-tiles.png`: 20 x 9 tiles of 18px. Grass, sand and snow
  terrain, hearts, doors, crates, signs, fences, plants, digits.
- `tilesets/pixel-platformer-industrial.png`: 16 x 7 tiles. Paved ground, steel girders,
  scaffolding, barrels, crates, pipes, road signs and barriers.
- `tilesets/pixel-platformer-food.png`: 16 x 7 tiles. Food and drink: mugs, glasses,
  bottles, burgers, pizza, cake.
- `tilesets/pixel-platformer-blocks-sand.png`: 9 x 9 tiles. Sand-coloured stone and
  brick blocks in several sizes.
- `sprites/pixel-platformer-characters.png`: 9 x 3 frames of 24px. Five heroes with two
  frames each, and the enemies.

The four tile sheets are stacked into one atlas when the game starts, so the level can
use tiles from any of them. `frames.ts` has a helper per sheet that takes the frame
number as counted in that sheet.

## Naming

- Lowercase `kebab-case`, no spaces: `player-run.png`, `forest-tileset.png`.
- Name by what it is, then the variant: `enemy-keg-roll.png`, not `roll2-final.png`.
- Add a key to `TextureKey` in `src/config/keys.ts` instead of typing the string in scenes.
- Spritesheets: fixed-size frames in a grid, no spacing; put the frame size in
  `src/themes/kenney/frames.ts`, not the filename.
- Atlases: matching pair with the same base name (`characters.png` + `characters.json`).
- Tilesets: 18x18 tiles, the Kenney theme's tile size; if you extrude, pass
  margin/spacing to `addTilesetImage`.
- Maps: `level-01.json`, `level-02.json`, exported from Tiled as JSON with embedded
  tilesets (Phaser cannot read external `.tsx` tilesets or image collections).
- Audio: ship `.ogg` plus `.m4a` (or `.mp3`) for Safari: `jump.ogg` + `jump.m4a`.
- Pixel art: export at 1x. The game scales the whole 480x270 canvas; never pre-scale.
