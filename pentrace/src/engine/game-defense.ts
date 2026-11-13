import { c } from './ansi';
import { defenseShiftMail, D1_MISSION, initDefenseRunD1, type DefenseRunState } from './defense/state';
import type { Game, RunState } from './game';
import type { GameEvent } from './events';
import { file, VFS } from './vfs';
import { generateWorld } from './network';
import { initRunStanding } from './progression';

export function mountDefenseCaseFiles(g: Game) {
  const vfs = new VFS(g.home.fs);
  vfs.mkdirp('/home/ghost/cases');
  vfs.write(D1_MISSION.authLogPath, D1_MISSION.authLogLines.join('\n') + '\n');
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
  const defense = initDefenseRunD1();
  g.run = freshOffenseRunStub(world, defense, g);
  mountDefenseCaseFiles(g);
  g.run.mails = defenseShiftMail().map((m) => ({ ...m }));
  g.emitGameEvent({ type: 'newRun' });
  return [
    c.green(c.bold('  ▸ L1 DEFENSE PREVIEW — training shift')),
    c.dim('  Not story M7. Type mail, tickets, ticket BT-2026-0103, socsearch, disposition tp, submit defense <ioc>.'),
    c.dim('  defense exit — return to offense'),
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
  d.slaRemainingSec = Math.max(0, d.slaRemainingSec - dt);
  if (d.slaRemainingSec <= 0) {
    d.outcome = 'lost_sla';
    g.emitGameEvent({ type: 'toast', kind: 'danger', title: 'SLA BREACH', body: D1_MISSION.primaryTicket });
    g.emitGameEvent({ type: 'print', lines: [c.red(c.bold('  ✗ SLA BREACH — CRITICAL ticket timed out while queue idle.'))] });
  }
}

export function defenseNextHint(g: Game): { text: string; cmd?: string } {
  const d = g.run.defense!;
  if (d.outcome === 'won') return { text: 'Shift clear. defense exit when ready.', cmd: 'defense exit' };
  if (d.outcome === 'lost_sla') return { text: 'SLA blown. defense exit and retry with ?defense=1.', cmd: 'defense exit' };
  if (d.outcome === 'lost_wrong') return { text: 'Wrong close. Re-read logs; disposition tp + correct IOC.', cmd: 'ticket BT-2026-0103' };
  if (!g.run.mails.some((m) => !m.read)) return { text: 'Read handler mail.', cmd: 'mail' };
  if (d.activeTicketId !== D1_MISSION.primaryTicket) return { text: 'Prioritize CRITICAL spray ticket.', cmd: 'ticket BT-2026-0103' };
  if (!d.investigated) return { text: 'Investigate: socsearch or grep the case log.', cmd: 'socsearch' };
  if (d.disposition !== 'tp') return { text: 'This is a true positive spray.', cmd: 'disposition tp' };
  return { text: 'Document the external IOC.', cmd: `submit defense ${D1_MISSION.expectedIoc}` };
}

export type { GameEvent };
