import { describe, expect, it } from 'vitest';
import { stripAnsi } from '../src/engine/ansi';
import { CONTRACTS } from '../src/engine/content/contracts';
import { INDEX_ENTRIES } from '../src/engine/content/index-entries';
import { DEFENSE_MISSIONS } from '../src/engine/defense/state';
import type { GameEvent } from '../src/engine/events';
import { Game } from '../src/engine/game';
import { startDefensePreview } from '../src/engine/game-defense';
import { missionStages } from '../src/engine/mission-complete';
import { totalXpForRank } from '../src/engine/progression';
import { TRAINING_LESSONS } from '../src/engine/tutorial';

const text = (lines: string[]) => lines.map(stripAnsi).join('\n');
const [D1, D2] = DEFENSE_MISSIONS;

function offense() {
  const g = new Game(null, 4242, { tutorial: false });
  g.profile.relayUnlocked = true;
  const events: GameEvent[] = [];
  g.on((e) => events.push(e));
  return { g, events };
}

function closeContract(g: Game, id: 'c1' | 'c2' | 'c3') {
  g.run.contracts[id] = 'active';
  (g as unknown as { completeContract(id: string): void }).completeContract(id);
}

function defenseReady() {
  const g = new Game(null, 99, { tutorial: false });
  g.profile.tutorialDone = true;
  startDefensePreview(g);
  return g;
}

describe('mission complete: authored content', () => {
  it('every contract, defense ticket and the training sim has lessons', () => {
    for (const c of CONTRACTS) expect(c.lessons.length, c.id).toBeGreaterThanOrEqual(2);
    for (const m of DEFENSE_MISSIONS) expect(m.lessons.length, m.id).toBeGreaterThanOrEqual(2);
    expect(TRAINING_LESSONS.length).toBeGreaterThanOrEqual(2);
  });

  it('every INDEX card has at least one interview line', () => {
    for (const e of INDEX_ENTRIES) expect(e.interview.length, e.id).toBeGreaterThanOrEqual(1);
  });

  it('new copy uses no em or en dashes', () => {
    const copy = [
      ...CONTRACTS.flatMap((c) => [...c.lessons, c.fixerLine]),
      ...DEFENSE_MISSIONS.flatMap((m) => m.lessons),
      ...TRAINING_LESSONS,
      ...INDEX_ENTRIES.flatMap((e) => e.interview),
    ].join('\n');
    expect(copy).not.toMatch(/[\u2013\u2014]/);
  });
});

describe('mission complete: reports', () => {
  it('c1 report carries credits, XP, the fixer line and the concepts used this mission', () => {
    const { g, events } = offense();
    g.unlockIndex('port-scanning');
    closeContract(g, 'c1');
    const r = g.missionComplete!;
    expect(events.some((e) => e.type === 'missionComplete')).toBe(true);
    expect(r.kind).toBe('offense');
    expect(r.credits).toBe(CONTRACTS[0].payout);
    expect(r.xp).toBe(CONTRACTS[0].operatorXp);
    expect(r.fixerLine).toMatch(/Standing with me is \d/);
    expect(r.cards).toContain('port-scanning');
    expect(r.cards).toContain(CONTRACTS[0].indexEntryId);
    expect(r.loot.some((l) => l.kind === 'card')).toBe(true);
    expect(g.profile.lastStudy?.missionId).toBe('c1');
  });

  it('tracking resets between missions, and reused cards still count as studied', () => {
    const { g } = offense();
    g.unlockIndex('port-scanning');
    closeContract(g, 'c1');
    g.dismissMissionComplete();
    g.unlockIndex('port-scanning');
    closeContract(g, 'c2');
    const r = g.missionComplete!;
    expect(r.cards).toContain('port-scanning');
    expect(r.newCards).not.toContain('port-scanning');
    expect(r.missionId).toBe('c2');
  });

  it('c3 reports the IOC as loot', () => {
    const { g } = offense();
    closeContract(g, 'c3');
    expect(g.missionComplete!.loot.some((l) => l.kind === 'ioc')).toBe(true);
  });

  it('rank up sets the perk prompt and reports the point', () => {
    const { g } = offense();
    g.profile.operatorRank = 1;
    g.profile.operatorXp = totalXpForRank(2) - 1;
    closeContract(g, 'c1');
    const r = g.missionComplete!;
    expect(r.rankAfter).toBeGreaterThan(r.rankBefore);
    expect(r.perkPoints).toBeGreaterThan(0);
    expect(g.profile.pendingPerkPick).toBe(true);
  });

  it('D1 correct: TICKET RESOLVED, no credits, IOC and note loot', () => {
    const g = defenseReady();
    g.exec(`ticket ${D1.ticketId}`);
    g.exec('socsearch');
    g.exec('disposition tp');
    g.exec(`note ${D1.noteSuggestion}`);
    g.exec(`submit defense ${D1.expectedIoc}`);
    const r = g.missionComplete!;
    expect(r.kind).toBe('defense');
    expect(r.splash).toBe('TICKET RESOLVED');
    expect(r.credits).toBe(0);
    expect(r.xp).toBeGreaterThan(0);
    expect(r.loot.some((l) => l.kind === 'ioc')).toBe(true);
    expect(r.lessons).toEqual(D1.lessons);
  });

  it('wrong defense call is QA FLAGGED and still teaches', () => {
    const g = defenseReady();
    g.exec(`ticket ${D2.ticketId}`);
    g.exec('socsearch');
    g.exec('disposition tp');
    g.exec('submit defense 192.0.2.25');
    const r = g.missionComplete!;
    expect(r.splash).toBe('QA FLAGGED');
    expect(r.flagged).toBe(true);
    expect(r.lessons.length).toBeGreaterThan(0);
  });
});

describe('mission complete: pause', () => {
  it('nothing advances while the screen is open, and resumes after Continue', () => {
    const { g } = offense();
    g.exec(`nmap ${g.world.gatewayIp}`);
    const proc = g.run.procs[0];
    closeContract(g, 'c1');
    const elapsed = g.run.elapsed;
    const heat = g.run.heat;
    for (let i = 0; i < 40; i++) g.tick(0.25);
    expect(g.run.elapsed).toBe(elapsed);
    expect(proc.elapsed).toBe(0);
    expect(g.run.heat).toBe(heat);
    g.dismissMissionComplete();
    g.tick(0.25);
    expect(g.run.elapsed).toBeGreaterThan(elapsed);
  });

  it('defense SLA clocks freeze while open', () => {
    const g = defenseReady();
    g.exec(`ticket ${D1.ticketId}`);
    g.exec('socsearch');
    g.exec('disposition tp');
    g.exec(`submit defense ${D1.expectedIoc}`);
    const sla = g.run.defense!.tickets.map((t) => t.slaRemainingSec);
    for (let i = 0; i < 40; i++) g.tick(1);
    expect(g.run.defense!.tickets.map((t) => t.slaRemainingSec)).toEqual(sla);
  });
});

describe('mission complete: study and interview', () => {
  it('study with no history explains itself', () => {
    const { g } = offense();
    expect(text(g.exec('study'))).toContain('no mission debrief yet');
  });

  it('study reopens the last debrief as a study-only report', () => {
    const { g } = offense();
    closeContract(g, 'c1');
    g.dismissMissionComplete();
    const out = text(g.exec('study'));
    expect(out).toContain(CONTRACTS[0].title);
    expect(out).toContain(CONTRACTS[0].lessons[0]);
    expect(g.missionComplete?.studyOnly).toBe(true);
    expect(missionStages(g.missionComplete!)).toEqual(['debrief']);
  });

  it('interview lists lines for unlocked cards only', () => {
    const { g } = offense();
    expect(text(g.exec('interview'))).toContain('unlock INDEX cards first');
    g.unlockIndex('port-scanning');
    const out = text(g.exec('interview'));
    const e = INDEX_ENTRIES.find((x) => x.id === 'port-scanning')!;
    expect(out).toContain(e.interview[0]);
    expect(out).toContain('1 topics');
  });
});

describe('missionStages', () => {
  const base = { studyOnly: false, loot: [] } as unknown as Parameters<typeof missionStages>[0];
  it('skips loot when empty', () => {
    expect(missionStages(base)).toEqual(['splash', 'tally', 'growth', 'debrief']);
  });
  it('includes loot when present', () => {
    expect(missionStages({ ...base, loot: [{ kind: 'file', label: 'x' }] })).toEqual(['splash', 'tally', 'growth', 'loot', 'debrief']);
  });
});
