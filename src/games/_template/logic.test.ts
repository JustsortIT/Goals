import { describe, expect, it } from 'vitest';
import { readGameData } from './gameData';
import { everyMs, isCaught, movePaddle, pickDrop } from './logic';
import data from './game.json';

describe("the game's data", () => {
  it('reads game.json', () => {
    const game = readGameData(data);
    expect(game.name).toBe('CATCH');
    expect(game.drops.map((drop) => drop.points)).toEqual([10, 30, 100]);
    expect(game.drops[0].colour).toBe(0xffd76a);
  });

  it("says what is wrong with data that is not this game's", () => {
    expect(() => readGameData(null)).toThrow('no data');
    expect(() => readGameData({ ...data, drops: [] })).toThrow('no drops');
    expect(() => readGameData({ ...data, name: 'CAF\u00c9' })).toThrow('plain keyboard characters');
    expect(() => readGameData({ ...data, drops: [{ ...data.drops[0], points: 0 }] })).toThrow(
      'whole numbers above zero',
    );
  });
});

describe('the paddle', () => {
  it('goes towards the finger no faster than its speed, and stops on it', () => {
    expect(movePaddle(100, 300, 200, 500, 40, 480)).toBe(200);
    expect(movePaddle(100, 110, 200, 500, 40, 480)).toBe(110);
    expect(movePaddle(100, 0, 200, 250, 40, 480)).toBe(50);
  });

  it('stays on the screen', () => {
    expect(movePaddle(30, 0, 1000, 1000, 40, 480)).toBe(20);
    expect(movePaddle(450, 480, 1000, 1000, 40, 480)).toBe(460);
  });

  it('catches a drop that touches it', () => {
    expect(isCaught(100, 100, 40, 10)).toBe(true);
    expect(isCaught(125, 100, 40, 10)).toBe(true);
    expect(isCaught(126, 100, 40, 10)).toBe(false);
  });
});

describe('the drops', () => {
  it('come quicker as the score grows, and no quicker than the quickest', () => {
    expect(everyMs(0, 1000, 400, 1500)).toBe(1000);
    expect(everyMs(750, 1000, 400, 1500)).toBe(700);
    expect(everyMs(9000, 1000, 400, 1500)).toBe(400);
  });

  it('are picked as often as their weights say', () => {
    const { drops } = readGameData(data);
    expect(pickDrop(drops, 0).name).toBe('pint');
    expect(pickDrop(drops, 0.59).name).toBe('pint');
    expect(pickDrop(drops, 0.6).name).toBe('treat');
    expect(pickDrop(drops, 0.95).name).toBe('prize');
  });
});
