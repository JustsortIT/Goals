# Asset credits

Everything in this folder is third-party art released under
[Creative Commons Zero (CC0 1.0)](https://creativecommons.org/publicdomain/zero/1.0/):
free for personal, educational and commercial use, with no attribution required.
Credit is given here anyway, and the original licence files are kept in `licenses/`.

| File                                        | From                                                                 | Author | Source                                                         |
| ------------------------------------------- | -------------------------------------------------------------------- | ------ | -------------------------------------------------------------- |
| `tilesets/pixel-platformer-tiles.png`       | Pixel Platformer 1.2 (`Tilemap/tilemap_packed.png`)                  | Kenney | https://kenney.nl/assets/pixel-platformer                      |
| `tilesets/pixel-platformer-industrial.png`  | Pixel Platformer Industrial Expansion (`Tilemap/tilemap_packed.png`) | Kenney | https://kenney.nl/assets/pixel-platformer-industrial-expansion |
| `tilesets/pixel-platformer-food.png`        | Pixel Platformer Food Expansion (`Tilemap/tilemap_packed.png`)       | Kenney | https://kenney.nl/assets/pixel-platformer-food-expansion       |
| `tilesets/pixel-platformer-blocks-sand.png` | Pixel Platformer Blocks (`Tilemap/sand_packed.png`)                  | Kenney | https://kenney.nl/assets/pixel-platformer-blocks               |
| `sprites/pixel-platformer-characters.png`   | Pixel Platformer 1.2 (`Tilemap/tilemap-characters_packed.png`)       | Kenney | https://kenney.nl/assets/pixel-platformer                      |
| `fonts/kenney-mini.ttf`                     | Kenney Fonts (`Fonts/Kenney Mini.ttf`)                               | Kenney | https://kenney.nl/assets/kenney-fonts                          |

Retrieved 2026-10-04. The files are unmodified apart from being renamed.

Only the packed sheets the game uses were copied. The full packs also contain
individual tile images, more block colours and fonts, and sample Tiled maps
(`.tmx`/`.tsx`) that are a useful reference when the level moves to Tiled.

## Derived at run time

The files above are never edited. A few things in the game are made from them in code
when it starts (`src/themes/kenney/textures.ts`, and `src/systems/commonTextures.ts`
for the skyline), which CC0 permits:

- **The hero** is the pack's beige character with its space helmet removed and clothes
  coloured in.
- **The pint** is the Food Expansion's white mug, recoloured.
- **The lamp post, pub window, pub sign and city skyline** are drawn from scratch in the
  pack's palette and outline style. They are original to this project.

## Generated packs

The art under `src/themes/packs/` is not in this folder and is not Kenney's. Each pack
was generated with [PixelLab](https://www.pixellab.ai) from the descriptions in
`tools/art/themes/<name>.json`; the exact prompt for every image is recorded in the
pack's `theme.json`. Check PixelLab's terms for the plan the images were generated under
before distributing a build that includes them.
