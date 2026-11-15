import { describe, expect, it } from 'vitest';
import { commandDelayPlan, streamLineDelayMs } from '../src/engine/command-delay';

describe('commandDelayPlan', () => {
  it('instant for blank input', () => {
    const p = commandDelayPlan('   ', []);
    expect(p.instant).toBe(true);
    expect(p.instantReason).toBe('empty-line');
    expect(p.delayMs).toBe(0);
  });

  it('instant for clear only', () => {
    const p = commandDelayPlan('clear', []);
    expect(p.instant).toBe(true);
    expect(p.instantReason).toBe('clear-resets-terminal');
  });

  it('defaults to 1–5s for ordinary commands', () => {
    const p = commandDelayPlan('pwd', ['/home/ghost']);
    expect(p.instant).toBe(false);
    expect(p.delayMs).toBeGreaterThanOrEqual(1000);
    expect(p.delayMs).toBeLessThanOrEqual(5000);
  });

  it('leans longer for heavy tools and large output', () => {
    const light = commandDelayPlan('cd ..', []).delayMs;
    const heavy = commandDelayPlan('nmap -sV 10.0.0.1', Array.from({ length: 40 }, (_, i) => `line ${i}`)).delayMs;
    expect(heavy).toBeGreaterThan(light);
    expect(heavy).toBeLessThanOrEqual(5000);
  });

  it('streams multi-line results', () => {
    expect(commandDelayPlan('ls', ['a', 'b']).stream).toBe(true);
    expect(commandDelayPlan('echo hi', ['hi']).stream).toBe(false);
  });
});

describe('streamLineDelayMs', () => {
  it('scales mildly with line length', () => {
    expect(streamLineDelayMs('x')).toBeLessThan(streamLineDelayMs('x'.repeat(200)));
  });
});
