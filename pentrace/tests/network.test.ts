import { describe, expect, it } from 'vitest';
import { findHost, generateWorld, HOME_IP, scanLinks } from '../src/engine/network';
import { resolvePath, VFS } from '../src/engine/vfs';

describe('generateWorld', () => {
  it('is deterministic for a seed', () => {
    expect(JSON.stringify(generateWorld(42))).toBe(JSON.stringify(generateWorld(42)));
  });

  it('varies between seeds', () => {
    const ips = new Set([1, 2, 3, 4, 5, 6].map((s) => generateWorld(s).financeIp + generateWorld(s).attackerIp));
    expect(ips.size).toBeGreaterThan(1);
  });

  it('builds home plus three Kestrel-style hosts on one subnet', () => {
    const w = generateWorld(7);
    expect(w.hosts.map((h) => h.role)).toEqual(['home', 'gateway', 'soc', 'finance']);
    const subnet = (ip: string) => ip.split('.').slice(0, 3).join('.');
    expect(new Set([w.gatewayIp, w.socIp, w.financeIp].map(subnet)).size).toBe(1);
    expect(findHost(w, HOME_IP)?.root).toBe(true);
  });

  it('only shows the gateway at the start; scanning it reveals the rest', () => {
    const w = generateWorld(9);
    expect(w.hosts.filter((h) => h.discovered).map((h) => h.role)).toEqual(['home', 'gateway']);
    const found = scanLinks(w, findHost(w, w.gatewayIp)!);
    expect(found.map((h) => h.role).sort()).toEqual(['finance', 'soc']);
    expect(scanLinks(w, findHost(w, w.gatewayIp)!)).toEqual([]);
  });

  it('firewalls the finance box to trust only the gateway', () => {
    const w = generateWorld(11);
    const fin = findHost(w, w.financeIp)!;
    expect(fin.firewall?.allowSrc).toBe(w.gatewayIp);
    expect(fin.firewall?.rules.some((r) => r.includes(`-s ${w.gatewayIp}/32 -p tcp`))).toBe(true);
  });

  it('plants the attacker IP in the SOC auth log after a brute force', () => {
    const w = generateWorld(13);
    const log = new VFS(findHost(w, w.socIp)!.fs).read('/var/log/auth.log');
    const accepted = log.split('\n').filter((l) => l.includes('Accepted password'));
    expect(accepted).toHaveLength(1);
    expect(accepted[0]).toContain(w.attackerIp);
    expect(log.split('\n').filter((l) => l.includes(`Failed password`) && l.includes(w.attackerIp)).length).toBeGreaterThan(10);
  });

  it('finds hosts by hostname too', () => {
    const w = generateWorld(3);
    expect(findHost(w, `${w.orgSlug}-gw`)?.ip).toBe(w.gatewayIp);
  });
});

describe('VFS', () => {
  it('resolves relative paths, .. and ~', () => {
    expect(resolvePath('/var/log', '../www')).toBe('/var/www');
    expect(resolvePath('/', '~/downloads')).toBe('/home/ghost/downloads');
    expect(resolvePath('/a/b', '/c/./d')).toBe('/c/d');
  });

  it('reads, writes, moves, removes and globs', () => {
    const fs = new VFS();
    fs.mkdirp('/var/log');
    fs.write('/var/log/auth.log', 'x');
    fs.write('/var/log/syslog', 'y');
    expect(fs.glob('/var/log/*')).toEqual(['/var/log/auth.log', '/var/log/syslog']);
    fs.mkdirp('/tmp');
    fs.move('/var/log/syslog', '/tmp');
    expect(fs.read('/tmp/syslog')).toBe('y');
    fs.remove('/var/log/auth.log');
    expect(fs.list('/var/log')).toEqual([]);
    expect(() => fs.read('/nope')).toThrow();
  });
});
