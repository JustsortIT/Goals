import type Phaser from 'phaser';
import { FX, GAME_HEIGHT, GAME_WIDTH, SKYLINE, TILE_SIZE } from '../config/constants';
import { TextureKey } from '../config/keys';
import type { BoardArt } from '../themes/theme';

/**
 * Textures drawn in code that every theme shares: the particle, the vignette, the blank
 * tiles the invisible collision layer is made of, and plain versions of things a theme
 * may not have of its own: the city skyline, the notice board and the banner.
 */

type Draw = (context: CanvasRenderingContext2D) => void;

function createTexture(
  scene: Phaser.Scene,
  key: string,
  width: number,
  height: number,
  draw: Draw,
): void {
  if (scene.textures.exists(key)) {
    return;
  }

  const texture = scene.textures.createCanvas(key, width, height);
  if (!texture) {
    throw new Error(`Could not create texture "${key}".`);
  }
  draw(texture.getContext());
  texture.refresh();
}

/** Transparent in the middle, darkening smoothly towards the corners. */
function drawVignette(context: CanvasRenderingContext2D): void {
  const centerX = GAME_WIDTH / 2;
  const centerY = GAME_HEIGHT / 2;
  const cornerDistance = Math.hypot(centerX, centerY);

  const gradient = context.createRadialGradient(
    centerX,
    centerY,
    cornerDistance * FX.vignette.innerRadius,
    centerX,
    centerY,
    cornerDistance,
  );
  // The middle stop makes the darkening ease in instead of starting with a visible edge.
  gradient.addColorStop(0, 'rgba(16, 12, 40, 0)');
  gradient.addColorStop(0.5, `rgba(16, 12, 40, ${FX.vignette.alpha * 0.25})`);
  gradient.addColorStop(1, `rgba(16, 12, 40, ${FX.vignette.alpha})`);

  context.fillStyle = gradient;
  context.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
}

interface SkylineStyle {
  key: string;
  color: string;
  /** Lit windows, or null for buildings too far away to show any. */
  windowColor: string | null;
  /** [width, height above street level] of each building; widths add up to the strip width. */
  buildings: ReadonlyArray<readonly [width: number, height: number]>;
}

const SKYLINES: SkylineStyle[] = [
  {
    key: TextureKey.SkylineFar,
    color: '#b9cddd',
    windowColor: null,
    buildings: [
      [28, 60],
      [20, 84],
      [34, 52],
      [22, 106],
      [30, 70],
      [26, 58],
      [18, 96],
      [40, 64],
      [38, 76],
    ],
  },
  {
    key: TextureKey.SkylineNear,
    color: '#9db3c8',
    windowColor: '#b9cddd',
    buildings: [
      [36, 40],
      [24, 58],
      [44, 30],
      [30, 50],
      [20, 66],
      [48, 36],
      [26, 54],
      [28, 26],
    ],
  },
];

/** A row of flat building silhouettes. The strip tiles horizontally. */
function createSkyline(scene: Phaser.Scene, style: SkylineStyle): void {
  const width = style.buildings.reduce((sum, [buildingWidth]) => sum + buildingWidth, 0);
  const tallest = Math.max(...style.buildings.map(([, height]) => height));
  const stripHeight = tallest + SKYLINE.belowStreet;

  createTexture(scene, style.key, width, stripHeight, (context) => {
    let left = 0;
    style.buildings.forEach(([buildingWidth, height], index) => {
      const top = stripHeight - SKYLINE.belowStreet - height;
      context.fillStyle = style.color;
      context.fillRect(left, top, buildingWidth, stripHeight - top);
      // Every other building has something on the roof.
      if (index % 2 === 0) context.fillRect(left + 4, top - 4, 8, 4);

      if (style.windowColor) {
        context.fillStyle = style.windowColor;
        for (let y = top + 5; y < stripHeight - SKYLINE.belowStreet - 6; y += 8) {
          for (let x = left + 4, column = 0; x < left + buildingWidth - 5; x += 6, column++) {
            // A fixed pattern, so the same windows are lit every time.
            if ((column * 7 + y * 3 + index) % 3 !== 0) context.fillRect(x, y, 3, 4);
          }
        }
      }
      left += buildingWidth;
    });
  });
}

const BOARD_EDGE = '#2b2540';
const BOARD_FACE = '#3d3a5c';
const BOARD_TRIM = '#dce1e7';
const BOARD_INK = 0xfff6e2;

/** A dark panel with a pale rim. */
function drawPanel(context: CanvasRenderingContext2D, width: number, height: number): void {
  context.fillStyle = BOARD_EDGE;
  context.fillRect(0, 0, width, height);
  context.fillStyle = BOARD_TRIM;
  context.fillRect(1, 1, width - 2, height - 2);
  context.fillStyle = BOARD_FACE;
  context.fillRect(2, 2, width - 4, height - 4);
}

const NOTICE = { width: 48, height: 46, panelHeight: 34, legWidth: 4, legInset: 8 };
const BANNER = { width: 112, height: 16 };

/**
 * The plain notice board and banner, for themes that have none of their own. The numbers
 * say where each one's blank face is.
 */
export const DEFAULT_BOARDS: { noticeBoard: BoardArt; banner: BoardArt } = {
  noticeBoard: {
    texture: TextureKey.NoticeBoard,
    frame: 0,
    writing: {
      x: 3,
      y: 3,
      width: NOTICE.width - 6,
      height: NOTICE.panelHeight - 6,
      tint: BOARD_INK,
    },
  },
  banner: {
    texture: TextureKey.Banner,
    frame: 0,
    writing: { x: 3, y: 3, width: BANNER.width - 6, height: BANNER.height - 6, tint: BOARD_INK },
  },
};

function createBoards(scene: Phaser.Scene): void {
  const boards: Array<[key: string, width: number, height: number, draw: Draw]> = [
    [
      TextureKey.NoticeBoard,
      NOTICE.width,
      NOTICE.height,
      (context) => {
        // Two legs, then the panel over the top of them.
        context.fillStyle = BOARD_EDGE;
        for (const left of [NOTICE.legInset, NOTICE.width - NOTICE.legInset - NOTICE.legWidth]) {
          context.fillRect(left, NOTICE.panelHeight - 1, NOTICE.legWidth, NOTICE.height);
        }
        drawPanel(context, NOTICE.width, NOTICE.panelHeight);
      },
    ],
    [
      TextureKey.Banner,
      BANNER.width,
      BANNER.height,
      (c) => drawPanel(c, BANNER.width, BANNER.height),
    ],
  ];
  for (const [key, width, height, draw] of boards) {
    if (scene.textures.exists(key)) continue;
    createTexture(scene, key, width, height, draw);
    scene.textures.get(key).add(0, 0, 0, 0, width, height);
  }
}

export function createCommonTextures(scene: Phaser.Scene): void {
  createBoards(scene);
  createTexture(scene, TextureKey.Particle, 2, 2, (context) => {
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, 2, 2);
  });
  createTexture(scene, TextureKey.Vignette, GAME_WIDTH, GAME_HEIGHT, drawVignette);
  SKYLINES.forEach((style) => createSkyline(scene, style));
  // Two empty tiles: the collision layer needs a tileset, but is never drawn.
  createTexture(scene, TextureKey.Collision, TILE_SIZE * 2, TILE_SIZE, () => {});
}
