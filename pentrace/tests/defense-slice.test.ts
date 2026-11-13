import { describe, expect, it } from 'vitest';
import { D1_MISSION } from '../src/engine/defense/state';
import { Game } from '../src/engine/game';
import { startDefensePreview } from '../src/engine/game-defense';

function defenseReady() {
  const g = new Game(null, 99, { tutorial: false });
  g.profile.tutorialDone = true;
  startDefensePreview(g);
  return g;
}

describe('defense vertical slice d1', () => {
  it('preview entry sets gamePhase and defense state', () => {
    const g = defenseReady();
    expect(g.profile.gamePhase).toBe('defense');
    expect(g.run.defense?.missionId).toBe('d1-sla-spray');
    expect(g.run.defense?.slaRemainingSec).toBeGreaterThan(0);
  });

  it('golden path closes spray ticket as true positive', () => {
    const g = defenseReady();
    g.exec('ticket BT-2026-0103');
    g.exec('socsearch');
    g.exec('disposition tp');
    const out = g.exec(`submit defense ${D1_MISSION.expectedIoc}`).join('\n');
    expect(g.run.defense?.outcome).toBe('won');
    expect(out).toMatch(/CLOSED/i);
  });

  it('false positive disposition fails the shift', () => {
    const g = defenseReady();
    g.exec('ticket BT-2026-0103');
    g.exec('socsearch');
    g.exec('disposition fp');
    g.exec(`submit defense ${D1_MISSION.expectedIoc}`);
    expect(g.run.defense?.outcome).toBe('lost_wrong');
  });

  it('wrong IOC fails under true positive disposition', () => {
    const g = defenseReady();
    g.exec('ticket BT-2026-0103');
    g.exec('socsearch');
    g.exec('disposition tp');
    g.exec('submit defense 198.51.100.9');
    expect(g.run.defense?.outcome).toBe('lost_wrong');
  });

  it('SLA breach after clock exhausts', () => {
    const g = defenseReady();
    g.run.defense!.slaRemainingSec = 0.01;
    g.tick(1);
    expect(g.run.defense?.outcome).toBe('lost_sla');
  });

  it('defense exit restores offense phase', () => {
    const g = defenseReady();
    g.exec('defense exit');
    expect(g.profile.gamePhase).toBe('offense');
    expect(g.run.defense).toBeUndefined();
  });
});
