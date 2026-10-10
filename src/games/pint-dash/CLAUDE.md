> **These are Pint Dash's own notes, as written on 4 October 2026.** Pint Dash was the whole of this repo
> then; it now lives in `src/games/pint-dash`, and every path below (`src/...`, `tools/art/...`,
> `docs/images/...`) is inside that folder. PubPixels' platformer grew out of it and has left it
> behind. For making a new game, read `README.md` and `CLAUDE.md` at the top of the repo instead.

# Pint Dash (repository: phaseplay)

A pixel-art platformer built with **Phaser 4** (not Phaser 3), for local development on macOS.
It is set on a Dublin street: collect pints of stout, dodge the rolling kegs, reach the pub.
The game is called **Pint Dash** (`GAME_TITLE` in `config/constants.ts`, and the `<title>`
in `index.html`); the repository and npm package keep the working name `phaseplay`.

## Stack

| Tool            | Version | Notes                                                          |
| --------------- | ------- | -------------------------------------------------------------- |
| Phaser          | 4.2.1   | Arcade Physics, WebGL renderer                                 |
| TypeScript      | 6.0.x   | `strict`, `erasableSyntaxOnly` (no enums/parameter properties) |
| Vite            | 8.3.x   | dev server and build                                           |
| Vitest          | 5.0.x   | unit tests for pure logic only, Node environment               |
| ESLint          | 10.x    | flat config: `@eslint/js` + `typescript-eslint` recommended    |
| Prettier        | 3.x     | single quotes, 100 columns                                     |
| Node            | 24      | pinned in `mise.toml`; anything >= 22.12 works                 |
| Package manager | npm     |                                                                |

Ask the user before adding any dependency that is not in this table.

## Commands

```sh
npm run dev         # Vite dev server at http://localhost:5173
npm run build       # typecheck, then production build to dist/
npm run preview     # serve dist/
npm run typecheck   # tsc --noEmit
npm run lint        # eslint + prettier --check
npm run format      # prettier --write
npm test            # vitest run (npm run test:watch to watch)
npm run art:generate -- <theme> --dry-run   # generated art; see "Themes" before a real run
```

Run `typecheck`, `lint`, `test` and `build` before calling a change done.

A theme's JSON file holds two things: the description of its art, which only the
generator reads, and its level, which only the game reads.

`README.md` is the detailed description of the architecture and of theme generation
(the walkthrough, the prompting guide, the generator's internals, the pack format and
measured costs). Keep it in step when any of those change: it quotes the theme
description file, the prompt wording the generator adds, and the `Theme` interface.

The machine's default Node (via mise) is 20.x, which is too old for Vite 8 and Vitest 5.
Interactive shells pick up `mise.toml` automatically; in a non-interactive shell, check
`node --version` and prefix commands with `mise exec --` if it is not 24
(for example `mise exec -- npm test`).

## This is Phaser 4: do not write Phaser 3 from memory

Most Phaser examples and most model training data are Phaser 3. v4 kept much of the API
but rewrote the renderer and removed or changed things. Before using any Phaser API:

1. Check the skill for that subsystem in `.claude/skills/` (cameras, physics-arcade,
   tilemaps, input, tweens, ...). They are copied from `node_modules/phaser/skills`
   at v4.2.1; re-copy them after upgrading Phaser. `physics-matter` is deliberately
   left out because this project uses Arcade only.
2. Check the installed types: `node_modules/phaser/types/phaser.d.ts` (grep for the
   method). If the types disagree with your memory, the types win.
3. For anything removed or renamed, read `.claude/skills/v3-to-v4-migration/SKILL.md`
   (same content as `node_modules/phaser/changelog/v4/4.0/MIGRATION-GUIDE.md`).
4. When types are not enough, read the source in `node_modules/phaser/src`.

v4 differences this codebase already depends on:

- `setTintFill()` is gone. Use `setTint(color).setTintMode(Phaser.TintModes.FILL)`.
- `Group#children` is a native `Set` (`for...of`, `.size`), not `Phaser.Structs.Set`.
- `roundPixels` defaults to `false`. `pixelArt: true` turns it on (and antialias off).
  Camera scroll is no longer rounded; vertices are rounded per object when drawn.
- `TextureManager.generate` / `Create.GenerateTexture` are gone. Textures made in code
  use `textures.createCanvas()` and the 2D context.
- `this.load.font(key, url, 'truetype')` loads a font file natively; the key becomes
  the CSS font-family.
- `Geom.Point` is gone (use `Vector2`); `Math.TAU` is now `2 * PI`.
- `map.createLayer()` can return a `TilemapGPULayer`; Arcade colliders want a
  `TilemapLayer`, so `levelLoader.ts` narrows with `instanceof`.
- `import Phaser from 'phaser'` works (the ESM build has a default export). There is no
  global `Phaser` at runtime.
- FX are now filters (`camera.filters.internal/external`, `sprite.enableFilters()`).
  The Vignette filter darkens linearly from the centre and is fully opaque outside its
  radius, so the HUD uses a pre-drawn overlay texture instead. External camera filters
  add a full-screen render pass; measure frame cost before keeping one.
- `emitter.setParticleTint()` only replaces the current value. To pick tints at random,
  pass the array as `tint` in the emitter config (see `systems/effects.ts`).

## Folder conventions

```
src/
  main.ts            Phaser.Game config only (size, scaling, physics, scene list)
  config/
    constants.ts     every tunable: gameplay (PLAYER, ENEMY, ...) and presentation (FX, SKYLINE)
    keys.ts          scene, texture, font, animation and registry key strings
  scenes/            one class per file, named after its key: Boot, Preloader, Title, Game,
                     UI, GameOver
  entities/          game objects with behaviour: Player, Enemy (keg), Collectible (pint)
  systems/           logic that is not a scene, an entity or a theme
    input.ts             keyboard and touch buttons -> InputState (the only place that knows bindings)
    touchControls.ts     on-screen buttons for touch devices (drawn in the UI scene)
    level.ts             level format + text-grid parser; joinSections (pure)
    reach.ts             plays a level with a copy of the game's physics: what can be
                         reached, how quickly, by what route (pure)
    format.ts            formatting for text shown to the player (pure)
    levelLoader.ts       LevelData -> invisible collision layer, one-way platform rule
    movement.ts          run/jump/stomp maths, and which in-air pose to show (pure)
    commonTextures.ts    textures drawn in code that every theme shares: vignette, particle, and
                         the plain city skyline for themes with none of their own
    pixelFont.ts         builds the bitmap font from the TTF; addPixelText() for all text
    animations.ts        the hero's idle and run animations, from the theme's frame lists
    background.ts        the sky colour and the two parallax rows of skyline, from the theme
    effects.ts           particle bursts and floating score text
    boards.ts            writes on the notice boards and the HUD's section banner
    ambient.ts           the theme's flyer crossing the sky
    *.test.ts            Vitest tests, next to the file they test
  themes/            everything that depends on which art is in use
    theme.ts             the Theme interface: preload, create (-> ThemeArt), renderLevel, buildGoal
    active.ts            which theme is running, and the tile size it implies (pure)
    index.ts             `theme` and `themeArt()`, what the rest of the game imports
    packs.ts             finds generated packs at build time (pure)
    kenney/              the hand-assembled theme: frames.ts (tile numbers), tiles.ts (which
                         tile draws each cell, pure), textures.ts (atlas, hero, pint), pub.ts
    generated/           the theme for any generated pack: corners.ts, pixels.ts and
                         heroLayout.ts (all pure)
    packs/<name>/        a generated pack: PNGs, theme.json, preview.html (committed)
  levels/            levels.ts (which level the active theme plays, and the tests that
                     play every level), and title.ts for the street behind the title screen.
                     The level itself is data in tools/art/themes/<name>.json
public/assets/       Kenney art and the font; README for layout, CREDITS for sources and licences
tools/art/           generate.mjs (npm run art:generate), themes/<name>.json (the prompts),
                     png.mjs (reads and writes PNGs, so no image library is needed)
docs/images/         the pictures used by README.md
```

Rules that keep this structure working:

- **Pure logic stays Phaser-free.** Files marked "pure" above must not import Phaser
  (it needs a browser, and the tests run in Node). Entities read body state, call the
  pure function, and write the result back. New rules that can be expressed as maths
  go in a pure module with tests.
- **Tunables go in `config/constants.ts`**, grouped by owner (`PLAYER`, `ENEMY`, ...).
  Distances and speeds are written in tiles (`tiles(7.5)`), because the tile size
  depends on the theme. Never write a pixel distance that assumes 18px or 16px tiles.
- **No string literals for keys.** Add to `config/keys.ts`. The one exception is texture
  keys that a theme builds and only that theme uses (see `themes/generated/index.ts`).
- **Nothing outside `src/themes` knows what the art is.** Entities and the HUD get their
  texture, frames and collision box from `themeArt()`; the level picture comes from
  `theme.renderLevel()`. If a theme needs something new, add it to the `Theme` interface
  and implement it in both themes.
- **Scenes talk through the registry**, not to each other. `Game` writes score/lives to
  `this.registry`; `UI` redraws on registry change events.
- **Scene instances are reused on restart.** Reset all state in `create()`, never rely
  on field initialisers. Listeners on anything that outlives the scene (registry, game
  events) must be removed on `SHUTDOWN`.
- Entities take the **bottom-centre** position of their tile (where the feet go).
- **Visuals never change physics.** Arcade bodies resize with their sprite's scale, so
  anything that squashes, stretches or scales during play is drawn by a separate sprite.
  `Player` is an invisible physics sprite plus a `visual` sprite that follows it.
- **Effects hang off events.** Entities emit (`PlayerEvent.Jumped`, `Landed`) and the
  Game scene decides what dust, shake or sound that means. Presentation numbers live
  in `FX` / `SKYLINE` in `constants.ts`.
- **Whole pixels.** Keep sprite positions, particle scales and tile offsets on integers
  where possible; fractional values shimmer at this resolution.
- **Kenney theme: no raw frame numbers outside `themes/kenney/frames.ts`.** The tile
  sheets are stacked into one atlas (`TextureKey.Tiles`) at boot. In `frames.ts`,
  `base(n)`, `industrial(n)`, `bricks(n)` and `custom(n)` turn a frame number as counted
  in that sheet into its atlas number; name the result there (`TileFrame`,
  `DECOR_TILES`, ...).
- **The setting is a Dublin street leading to a pub** (the `dublin` pack, the default
  look). Keep it recognisably Dublin without brand names or real pub names: stout, not
  a named stout. The Kenney theme is the generic fallback, built only from Kenney's
  Pixel Platformer family plus a few pieces made in the same style in
  `themes/kenney/textures.ts` (hero without helmet, pint, lamp post, pub window and
  sign). Keep new art for it in that family or that style.
- **Tiles are drawn at the art's native size** (18px Kenney, 16px generated) and sprites
  are never scaled to fit. The one exception is a generated crate, which is stretched to
  fill its cell because the cell is what collides.
- **All text is `BitmapText` via `addPixelText()`**, at sizes from `FONT_SIZE` (multiples
  of 8). Do not use `this.add.text()`: the browser anti-aliases canvas text, which
  shows as soft fringes next to the pixel art. Tint it with `setTint()`; the dark
  outline is baked in. The font covers printable ASCII only.
- **Third-party assets need a row in `public/assets/CREDITS.md`** and a licence that
  allows the use. Ask the user before adding a new pack.

## Scene flow

`Boot` -> `Preloader` -> `Title` -> `Game` (which launches `UI` on top) -> `GameOver` ->
`Game` again. The title screen is not a picture: it parses `levels/title.ts` and has the
theme draw it (`theme.renderLevel`, `theme.buildGoal`, the backdrop), so it matches
whichever theme is active and needs no art of its own. Its layout numbers and the tagline
are `TITLE` in `constants.ts`. Space, Enter or a tap starts the game.

## Adding a scene

1. Add its key to `SceneKey` in `src/config/keys.ts`.
2. Create `src/scenes/<Name>.ts`: `export class <Name> extends Phaser.Scene` with
   `constructor() { super(SceneKey.<Name>); }` and a `create()`.
3. Add the class to the `scene` array in `src/main.ts`. Order is draw order: overlays
   such as `UI` go after the scene they sit on top of. Only the first scene auto-starts.
4. Start it with `this.scene.start(SceneKey.<Name>, data)` (replaces the current scene)
   or `this.scene.launch(SceneKey.<Name>)` (runs in parallel, like the HUD).

## Adding an entity

1. Create `src/entities/<Name>.ts` extending `Phaser.Physics.Arcade.Sprite`. Follow
   `Enemy.ts`: `declare body: Phaser.Physics.Arcade.Body;`, then in the constructor
   call `scene.add.existing(this)` and `scene.physics.add.existing(this)` before
   touching `this.body`.
2. Add its tunables to `config/constants.ts` and any animation to
   `systems/animations.ts`. Add its art to `ThemeArt` in `themes/theme.ts` and provide
   it in both themes: for Kenney, name the frame in `themes/kenney/frames.ts` (the
   sheets have many unused tiles; see `public/assets/README.md`) and measure the art's
   opaque bounds before choosing the collision box; for generated packs, add the role
   to `tools/art/generate.mjs` and the theme definitions, and load it in
   `themes/generated/index.ts`.
3. To place it in levels: add a type to `LevelObjectType` and a character to
   `OBJECT_SYMBOLS` (both in `systems/level.ts`), cover it in `level.test.ts`, then
   handle the new type in `Game.spawnEntities()`. If it is something to collect, add it
   to the pickups in `reach.ts` so the tests check it can be reached.
4. Wire collisions in `Game.addCollisions()`. Put instances in a plain
   `this.add.group()`: a physics group would overwrite per-body settings such as
   `allowGravity` with its defaults. Pass `shouldCollideWithTile` as the process
   callback on any collider against the tile layer so one-way platforms work.
5. Per-frame behaviour is an explicit method called from `Game.update()`
   (`player.tick()`, `enemy.patrol()`).

## Levels

The level is data: `"level"` in a theme's description, `tools/art/themes/<name>.json`
(today only `dublin.json` has one). `src/levels/levels.ts` reads every description with
`import.meta.glob` and gives the running theme its own level, or the default theme's if
it has none (Kenney has no description at all). The generator ignores `level`. Editing
the JSON reloads the game; there is no build step. The legend is the header comment of
`systems/level.ts`, because JSON cannot hold comments.

A level is text grids. `parseLevel` turns a grid into
`LevelData`, which says what is in each place, never which picture to draw: `cells`
(ground, one-way, deck, brick, crate, or empty), `decor` (scenery, by the cell it stands
in) and `objects` (the player, kegs, fast kegs, pints, hearts, checkpoints, the goal).
The level is the same under every theme.

`buildLevel` in `levelLoader.ts` makes an invisible Tilemap layer from `cells` that
everything collides with (index 0 solid, 1 one-way), then hands the level to
`theme.renderLevel()` for the picture. Its doc comment has the steps for switching to a
Tiled JSON map.

To add scenery: add a kind to `DecorKind`, a character to `DECOR_SYMBOLS` and a height
to `DECOR_HEIGHT` in `level.ts`, then its tiles to `DECOR_TILES` in the Kenney theme
(bottom first, for tall pieces; a test checks the count matches the height) and its
name to `DECOR_KINDS` in the generated theme. A generated pack that has no image for a
kind of scenery just leaves it out.

The pub is not in the grid: `G` marks its door. `Game` puts the goal trigger there (one
cell) and `theme.buildGoal()` draws the building around it.

A notice board (`N`) is an object with words: each section lists its `notices`, in order
from the left, and `parseLevel(rows, tileSize, notices)` attaches them. It throws if the
counts differ or a message is over three lines of seven characters (`NOTICE_LIMITS`,
which is what every theme's board has room for). `M` (landmark) and `D` (building) are
big scenery; the Kenney theme has no art for them and draws nothing.

`Game.enterSections()` puts the name of the section the player has reached in the
registry (`RegistryKey.Section`), and the HUD's banner shows it.

An arrow sign (`>`) is scenery and a checkpoint: `parseLevel` emits both a decor item and
a `checkpoint` object. `Game.passCheckpoints()` moves the respawn point when the player's
x passes one. A sign within `CHECKPOINT.nearStart` of the spawn is ignored.

### Editing the level

The level is 320 tiles: eight entries in `level.sections` in `dublin.json`, each with a
`name` (shown on the banner), a `note` (for editors, unused), 20 `rows` and optional
`notices`, joined by `joinSections`. Keep every row of a section the same width; the
parser names the section and row if one is not. Row 16 is where things stand on the street; rows 17
to 19 are ground. Add, remove or reorder sections to change the length; each should
have an arrow sign near its start.

**`npm test` plays every level it finds in a theme description** (`systems/reach.ts`,
`levels/levels.test.ts`). After any edit it must still pass: the pub reachable, also at nine tenths strength; every
checkpoint on the way in order; every pint and heart touchable. The default level must
also keep its quickest route between 40 and 52 seconds (roughly half what a person
takes) and its second half harder than the first. If a pint is reported out of reach, it is probably not on a natural jump
arc: put pickups in cells the player stands in, or one or two cells above them.

What the player can do, which is what to design to:

| Jump                 | Full strength                           | Nine tenths (use this for the way to the pub) |
| -------------------- | --------------------------------------- | --------------------------------------------- |
| Gap on the flat      | 5 tiles                                 | 4                                             |
| Gap while climbing 2 | 4                                       | 3                                             |
| Climb with no gap    | 3 tiles                                 | 2                                             |
| A pickup overhead    | 2 cells above the cell stood in is safe |                                               |

Kegs turn at walls and at the edge of what they stand on, so a keg's lane is the run of
floor between two walls, crates or drops. Give a lane at least 6 tiles. A keg works on a
one-way platform or a deck as well as on the ground. `F` is the same keg, faster.

`reach.ts` must stay a faithful copy of the game. It calls the same `movement.ts`
functions with the same constants, and its `separate()` is a port of Phaser's Arcade
`SeparateTile` (including the corner rule: a body that just clips the top corner of a
ledge is pushed off sideways). `reach.test.ts` pins it to distances measured in the real
game. If the player's movement code, the physics order in `Player.tick`, or a collision
setting changes, re-measure in a browser and update both.

## Themes

The theme is chosen once at start-up (`themes/active.ts`): `?theme=<name>` in the
address, else `VITE_THEME=<name>` at dev or build time, else `DEFAULT_THEME` in that
file (`dublin`). Names are `kenney` or any folder under `src/themes/packs/`: currently
`dublin` and `street-daylight` (the first generated pack, a generic English street).
Check changes that touch drawing, entities or constants under both `?theme=kenney` and
a generated pack.

How the two differ:

|         | Kenney                                              | Generated pack                                    |
| ------- | --------------------------------------------------- | ------------------------------------------------- |
| Tiles   | 18px, one tile per cell, picked from neighbours     | 16px corner pieces, sixteen per material          |
| Sprites | frames of the Kenney sheets, boxes hand-measured    | one PNG each, trimmed at boot, boxes from the art |
| Hero    | two frames: stand, step (the step is also the jump) | stand, a run cycle, and poses for the air         |
| The pub | assembled from tiles in `kenney/pub.ts`             | one image, `goal.png`                             |
| Skyline | plain buildings drawn in `commonTextures.ts`        | the pack's pictures, faded towards a haze colour  |

Corner pieces ("Wang" tiles): each is drawn centred on the point where four cells meet
and chosen by which of those four are filled (`generated/corners.ts`: north-west 1,
north-east 2, south-west 4, south-east 8). So each material is a layer one tile bigger
than the level, shifted half a tile up and left. One-way platforms are drawn without
their underside pieces, which makes them a thin ledge.

The hero (`HeroArt` in `themes/theme.ts`) is one texture with frame lists: `idle`, `run`
(played as animations) and `air`. In the air there is no animation: `Player` shows one
`air` pose at a time, picked by vertical speed (`airPoseIndex`), so the first pose is
the take-off, the middle ones the top of the jump and the last the fall, whatever the
height. A generated pack's frames all share one canvas; `heroLayout.ts` cuts them into
equal cells with the standing hero's feet on the bottom edge, and moves air poses down
so their lowest point is on that edge (the physics supplies the height of a jump).

### Generating a pack (PixelLab)

Things with words on them (`BoardArt`: the notice board and the banner) are blank
pictures that `systems/boards.ts` writes on with `addPixelText`. Never generate or draw
the words into the picture. A generated pack's blank face is found at boot by
`findWritingArea` (the largest rectangle of a single colour); if the pack has no board,
or the face is under 30 by 9 pixels, the theme falls back to `DEFAULT_BOARDS`, drawn in
`commonTextures.ts`. `ThemeArt.flyer` is optional (null for none); `systems/ambient.ts`
sends one across the sky every few seconds.

The backdrop (`BackdropArt`): a sky colour and two rows of skyline, the far one scrolling
slowest. A pack's rows are pictures (`backdrop-near`, `backdrop-far`), washed with the
row's haze colour (`SKYLINE.farHaze` / `nearHaze`) so they sit back behind the level.
A row of one picture is mirrored so it repeats without a seam. A row of several
(`backdrop-far-1`, `-2`, ...) is laid side by side unmirrored, which keeps a landmark
from showing twice on one screen: in `dublin`, picture 2 has the Spire, the Poolbeg
chimneys and the Custom House, and picture 1 is plain rooftops. The far row is raised
(`SKYLINE.farLift`) so it shows over the near row's roofs. The sky and haze colours are
in the theme definition and can be changed with `--page-only`.

`tools/art/themes/<name>.json` describes a theme in words: a setting, a style, and what
each role should be (hero, enemy, pickup, heart, crate, goal, scenery, the three ground
materials, the skyline, the hero's `run` and `jump` animations, and five optional
extras: `noticeBoard`, `banner` and `flyer` under `sprites`, `landmark` and `building`
under `decor`). `reuse` copies named
pieces from another pack for nothing (`dublin` borrows the keg, heart, crate, fence, weeds
and lamp post). `npm run art:generate -- <name>` turns that into
`src/themes/packs/<name>/` with the PixelLab API, using the key in `.env.local`
(`PIXELLAB_API_KEY`). It only makes what the pack is missing; `--only a,b` redoes
specific pieces. `preview.html` in the pack shows everything with its prompt.

**Every image spends the user's credit** (the free trial is used up). Measured prices:
a sprite about $0.007, the pub or a skyline picture about $0.01, a tileset about $0.01,
an animation $0.02 to $0.03. The whole `dublin` pack cost about $0.20 including three
redos. So:

- Use `--dry-run` or `--page-only` unless a paid run is intended, and keep the caps
  (`--max-generations`, `--max-usd`) low. The script rejects options it does not know.
- Never chain a paid run after a step that might have failed.
- `--only` overwrites. Copy the files somewhere first if the current ones might be kept.
- The free plan runs one job at a time; the script waits and retries on HTTP 429.

What has been learned about prompting it:

- Sprites: describe the object only. Adding the setting ("city street") makes it draw
  scenery around the object. The script appends "single object centered on a plain white
  background, nothing else" and asks for no background.
- The canvas size sets the size in the game, because things come back filling most of
  the canvas: one tile (16x16) for low things, 32x32 for tall ones, 24x24 for the hero.
  Sizes must be multiples of 4, and square when a side is under 32.
- A crate must fill its cell, so its prompt says "fills the whole image edge to edge".
- Buildings: say "flat front elevation seen straight on, no perspective".
- Boards the game writes on (`noticeBoard`, `banner`): ask for them blank and say so
  twice ("completely blank plain black slate, no writing, no drawing"), with one plain
  colour for the face. Check on the preview page that nothing was drawn on the face.
- Landmark: one object on a base, described and not named. Flyer: a light shape, side
  view, facing right.
- Skyline pictures: 256 wide works well. A 640-wide one came back nearly empty, so for
  more width use several pictures in a row. Name the landmarks by shape ("one very tall
  thin needle spire, two tall thin power station chimneys side by side"), not by name.
  A second picture comes out at its own scale; that reads as a different distance.
- Tilesets: the fill tile repeats across the whole ground, so ask for something plain
  ("smooth flat colour, almost no detail"); "small stones" gave a busy pattern. The
  `transition` text is the surface layer; it comes out as a row of rounded stones
  whatever it is called, which suits cobbles. "Dark grey" comes out nearly black; ask
  for "medium grey".
- Hero animations (`animations` in the definition, ids `hero-run` and `hero-jump`) are
  made from the hero image with `/animate-with-text-v3`: the image is the first frame
  and `action` describes the movement. Each costs one generation whatever the frame
  count, and returns the input frame followed by the new ones.
  - Say the movement happens in place: "running on the spot ... staying in the centre of
    the frame". "Running to the right" made the hero travel out of the frame, and the
    model then drew a second figure and lost the colours.
  - Not every frame is usable. Look at `preview.html`, list the frame numbers to play in
    `use`, and run `--page-only` to apply it (no API call). For a run, leave out the
    standing first frame and any frame where the hero stands upright mid-cycle. For a
    jump, pick poses in order: rising, top, falling.
  - A pack with no animations still works: the run is the standing image bobbing.

The API reference is at `https://api.pixellab.ai/v2/llms.txt` and `/v2/openapi.json`.

## Checking the game in a browser

- In dev builds the game instance is `window.game`, so
  `game.scene.getScene('Game')` gives the live scene (player, enemies, level).
- The page opens on the title screen. A test script can go straight to the level with
  `game.scene.getScene('Title').scene.start('Game')`.
- Moving the player with `player.body.reset(x, y)` passes every checkpoint to its left,
  so the respawn point moves too. Kegs are in level order (top row first), not left to
  right.
- Backtick toggles Arcade debug drawing plus a tile-collision overlay.
- The dev server allows `.ngrok-free.dev` hosts (`vite.config.ts`), so the user can test
  on a phone through an ngrok tunnel to port 5173.
- To test touch in headless Chrome, turn on touch emulation before loading the page;
  the buttons only appear when the device reports a touch screen.
- Audio is switched off in `main.ts` (`audio.noAudio`) because the game has no sound yet.
- Headless Chrome renders it fine with WebGL
  (`Google Chrome --headless=new --remote-debugging-port=...`), which is how the
  initial vertical slice was verified: load the page, watch for console errors, drive
  keys over the DevTools protocol and read state from `window.game`.
- On this Mac a headless Chrome instance tends to stall after a few minutes (its log
  shows `CVDisplayLinkCreateWithCGDisplay failed`). Launch a fresh instance per run with
  its own `--user-data-dir`, and give test scripts a hard timeout.
