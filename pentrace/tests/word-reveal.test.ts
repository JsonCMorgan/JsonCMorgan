import { describe, expect, it } from 'vitest';
import { c } from '../src/engine/ansi';
import {
  DEFAULT_WPS,
  joinRevealTokens,
  TUTORIAL_WPS_MULTIPLIER,
  tokenizeRevealLine,
  wordsPerSecond,
} from '../src/engine/word-reveal';

describe('tokenizeRevealLine', () => {
  it('preserves ANSI sequences without splitting inside them', () => {
    const line = `${c.green('open')} 443/tcp`;
    const tokens = tokenizeRevealLine(line);
    expect(joinRevealTokens(tokens)).toBe(line);
    const ansiCount = tokens.filter((t) => t.kind === 'ansi').length;
    expect(ansiCount).toBeGreaterThanOrEqual(2);
    expect(tokens.some((t) => t.kind === 'word' && t.text.includes('open'))).toBe(true);
    expect(tokens.some((t) => t.kind === 'word' && t.text.includes('443/tcp'))).toBe(true);
  });

  it('keeps trailing spaces on words', () => {
    const tokens = tokenizeRevealLine('hello  world ');
    expect(joinRevealTokens(tokens)).toBe('hello  world ');
  });

  it('handles empty and whitespace-only lines', () => {
    expect(tokenizeRevealLine('')).toEqual([]);
    expect(tokenizeRevealLine('   ')).toEqual([{ kind: 'word', text: '   ' }]);
  });
});

describe('wordsPerSecond', () => {
  it('defaults within 8–14 wps', () => {
    const wps = wordsPerSecond({ line: 'pwd shows current directory' });
    expect(wps).toBeGreaterThanOrEqual(8);
    expect(wps).toBeLessThanOrEqual(14);
    expect(wps).toBe(DEFAULT_WPS);
  });

  it('slows during tutorial and Vex dialogue (~6 WPS tutorial)', () => {
    const base = wordsPerSecond({ line: 'type ls to list files' });
    const tut = wordsPerSecond({ tutorial: true, line: 'type ls to list files' });
    const vex = wordsPerSecond({ tutorial: true, line: 'Vex: run nmap on the gateway' });
    expect(tut).toBeLessThan(base);
    expect(vex).toBeLessThan(tut);
    expect(tut).toBeCloseTo(DEFAULT_WPS * TUTORIAL_WPS_MULTIPLIER, 1);
    expect(tut).toBeGreaterThanOrEqual(5);
    expect(tut).toBeLessThanOrEqual(7);
  });

  it('speeds slightly for scan-style tables', () => {
    const plain = wordsPerSecond({ line: 'notes go here' });
    const scan = wordsPerSecond({ line: 'PORT   STATE SERVICE\n22/tcp open  ssh' });
    expect(scan).toBeGreaterThan(plain);
    expect(scan).toBeLessThanOrEqual(14);
  });
});