import { describe, expect, it } from 'vitest';
import { formatTime } from './format';

describe('formatTime', () => {
  it('shows minutes and two-digit seconds', () => {
    expect(formatTime(0)).toBe('0:00');
    expect(formatTime(9_000)).toBe('0:09');
    expect(formatTime(87_000)).toBe('1:27');
    expect(formatTime(600_000)).toBe('10:00');
  });

  it('drops fractions of a second', () => {
    expect(formatTime(59_999)).toBe('0:59');
    expect(formatTime(60_000)).toBe('1:00');
  });

  it('never shows a negative time', () => {
    expect(formatTime(-500)).toBe('0:00');
  });
});
