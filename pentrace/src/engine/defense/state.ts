import missionD1 from './mission-d1.json';
import ticketsJson from './tickets.json';

export interface DefenseMail {
  from: string;
  subject: string;
  body: string[];
  read: boolean;
}

export type DefenseDisposition = 'fp' | 'tp' | 'escalate' | null;
export type DefenseOutcome = 'active' | 'won' | 'lost_sla' | 'lost_wrong';

export interface DefenseTicketRow {
  id: string;
  client: string;
  priority: number;
  severity: string;
  title: string;
  mitre: string;
  status: 'new' | 'working' | 'closed' | 'waiting';
}

export interface DefenseRunState {
  missionId: string;
  slaTotalSec: number;
  slaRemainingSec: number;
  activeTicketId: string;
  disposition: DefenseDisposition;
  investigated: boolean;
  outcome: DefenseOutcome;
  tickets: DefenseTicketRow[];
}

export const D1_MISSION = missionD1;
export const DEFENSE_TICKETS = ticketsJson.tickets as DefenseTicketRow[];

export function initDefenseRunD1(): DefenseRunState {
  return {
    missionId: D1_MISSION.id,
    slaTotalSec: D1_MISSION.slaMinutes * 60,
    slaRemainingSec: D1_MISSION.slaMinutes * 60,
    activeTicketId: D1_MISSION.primaryTicket,
    disposition: null,
    investigated: false,
    outcome: 'active',
    tickets: DEFENSE_TICKETS.map((t) => ({ ...t })),
  };
}

export function defenseShiftMail(): DefenseMail[] {
  const h = D1_MISSION.handler;
  return [
    {
      from: h.from,
      subject: h.shiftSubject,
      body: h.shiftBody,
      read: false,
    },
  ];
}
