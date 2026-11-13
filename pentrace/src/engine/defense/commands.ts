import { c } from '../ansi';
import { grantOperatorXp } from '../progression';
import type { Game } from '../game';
import { D1_MISSION } from './state';

type DefenseCmd = (g: Game, args: string[]) => string[];

class DefenseCmdError extends Error {}

const err = (msg: string): never => {
  throw new DefenseCmdError(msg);
};

function ticketsCmd(g: Game): string[] {
  const d = g.run.defense!;
  g.emitGameEvent({ type: 'open', panel: 'tickets' });
  const lines = [c.bold(c.cyan('MISSION QUEUE // L1 shift (preview)'))];
  for (const t of d.tickets) {
    const badge =
      t.status === 'closed'
        ? c.green('CLOSED')
        : t.id === d.activeTicketId
          ? c.yellow('ACTIVE')
          : c.dim(t.status.toUpperCase());
    lines.push(
      `${badge} ${c.magenta(t.id)}  ${t.client.padEnd(10)} P${t.priority} ${t.severity.padEnd(8)} ${t.title}`,
    );
  }
  lines.push(c.dim('  ticket <id> for detail · disposition fp|tp|escalate · submit defense <ioc>'));
  return lines;
}

function ticketCmd(g: Game, args: string[]): string[] {
  const id = args[0];
  if (!id) err('usage: ticket <id>   e.g. ticket BT-2026-0103');
  const d = g.run.defense!;
  const t = d.tickets.find((x) => x.id === id);
  if (!t) err(`ticket: unknown ${id}`);
  d.activeTicketId = id;
  const working = d.tickets.find((x) => x.status === 'working');
  if (working && working.id !== id) working.status = 'new';
  t.status = 'working';
  g.emitGameEvent({ type: 'open', panel: 'tickets' });
  const lines = [
    c.bold(c.cyan(`${t.id} // ${t.client}`)),
    `  ${t.severity} · priority ${t.priority} · ${t.mitre}`,
    `  ${t.title}`,
    '',
    c.dim('  Next: socsearch (SPL view) or grep /home/ghost/cases/northpeak-auth.log'),
  ];
  if (id === D1_MISSION.primaryTicket) {
    lines.push(c.yellow('  ▸ SLA clock is running on this ticket.'));
  }
  return lines;
}

function socsearchCmd(g: Game): string[] {
  const d = g.run.defense!;
  if (d.activeTicketId !== D1_MISSION.primaryTicket) {
    return [c.yellow('Focused ticket is not the spray case. ticket BT-2026-0103 first.')];
  }
  d.investigated = true;
  g.unlockIndex('log-analysis');
  return [c.dim('# socsearch (SPL-lite preview)'), ...D1_MISSION.socsearchOutput.map((l) => (l ? '  ' + l : ''))];
}

function dispositionCmd(g: Game, args: string[]): string[] {
  const pick = args[0] as 'fp' | 'tp' | 'escalate' | undefined;
  if (!pick || !['fp', 'tp', 'escalate'].includes(pick)) err('usage: disposition fp|tp|escalate');
  g.run.defense!.disposition = pick;
  if (pick === 'tp') g.unlockIndex('soc-disposition');
  const label = { fp: 'FALSE POSITIVE', tp: 'TRUE POSITIVE', escalate: 'ESCALATED' }[pick];
  return [c.green(`  disposition set: ${label}`), c.dim('  For spray case: submit defense <ioc> after disposition tp.')];
}

function submitDefenseCmd(g: Game, args: string[]): string[] {
  const d = g.run.defense!;
  if (d.outcome !== 'active') err('submit: shift already resolved');
  const answer = args[0]?.trim();
  if (!answer) err(`usage: submit defense <ioc>   e.g. submit defense ${D1_MISSION.expectedIoc}`);
  if (!d.investigated) err('submit: run socsearch or grep the case log before closing');
  if (!d.disposition) err('submit: set disposition tp|fp|escalate first');
  if (d.disposition === 'fp') {
    d.outcome = 'lost_wrong';
    g.emitGameEvent({ type: 'sound', sound: 'error' });
    return [
      c.red('  ✗ CLOSED AS FALSE POSITIVE — spray pattern was real.'),
      c.dim('  Retrain: 412 fails → 1 accept is a textbook T1110.003.'),
    ];
  }
  if (d.disposition === 'escalate') {
    return [
      c.yellow('  ▸ Escalated to lead. For preview win: disposition tp and submit IOC yourself.'),
    ];
  }
  if (answer !== D1_MISSION.expectedIoc) {
    d.outcome = 'lost_wrong';
    g.emitGameEvent({ type: 'sound', sound: 'error' });
    return [c.red(`  ✗ IOC "${answer}" does not match the Accepted source in auth.log.`)];
  }
  d.outcome = 'won';
  const ticket = d.tickets.find((t) => t.id === D1_MISSION.primaryTicket);
  if (ticket) ticket.status = 'closed';
  g.unlockIndex('log-analysis');
  const { rankUps } = grantOperatorXp(g.profile, 60);
  g.emitGameEvent({ type: 'toast', kind: 'success', title: 'TICKET CLOSED', body: `${D1_MISSION.primaryTicket} TP` });
  g.emitGameEvent({ type: 'sound', sound: 'success' });
  if (rankUps) {
    g.emitGameEvent({ type: 'toast', kind: 'success', title: 'OPERATOR RANK', body: `Rank ${g.profile.operatorRank}` });
  }
  return [
    c.green(c.bold(`  ✔ ${D1_MISSION.primaryTicket} CLOSED — true positive`)),
    c.cyan(`  IOC ${answer} documented · +60 Operator XP`),
    ...D1_MISSION.handler.triageBullets.map((b) => c.dim('  · ' + b)),
    c.dim('  defense exit — back to offense'),
  ];
}

export const DEFENSE_COMMANDS: Record<string, DefenseCmd> = {
  tickets: (g) => ticketsCmd(g),
  ticket: (g, a) => ticketCmd(g, a),
  socsearch: (g) => socsearchCmd(g),
  disposition: (g, a) => dispositionCmd(g, a),
  soc: (g, a) => {
    const sub = a[0];
    if (sub === 'search') return socsearchCmd(g);
    err('usage: socsearch   (alias: soc search)');
    return [];
  },
};

export function execDefenseSubmit(g: Game, args: string[]): string[] | null {
  if (args[0] !== 'defense') return null;
  return submitDefenseCmd(g, args.slice(1));
}

export function runDefenseCommand(g: Game, name: string, args: string[]): string[] {
  if (name === 'soc' && args[0] === 'search') return DEFENSE_COMMANDS.socsearch(g, ['search']);
  if (name === 'submit') {
    const sub = execDefenseSubmit(g, args);
    if (sub) return sub;
    err('usage: submit defense <ioc>');
  }
  const cmd = DEFENSE_COMMANDS[name];
  if (!cmd) err(`${name}: not available in defense shift (try tickets, socsearch, disposition)`);
  return cmd(g, args);
}

export { DefenseCmdError };
