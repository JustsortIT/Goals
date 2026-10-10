import { describe, expect, it } from 'vitest';
import { layoutHeroFrames, type HeroFrame } from './heroLayout';

/** A hero 8 wide and 22 tall, standing at the bottom of a 32x32 canvas. */
const STANDING = { x: 12, y: 10, width: 8, height: 22 };
const still: HeroFrame = { bounds: STANDING, dropToGround: false };

describe('layoutHeroFrames', () => {
  it('trims a lone standing frame to the hero, feet on the bottom edge', () => {
    const layout = layoutHeroFrames(STANDING, [still], 0);
    expect(layout.frameWidth).toBe(8);
    expect(layout.frameHeight).toBe(22);
    // Canvas column 12 lands on cell column 0, canvas row 10 on cell row 0.
    expect(layout.offsets).toEqual([{ x: -12, y: -10 }]);
  });

  it('widens every cell equally to both sides for a frame that reaches out one way', () => {
    const reaching: HeroFrame = {
      bounds: { x: 12, y: 10, width: 14, height: 22 },
      dropToGround: false,
    };
    const layout = layoutHeroFrames(STANDING, [still, reaching], 0);
    // The middle is canvas column 16; the reach is 10 to the right, so 20 wide.
    expect(layout.frameWidth).toBe(20);
    expect(layout.offsets[0].x).toBe(-6);
    expect(layout.offsets[0].x).toBe(layout.offsets[1].x);
  });

  it('grows upwards for a frame taller than the standing hero', () => {
    const armsUp: HeroFrame = {
      bounds: { x: 12, y: 6, width: 8, height: 26 },
      dropToGround: false,
    };
    const layout = layoutHeroFrames(STANDING, [still, armsUp], 0);
    expect(layout.frameHeight).toBe(26);
    expect(layout.offsets.map((offset) => offset.y)).toEqual([-6, -6]);
  });

  it('leaves a running frame where it was drawn, even with its feet off the ground', () => {
    const midStride: HeroFrame = {
      bounds: { x: 12, y: 8, width: 8, height: 22 },
      dropToGround: false,
    };
    const layout = layoutHeroFrames(STANDING, [still, midStride], 0);
    expect(layout.offsets[1]).toEqual(layout.offsets[0]);
    expect(layout.frameHeight).toBe(24);
  });

  it('drops a pose in the air so its lowest point is on the ground line', () => {
    // Drawn 6 rows up the canvas with the knees tucked: 16 tall, ending at row 26.
    const tucked: HeroFrame = {
      bounds: { x: 12, y: 10, width: 8, height: 16 },
      dropToGround: true,
    };
    const layout = layoutHeroFrames(STANDING, [still, tucked], 0);
    expect(layout.frameHeight).toBe(22);
    expect(layout.offsets[1].y - layout.offsets[0].y).toBe(6);
  });

  it('never makes cells narrower than the collision box, and keeps them even', () => {
    expect(layoutHeroFrames(STANDING, [still], 10).frameWidth).toBe(10);
    expect(layoutHeroFrames(STANDING, [still], 11).frameWidth).toBe(12);
    const odd = { x: 12, y: 10, width: 7, height: 22 };
    expect(layoutHeroFrames(odd, [{ bounds: odd, dropToGround: false }], 0).frameWidth % 2).toBe(0);
  });
});
