import { describe, expect, it } from 'vitest';
import { dim, findWritingArea, hardenAlpha, opaqueBounds, type Pixels } from './pixels';

/** Builds an image from rows of characters: `.` empty, `#` solid, `~` faint, `+` mostly solid. */
function image(rows: string[]): Pixels {
  const alpha: Record<string, number> = { '.': 0, '~': 60, '+': 200, '#': 255 };
  const data = new Uint8ClampedArray(rows.length * rows[0].length * 4);
  rows
    .join('')
    .split('')
    .forEach((symbol, index) => {
      data.set([200, 100, 50, alpha[symbol]], index * 4);
    });
  return { width: rows[0].length, height: rows.length, data };
}

const alphas = (pixels: Pixels) => Array.from(pixels.data.filter((_, index) => index % 4 === 3));

describe('hardenAlpha', () => {
  it('makes faint pixels empty and the rest solid', () => {
    const pixels = image(['.~+#']);
    hardenAlpha(pixels);
    expect(alphas(pixels)).toEqual([0, 0, 255, 255]);
  });
});

describe('opaqueBounds', () => {
  it('finds the box around what is drawn', () => {
    expect(opaqueBounds(image(['.....', '..#..', '.###.', '.....']))).toEqual({
      x: 1,
      y: 1,
      width: 3,
      height: 2,
    });
  });

  it('covers the whole image when it is full', () => {
    expect(opaqueBounds(image(['##', '##']))).toEqual({ x: 0, y: 0, width: 2, height: 2 });
  });

  it('returns null for an empty image', () => {
    expect(opaqueBounds(image(['..', '..']))).toBeNull();
  });
});

describe('dim', () => {
  it('removes the colour and keeps the shape', () => {
    const pixels = image(['#.']);
    dim(pixels);
    const [red, green, blue] = pixels.data;
    expect(Math.max(red, green, blue) - Math.min(red, green, blue)).toBeLessThan(40);
    expect(red).toBeLessThan(100);
    expect(alphas(pixels)).toEqual([255, 0]);
  });
});

describe('findWritingArea', () => {
  /** Builds an image from rows of characters: `.` empty, `#` outline, `g` green face, `w` white rim. */
  function board(rows: string[]): Pixels {
    const colours: Record<string, number[]> = {
      '.': [0, 0, 0, 0],
      '#': [20, 20, 30, 255],
      g: [40, 110, 70, 255],
      G: [50, 120, 80, 255],
      w: [240, 240, 230, 255],
    };
    const data = new Uint8ClampedArray(rows.length * rows[0].length * 4);
    rows
      .join('')
      .split('')
      .forEach((symbol, index) => data.set(colours[symbol], index * 4));
    return { width: rows[0].length, height: rows.length, data };
  }

  it('finds the blank face inside the frame of a board', () => {
    const found = findWritingArea(
      board([
        '..........',
        '.########.',
        '.#wwwwww#.',
        '.#wggggw#.',
        '.#wggggw#.',
        '.#wggggw#.',
        '.#wwwwww#.',
        '.########.',
        '...#..#...',
        '...#..#...',
      ]),
    )!;
    expect(found.area).toEqual({ x: 3, y: 3, width: 4, height: 3 });
    expect([found.red, found.green, found.blue]).toEqual([40, 110, 70]);
  });

  it('counts slight shading as the same colour', () => {
    const found = findWritingArea(board(['#####', '#gGg#', '#Ggg#', '#####']))!;
    expect(found.area).toEqual({ x: 1, y: 1, width: 3, height: 2 });
  });

  it('leaves out a corner that is not blank', () => {
    // A white mark in the top right. The area beside it (4 by 4) is bigger than the
    // area below it (5 by 3), so that is the one chosen.
    const found = findWritingArea(board(['ggggw', 'ggggg', 'ggggg', 'ggggg']))!;
    expect(found.area).toEqual({ x: 0, y: 0, width: 4, height: 4 });
  });

  it('returns null for an empty image', () => {
    expect(findWritingArea(board(['..', '..']))).toBeNull();
  });
});
