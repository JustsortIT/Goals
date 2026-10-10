import type Phaser from 'phaser';
import { BACKGROUND_COLOR, SKYLINE } from '../../config/constants';
import { TextureKey } from '../../config/keys';
import { DEFAULT_BOARDS } from '../../systems/commonTextures';
import type { CellKind, DecorKind, LevelData } from '../../systems/level';
import { PACKS, packUrl, type PackManifest } from '../packs';
import type { BackdropArt, BoardArt, BodyBox, HeroArt, Theme, ThemeArt } from '../theme';
import { Corner, cornerCodes } from './corners';
import { layoutHeroFrames } from './heroLayout';
import { dim, findWritingArea, hardenAlpha, opaqueBounds, type Box } from './pixels';

/**
 * A theme made from a generated art pack (`npm run art:generate`, see tools/art).
 *
 * A pack is loose images: one per sprite, and sixteen corner pieces per ground material.
 * At boot the sprites are trimmed to what was actually drawn, and the corner pieces are
 * gathered into one tile atlas. Nothing here knows what the pictures show, so any pack
 * with the same file names works.
 */

/** Texture keys. These are built here and used nowhere else, so they stay out of `config/keys`. */
const Key = {
  Tiles: 'theme-tiles',
  Hero: 'theme-hero',
  Enemy: 'theme-enemy',
  Pickup: 'theme-pickup',
  Heart: 'theme-heart',
  Crate: 'theme-crate',
  Goal: 'theme-goal',
  SkylineFar: 'theme-skyline-far',
  SkylineNear: 'theme-skyline-near',
  NoticeBoard: 'theme-notice-board',
  Banner: 'theme-banner',
  Flyer: 'theme-flyer',
} as const;
const decorKey = (kind: DecorKind) => `theme-decor-${kind}`;
const sourceKey = (file: string) => `theme-source-${file}`;

/** The tilesets a pack has, in the order they are drawn (later ones in front). */
const MATERIALS = ['ground', 'wall', 'platform'] as const;
type Material = (typeof MATERIALS)[number];
const PIECES_PER_MATERIAL = 16;

/** Which material draws each kind of cell. Crates are single images, not a material. */
const CELL_MATERIAL: Partial<Record<CellKind, Material>> = {
  ground: 'ground',
  brick: 'wall',
  oneWay: 'platform',
  deck: 'platform',
};

/**
 * Scenery a pack may provide. Kinds it leaves out are simply not drawn. The order is the
 * order they are drawn in: the big set pieces first, so smaller things stand in front.
 */
const DECOR_KINDS: DecorKind[] = [
  'building',
  'landmark',
  'weeds',
  'fence',
  'arrowSign',
  'barrel',
  'roadBarrier',
  'warningSign',
  'streetSign',
  'lampPost',
];

/** What to write in on a dark board and on a light one. */
const INK = { light: 0xfff6e2, dark: 0x2b2540 };
/** A board's face is "dark" below this brightness, out of 255. */
const DARK_FACE = 140;
/** A board with a blank face smaller than this, in pixels, is no use; the plain one is used. */
const SMALLEST_FACE = { width: 30, height: 9 };

/** Frames per second of a generated run cycle. */
const RUN_FRAME_RATE = 12;
/**
 * A pack with no run animation makes do with the standing image lifted by this much on
 * alternate frames, as a simple bob.
 */
const STEP_LIFT = 1;
const BOB_FRAME_RATE = 9;

const EMPTY_TILE = -1;

// --- Reading and writing images -----------------------------------------------------------

function newCanvas(width: number, height: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

function contextOf(canvas: HTMLCanvasElement): CanvasRenderingContext2D {
  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (!context) {
    throw new Error('Could not create a canvas to prepare the theme art.');
  }
  return context;
}

function loadedImage(scene: Phaser.Scene, file: string): CanvasImageSource {
  return scene.textures.get(sourceKey(file)).getSourceImage() as CanvasImageSource;
}

/** A picture with hard edges on a canvas, and the box around what was drawn. */
interface Drawing {
  canvas: HTMLCanvasElement;
  bounds: Box;
}

/** Draws one of the pack's images at `x`, `y` on a new canvas of the given size. */
function drawing(
  scene: Phaser.Scene,
  file: string,
  width: number,
  height: number,
  x = 0,
  y = 0,
): Drawing {
  const canvas = newCanvas(width, height);
  const context = contextOf(canvas);
  context.drawImage(loadedImage(scene, file), x, y);

  const pixels = context.getImageData(0, 0, width, height);
  hardenAlpha(pixels);
  context.putImageData(pixels, 0, 0);
  const bounds = opaqueBounds(pixels);
  if (!bounds) {
    throw new Error(`Theme image "${file}" is empty.`);
  }
  return { canvas, bounds };
}

/** A copy of a drawing moved up the canvas. */
function lifted({ canvas, bounds }: Drawing, by: number): Drawing {
  const copy = newCanvas(canvas.width, canvas.height);
  contextOf(copy).drawImage(canvas, 0, -by);
  return { canvas: copy, bounds: { ...bounds, y: bounds.y - by } };
}

/**
 * One of the pack's sprites with hard edges, trimmed to what was drawn. The generator
 * leaves an uneven margin around things, and placing them needs to know where they end.
 */
function trimmedSprite(scene: Phaser.Scene, file: string): HTMLCanvasElement {
  const source = loadedImage(scene, file) as HTMLImageElement;
  const { canvas, bounds } = drawing(scene, file, source.width, source.height);
  const trimmed = newCanvas(bounds.width, bounds.height);
  contextOf(trimmed).drawImage(canvas, -bounds.x, -bounds.y);
  return trimmed;
}

/**
 * Makes a texture of `frames` equal frames side by side and lets `draw` fill it in.
 * Frames are numbered from 0.
 */
function createTexture(
  scene: Phaser.Scene,
  key: string,
  frameWidth: number,
  frameHeight: number,
  frames: number,
  draw: (context: CanvasRenderingContext2D) => void,
): void {
  if (scene.textures.exists(key)) {
    return;
  }
  const texture = scene.textures.createCanvas(key, frameWidth * frames, frameHeight);
  if (!texture) {
    throw new Error(`Could not create texture "${key}".`);
  }
  draw(texture.getContext());
  texture.refresh();
  for (let frame = 0; frame < frames; frame++) {
    texture.add(frame, 0, frame * frameWidth, 0, frameWidth, frameHeight);
  }
}

/** Rounds up to an even number, so a centred sprite sits on whole pixels. */
const even = (value: number) => value + (value % 2);

// --- The theme ----------------------------------------------------------------------------

export function createGeneratedTheme(name: string): Theme {
  const manifest: PackManifest = PACKS[name];
  const tileSize = manifest.tileSize;

  const fileOf = (id: string): string => {
    const image = manifest.images[id];
    if (!image) {
      throw new Error(`Theme "${name}" has no "${id}" image. Run: npm run art:generate -- ${name}`);
    }
    return image.file;
  };

  /** First tile of a material in the atlas; a piece's tile is this plus its corner code. */
  const firstTile = (material: Material) => MATERIALS.indexOf(material) * PIECES_PER_MATERIAL;

  function createTileAtlas(scene: Phaser.Scene): void {
    const columns = PIECES_PER_MATERIAL;
    createTexture(
      scene,
      Key.Tiles,
      tileSize * columns,
      tileSize * MATERIALS.length,
      1,
      (context) => {
        MATERIALS.forEach((material, row) => {
          const tiles = manifest.tilesets[material]?.tiles ?? {};
          for (const [code, file] of Object.entries(tiles)) {
            context.drawImage(loadedImage(scene, file), Number(code) * tileSize, row * tileSize);
          }
        });
      },
    );
  }

  /**
   * The hero's frames, all in one texture: standing, then the run, then the poses in the
   * air. A pack without animations gets the old stand-in: the standing image bobbing.
   */
  function createHero(scene: Phaser.Scene): HeroArt {
    const hero = manifest.images[fileOf('hero') && 'hero'];
    const { run, jump } = manifest.animations ?? {};
    // Animation frames share a canvas bigger than the hero image, which sits inside it.
    const canvas = run ??
      jump ?? { width: hero.width, height: hero.height + STEP_LIFT, heroX: 0, heroY: STEP_LIFT };
    const onCanvas = (file: string, x = 0, y = 0) =>
      drawing(scene, file, canvas.width, canvas.height, x, y);

    const stand = onCanvas(hero.file, canvas.heroX, canvas.heroY);
    const step = lifted(stand, STEP_LIFT);
    const runFrames = run ? run.frames.map((file) => onCanvas(file)) : [step, stand];
    const airFrames = jump ? jump.frames.map((file) => onCanvas(file)) : [step];
    const all = [stand, ...runFrames, ...airFrames];

    // The box is the size of the Kenney hero's in tiles (two thirds of a tile wide), not
    // the size of the drawing, so the game plays the same however the hero is drawn. It
    // may be taller, up to a point, so a tall hero's head does not pass through ceilings.
    const twoThirds = Math.floor((tileSize * 2) / 3);
    const bodyWidth = twoThirds - (twoThirds % 2);
    const bodyHeight = Math.min(stand.bounds.height, Math.round(tileSize * 1.25));

    const firstAirFrame = 1 + runFrames.length;
    const { frameWidth, frameHeight, offsets } = layoutHeroFrames(
      stand.bounds,
      all.map(({ bounds }, index) => ({
        bounds,
        dropToGround: jump !== undefined && index >= firstAirFrame,
      })),
      bodyWidth,
    );

    createTexture(scene, Key.Hero, frameWidth, frameHeight, all.length, (context) => {
      all.forEach((frame, index) => {
        // Clipped to its own cell, so nothing can spill into the next frame.
        context.save();
        context.beginPath();
        context.rect(index * frameWidth, 0, frameWidth, frameHeight);
        context.clip();
        context.drawImage(frame.canvas, index * frameWidth + offsets[index].x, offsets[index].y);
        context.restore();
      });
    });

    const numbered = (first: number, count: number) =>
      Array.from({ length: count }, (_, index) => first + index);
    return {
      texture: Key.Hero,
      body: {
        width: bodyWidth,
        height: bodyHeight,
        offsetX: (frameWidth - bodyWidth) / 2,
        offsetY: frameHeight - bodyHeight,
      },
      idle: [0],
      run: numbered(1, runFrames.length),
      runFrameRate: run ? RUN_FRAME_RATE : BOB_FRAME_RATE,
      air: numbered(firstAirFrame, airFrames.length),
    };
  }

  /**
   * A sprite in a frame of even size, resting on the frame's bottom edge. The box is the
   * drawn part, pulled in by `inset` at the sides and top so near misses are forgiven.
   */
  function createSprite(scene: Phaser.Scene, key: string, id: string, inset: number): BodyBox {
    const sprite = trimmedSprite(scene, fileOf(id));
    const frameWidth = even(sprite.width);
    const frameHeight = even(sprite.height);

    createTexture(scene, key, frameWidth, frameHeight, 1, (context) => {
      context.drawImage(sprite, 0, frameHeight - sprite.height);
    });

    return {
      width: sprite.width - inset * 2,
      height: sprite.height - inset,
      offsetX: inset,
      offsetY: frameHeight - sprite.height + inset,
    };
  }

  /** The heart, and a dimmed copy of it for a life that has been lost. */
  function createHeart(scene: Phaser.Scene): ThemeArt['heart'] {
    const full = trimmedSprite(scene, fileOf('heart'));
    const { width, height } = full;
    const empty = newCanvas(width, height);
    const pixels = contextOf(full).getImageData(0, 0, width, height);
    dim(pixels);
    contextOf(empty).putImageData(pixels, 0, 0);

    createTexture(scene, Key.Heart, width, height, 2, (context) => {
      context.drawImage(full, 0, 0);
      context.drawImage(empty, width, 0);
    });
    return { texture: Key.Heart, full: 0, empty: 1 };
  }

  /** Crates fill their cell exactly, because the cell is what collides. */
  function createCrate(scene: Phaser.Scene): void {
    const sprite = trimmedSprite(scene, fileOf('crate'));
    createTexture(scene, Key.Crate, tileSize, tileSize, 1, (context) => {
      context.imageSmoothingEnabled = false;
      context.drawImage(sprite, 0, 0, tileSize, tileSize);
    });
  }

  /** The thing that crosses the sky, if the pack has one. */
  function createFlyer(scene: Phaser.Scene): ThemeArt['flyer'] {
    if (!manifest.images.flyer) return null;
    createScenery(scene, Key.Flyer, 'flyer');
    return { texture: Key.Flyer, frame: 0 };
  }

  function createScenery(scene: Phaser.Scene, key: string, id: string): void {
    const sprite = trimmedSprite(scene, fileOf(id));
    createTexture(scene, key, sprite.width, sprite.height, 1, (context) => {
      context.drawImage(sprite, 0, 0);
    });
  }

  /**
   * A board the game writes on. The pack's picture is blank; this finds its blank face
   * and decides whether to write on it in light or dark. Falls back to the plain board
   * drawn in code if the pack has none, or its face is too small to write on.
   */
  function createBoard(scene: Phaser.Scene, key: string, id: string, fallback: BoardArt): BoardArt {
    const image = manifest.images[id];
    if (!image) return fallback;

    const sprite = trimmedSprite(scene, image.file);
    const pixels = contextOf(sprite).getImageData(0, 0, sprite.width, sprite.height);
    const face = findWritingArea(pixels);
    if (!face || face.area.width < SMALLEST_FACE.width || face.area.height < SMALLEST_FACE.height) {
      return fallback;
    }

    createTexture(scene, key, sprite.width, sprite.height, 1, (context) => {
      context.drawImage(sprite, 0, 0);
    });
    const brightness = (face.red * 3 + face.green * 6 + face.blue) / 10;
    return {
      texture: key,
      frame: 0,
      writing: { ...face.area, tint: brightness < DARK_FACE ? INK.light : INK.dark },
    };
  }

  /**
   * One row of the skyline, made from the pack's pictures of buildings: `backdrop-far`,
   * or `backdrop-far-1`, `-2`, ... side by side. Returns how tall the buildings are, or
   * null if the pack has no pictures or colour for this row.
   *
   * - The pictures are faded most of the way to one hazy colour (`haze`, from 0 to 1),
   *   so the row sits back behind the level whatever colours they came in.
   * - A single picture is drawn twice, the second time mirrored, so the ends meet when
   *   the row repeats. Several pictures are laid side by side unmirrored, so a landmark
   *   in one of them is a whole row's width away from its next appearance.
   * - `lift` raises the buildings above street level, on a solid base.
   */
  function createSkyline(
    scene: Phaser.Scene,
    key: string,
    row: 'far' | 'near',
    color: string | undefined,
    haze: number,
    lift: number,
  ): number | null {
    const pictures = Object.keys(manifest.images)
      .filter((id) => id === `backdrop-${row}` || id.startsWith(`backdrop-${row}-`))
      .sort()
      .map((id) => manifest.images[id])
      .map((image) => drawing(scene, image.file, image.width, image.height));
    if (pictures.length === 0 || color === undefined) return null;

    const tallest = Math.max(...pictures.map(({ bounds }) => bounds.height));
    const span = pictures.reduce((sum, { canvas }) => sum + canvas.width, 0);
    const mirrored = pictures.length === 1;
    const width = mirrored ? span * 2 : span;
    // Below the buildings the row is solid, to show at the bottom of pits.
    const base = lift + SKYLINE.belowStreet;

    createTexture(scene, key, width, tallest + base, 1, (context) => {
      let left = 0;
      for (const { canvas, bounds } of pictures) {
        // Every picture stands on the same line, whatever margin it was drawn with.
        const top = tallest - (bounds.y + bounds.height);
        context.drawImage(canvas, left, top);
        if (mirrored) {
          context.save();
          context.translate(width, 0);
          context.scale(-1, 1);
          context.drawImage(canvas, left, top);
          context.restore();
        }
        left += canvas.width;
      }
      context.fillStyle = color;
      context.fillRect(0, tallest, width, base);

      // Wash the haze colour over what was drawn, and nowhere else.
      context.globalCompositeOperation = 'source-atop';
      context.globalAlpha = haze;
      context.fillRect(0, 0, width, tallest + base);
    });
    return tallest;
  }

  /** The pack's own sky and skyline where it has them, the shared ones where it does not. */
  function createBackdrop(scene: Phaser.Scene): BackdropArt {
    const colours = manifest.backdrop ?? {};
    const near = createSkyline(scene, Key.SkylineNear, 'near', colours.near, SKYLINE.nearHaze, 0);
    // The far row stands part of the way up the near one, so more than its tallest
    // landmarks show over the rooftops in front.
    const lift = Math.round((near ?? 0) * SKYLINE.farLift);
    const far = createSkyline(scene, Key.SkylineFar, 'far', colours.far, SKYLINE.farHaze, lift);
    return {
      sky: colours.sky ?? BACKGROUND_COLOR,
      far: far === null ? TextureKey.SkylineFar : Key.SkylineFar,
      near: near === null ? TextureKey.SkylineNear : Key.SkylineNear,
    };
  }

  /**
   * Draws the ground materials. Each piece sits on a corner where four cells meet (see
   * `corners.ts`), so the layers are one tile bigger than the level and start half a
   * tile up and to the left of it.
   */
  function renderMaterials(scene: Phaser.Scene, level: LevelData): void {
    const map = scene.make.tilemap({
      tileWidth: tileSize,
      tileHeight: tileSize,
      width: level.width + 1,
      height: level.height + 1,
    });
    const tileset = map.addTilesetImage(Key.Tiles, Key.Tiles, tileSize, tileSize);
    if (!tileset) {
      throw new Error(`Tileset texture "${Key.Tiles}" is missing.`);
    }

    /** The cell at a position; past the sides and bottom, the nearest cell inside. */
    const cellAt = (row: number, column: number): CellKind | null => {
      if (row < 0) return null;
      const nearestRow = Math.min(row, level.height - 1);
      const nearestColumn = Math.min(Math.max(column, 0), level.width - 1);
      return level.cells[nearestRow][nearestColumn];
    };

    for (const material of MATERIALS) {
      if (!manifest.tilesets[material]) continue;

      const isFilled = (row: number, column: number) => {
        const kind = cellAt(row, column);
        return kind !== null && CELL_MATERIAL[kind] === material;
      };
      const codes = cornerCodes(level.height, level.width, isFilled);

      const tiles = codes.map((codeRow, row) =>
        codeRow.map((code, column) => {
          if (code === 0) return EMPTY_TILE;
          // A piece with nothing below it is the underside of whatever is above. One-way
          // platforms are drawn without theirs, as a thin ledge you can jump up through.
          const isUnderside = (code & (Corner.SouthWest | Corner.SouthEast)) === 0;
          const above = [cellAt(row - 1, column - 1), cellAt(row - 1, column)];
          if (isUnderside && !above.includes('deck') && above.includes('oneWay')) {
            return EMPTY_TILE;
          }
          return firstTile(material) + code;
        }),
      );

      const layer = map.createBlankLayer(material, tileset, -tileSize / 2, -tileSize / 2);
      if (!layer) {
        throw new Error(`Could not create the "${material}" layer.`);
      }
      layer.putTilesAt(tiles, 0, 0, false);
    }
  }

  function renderLevel(scene: Phaser.Scene, level: LevelData): void {
    renderMaterials(scene, level);

    level.cells.forEach((cells, row) => {
      cells.forEach((kind, column) => {
        if (kind === 'crate') {
          scene.add.image(column * tileSize, row * tileSize, Key.Crate).setOrigin(0, 0);
        }
      });
    });

    // Scenery stands on the bottom of its cell, in front of the ground. The big set
    // pieces go down first, so the lamp posts and signs stand in front of them.
    const inDrawingOrder = [...level.decor].sort(
      (a, b) => DECOR_KINDS.indexOf(a.kind) - DECOR_KINDS.indexOf(b.kind),
    );
    for (const { kind, column, row } of inDrawingOrder) {
      if (scene.textures.exists(decorKey(kind))) {
        const image = scene.add.image(0, (row + 1) * tileSize, decorKey(kind)).setOrigin(0, 1);
        image.setX(Math.round((column + 0.5) * tileSize - image.width / 2));
      }
    }
  }

  return {
    name,

    preload(scene) {
      const files = [
        ...Object.values(manifest.images).map((image) => image.file),
        ...Object.values(manifest.tilesets).flatMap((tileset) => Object.values(tileset.tiles)),
        ...Object.values(manifest.animations ?? {}).flatMap((animation) => animation.frames),
      ];
      for (const file of files) {
        scene.load.image(sourceKey(file), packUrl(name, file));
      }
    },

    create(scene) {
      createTileAtlas(scene);
      createCrate(scene);
      createScenery(scene, Key.Goal, 'goal');
      for (const kind of DECOR_KINDS) {
        if (manifest.images[kind]) createScenery(scene, decorKey(kind), kind);
      }

      return {
        hero: createHero(scene),
        enemy: { texture: Key.Enemy, frame: 0, body: createSprite(scene, Key.Enemy, 'enemy', 1) },
        pickup: {
          texture: Key.Pickup,
          frame: 0,
          body: createSprite(scene, Key.Pickup, 'pickup', 0),
        },
        heart: createHeart(scene),
        backdrop: createBackdrop(scene),
        noticeBoard: createBoard(scene, Key.NoticeBoard, 'noticeBoard', DEFAULT_BOARDS.noticeBoard),
        banner: createBoard(scene, Key.Banner, 'banner', DEFAULT_BOARDS.banner),
        flyer: createFlyer(scene),
      };
    },

    renderLevel,

    buildGoal(scene, x, y) {
      const image = scene.add.image(0, y, Key.Goal).setOrigin(0, 1);
      image.setX(Math.round(x - image.width / 2));
    },
  };
}
