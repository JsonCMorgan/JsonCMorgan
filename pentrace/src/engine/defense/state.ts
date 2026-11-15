import missionD1 from './mission-d1.json';
import missionD2 from './mission-d2.json';
import missionD3 from './mission-d3.json';
import ticketsJson from './tickets.json';

export interface DefenseMail {
  from: string;
  subject: string;
  body: string[];
  read: boolean;
}

export type Disposition = 'fp' | 'tp' | 'escalate';
export type DefenseDisposition = Disposition | null;
/** active until every ticket in the queue is closed, then complete (shift summary). */
export type DefenseOutcome = 'active' | 'complete';

export interface DefenseMission {
  id: string;
  ticketId: string;
  title: string;
  client: string;
  expectedDisposition: Disposition;
  expectedIoc?: string;
  mitre: string;
  slaMinutes: number;
  xp: number;
  socsearchOutput: string[];
  caseFiles: { path: string; lines: string[] }[];
  noteEvidence: { label: string; any: string[] }[];
  noteSuggestion: string;
  wrong: Partial<Record<Disposition, string>>;
  triageBullets: string[];
  /** Mission Complete debrief takeaways. */
  lessons: string[];
}

export interface DefenseTicketRow {
  id: string;
  client: string;
  priority: number;
  severity: string;
  title: string;
  mitre: string;
  status: 'new' | 'working' | 'closed' | 'waiting';
  slaTotalSec: number;
  slaRemainingSec: number;
  slaMissed: boolean;
  investigated: boolean;
  disposition: DefenseDisposition;
  notes: string[];
  result?: { correct: boolean; evidence: string[]; xp: number; slaMet: boolean };
}

export interface DefenseRunState {
  /** Bumped when the shape changes so old saves restart the shift instead of crashing. */
  version: 2;
  missionId: string;
  activeTicketId: string;
  outcome: DefenseOutcome;
  tickets: DefenseTicketRow[];
}

export const DEFENSE_MISSIONS: DefenseMission[] = [missionD1, missionD2, missionD3] as DefenseMission[];
export const MISSION_BY_TICKET: Record<string, DefenseMission> = Object.fromEntries(DEFENSE_MISSIONS.map((m) => [m.ticketId, m]));
export const D1_MISSION = missionD1 as DefenseMission;
export const DEFENSE_PLAYBOOK: string[] = ticketsJson.playbook;
export const PLAYBOOK_PATH = '/home/ghost/cases/playbook-l1.txt';

type TicketSeed = Pick<DefenseTicketRow, 'id' | 'client' | 'priority' | 'severity' | 'title' | 'mitre' | 'status'>;

export function initDefenseShift(): DefenseRunState {
  const seeds = ticketsJson.tickets as TicketSeed[];
  return {
    version: 2,
    missionId: 'l1-shift-1',
    activeTicketId: seeds[0].id,
    outcome: 'active',
    tickets: seeds.map((t) => {
      const sla = (MISSION_BY_TICKET[t.id]?.slaMinutes ?? 30) * 60;
      return { ...t, slaTotalSec: sla, slaRemainingSec: sla, slaMissed: false, investigated: false, disposition: null, notes: [] };
    }),
  };
}

export function activeTicket(d: DefenseRunState): DefenseTicketRow | undefined {
  return d.tickets.find((t) => t.id === d.activeTicketId);
}

/** Which evidence items a note mentions. Short tokens like "RO" must match as whole words. */
export function noteEvidenceHits(mission: DefenseMission, notes: string[]): string[] {
  const text = notes.join(' ');
  return mission.noteEvidence
    .filter((e) =>
      e.any.some((tok) => {
        if (tok.length <= 3 && /^[A-Za-z]+$/.test(tok)) return new RegExp(`\\b${tok}\\b`).test(text);
        return text.toLowerCase().includes(tok.toLowerCase());
      }),
    )
    .map((e) => e.label);
}

export function defenseShiftMail(): DefenseMail[] {
  const h = ticketsJson.handler;
  return [{ from: h.from, subject: h.shiftSubject, body: h.shiftBody, read: false }];
}
