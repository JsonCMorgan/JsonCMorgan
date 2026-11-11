import { c, pad } from './ansi';
import type { GameEvent } from './events';
import { Host, openPortCount, World, WORDLIST_MINI } from './network';
import type { ParsedOpts } from './parser';
import { VFS } from './vfs';

/**
 * Everything a running tool may touch. Starter, shop and (later) Workshop
 * tools all go through this same surface, so the breach engine never needs
 * to know where a tool came from.
 */
export interface ToolContext {
  host: Host;
  world: World;
  opts: ParsedOpts;
  print(lines: string[]): void;
  emit(e: GameEvent): void;
  unlockIndex(id: string): void;
  addHeat(n: number): void;
  owns(itemId: string): boolean;
}

export type ToolOrigin = 'starter' | 'shop' | 'workshop';

export interface ToolDef {
  id: string;
  name: string;
  side: 'offense' | 'defense';
  category: 'recon' | 'cracker' | 'exploit' | 'firewall' | 'detect';
  origin: ToolOrigin;
  ramMb: number;
  durationSec: number;
  heatPerSec: number;
  targetPort?: number;
  indexEntryId: string;
  summary: string;
  usage: string;
  realWorld: string;
  /** Flags and owned upgrades can change speed and noise per launch. */
  tune?(ctx: ToolContext): { durationMul?: number; heatMul?: number; ramMul?: number };
  /** Returns an error message if the tool cannot launch. */
  precheck(ctx: ToolContext): string | null;
  complete(ctx: ToolContext): void;
}

function crackerPrecheck(ctx: ToolContext, port: number): string | null {
  const p = ctx.host.ports.find((x) => x.num === port);
  if (!p) return `${ctx.host.ip}: port ${port} is not exposed on this host (nmap it first)`;
  if (p.open) return `${ctx.host.ip}:${port} is already open`;
  if (ctx.host.firewall && !ctx.host.firewall.bypassed) {
    return `connection to ${ctx.host.ip}:${port} dropped by firewall. Read it with ${c.cyan(`fwrules ${ctx.host.ip}`)}`;
  }
  return null;
}

function openPort(ctx: ToolContext, port: number) {
  const p = ctx.host.ports.find((x) => x.num === port)!;
  p.open = true;
  ctx.host.alerted = true;
  ctx.emit({ type: 'fx', fx: 'portopen' });
  ctx.emit({ type: 'sound', sound: 'success' });
  const need = ctx.host.portsRequired - openPortCount(ctx.host);
  ctx.print([
    c.green(`  ▸ PORT ${port}/${p.service.toUpperCase()} OPEN on ${ctx.host.hostname}`) +
      (need > 0 ? c.dim(`  (${need} more required for getroot)`) : c.magenta('  ready for getroot')),
  ]);
}

function appendLog(host: Host, path: string, lines: string[]) {
  const fs = new VFS(host.fs);
  if (!fs.get(path)) return;
  fs.write(path, fs.read(path) + lines.join('\n') + '\n');
}

export const nmap: ToolDef = {
  id: 'nmap',
  name: 'nmap',
  side: 'offense',
  category: 'recon',
  origin: 'starter',
  ramMb: 60,
  durationSec: 2.5,
  heatPerSec: 1,
  indexEntryId: 'port-scanning',
  summary: 'Scan a host for open ports and service versions.',
  usage: 'nmap [-sV] [-T4] <host>',
  realWorld: 'nmap, the standard network mapper.',
  tune(ctx) {
    const fast = ctx.opts.flags.has('-T4') || ctx.opts.flags.has('-T5');
    return fast ? { durationMul: 0.45, heatMul: 2.5 } : {};
  },
  precheck: () => null,
  complete(ctx) {
    const h = ctx.host;
    const sv = ctx.opts.flags.has('-sV') || ctx.opts.flags.has('-A');
    h.scanned = true;
    if (sv) h.fingerprinted = true;
    const out = [
      c.dim(`Nmap scan report for ${h.hostname} (${h.ip})`),
      c.bold(pad('PORT', 11) + pad('STATE', 9) + pad('SERVICE', 9) + (sv ? 'VERSION' : '')),
    ];
    for (const p of h.ports) {
      out.push(
        pad(`${p.num}/${p.proto}`, 11) +
          pad(p.open ? c.green('open') : c.yellow('locked'), 9) +
          pad(p.service, 9) +
          (sv ? c.cyan(p.version) : ''),
      );
    }
    out.push(c.dim(`Ports required for getroot: ${h.portsRequired}`));
    if (h.firewall && !h.firewall.bypassed) out.push(c.red(`Firewall: ACTIVE (iptables)  →  fwrules ${h.ip}`));
    if (!sv) out.push(c.dim('Tip: add -sV to fingerprint versions.'));
    ctx.print(out);
    ctx.unlockIndex('port-scanning');
    ctx.emit({ type: 'sound', sound: 'blip' });
  },
};

export const sshbrute: ToolDef = {
  id: 'sshbrute',
  name: 'sshbrute',
  side: 'offense',
  category: 'cracker',
  origin: 'starter',
  ramMb: 240,
  durationSec: 9,
  heatPerSec: 0.8,
  targetPort: 22,
  indexEntryId: 'ssh-credential-attacks',
  summary: 'Dictionary attack against SSH (port 22).',
  usage: 'sshbrute [-w wordlist] <host>',
  realWorld: 'Hydra / Medusa style password guessing.',
  tune(ctx) {
    const wl = ctx.opts.values['-w'] ?? (ctx.owns('wordlist-plus') ? 'rockyou-plus.txt' : 'rockyou-mini.txt');
    const plus = wl.includes('plus') && ctx.owns('wordlist-plus');
    return {
      durationMul: plus ? 0.5 : 1,
      heatMul: ctx.owns('mod-quiet') ? 0.5 : 1,
    };
  },
  precheck(ctx) {
    const wl = ctx.opts.values['-w'];
    if (wl && !['rockyou-mini.txt', 'rockyou-plus.txt'].includes(wl)) return `${wl}: wordlist not found in ~/wordlists`;
    if (wl === 'rockyou-plus.txt' && !ctx.owns('wordlist-plus')) return 'rockyou-plus.txt: buy it in the shop first';
    return crackerPrecheck(ctx, 22);
  },
  complete(ctx) {
    const h = ctx.host;
    const { user, pass, isDefault } = h.account;
    const attempts = isDefault ? 1 : WORDLIST_MINI.indexOf(pass) + 1 || 14;
    appendLog(
      h,
      '/var/log/auth.log',
      Array.from({ length: Math.min(attempts, 8) }, () => `Nov 11 23:59:59 ${h.hostname} sshd[999]: Failed password for ${user} from 10.13.37.1 port 51337 ssh2`),
    );
    h.credsFound = true;
    ctx.print([
      c.dim(`[DATA] attacking ssh://${h.ip}:22/ (${attempts} tries)`),
      `[22][ssh] host: ${c.cyan(h.ip)}   login: ${c.yellow(user)}   password: ${c.yellow(pass)}` +
        (isDefault ? c.magenta('  << DEFAULT CREDENTIAL') : ''),
    ]);
    openPort(ctx, 22);
    ctx.unlockIndex('ssh-credential-attacks');
    if (isDefault) ctx.unlockIndex('weak-default-creds');
  },
};

export const webscan: ToolDef = {
  id: 'webscan',
  name: 'webscan',
  side: 'offense',
  category: 'exploit',
  origin: 'starter',
  ramMb: 200,
  durationSec: 7,
  heatPerSec: 0.7,
  targetPort: 80,
  indexEntryId: 'web-enumeration',
  summary: 'Enumerate a web server and exploit a known CVE (port 80).',
  usage: 'webscan <host>',
  realWorld: 'gobuster/ffuf directory brute force plus a known-CVE exploit.',
  precheck: (ctx) => crackerPrecheck(ctx, 80),
  complete(ctx) {
    const p = ctx.host.ports.find((x) => x.num === 80)!;
    const apache = p.version.includes('2.4.49');
    ctx.print([
      c.dim(`[webscan] ${p.version} on ${ctx.host.ip}:80`),
      `  /admin            ${c.yellow('403')}`,
      `  /server-status    ${c.green('200')}`,
      apache ? `  /cgi-bin/         ${c.yellow('403')}` : `  /.git/HEAD        ${c.green('200')}  ${c.magenta('repo exposed')}`,
      apache
        ? c.magenta('  ▸ CVE-2021-41773 path traversal matched. Exploit fired.')
        : c.magenta('  ▸ Leaked deploy key in /.git. Foothold gained.'),
    ]);
    openPort(ctx, 80);
    ctx.unlockIndex('web-enumeration');
  },
};

export const ftploot: ToolDef = {
  id: 'ftploot',
  name: 'ftploot',
  side: 'offense',
  category: 'cracker',
  origin: 'shop',
  ramMb: 120,
  durationSec: 4,
  heatPerSec: 0.3,
  targetPort: 21,
  indexEntryId: 'ftp-anonymous',
  summary: 'Anonymous FTP login and cleartext cred sniffing (port 21). Quiet.',
  usage: 'ftploot <host>',
  realWorld: 'ftp anonymous@host, plus sniffing cleartext FTP creds.',
  precheck: (ctx) => crackerPrecheck(ctx, 21),
  complete(ctx) {
    ctx.print([c.dim('[ftploot] 230 Login successful (anonymous)'), c.dim('[ftploot] pub/ is world-writable')]);
    openPort(ctx, 21);
    ctx.unlockIndex('ftp-anonymous');
  },
};

export const fwbypass: ToolDef = {
  id: 'fwbypass',
  name: 'fwbypass',
  side: 'offense',
  category: 'firewall',
  origin: 'starter',
  ramMb: 160,
  durationSec: 3.5,
  heatPerSec: 1.0,
  indexEntryId: 'firewall-rules',
  summary: 'Route your traffic through an owned host the firewall trusts.',
  usage: 'fwbypass <host> --src <ip-you-own>',
  realWorld: 'Pivoting through a trusted host (ssh -J, proxychains).',
  precheck(ctx) {
    const fw = ctx.host.firewall;
    if (!fw) return `${ctx.host.ip}: no firewall to bypass`;
    if (fw.bypassed) return `${ctx.host.ip}: firewall already bypassed`;
    const src = ctx.opts.values['--src'];
    if (!src) return `usage: fwbypass <host> --src <ip-you-own>   (read ${c.cyan(`fwrules ${ctx.host.ip}`)} to find the trusted source)`;
    const pivot = ctx.world.hosts.find((h) => h.ip === src || h.hostname === src);
    if (!pivot) return `${src}: unknown host`;
    if (!pivot.root && pivot.role !== 'home') return `${pivot.ip}: you need root on the pivot first (getroot ${pivot.ip})`;
    if (pivot.ip !== fw.allowSrc) {
      ctx.addHeat(6);
      ctx.emit({ type: 'sound', sound: 'error' });
      return `packets from ${pivot.ip} hit "-A INPUT -j LOG --log-prefix FW-DROP". Dropped and logged (+heat). Re-read the ACCEPT rules.`;
    }
    return null;
  },
  complete(ctx) {
    ctx.host.firewall!.bypassed = true;
    ctx.host.alerted = true;
    ctx.print([c.green(`  ▸ FIREWALL BYPASSED: ${ctx.host.hostname} now sees you as ${ctx.host.firewall!.allowSrc}`)]);
    ctx.emit({ type: 'fx', fx: 'firewall' });
    ctx.emit({ type: 'sound', sound: 'success' });
  },
};

export const getroot: ToolDef = {
  id: 'getroot',
  name: 'getroot',
  side: 'offense',
  category: 'exploit',
  origin: 'starter',
  ramMb: 280,
  durationSec: 5,
  heatPerSec: 1.2,
  indexEntryId: 'privilege-escalation',
  summary: 'Escalate to root once enough ports are open.',
  usage: 'getroot <host>',
  realWorld: 'Privilege escalation via SUID/sudo misconfig (GTFOBins).',
  precheck(ctx) {
    const h = ctx.host;
    if (h.root) return `${h.ip}: you already have root`;
    if (h.firewall && !h.firewall.bypassed) return `${h.ip}: firewall still active. fwrules ${h.ip}`;
    const open = openPortCount(h);
    if (open < h.portsRequired) return `${h.ip}: ${open}/${h.portsRequired} required ports open. Crack more first.`;
    return null;
  },
  complete(ctx) {
    ctx.host.root = true;
    ctx.host.alerted = true;
    ctx.print([
      c.dim('[getroot] sudo -l  →  (root) NOPASSWD: /usr/bin/find'),
      c.dim("[getroot] find . -exec /bin/sh -p \\; -quit"),
      c.magenta(c.bold(`  ▸ ROOT ACCESS GRANTED: ${ctx.host.hostname} (${ctx.host.ip})`)),
      c.dim(`  connect ${ctx.host.ip} to browse its files`),
    ]);
    ctx.emit({ type: 'fx', fx: 'granted' });
    ctx.emit({ type: 'sound', sound: 'granted' });
    ctx.unlockIndex('privilege-escalation');
  },
};

/** One registry for every tool, whatever its origin. Workshop tools will register here too. */
export class ToolRegistry {
  private tools = new Map<string, ToolDef>();
  register(t: ToolDef) {
    this.tools.set(t.id, t);
  }
  get(id: string) {
    return this.tools.get(id);
  }
  all(): ToolDef[] {
    return [...this.tools.values()];
  }
}

export function defaultRegistry(): ToolRegistry {
  const r = new ToolRegistry();
  [nmap, sshbrute, webscan, ftploot, fwbypass, getroot].forEach((t) => r.register(t));
  return r;
}
