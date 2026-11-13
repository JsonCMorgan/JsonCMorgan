import { describe, expect, it } from 'vitest';
import { stripAnsi } from '../src/engine/ansi';
import type { GameEvent } from '../src/engine/events';
import { Game } from '../src/engine/game';
import { findHost } from '../src/engine/network';

const SEED = 4242;
const text = (lines: string[]) => lines.map(stripAnsi).join('\n');

function settle(g: Game, maxSec = 60) {
  for (let t = 0; t < maxSec && g.run.procs.length; t += 0.25) g.tick(0.25);
}

function setup() {
  const g = new Game(null, SEED, { tutorial: false });
  g.profile.relayUnlocked = true;
  g.profile.operatorRank = 4;
  g.run.runStanding.relay = 2;
  const events: GameEvent[] = [];
  g.on((e) => events.push(e));
  const w = g.world;
  return { g, events, w, gw: findHost(w, w.gatewayIp)!, fin: findHost(w, w.financeIp)!, soc: findHost(w, w.socIp)! };
}

function ownGateway(g: Game, ip: string) {
  g.exec(`sshbrute ${ip}`);
  settle(g);
  g.exec(`getroot ${ip}`);
  settle(g);
}

describe('breach engine', () => {
  it('nmap runs as a process, then fingerprints with -sV', () => {
    const { g, gw } = setup();
    g.exec(`nmap -sV ${gw.ip}`);
    expect(g.run.procs).toHaveLength(1);
    expect(gw.fingerprinted).toBe(false);
    settle(g);
    expect(gw.fingerprinted).toBe(true);
    expect(g.profile.index['port-scanning']).toBeDefined();
  });

  it('cannot target hosts that are not on the netmap', () => {
    const { g, fin } = setup();
    expect(text(g.exec(`nmap ${fin.ip}`))).toContain('unreachable');
  });

  it('enforces the RAM budget', () => {
    const { g, gw } = setup();
    expect(text(g.exec(`sshbrute ${gw.ip}`))).toContain('240 MB');
    expect(text(g.exec(`webscan ${gw.ip}`))).toContain('200 MB');
    expect(g.usedRam).toBe(440);
    g.exec(`connect ${gw.ip}`);
    g.exec('scan');
    expect(text(g.exec(`nmap ${g.world.financeIp}`))).toContain('60 MB');
    expect(text(g.exec(`nmap ${g.world.socIp}`))).toContain('not enough RAM');
    g.run.procs.splice(2);
    const pid = g.run.procs[0].pid;
    g.exec(`kill ${pid}`);
    expect(g.usedRam).toBe(200);
  });

  it('getroot needs the required ports, then grants root', () => {
    const { g, gw } = setup();
    expect(text(g.exec(`getroot ${gw.ip}`))).toContain('0/1 required ports');
    ownGateway(g, gw.ip);
    expect(gw.root).toBe(true);
    expect(gw.credsFound).toBe(true);
    expect(g.profile.index['ssh-credential-attacks']).toBeDefined();
    expect(g.profile.index['weak-default-creds']).toBeDefined();
    expect(g.profile.index['privilege-escalation']).toBeDefined();
  });

  it('firewall blocks crackers until bypassed through the trusted pivot', () => {
    const { g, gw, fin, soc } = setup();
    g.exec(`connect ${gw.ip}`);
    g.exec('scan');
    expect(text(g.exec(`sshbrute ${fin.ip}`))).toContain('dropped by firewall');
    expect(text(g.exec(`fwrules ${fin.ip}`))).toContain(`-s ${gw.ip}/32 -p tcp`);
    expect(text(g.exec(`fwbypass ${fin.ip} --src ${gw.ip}`))).toContain('need root on the pivot');

    ownGateway(g, soc.ip);
    const before = g.run.heat;
    expect(text(g.exec(`fwbypass ${fin.ip} --src ${soc.ip}`))).toContain('Dropped and logged');
    expect(g.run.heat).toBeGreaterThan(before);

    ownGateway(g, gw.ip);
    g.exec(`fwbypass ${fin.ip} --src ${gw.ip}`);
    settle(g);
    expect(fin.firewall!.bypassed).toBe(true);
    expect(text(g.exec(`sshbrute ${fin.ip}`))).toContain('sshbrute');
  });

  it('trace heat accumulates, survives dc, and only decays while idle', () => {
    const { g, gw } = setup();
    g.exec(`connect ${gw.ip}`);
    g.exec(`sshbrute ${gw.ip}`);
    settle(g);
    const hot = g.run.heat;
    expect(hot).toBeGreaterThan(8);
    g.exec('dc');
    expect(g.run.heat).toBe(hot);
    g.tick(5);
    expect(g.run.heat).toBeCloseTo(hot - 4, 5);
  });

  it('lingering on an alerted host keeps the trace rising', () => {
    const { g, gw } = setup();
    g.exec(`connect ${gw.ip}`);
    g.exec(`sshbrute ${gw.ip}`);
    settle(g);
    const h = g.run.heat;
    g.tick(10);
    expect(g.run.heat).toBeGreaterThan(h);
  });

  it('crossing 50% unlocks The Trace; 100% burns the run', () => {
    const { g, events } = setup();
    g.addHeat(55);
    expect(g.profile.index['the-trace']).toBeDefined();
    g.addHeat(30);
    expect(g.run.flagged).toBe(true);
    g.addHeat(30);
    expect(g.run.traced).toBe(true);
    expect(events.some((e) => e.type === 'traced')).toBe(true);
    expect(text(g.exec('ls'))).toContain('traced');
    const credits = g.profile.credits;
    g.startRun();
    expect(g.run.heat).toBe(0);
    expect(g.profile.credits).toBe(credits);
  });

  it('scrubbing logs on an owned box clears its alert once', () => {
    const { g, gw } = setup();
    ownGateway(g, gw.ip);
    g.exec(`connect ${gw.ip}`);
    g.run.heat = 40;
    expect(text(g.exec('rm /var/log/*'))).toContain('Logs scrubbed');
    expect(g.run.heat).toBe(28);
    expect(gw.alerted).toBe(false);
    expect(g.profile.index['covering-tracks']).toBeDefined();
  });

  it('remote files need root', () => {
    const { g, gw } = setup();
    g.exec(`connect ${gw.ip}`);
    expect(text(g.exec('ls'))).toContain('permission denied');
    expect(text(g.exec('scp /etc/motd'))).toContain('permission denied');
  });

  it('shop upgrades change tool behavior', () => {
    const { g, gw } = setup();
    g.profile.credits = 2000;
    g.exec('buy wordlist-plus');
    g.exec('buy mod-quiet');
    g.exec(`sshbrute ${gw.ip}`);
    const p = g.run.procs[0];
    expect(p.duration).toBeCloseTo(4.5);
    expect(p.heatPerSec).toBeCloseTo(0.4);
    g.exec('buy ftploot');
    expect(text(g.exec('ftploot ' + gw.ip))).toContain('not exposed');
    g.exec('buy ram-512');
    expect(g.maxRam).toBe(1024);
    expect(g.profile.credits).toBe(2000 - 250 - 350 - 300 - 400);
    expect(text(g.exec('buy ram-512'))).toContain('already own');
  });

  it('cannot buy without credits; shop tools are locked until bought', () => {
    const { g, gw } = setup();
    expect(text(g.exec('buy ftploot'))).toContain('costs 300');
    expect(text(g.exec(`ftploot ${gw.ip}`))).toContain('Buy it in the shop');
  });

  it('save data round-trips', () => {
    const { g, gw } = setup();
    ownGateway(g, gw.ip);
    const g2 = new Game(g.serialize());
    expect(findHost(g2.world, gw.ip)!.root).toBe(true);
    expect(g2.profile.index).toEqual(g.profile.index);
  });

  it('every tool links to a real Index entry (common tool interface)', async () => {
    const { INDEX_BY_ID } = await import('../src/engine/content/index-entries');
    const { g } = setup();
    for (const t of g.registry.all()) expect(INDEX_BY_ID[t.indexEntryId], t.id).toBeDefined();
  });
});

describe('log analysis evidence', () => {
  function onSocWithJobOpen() {
    const ctx = setup();
    const { g, soc } = ctx;
    soc.discovered = true;
    soc.root = true;
    soc.alerted = true;
    g.run.contracts = { c1: 'done', c2: 'done', c3: 'active' };
    g.exec(`connect ${soc.ip}`);
    expect(g.connectedHost).toBe(soc);
    return ctx;
  }

  it('a hot trace on the SOC box suggests disconnecting, not scrubbing the evidence', () => {
    const { g } = onSocWithJobOpen();
    g.run.heat = 80;
    expect(g.nextHint().cmd).toBe('dc');
  });

  it('rm keeps auth.log while the Log Analysis job is open, so the job stays solvable', () => {
    const { g, w } = onSocWithJobOpen();
    const out = text(g.exec('rm /var/log/*'));
    expect(out).toContain('kept /var/log/auth.log');
    expect(text(g.exec('grep Accepted /var/log/auth.log'))).toContain(w.attackerIp);
    g.exec(`submit c3 ${w.attackerIp}`);
    expect(g.run.contracts.c3).toBe('done');
    g.exec('rm /var/log/auth.log');
    expect(text(g.exec('ls /var/log'))).not.toContain('auth.log');
  });
});

describe('contracts: full guided playthrough', () => {
  it('following the hints completes all three jobs, gets paid and stays untraced', () => {
    const { g, w, events } = setup();
    let peak = 0;
    let guard = 0;
    while (g.run.contracts.c3 !== 'done' && guard++ < 100) {
      const h = g.nextHint();
      const cmd = h.cmd === 'grep Accepted /var/log/auth.log' ? `submit c3 ${w.attackerIp}` : h.cmd;
      if (cmd) g.exec(cmd);
      else g.tick(0.25);
      for (let t = 0; t < 60 && g.run.procs.length; t += 0.25) {
        g.tick(0.25);
        peak = Math.max(peak, g.run.heat);
      }
      // a human takes a few seconds to read and type between commands
      g.tick(2);
      peak = Math.max(peak, g.run.heat);
      expect(g.run.traced).toBe(false);
    }
    expect(Object.values(g.run.contracts)).toEqual(['done', 'done', 'done']);
    expect(g.profile.credits).toBe(350 + 900 + 600);
    expect(events.filter((e) => e.type === 'toast' && e.kind === 'money')).toHaveLength(3);
    expect(peak).toBeGreaterThan(50);
    expect(peak).toBeLessThan(80);
    expect(g.nextHint().cmd).toBe('jackout');
    g.exec('jackout');
    expect(g.profile.extracted).toBe(1);
    expect(g.profile.runs).toBe(2);
    expect(g.profile.credits).toBeGreaterThan(1850);
  });

  it('submitting the wrong answer costs heat and does not pay', () => {
    const { g } = setup();
    g.run.contracts.c3 = 'active';
    expect(text(g.exec('submit c3 1.2.3.4'))).toContain('Nope');
    expect(g.run.contracts.c3).toBe('active');
    expect(g.run.heat).toBe(3);
  });
});
