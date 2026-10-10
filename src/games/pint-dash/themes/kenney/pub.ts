import type Phaser from 'phaser';
import { FONT_SIZE, TILE_SIZE } from '../../config/constants';
import { TextureKey } from '../../config/keys';
import { addPixelText, centerPixelText } from '../../systems/pixelFont';
import { TileFrame } from './frames';

const { BrickWall: WALL, BrickCap: CAP, Window: WINDOW } = TileFrame;
const { SignLeft, SignMiddle, SignRight, DoorTop, DoorBottom } = TileFrame;

/** The front of the pub, top row first. The door is in the middle column. */
const FRONT: number[][] = [
  [CAP, CAP, CAP, CAP, CAP, CAP, CAP],
  [WALL, WALL, SignLeft, SignMiddle, SignRight, WALL, WALL],
  [WALL, WINDOW, WALL, DoorTop, WALL, WINDOW, WALL],
  [WALL, WINDOW, WALL, DoorBottom, WALL, WINDOW, WALL],
];

const SIGN_TEXT = 'PUB';
const SIGN_TINT = 0xffd76a;

/** Builds the pub at the end of the level. `x`, `y` is the bottom-centre of its door. */
export function buildPub(scene: Phaser.Scene, x: number, y: number): void {
  const middle = Math.floor(FRONT[0].length / 2);

  FRONT.forEach((row, rowIndex) => {
    const bottom = y - (FRONT.length - 1 - rowIndex) * TILE_SIZE;
    row.forEach((frame, column) => {
      scene.add
        .image(x + (column - middle) * TILE_SIZE, bottom, TextureKey.Tiles, frame)
        .setOrigin(0.5, 1);
    });
  });

  // The sign board is the second row from the top.
  const sign = addPixelText(scene, 0, 0, SIGN_TEXT, FONT_SIZE.small).setTint(SIGN_TINT);
  centerPixelText(sign, x, y - (FRONT.length - 2) * TILE_SIZE - TILE_SIZE / 2);
}
