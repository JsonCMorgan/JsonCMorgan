import { describe, expect, it } from 'vitest';
import { advanceClock, MAX_FRAME_GAP, SIM_STEP } from '../src/engine/clock';
import { Game } from '../src/engine/game';

describe('game clock', () => {
  it('runs at real speed even at 2 frames per second', () => {
    const fast = new Game(null, 21, { tutorial: false });
    const slow = new Game(null, 21, { tutorial: false });
    for (const g of [fast, slow]) g.exec(`nmap -sV ${g.world.gatewayIp}`);
    let fastTime = 0;
    let slowTime = 0;
    for (let f = 0; f < 60 * 3; f++) fastTime += advanceClock(1 / 60, (dt) => fast.tick(dt));
    for (let f = 0; f < 2 * 3; f++) slowTime += advanceClock(0.5, (dt) => slow.tick(dt));
    expect(slowTime).toBeCloseTo(3, 5);
    expect(fastTime).toBeCloseTo(3, 5);
    expect(slow.run.procs.length).toBe(fast.run.procs.length);
    expect(slow.world.hosts.find((h) => h.role === 'gateway')!.fingerprinted).toBe(true);
  });

  it('splits a slow frame into small steps', () => {
    const steps: number[] = [];
    advanceClock(0.6, (dt) => steps.push(dt));
    expect(steps.every((s) => s <= SIM_STEP)).toBe(true);
    expect(steps.reduce((a, b) => a + b, 0)).toBeCloseTo(0.6, 9);
  });

  it('treats a long gap (laptop sleep) as a pause, and ignores negative time', () => {
    let total = 0;
    advanceClock(3600, (dt) => (total += dt));
    expect(total).toBeCloseTo(MAX_FRAME_GAP, 9);
    expect(advanceClock(-1, () => {})).toBe(0);
  });
});
