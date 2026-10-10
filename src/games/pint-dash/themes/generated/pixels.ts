/**
 * Tidying generated images, pixel by pixel. Pure, no Phaser or browser imports: `Pixels`
 * has the same shape as the browser's `ImageData`, so either can be passed in.
 */

export interface Pixels {
  width: number;
  height: number;
  /** Red, green, blue, alpha for each pixel, row by row. */
  data: Uint8ClampedArray;
}

export interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}

const ALPHA = 3;

/**
 * Makes every pixel either solid or empty. Generated sprites can come back with soft
 * edges, which look washed out next to hard-edged pixel art.
 */
export function hardenAlpha(image: Pixels, threshold = 128): void {
  for (let i = ALPHA; i < image.data.length; i += 4) {
    image.data[i] = image.data[i] >= threshold ? 255 : 0;
  }
}

/** The smallest box holding every pixel that is not empty, or null if there are none. */
export function opaqueBounds(image: Pixels): Box | null {
  let left = image.width;
  let top = image.height;
  let right = -1;
  let bottom = -1;

  for (let y = 0; y < image.height; y++) {
    for (let x = 0; x < image.width; x++) {
      if (image.data[(y * image.width + x) * 4 + ALPHA] > 0) {
        left = Math.min(left, x);
        right = Math.max(right, x);
        top = Math.min(top, y);
        bottom = Math.max(bottom, y);
      }
    }
  }

  return right < 0 ? null : { x: left, y: top, width: right - left + 1, height: bottom - top + 1 };
}

/** Turns an icon into a dark, colourless copy of itself, for "this one is used up". */
export function dim(image: Pixels): void {
  const { data } = image;
  for (let i = 0; i < data.length; i += 4) {
    const brightness = (data[i] * 3 + data[i + 1] * 6 + data[i + 2]) / 10;
    // A slate blue-grey, keeping a little of the original shading.
    data[i] = 40 + brightness * 0.2;
    data[i + 1] = 46 + brightness * 0.2;
    data[i + 2] = 66 + brightness * 0.2;
  }
}

/** A blank area to write on, and the colour it is. */
export interface WritingArea {
  area: Box;
  red: number;
  green: number;
  blue: number;
}

/** Colours within this much of each other, per channel, count as the same flat colour. */
const SAME_COLOUR = 28;

/**
 * Finds the blank face of a board: the biggest rectangle of one flat colour.
 *
 * Generated boards are asked to be empty, but where the empty part is, and what colour,
 * is not known until the picture arrives. So every colour in the picture is tried, and
 * the largest rectangle that is all one colour wins. An outline or a post is one colour
 * too, but thin, so the face is the largest.
 */
export function findWritingArea(image: Pixels): WritingArea | null {
  const { width, height, data } = image;

  // The colours in the picture, counted in coarse steps so slight shading is one colour.
  const colours = new Map<number, { count: number; red: number; green: number; blue: number }>();
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + ALPHA] === 0) continue;
    const bucket = ((data[i] >> 5) << 6) | ((data[i + 1] >> 5) << 3) | (data[i + 2] >> 5);
    const entry = colours.get(bucket) ?? { count: 0, red: 0, green: 0, blue: 0 };
    entry.count++;
    entry.red += data[i];
    entry.green += data[i + 1];
    entry.blue += data[i + 2];
    colours.set(bucket, entry);
  }

  let best: WritingArea | null = null;
  for (const colour of colours.values()) {
    const red = Math.round(colour.red / colour.count);
    const green = Math.round(colour.green / colour.count);
    const blue = Math.round(colour.blue / colour.count);
    const area = largestRectangle(width, height, (x, y) => {
      const i = (y * width + x) * 4;
      return (
        data[i + ALPHA] > 0 &&
        Math.abs(data[i] - red) <= SAME_COLOUR &&
        Math.abs(data[i + 1] - green) <= SAME_COLOUR &&
        Math.abs(data[i + 2] - blue) <= SAME_COLOUR
      );
    });
    if (area && (!best || area.width * area.height > best.area.width * best.area.height)) {
      best = { area, red, green, blue };
    }
  }
  return best;
}

/** The largest rectangle in which every pixel passes `isIn`. */
function largestRectangle(
  width: number,
  height: number,
  isIn: (x: number, y: number) => boolean,
): Box | null {
  // `run[x]` is how many passing pixels end at the current row in column x. The widest
  // stretch of columns at least that tall is a candidate rectangle.
  const run = new Array<number>(width).fill(0);
  let best: Box | null = null;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      run[x] = isIn(x, y) ? run[x] + 1 : 0;
    }
    for (let x = 0; x < width; x++) {
      if (run[x] === 0) continue;
      let left = x;
      while (left > 0 && run[left - 1] >= run[x]) left--;
      let right = x;
      while (right < width - 1 && run[right + 1] >= run[x]) right++;
      const candidate = { x: left, y: y - run[x] + 1, width: right - left + 1, height: run[x] };
      if (!best || candidate.width * candidate.height > best.width * best.height) {
        best = candidate;
      }
    }
  }
  return best;
}
