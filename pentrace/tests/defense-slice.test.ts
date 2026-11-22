import { describe, expect, it } from 'vitest';
import { stripAnsi } from '../src/engine/ansi';
import { DEFENSE_MISSIONS, MISSION_BY_TICKET, noteEvidenceHits } from '../src/engine/defense/state';
import { Game } from '../src/engine/game';
import { startDefensePreview } from '../src/engine/game-defense';

const text = (lines: string[]) => lines.map(stripAnsi).join('\n');
const [D1, D2, D3] = DEFENSE_MISSIONS;

function defenseReady() {
  const g = new Game(null, 99, { tutorial: false });
  g.profile.tutorialDone = true;
  startDefensePreview(g);
  return g;
}

/** Plays one ticket through investigation to a disposition (and a note when given). */
function work(g: Game, ticketId: string, disposition: string, note?: string) {
  g.exec(`ticket ${ticketId}`);
  g.exec('socsearch');
  g.exec(`disposition ${disposition}`);
  if (note) g.exec(`note ${note}`);
}

const ticket = (g: Game, id: string) => g.run.defense!.tickets.find((t) => t.id === id)!;

describe('defense shift: three-ticket queue', () => {
  it('preview entry sets gamePhase, queue and per-ticket SLA clocks', () => {
    const g = defenseReady();
    expect(g.profile.gamePhase).toBe('defense');
    expect(g.run.defense?.tickets).toHaveLength(3);
    expect(g.run.defense?.tickets.every((t) => t.slaRemainingSec > 0)).toBe(true);
    expect(g.exec('cat ~/cases/playbook-l1.txt').join('\n')).toContain('L1 PLAYBOOK');
  });

  it('D1 golden path: true positive with the right IOC', () => {
    const g = defenseReady();
    work(g, D1.ticketId, 'tp', D1.noteSuggestion);
    const xpBefore = g.profile.operatorXp;
    const out = text(g.exec(`submit defense ${D1.expectedIoc}`));
    expect(out).toContain('CLOSED');
    const t = ticket(g, D1.ticketId);
    expect(t.result?.correct).toBe(true);
    expect(t.result?.evidence).toEqual(['source IP', 'account', 'time window']);
    expect(g.profile.operatorXp - xpBefore).toBe(D1.xp + 30 + 10);
  });

  it('D1 wrong: false positive gets QA-flagged with coaching, queue moves on', () => {
    const g = defenseReady();
    work(g, D1.ticketId, 'fp', 'looks fine');
    const out = text(g.exec('submit defense'));
    expect(out).toContain('QA flagged');
    expect(out).toContain('textbook T1110.003');
    expect(ticket(g, D1.ticketId).result?.correct).toBe(false);
    expect(g.run.defense?.activeTicketId).toBe(D3.ticketId);
  });

  it('D1 wrong IOC under true positive is flagged', () => {
    const g = defenseReady();
    work(g, D1.ticketId, 'tp');
    g.exec('submit defense 198.51.100.9');
    expect(ticket(g, D1.ticketId).result?.correct).toBe(false);
  });

  it('D2 golden path: approved scanner is a false positive, note required', () => {
    const g = defenseReady();
    g.exec(`ticket ${D2.ticketId}`);
    g.exec('less ~/cases/scanner-allowlist.txt');
    expect(ticket(g, D2.ticketId).investigated).toBe(true);
    g.exec('disposition fp');
    expect(text(g.exec('submit defense'))).toContain('needs an analyst note');
    g.exec(`note ${D2.noteSuggestion}`);
    g.exec('submit defense');
    const t = ticket(g, D2.ticketId);
    expect(t.result?.correct).toBe(true);
    expect(t.result?.evidence).toHaveLength(3);
  });

  it('D2 wrong: calling the scanner a true positive', () => {
    const g = defenseReady();
    work(g, D2.ticketId, 'tp');
    const out = text(g.exec('submit defense 192.0.2.25'));
    expect(out).toContain('CHG-4471');
    expect(ticket(g, D2.ticketId).result?.correct).toBe(false);
  });

  it('D3 golden path: escalate the account takeover with an evidence note', () => {
    const g = defenseReady();
    work(g, D3.ticketId, 'escalate', D3.noteSuggestion);
    g.exec('submit defense');
    const t = ticket(g, D3.ticketId);
    expect(t.result?.correct).toBe(true);
    expect(t.result?.evidence).toEqual(['user', 'source IP', 'new country', 'time window']);
  });

  it('D3 wrong: closing it yourself as true positive', () => {
    const g = defenseReady();
    work(g, D3.ticketId, 'tp');
    const out = text(g.exec('submit defense 203.0.113.77'));
    expect(out).toContain('L2');
    expect(ticket(g, D3.ticketId).result?.correct).toBe(false);
  });

  it('closing all three produces an end-of-shift summary', () => {
    const g = defenseReady();
    work(g, D1.ticketId, 'tp');
    g.exec(`submit defense ${D1.expectedIoc}`);
    work(g, D2.ticketId, 'fp', D2.noteSuggestion);
    g.exec('submit defense');
    work(g, D3.ticketId, 'fp', 'probably travel');
    const out = text(g.exec('submit defense'));
    expect(g.run.defense?.outcome).toBe('complete');
    expect(out).toContain('SHIFT SUMMARY');
    expect(out).toContain('tickets closed  3/3');
    expect(out).toContain('accuracy        2/3');
    expect(out).toContain('SLA met         3/3');
  });

  it('an SLA breach marks the ticket late but does not end the shift', () => {
    const g = defenseReady();
    ticket(g, D1.ticketId).slaRemainingSec = 0.01;
    g.tick(1);
    expect(ticket(g, D1.ticketId).slaMissed).toBe(true);
    expect(g.run.defense?.outcome).toBe('active');
    work(g, D1.ticketId, 'tp');
    g.exec(`submit defense ${D1.expectedIoc}`);
    expect(ticket(g, D1.ticketId).result).toMatchObject({ correct: true, slaMet: false });
  });

  it('note evidence matching ignores short tokens inside other words', () => {
    expect(noteEvidenceHits(MISSION_BY_TICKET[D3.ticketId], ['approved from somewhere'])).toEqual([]);
    expect(noteEvidenceHits(MISSION_BY_TICKET[D3.ticketId], ['login from RO'])).toEqual(['new country']);
  });

  it('GUIDE does not reveal the disposition, hint does', () => {
    const g = defenseReady();
    g.exec('mail');
    g.exec(`ticket ${D2.ticketId}`);
    g.exec('socsearch');
    expect(g.nextHint().cmd).toBe('less ~/cases/playbook-l1.txt');
    expect(g.nextHint(true).cmd).toBe('disposition fp');
  });

  it('defense exit restores offense phase', () => {
    const g = defenseReady();
    g.exec('defense exit');
    expect(g.profile.gamePhase).toBe('offense');
    expect(g.run.defense).toBeUndefined();
  });
});
