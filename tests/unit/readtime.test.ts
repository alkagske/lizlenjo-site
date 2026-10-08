import { describe, expect, it } from 'vitest';
import { countWords, minutesLeft, readMinutes, WORDS_PER_MINUTE } from '../../src/lib/readtime';

describe('read time', () => {
  it('counts words on any whitespace', () => {
    expect(countWords('  one two\nthree\tfour  ')).toBe(4);
    expect(countWords('')).toBe(0);
  });
  it('rounds up at 220 wpm and never returns less than 1', () => {
    expect(WORDS_PER_MINUTE).toBe(220);
    expect(readMinutes(0)).toBe(1);
    expect(readMinutes(1)).toBe(1);
    expect(readMinutes(220)).toBe(1);
    expect(readMinutes(221)).toBe(2);
    expect(readMinutes(2200)).toBe(10);
    expect(readMinutes(NaN)).toBe(1);
  });
  it('counts minutes left down with progress', () => {
    expect(minutesLeft(8, 0)).toBe(8);
    expect(minutesLeft(8, 0.5)).toBe(4);
    expect(minutesLeft(8, 0.99)).toBe(1);
    expect(minutesLeft(8, 1)).toBe(0);
    expect(minutesLeft(8, 2)).toBe(0);
    expect(minutesLeft(8, -1)).toBe(8);
  });
});
