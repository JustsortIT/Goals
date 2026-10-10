import { describe, expect, it } from 'vitest';
import { SHARE_PICTURE } from './constants';
import { shareFrame } from './share';

describe('shareFrame', () => {
  it('scales the game frame up to fill the picture and keeps its middle', () => {
    const { scale, x, y } = shareFrame(480, 270);
    expect(scale).toBe(2.5);
    expect(480 * scale).toBe(SHARE_PICTURE.width);
    expect(x).toBe(0);
    // 270 * 2.5 is 675, 45 taller than the picture: 22 or 23 off the top.
    expect(y).toBe(-22);
  });

  it('fills the picture whatever shape the frame is', () => {
    const { scale, x, y } = shareFrame(100, 100);
    expect(scale).toBe(12);
    expect(x).toBe(0);
    expect(y).toBe(-285);
  });
});
