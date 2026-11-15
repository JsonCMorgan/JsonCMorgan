import type { ChecklistItem } from './contract-checklist';
import type { Game } from './game';
import { activeTicket } from './defense/state';

export function defenseChecklist(g: Game): ChecklistItem[] {
  const d = g.run.defense;
  if (!d) return [];
  const closed = d.tickets.filter((t) => t.status === 'closed').length;
  const queue: ChecklistItem = { id: 'queue', label: `Queue closed ${closed}/${d.tickets.length}`, done: d.outcome === 'complete' };
  const t = activeTicket(d);
  if (d.outcome === 'complete' || !t) return [queue];
  return [
    { id: 'mail', label: 'Read handler shift mail', done: g.run.mails.every((m) => m.read) },
    { id: 'ticket', label: `Focus ${t.id} (${t.severity})`, done: t.status === 'working' },
    { id: 'investigate', label: 'socsearch, grep or less the case files', done: t.investigated },
    { id: 'disp', label: 'disposition tp | fp | escalate', done: !!t.disposition },
    { id: 'note', label: `note <evidence>${t.disposition === 'tp' ? ' (optional for tp)' : ''}`, done: t.notes.length > 0 },
    { id: 'submit', label: t.disposition === 'tp' ? 'submit defense <ioc>' : 'submit defense', done: false },
    queue,
  ];
}
