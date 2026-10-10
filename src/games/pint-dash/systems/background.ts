import Phaser from 'phaser';
import { GAME_WIDTH, SKYLINE } from '../config/constants';
import { themeArt } from '../themes';

interface Layer {
  sprite: Phaser.GameObjects.TileSprite;
  parallax: number;
  /** Screen y when the camera rests at the bottom of the level. */
  baseY: number;
}

const DEPTH = -100;
/** Drawn a little past the screen so camera shake never shows an edge. */
const OVERSCAN = 8;

/**
 * A city skyline behind the level: the sky colour (the camera background) and two rows of
 * building silhouettes, all from the theme. The rows are fixed to the screen and scroll
 * their textures at a fraction of the camera's speed, the far row slowest.
 */
export class ParallaxBackground {
  private readonly layers: Layer[] = [];
  private readonly maxScrollY: number;

  /** `maxScrollY` is the camera's scrollY when it rests at the bottom of the level. */
  constructor(scene: Phaser.Scene, maxScrollY: number) {
    this.maxScrollY = maxScrollY;

    const { sky, far, near } = themeArt().backdrop;
    scene.cameras.main.setBackgroundColor(sky);
    const rows: Array<[key: string, parallax: number]> = [
      [far, SKYLINE.farParallax],
      [near, SKYLINE.nearParallax],
    ];
    rows.forEach(([key, parallax], index) => {
      const height = scene.textures.get(key).getSourceImage().height;
      // The strip's street level sits `belowStreet` above its bottom edge.
      const baseY = SKYLINE.streetY + SKYLINE.belowStreet - height;
      const sprite = scene.add
        .tileSprite(-OVERSCAN, baseY, GAME_WIDTH + OVERSCAN * 2, height, key)
        .setOrigin(0, 0)
        .setScrollFactor(0)
        .setDepth(DEPTH + index);
      this.layers.push({ sprite, parallax, baseY });
    });

    // The camera works out its final scroll just before rendering, after the scene's
    // update(). Positioning the layers from this event keeps them in step with it.
    const camera = scene.cameras.main;
    camera.on(Phaser.Cameras.Scene2D.Events.FOLLOW_UPDATE, this.update, this);
    this.update(camera);
  }

  private update(camera: Phaser.Cameras.Scene2D.Camera): void {
    for (const { sprite, parallax, baseY } of this.layers) {
      // Whole pixels only, so the pixel art never shimmers.
      sprite.tilePositionX = Math.round(camera.scrollX * parallax);
      sprite.y = baseY + Math.round((this.maxScrollY - camera.scrollY) * parallax);
    }
  }
}
