import { describe, expect, it } from 'vitest';
import { stripAnsi } from '../src/engine/ansi';
import type { GameEvent } from '../src/engine/events';
import { Game } from '../src/engine/game';
import { TRAINING_GW_IP, TRAINING_INTRUDER_IP, TRAINING_VAULT_IP } from '../src/engine/network';
import { TUTORIAL_PAY_FIRST, TUTORIAL_STEPS } from '../src/engine/tutorial';

const text = (lines: string[]) => lines.map(stripAnsi).join('\n');
const stepId = (g: Game) => (g.run.tutorial ? TUTORIAL_STEPS[g.run.tutorial.step].id : 'done');

function settle(g: Game) {
  for (let t = 0; t < 60 && g.run.procs.length; t += 0.25) g.tick(0.25);
  g.tick(0.25);
}

/** Plays one step the way a player would, including TAB and history recall. */
function playStep(g: Game) {
  switch (stepId(g)) {
    case 'tab':
      g.completions('cat brea');
      g.exec('cat breach-cheatsheet.txt');
      break;
    case 'history':
      g.exec('cat breach-cheatsheet.txt');
      break;
    case 'parallel':
      g.exec(`sshbrute ${TRAINING_VAULT_IP}`);
      g.exec(`webscan ${TRAINING_VAULT_IP}`);
      break;
    case 'submit':
      g.exec(`submit drill ${TRAINING_INTRUDER_IP}`);
      break;
    default: {
      const cmd = g.nextHint(true).cmd!;
      g.exec(cmd);
    }
  }
  settle(g);
}

describe('tutorial', () => {
  it('a new profile starts in the training sim with real jobs locked', () => {
    const g = new Game(null, 1);
    expect(g.inTutorial).toBe(true);
    expect(g.world.org).toBe('Vex Training Sim');
    expect(Object.values(g.run.contracts)).toEqual(['locked', 'locked', 'locked']);
    expect(text(g.exec('jobs'))).toContain('finish training to unlock');
    expect(stepId(g)).toBe('help');
    expect(text(g.tutorialStepLines())).toContain('TRAINING 1/');
  });

  it('only advances when the step is satisfied', () => {
    const g = new Game(null, 1);
    g.exec('ls');
    expect(stepId(g)).toBe('help');
    const out = text(g.exec('help'));
    expect(out).toContain('✔ Pull up the command list');
    expect(out).toContain('TRAINING 2/');
    expect(stepId(g)).toBe('pwd');
  });

  it('the TAB step requires using tab completion, with a nudge', () => {
    const g = new Game(null, 1);
    for (const cmd of ['help', 'pwd', 'ls', 'cd notes']) g.exec(cmd);
    expect(stepId(g)).toBe('tab');
    expect(text(g.exec('cat breach-cheatsheet.txt'))).toContain('hit TAB');
    expect(stepId(g)).toBe('tab');
    expect(g.completions('cat brea')).toEqual(['breach-cheatsheet.txt']);
    g.exec('cat breach-cheatsheet.txt');
    expect(stepId(g)).toBe('history');
    g.exec('pwd');
    expect(stepId(g)).toBe('history');
    g.exec('pwd');
    expect(stepId(g)).toBe('pipe');
  });

  it('async steps complete from the game tick when a tool finishes', () => {
    const g = new Game(null, 1);
    while (stepId(g) !== 'nmap') playStep(g);
    g.exec(`nmap -sV ${TRAINING_GW_IP}`);
    expect(stepId(g)).toBe('nmap');
    settle(g);
    expect(stepId(g)).toBe('connect');
  });

  it('twist: cracking the firewalled vault head-on fails, and that failure advances the lesson', () => {
    const g = new Game(null, 1);
    while (stepId(g) !== 'firewall-twist') playStep(g);
    const out = text(g.exec(`sshbrute ${TRAINING_VAULT_IP}`));
    expect(out).toContain('dropped by firewall');
    expect(stepId(g)).toBe('fwrules');
    expect(g.run.heat).toBeLessThan(5);
  });

  it('forgives typos: suggestions, no trace, and Vex restates the step', () => {
    const g = new Game(null, 1);
    const out = text(g.exec('hlep'));
    expect(out).toContain('Did you mean help?');
    expect(out).toContain('This step wants: help');
    expect(g.run.heat).toBe(0);
    expect(stepId(g)).toBe('help');
  });

  it('apply: the final exam hides the command until the player asks for a hint', () => {
    const g = new Game(null, 1);
    while (stepId(g) !== 'graduation') playStep(g);
    expect(g.nextHint().cmd).toBeUndefined();
    expect(text(g.tutorialStepLines())).toContain('no hand-holding');
    expect(text(g.exec('hint'))).toContain(`connect ${TRAINING_VAULT_IP}`);
  });

  it('the trace can never end a tutorial run', () => {
    const g = new Game(null, 1);
    g.addHeat(500);
    expect(g.run.heat).toBe(99);
    expect(g.run.traced).toBe(false);
  });

  it('the SOC drill spikes the trace, unlocks The Trace, then cools down', () => {
    const g = new Game(null, 1);
    while (stepId(g) !== 'trace') playStep(g);
    expect(g.run.heat).toBeGreaterThanOrEqual(75);
    expect(g.run.flagged).toBe(true);
    expect(g.profile.index['the-trace']).toBeDefined();
    playStep(g);
    expect(stepId(g)).toBe('index');
    expect(g.run.heat).toBeCloseTo(30, 0);
    expect(text(g.exec('index port-scanning'))).toContain('index the-trace');
    expect(stepId(g)).toBe('index');
  });

  it('a wrong drill answer does not pay', () => {
    const g = new Game(null, 1);
    while (stepId(g) !== 'submit') playStep(g);
    expect(text(g.exec(`submit drill ${TRAINING_GW_IP}`))).toContain('not it');
    expect(g.profile.credits).toBe(0);
  });

  it('full playthrough covers every step, pays, buys, and unlocks the real board', () => {
    const g = new Game(null, 7);
    const events: GameEvent[] = [];
    g.on((e) => events.push(e));
    const seen: string[] = [];
    for (let i = 0; i < 80 && g.inTutorial; i++) {
      seen.push(stepId(g));
      playStep(g);
    }
    expect([...new Set(seen)]).toEqual(TUTORIAL_STEPS.map((s) => s.id));
    expect(g.inTutorial).toBe(false);
    expect(g.profile.tutorialDone).toBe(true);
    expect(g.owns('ram-512')).toBe(true);
    expect(g.profile.credits).toBe(TUTORIAL_PAY_FIRST - 400);
    expect(g.profile.index['the-trace']).toBeDefined();
    expect(g.profile.index['covering-tracks']).toBeDefined();
    expect(g.run.contracts.c1).toBe('active');
    expect(g.world.org).not.toBe('Vex Training Sim');
    expect(events.some((e) => e.type === 'traced')).toBe(false);
  });

  it('skip is refused on the first run but allowed on replays', () => {
    const g = new Game(null, 3);
    expect(text(g.exec('tutorial skip'))).toContain('finish training once');
    expect(g.inTutorial).toBe(true);
    expect(text(g.exec('jackout --force'))).toContain('finish training first');
    g.profile.tutorialDone = true;
    g.exec('tutorial skip');
    expect(g.inTutorial).toBe(false);
    expect(g.run.contracts.c1).toBe('active');
  });

  it('replaying parks the current op and restores it afterwards', () => {
    const g = new Game(null, 5, { tutorial: false });
    g.profile.tutorialDone = true;
    const org = g.world.org;
    g.exec(`nmap -sV ${g.world.gatewayIp}`);
    settle(g);
    g.exec('tutorial');
    expect(g.inTutorial).toBe(true);
    const saved = new Game(g.serialize());
    expect(saved.inTutorial).toBe(true);
    expect(saved.stash?.world.org).toBe(org);
    saved.exec('tutorial skip');
    expect(saved.world.org).toBe(org);
    expect(saved.world.hosts.find((h) => h.role === 'gateway')!.fingerprinted).toBe(true);
  });

  it('old saves without the tutorial flag count as veterans if they earned anything', () => {
    const g = new Game(null, 9, { tutorial: false });
    g.profile.totalEarned = 350;
    const data = g.serialize();
    delete (data.profile as Partial<typeof data.profile>).tutorialDone;
    expect(new Game(data).profile.tutorialDone).toBe(true);
  });

  it('old saves from players who never earned anything get sent to training, op parked', () => {
    const g = new Game(null, 9, { tutorial: false });
    const org = g.world.org;
    const data = g.serialize();
    delete (data.profile as Partial<typeof data.profile>).tutorialDone;
    const loaded = new Game(data);
    expect(loaded.inTutorial).toBe(true);
    expect(loaded.stash?.world.org).toBe(org);
  });
});
