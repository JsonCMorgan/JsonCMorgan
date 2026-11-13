import { describe, expect, it } from 'vitest';
import { Game } from '../src/engine/game';
import {
  BURN_RUN_STANDING_PENALTY,
  TRUST_FLOOR_MAX,
  adjustRunStanding,
  effectiveStanding,
  initRunStanding,
  migrateProfile,
  raiseTrustFloor,
  relaySetComplete,
} from '../src/engine/progression';

describe('standing: trust floor + run', () => {
  it('jack-in copies trust floor into run standing', () => {
    const g = new Game(null, 42, { tutorial: false });
    g.profile.trustFloor.relay = 2;
    g.startRun();
    expect(g.run.runStanding.relay).toBe(2);
    expect(g.standingNow('relay')).toBe(2);
  });

  it('contract complete raises run standing, set complete raises trust floor only', () => {
    const g = new Game(null, 42, { tutorial: false });
    g.profile.relayUnlocked = true;
    g.profile.gigProgress.relay = { setId: 0, completed: [] };
    g.startRun();
    adjustRunStanding(g.run, 'relay', 1);
    expect(g.standingNow('relay')).toBe(1);
    g.profile.gigProgress.relay!.completed = ['c1', 'c2'];
    expect(relaySetComplete(g.profile)).toBe(true);
    const floorBefore = g.profile.trustFloor.relay ?? 0;
    raiseTrustFloor(g.profile, 'relay', 1);
    expect(g.profile.trustFloor.relay).toBe(Math.min(TRUST_FLOOR_MAX, floorBefore + 1));
  });

  it('burn applies run penalty and does not lower trust floor', () => {
    const g = new Game(null, 99, { tutorial: false });
    g.profile.trustFloor.relay = 3;
    g.startRun();
    g.run.runStanding.relay = 5;
    g.run.contracts.c1 = 'active';
    const floorBefore = g.profile.trustFloor.relay;
    adjustRunStanding(g.run, 'relay', -BURN_RUN_STANDING_PENALTY);
    expect(g.run.runStanding.relay).toBe(3);
    expect(g.profile.trustFloor.relay).toBe(floorBefore);
  });

  it('migrates legacy fixerStanding into trustFloor cap 5', () => {
    const raw: Record<string, unknown> = {
      version: 2,
      tutorialDone: true,
      fixerStanding: { relay: 7 },
    };
    migrateProfile(raw, true);
    expect(raw.fixerStanding).toBeUndefined();
    expect((raw.trustFloor as { relay: number }).relay).toBe(5);
  });

  it('shop gate uses run standing', () => {
    const g = new Game(null, 1, { tutorial: false });
    g.profile.operatorRank = 1;
    g.startRun();
    expect(g.standingNow('relay')).toBe(0);
    g.run.runStanding.relay = 2;
    expect(g.standingNow('relay')).toBe(2);
  });
});

describe('effectiveStanding helper', () => {
  it('defaults missing run entry to trust floor', () => {
    const profile = { trustFloor: { relay: 2 } } as import('../src/engine/progression').ProgressionProfile;
    const run: { runStanding: Partial<Record<'relay', number>> } = { runStanding: {} };
    expect(effectiveStanding(profile, run, 'relay')).toBe(2);
    run.runStanding.relay = 4;
    expect(effectiveStanding(profile, run, 'relay')).toBe(4);
  });

  it('initRunStanding seeds all brokers', () => {
    const profile = {
      trustFloor: { relay: 1, kurohashi: 2 },
    } as import('../src/engine/progression').ProgressionProfile;
    const rs = initRunStanding(profile);
    expect(rs.relay).toBe(1);
    expect(rs.kurohashi).toBe(2);
  });
});
