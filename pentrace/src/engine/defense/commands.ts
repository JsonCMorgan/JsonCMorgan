import { c } from '../ansi';
import { grantOperatorXp } from '../progression';
import type { Game } from '../game';
import {
  activeTicket,
  DEFENSE_MISSIONS,
  MISSION_BY_TICKET,
  noteEvidenceHits,
  PLAYBOOK_PATH,
  type DefenseRunState,
  type DefenseTicketRow,
  type Disposition,
} from './state';

type DefenseCmd = (g: Game, args: string[]) => string[];

class DefenseCmdError extends Error {}

function err(msg: string): never {
  throw new DefenseCmdError(msg);
}

const LABEL: Record<Disposition, string> = { fp: 'FALSE POSITIVE', tp: 'TRUE POSITIVE', escalate: 'ESCALATED TO L2' };
const SLA_BONUS_XP = 10;
const EVIDENCE_XP = 10;

function focused(g: Game): DefenseTicketRow {
  const t = activeTicket(g.run.defense!);
  if (!t) err('no ticket focused. tickets, then ticket <id>');
  if (t.status === 'closed') err(`${t.id} is already closed. tickets shows what is still open.`);
  return t;
}

function slaLabel(t: DefenseTicketRow): string {
  if (t.status === 'closed') return t.result?.slaMet ? c.green('SLA met') : c.red('SLA missed');
  if (t.slaMissed) return c.red('SLA BREACHED');
  return c.dim(`SLA ${Math.ceil(t.slaRemainingSec / 60)}m`);
}

function ticketsCmd(g: Game): string[] {
  const d = g.run.defense!;
  g.emitGameEvent({ type: 'open', panel: 'tickets' });
  const lines = [c.bold(c.cyan(`MISSION QUEUE // L1 shift (${d.tickets.filter((t) => t.status === 'closed').length}/${d.tickets.length} closed)`))];
  for (const t of d.tickets) {
    const badge =
      t.status === 'closed'
        ? t.result?.correct
          ? c.green('CLOSED')
          : c.red('QA-FLAG')
        : t.id === d.activeTicketId
          ? c.yellow('ACTIVE')
          : c.dim(t.status.toUpperCase().padEnd(6));
    lines.push(`${badge} ${c.magenta(t.id)}  ${t.client.padEnd(10)} P${t.priority} ${t.severity.padEnd(8)} ${t.title}  ${slaLabel(t)}`);
  }
  lines.push(c.dim('  ticket <id> to focus · socsearch · disposition fp|tp|escalate · note <text> · submit defense [ioc]'));
  return lines;
}

function ticketCmd(g: Game, args: string[]): string[] {
  const id = args[0];
  const d = g.run.defense!;
  if (!id) err(`usage: ticket <id>   e.g. ticket ${d.tickets.find((t) => t.status !== 'closed')?.id ?? d.tickets[0].id}`);
  const t = d.tickets.find((x) => x.id === id);
  if (!t) err(`ticket: unknown ${id}. tickets lists the queue.`);
  if (t.status === 'closed') return [c.dim(`${t.id} is closed (${t.disposition ? LABEL[t.disposition] : 'n/a'}).`)];
  d.activeTicketId = t.id;
  for (const other of d.tickets) if (other.status === 'working' && other.id !== t.id) other.status = 'new';
  t.status = 'working';
  g.emitGameEvent({ type: 'open', panel: 'tickets' });
  const m = MISSION_BY_TICKET[t.id];
  return [
    c.bold(c.cyan(`${t.id} // ${t.client}`)),
    `  ${t.severity} · priority ${t.priority} · ${t.mitre}`,
    `  ${t.title}`,
    '',
    c.dim(`  Evidence: ${m.caseFiles.map((f) => f.path.replace('/home/ghost', '~')).join('  ')}`),
    c.dim(`  Next: socsearch, then grep or less the case files. Playbook: less ${PLAYBOOK_PATH.replace('/home/ghost', '~')}`),
    c.yellow(`  ▸ SLA ${Math.ceil(t.slaRemainingSec / 60)}m left on this ticket.`),
  ];
}

function socsearchCmd(g: Game): string[] {
  const t = focused(g);
  t.investigated = true;
  g.unlockIndex('log-analysis');
  return [c.dim('# socsearch (SPL-lite)'), ...MISSION_BY_TICKET[t.id].socsearchOutput.map((l) => (l ? '  ' + l : ''))];
}

function dispositionCmd(g: Game, args: string[]): string[] {
  const pick = args[0] as Disposition | undefined;
  if (!pick || !['fp', 'tp', 'escalate'].includes(pick)) err('usage: disposition fp|tp|escalate');
  const t = focused(g);
  t.disposition = pick!;
  if (pick === 'tp') g.unlockIndex('soc-disposition');
  if (pick === 'fp') g.unlockIndex('false-positive-tuning');
  if (pick === 'escalate') g.unlockIndex('soc-escalation');
  const next =
    pick === 'tp'
      ? 'Next: note <evidence> (optional), then submit defense <ioc>.'
      : `Next: note <evidence> (required for ${pick === 'fp' ? 'an FP close' : 'an escalation'}), then submit defense.`;
  return [c.green(`  ${t.id} disposition set: ${LABEL[pick!]}`), c.dim('  ' + next)];
}

function noteCmd(g: Game, args: string[]): string[] {
  const text = args.join(' ').trim();
  if (!text) err('usage: note <text>   e.g. note spray from 203.0.113.44 against admin 06:48-06:49');
  const t = focused(g);
  t.notes.push(text);
  g.unlockIndex('analyst-notes');
  const hits = noteEvidenceHits(MISSION_BY_TICKET[t.id], t.notes);
  return [
    c.green(`  note attached to ${t.id} (${t.notes.length} total)`),
    c.dim(`  evidence cited so far: ${hits.length ? hits.join(', ') : 'none yet (name IPs, users, times)'}`),
  ];
}

function closeTicket(g: Game, t: DefenseTicketRow, correct: boolean): { xp: number; evidence: string[] } {
  const d = g.run.defense!;
  const m = MISSION_BY_TICKET[t.id];
  const evidence = noteEvidenceHits(m, t.notes);
  const slaMet = !t.slaMissed;
  const xp = correct ? m.xp + evidence.length * EVIDENCE_XP + (slaMet ? SLA_BONUS_XP : 0) : 0;
  t.status = 'closed';
  t.result = { correct, evidence, xp, slaMet };
  if (xp) {
    const { rankUps } = grantOperatorXp(g.profile, xp);
    if (rankUps) g.emitGameEvent({ type: 'toast', kind: 'success', title: 'OPERATOR RANK', body: `Rank ${g.profile.operatorRank}` });
  }
  const next = d.tickets.filter((x) => x.status !== 'closed').sort((a, b) => a.priority - b.priority)[0];
  if (next) d.activeTicketId = next.id;
  else d.outcome = 'complete';
  return { xp, evidence };
}

function submitDefenseCmd(g: Game, args: string[]): string[] {
  const d = g.run.defense!;
  if (d.outcome !== 'active') err('submit: shift already complete. shift for the summary, defense exit to leave.');
  const t = focused(g);
  const m = MISSION_BY_TICKET[t.id];
  const answer = args[0]?.trim();
  if (!t.investigated) err('submit: investigate first (socsearch, or grep / less the case files)');
  if (!t.disposition) err('submit: set disposition tp|fp|escalate first');
  if (t.disposition === 'tp' && !answer) err(`usage: submit defense <ioc>   (true positives document the source IP)`);
  if (t.disposition !== 'tp' && !t.notes.length) {
    err(`submit: ${t.disposition === 'escalate' ? 'an escalation' : 'an FP close'} needs an analyst note. note <evidence> first.`);
  }
  const rightCall = t.disposition === m.expectedDisposition;
  const iocOk = m.expectedDisposition !== 'tp' || answer === m.expectedIoc;
  const correct = rightCall && iocOk;
  const id = t.id;
  const { xp, evidence } = closeTicket(g, t, correct);
  const out: string[] = [];
  if (correct) {
    g.emitGameEvent({ type: 'toast', kind: 'success', title: 'TICKET CLOSED', body: `${id} ${LABEL[m.expectedDisposition]}` });
    g.emitGameEvent({ type: 'sound', sound: 'success' });
    g.unlockIndex(m.expectedDisposition === 'tp' ? 'log-analysis' : m.expectedDisposition === 'fp' ? 'false-positive-tuning' : 'soc-escalation');
    out.push(
      c.green(c.bold(`  ✔ ${id} CLOSED · ${LABEL[m.expectedDisposition]}`)),
      c.cyan(`  +${xp} Operator XP`) + c.dim(`  (base ${m.xp}, evidence ${evidence.length}×${EVIDENCE_XP}${t.result!.slaMet ? `, SLA +${SLA_BONUS_XP}` : ', SLA missed'})`),
      ...m.triageBullets.map((b) => c.dim('  · ' + b)),
    );
  } else {
    g.emitGameEvent({ type: 'sound', sound: 'error' });
    g.emitGameEvent({ type: 'toast', kind: 'danger', title: 'QA FLAG', body: `${id} closed wrong` });
    const why = !rightCall
      ? m.wrong[t.disposition!] ?? `Expected ${LABEL[m.expectedDisposition]}.`
      : `IOC "${answer}" is not the source in the evidence. Re-read the Accepted line.`;
    out.push(c.red(c.bold(`  ✗ ${id} closed as ${LABEL[t.disposition!]}: QA flagged it`)), c.yellow('  ' + why), c.dim('  No XP for this ticket. The queue moves on, like a real shift.'));
  }
  if (shiftDone(d)) out.push('', ...shiftSummary(d), c.dim('  defense exit returns to offense.'));
  else out.push(c.dim(`  Next in queue: ticket ${d.activeTicketId}`));
  return out;
}

function shiftDone(d: DefenseRunState): boolean {
  return d.outcome === 'complete';
}

export function shiftSummary(d: DefenseRunState): string[] {
  const closed = d.tickets.filter((t) => t.status === 'closed');
  const correct = closed.filter((t) => t.result?.correct).length;
  const sla = closed.filter((t) => t.result?.slaMet).length;
  const xp = closed.reduce((s, t) => s + (t.result?.xp ?? 0), 0);
  const ev = closed.reduce((s, t) => s + (t.result?.evidence.length ?? 0), 0);
  const evMax = closed.reduce((s, t) => s + MISSION_BY_TICKET[t.id].noteEvidence.length, 0);
  return [
    c.bold(c.cyan(`SHIFT SUMMARY // ${d.outcome === 'complete' ? 'end of shift' : 'in progress'}`)),
    `  tickets closed  ${closed.length}/${d.tickets.length}`,
    `  accuracy        ${correct}/${closed.length || 0}${closed.length ? `  (${Math.round((correct / closed.length) * 100)}%)` : ''}`,
    `  SLA met         ${sla}/${closed.length || 0}`,
    `  note evidence   ${ev}/${evMax}`,
    `  Operator XP     +${xp}`,
    ...closed.map(
      (t) =>
        `  ${t.result?.correct ? c.green('✔') : c.red('✗')} ${t.id} ${t.client.padEnd(10)} ${t.disposition ? LABEL[t.disposition] : ''}${t.result?.correct ? '' : c.dim(`  (expected ${LABEL[MISSION_BY_TICKET[t.id].expectedDisposition]})`)}`,
    ),
  ];
}

export const DEFENSE_COMMANDS: Record<string, DefenseCmd> = {
  tickets: (g) => ticketsCmd(g),
  ticket: (g, a) => ticketCmd(g, a),
  socsearch: (g) => socsearchCmd(g),
  disposition: (g, a) => dispositionCmd(g, a),
  note: (g, a) => noteCmd(g, a),
  shift: (g) => shiftSummary(g.run.defense!),
  soc: (g, a) => {
    if (a[0] === 'search') return socsearchCmd(g);
    err('usage: socsearch   (alias: soc search)');
  },
};

export const DEFENSE_COMMAND_NAMES = new Set([...Object.keys(DEFENSE_COMMANDS)]);

export function runDefenseCommand(g: Game, name: string, args: string[]): string[] {
  if (name === 'submit') {
    if (args[0] !== 'defense') err('usage: submit defense [ioc]');
    return submitDefenseCmd(g, args.slice(1));
  }
  const cmd = DEFENSE_COMMANDS[name];
  if (!cmd) err(`${name}: not available in defense shift (try tickets, socsearch, disposition, note)`);
  return cmd(g, args);
}

/** Marks a ticket investigated when the player reads one of its case files. */
export function markCaseFilesRead(d: DefenseRunState, args: string[]) {
  for (const m of DEFENSE_MISSIONS) {
    const t = d.tickets.find((x) => x.id === m.ticketId);
    if (!t || t.status === 'closed') continue;
    const names = m.caseFiles.map((f) => f.path.split('/').pop()!);
    if (args.some((a) => names.some((n) => a.endsWith(n)))) t.investigated = true;
  }
}

export { DefenseCmdError };
