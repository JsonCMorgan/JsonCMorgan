import type { ChecklistItem } from './contract-checklist';
import type { Game } from './game';
import { D1_MISSION } from './defense/state';

export function defenseChecklist(g: Game): ChecklistItem[] {
  const d = g.run.defense;
  if (!d) return [];
  const onSpray = d.activeTicketId === D1_MISSION.primaryTicket;
  return [
    { id: 'mail', label: 'Read handler shift mail', done: g.run.mails.every((m) => m.read) },
    { id: 'ticket', label: 'Focus CRITICAL ticket BT-2026-0103', done: onSpray && d.tickets[0].status === 'working' },
    { id: 'investigate', label: 'socsearch or grep case auth.log', done: d.investigated },
    { id: 'disp', label: 'disposition tp', done: d.disposition === 'tp' },
    {
      id: 'submit',
      label: `submit defense ${D1_MISSION.expectedIoc}`,
      done: d.outcome === 'won',
    },
  ];
}
