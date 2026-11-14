import { c } from './ansi';
import {
  activeTicket,
  DEFENSE_MISSIONS,
  DEFENSE_PLAYBOOK,
  defenseShiftMail,
  initDefenseShift,
  MISSION_BY_TICKET,
  PLAYBOOK_PATH,
  type DefenseRunState,
} from './defense/state';
import type { Game, RunState } from './game';
import type { GameEvent } from './events';
import { VFS } from './vfs';
import { generateWorld } from './network';
import { initRunStanding } from './progression';

export function mountDefenseCaseFiles(g: Game) {
  const vfs = new VFS(g.home.fs);
  vfs.mkdirp('/home/ghost/cases');
  vfs.write(PLAYBOOK_PATH, DEFENSE_PLAYBOOK.join('\n') + '\n');
  for (const m of DEFENSE_MISSIONS) for (const f of m.caseFiles) vfs.write(f.path, f.lines.join('\n') + '\n');
}

export function startDefensePreview(g: Game): string[] {
  if (!g.profile.tutorialDone) {
    return [c.yellow('Finish Vex training once before the defense preview shift.')];
  }
  g.offenseStash = g.serialize();
  g.profile.gamePhase = 'defense';
  const seed = g.profile.nextSeed;
  g.profile.nextSeed = (seed * 48271 + 11) % 2147483647;
  const world = generateWorld(seed);
  world.org = 'NorthPeak MSSP';
  g.run = freshOffenseRunStub(world, initDefenseShift(), g);
  mountDefenseCaseFiles(g);
  g.run.mails = defenseShiftMail().map((m) => ({ ...m }));
  g.emitGameEvent({ type: 'newRun' });
  return [
    c.green(c.bold('  ▸ L1 DEFENSE SHIFT: three tickets in the queue')),
    c.dim('  mail, then less ~/cases/playbook-l1.txt. Per ticket: ticket <id>, socsearch, disposition, note, submit defense.'),
    c.dim('  defense exit returns to offense'),
  ];
}
export function exitDefensePreview(g: Game): string[] {
  if (!g.run.defense) return [c.dim('  Not in defense preview.')];
  g.profile.gamePhase = 'offense';
  const stash = g.offenseStash;
  g.offenseStash = null;
  if (stash) {
    g.profile = stash.profile;
    g.profile.gamePhase = 'offense';
    g.run = stash.run;
    g.run.procs = [];
    g.stash = stash.stash ?? null;
  } else {
    g.startRun();
  }
  g.emitGameEvent({ type: 'newRun' });
  return [c.cyan('  ▸ Back to offense. Jack in or continue your op.')];
}

function freshOffenseRunStub(world: import('./network').World, defense: DefenseRunState, g: Game): RunState {
  return {
    world,
    connected: null,
    cwd: '/',
    homeCwd: '/home/ghost',
    heat: 0,
    flagged: false,
    passed50: false,
    contracts: { c1: 'locked', c2: 'locked', c3: 'locked' },
    procs: [],
    nextPid: 2048,
    earned: 0,
    mails: [],
    traced: false,
    elapsed: 0,
    runStanding: initRunStanding(g.profile),
    defense,
  };
}

export function tickDefense(g: Game, dt: number) {
  const d = g.run.defense;
  if (!d || d.outcome !== 'active') return;
  for (const t of d.tickets) {
    if (t.status === 'closed' || t.slaMissed) continue;
    t.slaRemainingSec = Math.max(0, t.slaRemainingSec - dt);
    if (t.slaRemainingSec <= 0) {
      t.slaMissed = true;
      g.emitGameEvent({ type: 'toast', kind: 'danger', title: 'SLA BREACH', body: `${t.id} ${t.severity}` });
      g.emitGameEvent({ type: 'print', lines: [c.red(c.bold(`  ✗ SLA BREACH on ${t.id}. Still work it: the summary will show it was late.`))] });
    }
  }
}

/** reveal=false (GUIDE panel) never gives away the disposition or the IOC; the hint command does. */
export function defenseNextHint(g: Game, reveal = false): { text: string; cmd?: string } {
  const d = g.run.defense!;
  if (d.outcome === 'complete') return { text: 'Shift complete. Review the summary, then head back.', cmd: 'defense exit' };
  if (g.run.mails.some((m) => !m.read)) return { text: 'Read the handler shift mail.', cmd: 'mail' };
  const t = activeTicket(d);
  if (!t || t.status !== 'working') {
    const next = d.tickets.filter((x) => x.status !== 'closed').sort((a, b) => a.priority - b.priority)[0];
    return { text: `Focus the highest-priority open ticket (${next.severity}).`, cmd: `ticket ${next.id}` };
  }
  const m = MISSION_BY_TICKET[t.id];
  if (!t.investigated) return { text: 'Investigate before you decide: SIEM search first.', cmd: 'socsearch' };
  if (!t.disposition && !reveal) return { text: 'Decide: tp, fp or escalate? The playbook says which fits. Type hint to be told.', cmd: 'less ~/cases/playbook-l1.txt' };
  if (!t.disposition) {
    const file = m.caseFiles[m.caseFiles.length - 1].path.replace('/home/ghost', '~');
    return { text: `Check the evidence (${file}) against the playbook, then pick: ${m.expectedDisposition === 'tp' ? 'real attack on a server' : m.expectedDisposition === 'fp' ? 'expected activity' : 'possible account takeover'}.`, cmd: `disposition ${m.expectedDisposition}` };
  }
  if (t.disposition !== 'tp' && !t.notes.length) return { text: 'Write the analyst note: name the IP, user and time window.', cmd: reveal ? `note ${m.noteSuggestion}` : 'note <evidence>' };
  if (t.disposition === 'tp') return { text: 'Document the external IOC to close it.', cmd: reveal ? `submit defense ${m.expectedIoc ?? '<ioc>'}` : 'submit defense <ioc>' };
  return { text: 'Close the ticket with your note attached.', cmd: 'submit defense' };
}

export type { GameEvent, DefenseRunState };
