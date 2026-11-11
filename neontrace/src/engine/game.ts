import { c, pad, stripAnsi } from './ansi';
import { CONTRACT_BY_ID, CONTRACTS, ContractId } from './content/contracts';
import { INDEX_BY_ID, INDEX_ENTRIES } from './content/index-entries';
import { SHOP_BY_ID, SHOP_ITEMS } from './content/shop';
import type { GameEvent } from './events';
import { findHost, generateWorld, Host, openPortCount, scanLinks, World } from './network';
import { parseLine, parseOpts, ParseError } from './parser';
import { defaultRegistry, ToolContext, ToolDef, ToolRegistry } from './tools';
import { FsError, resolvePath, VFS } from './vfs';

export const BASE_RAM = 512;
export const HEAT_DECAY_PER_SEC = 0.8;
export const SAVE_VERSION = 1;

export interface Proc {
  pid: number;
  toolId: string;
  target: string;
  args: string[];
  elapsed: number;
  duration: number;
  ram: number;
  heatPerSec: number;
}

export interface Mail {
  from: string;
  subject: string;
  body: string[];
  read: boolean;
}

export type ContractStatus = 'locked' | 'active' | 'done';

export interface Profile {
  version: number;
  credits: number;
  totalEarned: number;
  owned: string[];
  index: Record<string, { unlockedAt: number; read: boolean }>;
  runs: number;
  traced: number;
  extracted: number;
  nextSeed: number;
  sound: boolean;
}

export interface RunState {
  world: World;
  connected: string | null;
  cwd: string;
  homeCwd: string;
  heat: number;
  flagged: boolean;
  passed50: boolean;
  contracts: Record<ContractId, ContractStatus>;
  procs: Proc[];
  nextPid: number;
  earned: number;
  mails: Mail[];
  traced: boolean;
  elapsed: number;
}

export interface SaveData {
  profile: Profile;
  run: RunState;
}

type Cmd = (args: string[], stdin: string[] | null) => string[];

class CmdError extends Error {}

const err = (msg: string): never => {
  throw new CmdError(msg);
};

export function newProfile(seed: number): Profile {
  return {
    version: SAVE_VERSION,
    credits: 0,
    totalEarned: 0,
    owned: [],
    index: {},
    runs: 0,
    traced: 0,
    extracted: 0,
    nextSeed: seed,
    sound: true,
  };
}

export class Game {
  profile: Profile;
  run!: RunState;
  registry: ToolRegistry;
  private listeners: ((e: GameEvent) => void)[] = [];
  private commands: Record<string, Cmd>;

  constructor(save?: SaveData | null, seed = Date.now() % 1_000_000) {
    this.registry = defaultRegistry();
    this.commands = this.buildCommands();
    if (save && save.profile?.version === SAVE_VERSION && save.run?.world) {
      this.profile = save.profile;
      this.run = save.run;
      this.run.procs = [];
    } else {
      this.profile = newProfile(seed);
      this.startRun();
    }
  }

  // ---------------------------------------------------------------- events
  on(fn: (e: GameEvent) => void) {
    this.listeners.push(fn);
    return () => (this.listeners = this.listeners.filter((l) => l !== fn));
  }
  emit(e: GameEvent) {
    for (const l of this.listeners) l(e);
  }
  private print(lines: string[]) {
    this.emit({ type: 'print', lines });
  }

  serialize(): SaveData {
    return JSON.parse(JSON.stringify({ profile: this.profile, run: { ...this.run, procs: [] } }));
  }

  // ---------------------------------------------------------------- run lifecycle
  startRun() {
    const seed = this.profile.nextSeed;
    this.profile.nextSeed = (seed * 48271 + 11) % 2147483647;
    this.profile.runs += 1;
    const world = generateWorld(seed);
    this.run = {
      world,
      connected: null,
      cwd: '/',
      homeCwd: '/home/ghost',
      heat: 0,
      flagged: false,
      passed50: false,
      contracts: { c1: 'active', c2: 'locked', c3: 'locked' },
      procs: [],
      nextPid: 1337,
      earned: 0,
      mails: [],
      traced: false,
      elapsed: 0,
    };
    const first = this.profile.runs === 1;
    this.addMail('Vex', first ? 'Welcome to the grid, Ghost' : `Op #${this.profile.runs}: new target`, [
      first
        ? 'Ghost. Vex here. I broker contracts, you breach networks, we both get paid.'
        : `Back on the grid. Your kit and credits carried over. New target: ${world.org}.`,
      'Your rig RAM is limited, and every noisy move raises the TRACE meter.',
      'Hit 100% and your identity burns: the op ends, but you keep banked credits and tools.',
      'Stuck? Type hint. Reference? Type index. Jobs? Type jobs.',
    ]);
    this.mailContract('c1');
    this.emit({ type: 'newRun' });
  }

  private addMail(from: string, subject: string, body: string[]) {
    this.run.mails.push({ from, subject, body, read: false });
  }
  private mailContract(id: ContractId) {
    const m = CONTRACT_BY_ID[id].mail(this.run.world);
    this.addMail('Vex', m.subject, m.body);
  }

  get world(): World {
    return this.run.world;
  }
  get home(): Host {
    return findHost(this.world, this.world.homeIp)!;
  }
  get connectedHost(): Host | null {
    return this.run.connected ? findHost(this.world, this.run.connected) ?? null : null;
  }
  get maxRam(): number {
    return BASE_RAM + (this.owns('ram-512') ? 512 : 0);
  }
  get usedRam(): number {
    return this.run.procs.reduce((s, p) => s + p.ram, 0);
  }
  owns(id: string): boolean {
    return this.profile.owned.includes(id);
  }
  toolAvailable(t: ToolDef): boolean {
    return t.origin !== 'shop' || this.owns(t.id);
  }

  // ---------------------------------------------------------------- heat
  addHeat(n: number) {
    if (this.run.traced) return;
    const mul = this.run.flagged && n > 0 ? 1.5 : 1;
    this.run.heat = Math.max(0, Math.min(100, this.run.heat + n * mul));
    if (!this.run.passed50 && this.run.heat >= 50) {
      this.run.passed50 = true;
      this.emit({ type: 'toast', kind: 'warn', title: 'TRACE 50%', body: 'A SOC analyst is correlating your activity.' });
      this.emit({ type: 'sound', sound: 'alarm' });
      this.unlockIndex('the-trace');
    }
    if (!this.run.flagged && this.run.heat >= 75) {
      this.run.flagged = true;
      this.emit({ type: 'toast', kind: 'danger', title: 'SOURCE FLAGGED', body: 'Your IP is on a blocklist. Heat now builds 50% faster. Lie low.' });
      this.emit({ type: 'fx', fx: 'shake' });
      this.emit({ type: 'sound', sound: 'alarm' });
    }
    if (this.run.heat >= 100) this.traced();
  }

  private traced() {
    this.run.traced = true;
    this.run.procs = [];
    this.profile.traced += 1;
    this.emit({ type: 'sound', sound: 'alarm' });
    this.emit({ type: 'traced' });
  }

  tick(dt: number) {
    if (this.run.traced) return;
    this.run.elapsed += dt;
    const done: Proc[] = [];
    let heat = 0;
    for (const p of this.run.procs) {
      const step = Math.min(dt, p.duration - p.elapsed);
      p.elapsed += dt;
      heat += p.heatPerSec * Math.max(0, step);
      if (p.elapsed >= p.duration) done.push(p);
    }
    const ch = this.connectedHost;
    const lingering = ch && ch.alerted && ch.role !== 'home';
    if (lingering) heat += ch.security * dt;
    if (heat > 0) this.addHeat(heat);
    else if (!this.run.procs.length && !lingering) this.run.heat = Math.max(0, this.run.heat - HEAT_DECAY_PER_SEC * dt);
    if (this.run.traced) return;
    for (const p of done) {
      this.run.procs = this.run.procs.filter((x) => x !== p);
      const tool = this.registry.get(p.toolId)!;
      const host = findHost(this.world, p.target)!;
      tool.complete(this.toolCtx(host, p.args));
      this.checkContracts();
    }
  }

  // ---------------------------------------------------------------- index / money
  unlockIndex(id: string) {
    if (this.profile.index[id] || !INDEX_BY_ID[id]) return;
    this.profile.index[id] = { unlockedAt: Date.now(), read: false };
    const e = INDEX_BY_ID[id];
    this.emit({ type: 'toast', kind: 'index', title: 'NEW INDEX ENTRY', body: e.title });
    this.emit({ type: 'sound', sound: 'unlock' });
    this.print([c.magenta(`  ◆ INDEX UNLOCKED: ${e.title}`) + c.dim(`   (index ${id})`)]);
  }

  pay(amount: number, why: string) {
    this.profile.credits += amount;
    this.profile.totalEarned += amount;
    this.run.earned += amount;
    this.emit({ type: 'toast', kind: 'money', title: `+${amount} ¢`, body: why });
    this.emit({ type: 'fx', fx: 'paid' });
    this.emit({ type: 'sound', sound: 'cash' });
  }

  private completeContract(id: ContractId) {
    if (this.run.contracts[id] !== 'active') return;
    const def = CONTRACT_BY_ID[id];
    this.run.contracts[id] = 'done';
    this.print([c.green(c.bold(`  ✔ CONTRACT COMPLETE: ${def.title}`)) + c.yellow(`  +${def.payout} ¢`)]);
    this.pay(def.payout, `Contract: ${def.title}`);
    this.unlockIndex(def.indexEntryId);
    const order: ContractId[] = ['c1', 'c2', 'c3'];
    const next = order[order.indexOf(id) + 1];
    if (next && this.run.contracts[next] === 'locked') {
      this.run.contracts[next] = 'active';
      this.mailContract(next);
      this.print([c.cyan(`  ✉ New mail from Vex. Type mail to read the next job.`)]);
    } else if (!next) {
      this.addMail('Vex', 'All jobs done. Extract.', [
        'Clean work. The board is clear.',
        'Type jackout to extract. Lower trace at extraction means a bigger stealth bonus.',
      ]);
      this.print([c.cyan('  ✉ Board clear. Type jackout to extract with a stealth bonus.')]);
    }
  }

  checkContracts() {
    const r = this.run;
    if (r.contracts.c1 === 'active' && this.world.hosts.filter((h) => h.role !== 'home').every((h) => h.fingerprinted)) {
      this.completeContract('c1');
    }
    if (r.contracts.c2 === 'active' && new VFS(this.home.fs).get('/home/ghost/downloads/payroll.db')) {
      this.completeContract('c2');
    }
  }

  // ---------------------------------------------------------------- tools
  private toolCtx(host: Host, args: string[]): ToolContext {
    return {
      host,
      world: this.world,
      opts: parseOpts(args, { withValue: ['-w', '--src', '-p', '-u'] }),
      print: (l) => this.print(l),
      emit: (e) => this.emit(e),
      unlockIndex: (id) => this.unlockIndex(id),
      addHeat: (n) => this.addHeat(n),
      owns: (id) => this.owns(id),
    };
  }

  launchTool(toolId: string, args: string[]): string[] {
    const tool = this.registry.get(toolId);
    if (!tool) err(`${toolId}: command not found`);
    if (!this.toolAvailable(tool!)) err(`${toolId}: not installed. Buy it in the shop.`);
    const t = tool!;
    const opts = parseOpts(args, { withValue: ['-w', '--src', '-p', '-u'] });
    const ref = opts.positional[0] ?? this.run.connected;
    if (!ref) err(`usage: ${t.usage}`);
    const host = findHost(this.world, ref!);
    if (!host || (!host.discovered && host.role !== 'home')) err(`${ref}: host unreachable (not on your netmap yet)`);
    if (host!.role === 'home') err('targeting your own rig is a bad idea, choom');
    const ctx = this.toolCtx(host!, args);
    const problem = t.precheck(ctx);
    if (problem) {
      this.emit({ type: 'sound', sound: 'error' });
      err(`${t.id}: ${problem}`);
    }
    if (this.run.procs.some((p) => p.toolId === t.id && p.target === host!.ip)) err(`${t.id} is already running against ${host!.ip}`);
    const tune = t.tune?.(ctx) ?? {};
    const ram = Math.round(t.ramMb * (tune.ramMul ?? 1));
    const free = this.maxRam - this.usedRam;
    if (ram > free) {
      this.emit({ type: 'sound', sound: 'error' });
      err(`${t.id}: not enough RAM (needs ${ram} MB, ${free} MB free). Wait for a process to finish or kill one.`);
    }
    const proc: Proc = {
      pid: this.run.nextPid++,
      toolId: t.id,
      target: host!.ip,
      args,
      elapsed: 0,
      duration: t.durationSec * (tune.durationMul ?? 1),
      ram,
      heatPerSec: t.heatPerSec * (tune.heatMul ?? 1),
    };
    this.run.procs.push(proc);
    if (t.category !== 'recon') host!.alerted = true;
    this.emit({ type: 'sound', sound: 'blip' });
    return [c.dim(`[${proc.pid}] ${t.id} → ${host!.hostname} (${host!.ip})  ${ram} MB  ~${proc.duration.toFixed(1)}s`)];
  }

  // ---------------------------------------------------------------- command execution
  exec(line: string): string[] {
    if (this.run.traced) return [c.red('Connection severed. You have been traced.')];
    let pipeline;
    try {
      pipeline = parseLine(line.trim());
    } catch (e) {
      return [c.red(`neosh: ${(e as ParseError).message}`)];
    }
    if (!pipeline.length) return [];
    let stdin: string[] | null = null;
    let out: string[] = [];
    try {
      for (let i = 0; i < pipeline.length; i++) {
        const { name, args } = pipeline[i];
        const cmd = this.commands[name];
        if (cmd) out = cmd(args, stdin);
        else if (this.registry.get(name)) out = this.launchTool(name, args);
        else err(`${name}: command not found. Try help.`);
        if (i < pipeline.length - 1) stdin = out.map(stripAnsi);
      }
    } catch (e) {
      if (e instanceof CmdError || e instanceof FsError) {
        this.emit({ type: 'sound', sound: 'error' });
        return [c.red(e.message)];
      }
      throw e;
    }
    this.checkContracts();
    return out;
  }

  prompt(): string {
    const h = this.connectedHost ?? this.home;
    const cwd = h.role === 'home' ? this.run.homeCwd.replace(/^\/home\/ghost/, '~') : this.run.cwd;
    const user = h.role === 'home' ? 'ghost' : h.root ? 'root' : 'guest';
    return `${c.magenta(user + '@' + h.hostname)}${c.dim(':')}${c.cyan(cwd)}${c.dim(h.root && h.role !== 'home' ? '# ' : '$ ')}`;
  }

  /** Filesystem of the current host. Remote boxes need root. */
  private fsCtx(): { vfs: VFS; cwd: string; host: Host; setCwd: (p: string) => void } {
    const host = this.connectedHost ?? this.home;
    if (host.role !== 'home' && !host.root) err(`permission denied: you are a guest on ${host.hostname}. Breach it and getroot first.`);
    const remote = host.role !== 'home';
    return {
      vfs: new VFS(host.fs),
      host,
      cwd: remote ? this.run.cwd : this.run.homeCwd,
      setCwd: (p) => (remote ? (this.run.cwd = p) : (this.run.homeCwd = p)),
    };
  }

  completions(partial: string): string[] {
    const words = partial.split(/\s+/);
    if (words.length <= 1) {
      const names = [...Object.keys(this.commands), ...this.registry.all().filter((t) => this.toolAvailable(t)).map((t) => t.id)];
      return [...new Set(names)].filter((n) => n.startsWith(words[0])).sort();
    }
    const last = words[words.length - 1];
    const cmd = words[0];
    const hostCmds = ['connect', 'fwrules', 'nmap', 'sshbrute', 'webscan', 'ftploot', 'getroot', 'fwbypass'];
    if (hostCmds.includes(cmd) || last.match(/^\d/)) {
      return this.world.hosts.filter((h) => h.discovered && h.role !== 'home').map((h) => h.ip).filter((ip) => ip.startsWith(last));
    }
    if (cmd === 'buy') return SHOP_ITEMS.map((i) => i.id).filter((i) => i.startsWith(last));
    if (cmd === 'index') return Object.keys(this.profile.index).filter((i) => i.startsWith(last));
    if (cmd === 'man') return this.registry.all().map((t) => t.id).filter((i) => i.startsWith(last));
    try {
      const { vfs, cwd } = this.fsCtx();
      const slash = last.lastIndexOf('/');
      const dirPart = slash >= 0 ? last.slice(0, slash + 1) : '';
      const base = resolvePath(cwd, dirPart || '.');
      const node = vfs.get(base);
      if (!node || node.type !== 'dir') return [];
      return Object.entries(node.children)
        .filter(([n]) => n.startsWith(last.slice(slash + 1)))
        .map(([n, v]) => dirPart + n + (v.type === 'dir' ? '/' : ''));
    } catch {
      return [];
    }
  }

  // ---------------------------------------------------------------- hint system
  nextHint(): { text: string; cmd?: string } {
    const w = this.world;
    const r = this.run;
    const gw = findHost(w, w.gatewayIp)!;
    const soc = findHost(w, w.socIp)!;
    const fin = findHost(w, w.financeIp)!;
    const at = this.connectedHost;
    const running = (tool: string, ip: string) => r.procs.some((p) => p.toolId === tool && p.target === ip);
    if (r.traced) return { text: 'You were traced. Press ENTER to start a new op.' };
    if (r.heat > 65) {
      if (at && at.root && at.alerted && !at.cleaned) return { text: 'Trace is hot. Scrub this box\'s logs to clear its alert.', cmd: 'rm /var/log/*' };
      if (at?.alerted) return { text: 'Trace is hot. Disconnect so the SOC loses your session.', cmd: 'dc' };
      if (!r.procs.length && r.heat > 50) return { text: 'Lie low. The trace cools while you stay idle and offline.' };
    }
    if (r.mails.length && !r.mails[0].read) return { text: 'You have mail from Vex, your fixer. Read it.', cmd: 'mail' };
    if (r.procs.length) return { text: `Processes running. Watch the RAM panel. You can queue another tool if RAM allows.` };

    const breach = (h: Host): { text: string; cmd?: string } | null => {
      if (h.root) return null;
      if (h.firewall && !h.firewall.bypassed) {
        if (!h.firewall.seen) return { text: `${h.hostname} is firewalled. Read its rules.`, cmd: `fwrules ${h.ip}` };
        if (!gw.root) return breach(gw);
        return { text: 'The ACCEPT rule trusts one TCP source. You own it. Pivot.', cmd: `fwbypass ${h.ip} --src ${gw.ip}` };
      }
      const open = openPortCount(h);
      if (open < h.portsRequired) {
        const p = h.ports.find((x) => !x.open && x.crackedBy && this.toolAvailable(this.registry.get(x.crackedBy)!) && !running(x.crackedBy, h.ip));
        if (p) return { text: `Crack port ${p.num} (${p.service}). Need ${h.portsRequired - open} more open.`, cmd: `${p.crackedBy} ${h.ip}` };
        return { text: 'Wait for your crackers to finish.' };
      }
      return { text: `Enough ports open. Escalate to root.`, cmd: `getroot ${h.ip}` };
    };

    if (r.contracts.c1 === 'active') {
      if (!gw.fingerprinted) return { text: 'Fingerprint the gateway with a version scan.', cmd: `nmap -sV ${gw.ip}` };
      if (!soc.discovered || !fin.discovered) {
        if (at !== gw) return { text: 'Connect to the gateway so you can scan its links.', cmd: `connect ${gw.ip}` };
        return { text: 'Reveal hosts linked to this gateway.', cmd: 'scan' };
      }
      const next = [soc, fin].find((h) => !h.fingerprinted)!;
      return { text: `Fingerprint ${next.hostname}.`, cmd: `nmap -sV ${next.ip}` };
    }
    if (r.contracts.c2 === 'active') {
      const b = breach(fin);
      if (b) return b;
      if (at !== fin) return { text: 'You own the finance box. Connect to it.', cmd: `connect ${fin.ip}` };
      return { text: 'Exfiltrate the payroll database to your rig.', cmd: 'scp /srv/finance/payroll.db' };
    }
    if (r.contracts.c3 === 'active') {
      const b = breach(soc);
      if (b) return b;
      if (at !== soc) return { text: 'Connect to the SOC collector.', cmd: `connect ${soc.ip}` };
      return { text: 'Find successful logins. The outside IP among them is your answer: submit c3 <ip>', cmd: 'grep Accepted /var/log/auth.log' };
    }
    return { text: 'Board clear. Extract for a stealth bonus.', cmd: 'jackout' };
  }

  // ---------------------------------------------------------------- commands
  private buildCommands(): Record<string, Cmd> {
    const cmds: Record<string, Cmd> = {
      help: () => [
        c.bold(c.cyan('NEONTRACE // command reference')),
        c.magenta(' FILES   ') + 'ls  cd  pwd  cat  rm  mv  grep  head  tail  sort  uniq  wc',
        c.magenta(' NET     ') + 'connect <host>  dc  scan  scp <path>',
        c.magenta(' BREACH  ') + 'nmap  fwrules  fwbypass  sshbrute  webscan  getroot  ps  kill',
        c.magenta(' JOBS    ') + 'mail  jobs  submit <job> <answer>  jackout',
        c.magenta(' RIG     ') + 'shop  buy <item>  index [entry]  tools  man <tool>  workshop  status',
        c.magenta(' HELP    ') + `hint  clear   ${c.dim('(TAB completes, ↑↓ history, pipes with |)')}`,
      ],
      hint: () => {
        const h = this.nextHint();
        return [c.yellow('► ') + h.text + (h.cmd ? '   ' + c.cyan(h.cmd) : '')];
      },
      clear: () => {
        this.emit({ type: 'clear' });
        return [];
      },
      whoami: () => [this.connectedHost?.root ? 'root' : this.connectedHost ? 'guest' : 'ghost'],
      hostname: () => [(this.connectedHost ?? this.home).hostname],
      pwd: () => [this.fsCtx().cwd],
      echo: (args) => [args.join(' ')],
      ls: (args) => {
        const { vfs, cwd } = this.fsCtx();
        const targets = args.filter((a) => !a.startsWith('-'));
        const path = resolvePath(cwd, targets[0] ?? '.');
        const node = vfs.get(path);
        if (!node) err(`ls: cannot access '${targets[0]}': No such file or directory`);
        if (node!.type === 'file') return [targets[0]];
        const names = vfs.list(path);
        if (!names.length) return [];
        return [
          names
            .map((n) => {
              const child = (node as { children: Record<string, { type: string }> }).children[n];
              return child.type === 'dir' ? c.blue(c.bold(n + '/')) : n;
            })
            .join('  '),
        ];
      },
      cd: (args) => {
        const ctx = this.fsCtx();
        const fallback = ctx.host.role === 'home' ? '/home/ghost' : '/';
        const path = resolvePath(ctx.cwd, args[0] ?? fallback);
        const node = ctx.vfs.get(path);
        if (!node) err(`cd: ${args[0]}: No such file or directory`);
        if (node!.type !== 'dir') err(`cd: ${args[0]}: Not a directory`);
        ctx.setCwd(path);
        return [];
      },
      cat: (args, stdin) => {
        if (!args.length) return stdin ?? [];
        const { vfs, cwd } = this.fsCtx();
        const out: string[] = [];
        for (const a of args) {
          const text = vfs.read(resolvePath(cwd, a)).replace(/\n$/, '');
          if (text) out.push(...text.split('\n'));
        }
        return out;
      },
      grep: (args, stdin) => {
        const o = parseOpts(args);
        const [pattern, ...files] = o.positional;
        if (pattern === undefined) err('usage: grep [-i] [-v] [-c] [-n] PATTERN [FILE...]');
        const flags = o.flags;
        const ci = flags.has('-i');
        let re: RegExp;
        try {
          re = new RegExp(pattern!, ci ? 'i' : '');
        } catch {
          re = new RegExp(pattern!.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), ci ? 'i' : '');
        }
        let lines: { text: string; file?: string }[] = [];
        if (files.length) {
          const { vfs, cwd } = this.fsCtx();
          for (const f of files) {
            for (const p of vfs.glob(resolvePath(cwd, f))) {
              const text = vfs.read(p);
              lines.push(...text.replace(/\n$/, '').split('\n').map((t) => ({ text: t, file: files.length > 1 ? f : undefined })));
              if (p.includes('/var/log/') && text.includes('sshd[')) this.unlockIndex('log-analysis');
            }
          }
        } else if (stdin) {
          lines = stdin.map((t) => ({ text: t }));
          if (stdin.some((l) => l.includes('sshd['))) this.unlockIndex('log-analysis');
        } else err('grep: no input (give a file or pipe into grep)');
        const hits = lines.map((l, i) => ({ ...l, n: i + 1 })).filter((l) => re.test(l.text) !== flags.has('-v'));
        if (flags.has('-c')) return [String(hits.length)];
        return hits.map((l) => {
          const body = flags.has('-v') ? l.text : l.text.replace(new RegExp(re.source, ci ? 'gi' : 'g'), (m) => c.red(c.bold(m)));
          return (l.file ? c.magenta(l.file + ':') : '') + (flags.has('-n') ? c.green(l.n + ':') : '') + body;
        });
      },
      head: (args, stdin) => this.headTail(args, stdin, 'head'),
      tail: (args, stdin) => this.headTail(args, stdin, 'tail'),
      sort: (args, stdin) => {
        const src = stdin ?? this.commands.cat(args.filter((a) => !a.startsWith('-')), null).map(stripAnsi);
        const sorted = [...src].sort((a, b) => (args.includes('-n') ? parseFloat(a) - parseFloat(b) : a.localeCompare(b)));
        return args.includes('-r') ? sorted.reverse() : sorted;
      },
      uniq: (args, stdin) => {
        const src = stdin ?? [];
        const out: { line: string; n: number }[] = [];
        for (const l of src) {
          const last = out[out.length - 1];
          if (last && last.line === l) last.n++;
          else out.push({ line: l, n: 1 });
        }
        return out.map((o) => (args.includes('-c') ? `${String(o.n).padStart(7)} ${o.line}` : o.line));
      },
      wc: (args, stdin) => {
        const src = stdin ?? this.commands.cat(args.filter((a) => !a.startsWith('-')), null);
        return [String(src.length)];
      },
      rm: (args) => {
        const { vfs, cwd, host } = this.fsCtx();
        const targets = args.filter((a) => !a.startsWith('-'));
        if (!targets.length) err('usage: rm FILE...');
        const out: string[] = [];
        for (const t of targets) {
          const paths = vfs.glob(resolvePath(cwd, t));
          if (!paths.length) err(`rm: cannot remove '${t}': No such file or directory`);
          for (const p of paths) {
            vfs.remove(p);
            if (host.role !== 'home' && p.startsWith('/var/log/')) {
              this.unlockIndex('covering-tracks');
              if (!host.cleaned) {
                host.cleaned = true;
                host.alerted = false;
                this.run.heat = Math.max(0, this.run.heat - 12);
                out.push(c.green(`  ▸ Logs scrubbed on ${host.hostname}. Alert cleared, trace -12%.`) + c.dim(' (A real SIEM already has a copy.)'));
              }
            }
          }
        }
        return out;
      },
      mv: (args) => {
        const { vfs, cwd } = this.fsCtx();
        if (args.length !== 2) err('usage: mv SOURCE DEST');
        vfs.move(resolvePath(cwd, args[0]), resolvePath(cwd, args[1]));
        return [];
      },
      scan: () => {
        const at = this.connectedHost;
        if (!at) err(`scan: connect to a host first (try connect ${this.world.gatewayIp})`);
        this.addHeat(1);
        const found = scanLinks(this.world, at!);
        const lines = [c.dim(`Scanning links from ${at!.hostname}...`)];
        for (const ip of at!.links) {
          const h = findHost(this.world, ip)!;
          const isNew = found.includes(h);
          lines.push(`  ${pad(c.cyan(h.ip), 14)} ${pad(h.hostname, 18)} ${isNew ? c.green('NEW') : c.dim('known')}`);
        }
        if (found.length) this.emit({ type: 'sound', sound: 'success' });
        return lines;
      },
      connect: (args) => {
        if (!args[0]) err('usage: connect <host>');
        const h = findHost(this.world, args[0]);
        if (!h || !h.discovered) err(`connect: ${args[0]}: host unreachable (not on your netmap)`);
        if (h!.role === 'home') return this.commands.dc([], null);
        this.run.connected = h!.ip;
        this.run.cwd = '/';
        this.emit({ type: 'sound', sound: 'blip' });
        const motd = new VFS(h!.fs).get('/etc/motd');
        return [
          c.dim(`Connected to ${h!.hostname} (${h!.ip})`) + (h!.root ? c.magenta('  [ROOT]') : c.yellow('  [guest: getroot to browse files]')),
          ...(motd && motd.type === 'file' ? [c.dim(motd.content.trim())] : []),
        ];
      },
      dc: () => {
        if (!this.run.connected) return [c.dim('Already home.')];
        const h = this.connectedHost!;
        this.run.connected = null;
        return [c.dim(`Disconnected from ${h.hostname}.`) + (this.run.heat > 0 ? c.dim(' Trace does not reset, but it cools while you lie low.') : '')];
      },
      disconnect: (a, s) => this.commands.dc(a, s),
      scp: (args) => {
        const at = this.connectedHost;
        if (!at) err('scp: connect to a remote host first');
        if (!at!.root) err(`scp: permission denied on ${at!.hostname}. getroot first.`);
        if (!args[0]) err('usage: scp <remote-file> [local-dir]');
        const remote = new VFS(at!.fs);
        const src = resolvePath(this.run.cwd, args[0]);
        const content = remote.read(src);
        const name = src.split('/').pop()!;
        const destDir = resolvePath('/home/ghost', args[1] ?? '/home/ghost/downloads');
        const home = new VFS(this.home.fs);
        home.mkdirp(destDir);
        home.write(`${destDir}/${name}`, content);
        this.addHeat(2);
        this.emit({ type: 'toast', kind: 'success', title: 'FILE EXFILTRATED', body: `${name} → ~/downloads` });
        this.emit({ type: 'sound', sound: 'success' });
        return [c.green(`${name}  100%  ${content.length * 37}KB  2.4MB/s  00:01`), c.dim(`saved to ${destDir.replace('/home/ghost', '~')}/${name}`)];
      },
      ps: () => {
        const procs = this.run.procs;
        const lines = [c.bold(pad('PID', 7) + pad('TOOL', 10) + pad('TARGET', 16) + pad('RAM', 8) + 'PROGRESS')];
        for (const p of procs) {
          const pct = Math.min(100, Math.round((p.elapsed / p.duration) * 100));
          lines.push(pad(String(p.pid), 7) + pad(p.toolId, 10) + pad(p.target, 16) + pad(`${p.ram}MB`, 8) + `${pct}%`);
        }
        lines.push(c.dim(`RAM ${this.usedRam}/${this.maxRam} MB`));
        return lines;
      },
      kill: (args) => {
        const pid = Number(args[0]);
        const p = this.run.procs.find((x) => x.pid === pid);
        if (!p) err(`kill: (${args[0] ?? ''}) - No such process`);
        this.run.procs = this.run.procs.filter((x) => x !== p);
        return [c.dim(`[${pid}] ${p!.toolId} terminated. ${p!.ram} MB freed.`)];
      },
      fwrules: (args) => {
        const ref = args[0] ?? this.run.connected;
        if (!ref) err('usage: fwrules <host>');
        const h = findHost(this.world, ref!);
        if (!h || !h.discovered) err(`fwrules: ${ref}: host unreachable`);
        if (!h!.firewall) return [c.dim(`${h!.ip}: no host firewall detected`)];
        h!.firewall.seen = true;
        this.addHeat(1);
        this.unlockIndex('firewall-rules');
        this.emit({ type: 'fx', fx: 'firewall' });
        return [
          c.dim(`# iptables-save  (${h!.hostname})`),
          ...h!.firewall.rules.map((r) =>
            r.includes('ACCEPT') && r.includes('-s ') ? c.green(r) : r.includes('DROP') ? c.red(r) : r.startsWith('-A') ? r : c.dim(r),
          ),
          c.yellow(`Hint: rules match top-down. Which source may reach TCP 21,22,80? Own it, then fwbypass ${h!.ip} --src <ip>`),
        ];
      },
      jobs: () => {
        const lines = [c.bold(c.cyan(`CONTRACT BOARD // ${this.world.org}`))];
        for (const def of CONTRACTS) {
          const st = this.run.contracts[def.id];
          const badge = st === 'done' ? c.green('DONE  ') : st === 'active' ? c.yellow('ACTIVE') : c.dim('LOCKED');
          lines.push(`${badge} ${c.magenta(def.id)}  ${pad(def.title, 18)} ${pad(c.dim(def.type), 18)} ${c.yellow(def.payout + '¢')}`);
          if (st === 'active') lines.push(c.dim(`          ${def.objective(this.world)}`));
        }
        this.emit({ type: 'open', panel: 'jobs' });
        return lines;
      },
      contracts: (a, s) => this.commands.jobs(a, s),
      submit: (args) => {
        const [id, answer] = args as [ContractId, string];
        const def = CONTRACT_BY_ID[id];
        if (!def) err('usage: submit <job-id> <answer>   e.g. submit c3 203.0.113.50');
        if (!def.answer) err(`submit: ${id} completes automatically when its objective is met`);
        if (this.run.contracts[id] !== 'active') err(`submit: ${id} is not active`);
        if (!answer) err(`usage: submit ${id} <answer>`);
        if (answer.trim() !== def.answer!(this.world)) {
          this.addHeat(3);
          this.emit({ type: 'sound', sound: 'error' });
          return [c.red(`Vex: "${answer}? Nope. Check whose login was Accepted, and from where."`)];
        }
        this.completeContract(id);
        return [];
      },
      mail: (args) => {
        const mails = this.run.mails;
        const n = args[0] ? Number(args[0]) - 1 : mails.findIndex((m) => !m.read);
        const idx = n >= 0 ? n : mails.length - 1;
        const m = mails[idx];
        if (!m) err('mail: no such message');
        m.read = true;
        this.emit({ type: 'open', panel: 'mail', arg: String(idx) });
        const list = mails.map((x, i) => `${i === idx ? c.yellow('▸') : ' '} ${i + 1}. ${x.read ? c.dim(x.subject) : c.bold(x.subject)}`);
        return [
          ...list,
          '',
          c.cyan(`From: ${m.from}  //  ${m.subject}`),
          ...m.body.map((l) => '  ' + l),
          ...(mails.some((x) => !x.read) ? [c.dim('  (more unread mail: type mail again)')] : []),
        ];
      },
      shop: () => {
        this.emit({ type: 'open', panel: 'shop' });
        return [
          c.bold(c.cyan(`BLACK MARKET // balance ${this.profile.credits}¢`)),
          ...SHOP_ITEMS.map(
            (i) =>
              `${this.owns(i.id) ? c.green('OWNED') : c.yellow(pad(i.price + '¢', 5))}  ${pad(c.magenta(i.id), 16)} ${i.effect}`,
          ),
          c.dim('buy <item-id> to purchase. Purchases are permanent across ops.'),
        ];
      },
      buy: (args) => {
        const item = SHOP_BY_ID[args[0]];
        if (!item) err('usage: buy <item-id>   (see shop)');
        if (this.owns(item.id)) err(`buy: you already own ${item.name}`);
        if (this.profile.credits < item.price) err(`buy: ${item.name} costs ${item.price}¢, you have ${this.profile.credits}¢`);
        this.profile.credits -= item.price;
        this.profile.owned.push(item.id);
        if (item.id === 'wordlist-plus') {
          new VFS(this.home.fs).write('/home/ghost/wordlists/rockyou-plus.txt', 'Summer2026!\nWinter2025!\nneon4ever\n... (48,211 more)\n');
        }
        const tool = this.registry.get(item.id);
        if (tool) this.unlockIndex(tool.indexEntryId);
        this.emit({ type: 'toast', kind: 'success', title: 'PURCHASED', body: item.name });
        this.emit({ type: 'sound', sound: 'cash' });
        this.emit({ type: 'fx', fx: 'glitch' });
        return [c.green(`  ▸ ${item.name} acquired. ${item.effect}`), c.dim(`  balance: ${this.profile.credits}¢`)];
      },
      index: (args) => {
        if (args[0]) {
          const e = INDEX_BY_ID[args[0]];
          if (!e) err(`index: no entry '${args[0]}'`);
          if (!this.profile.index[e.id]) return [c.dim(`LOCKED: ${e.title}. ${e.unlockHint}`)];
          this.profile.index[e.id].read = true;
          this.emit({ type: 'open', panel: 'index', arg: e.id });
          return [
            c.bold(c.magenta(e.title)) + c.dim(`  [${e.category} · tier ${e.tier}${e.mitre ? ' · ' + e.mitre : ''}]`),
            c.cyan('① REAL WORLD'),
            ...e.realWorld.map((l) => '  ' + l),
            c.cyan('② IN GAME'),
            ...e.inGame.map((l) => '  ' + l),
            c.cyan('③ DETECTION & DEFENSE'),
            ...e.defense.map((l) => '  ' + l),
          ];
        }
        this.emit({ type: 'open', panel: 'index' });
        const n = Object.keys(this.profile.index).length;
        return [
          c.bold(c.cyan(`THE INDEX // ${n}/${INDEX_ENTRIES.length} entries`)),
          ...INDEX_ENTRIES.map((e) =>
            this.profile.index[e.id]
              ? `  ${c.green('◆')} ${pad(c.magenta(e.id), 26)} ${e.title}`
              : `  ${c.dim('◇ ' + pad('??????', 24) + ' ' + e.unlockHint)}`,
          ),
          c.dim('index <entry-id> to read'),
        ];
      },
      tools: () => [
        c.bold(c.cyan('TOOLKIT')),
        c.dim(pad('TOOL', 11) + pad('ORIGIN', 10) + pad('RAM', 8) + pad('TIME', 7) + pad('PORT', 6) + 'INDEX'),
        ...this.registry.all().map(
          (t) =>
            (this.toolAvailable(t) ? c.magenta(pad(t.id, 11)) : c.dim(pad(t.id, 11))) +
            pad(t.origin, 10) +
            pad(`${t.ramMb}MB`, 8) +
            pad(`${t.durationSec}s`, 7) +
            pad(t.targetPort ? String(t.targetPort) : '-', 6) +
            c.dim(t.indexEntryId) +
            (this.toolAvailable(t) ? '' : c.yellow('  (shop)')),
        ),
      ],
      man: (args) => {
        const t = this.registry.get(args[0] ?? '');
        if (!t) err('usage: man <tool>   (see tools)');
        return [
          c.bold(`${t!.name}(1)`) + c.dim(`  ${t!.side} / ${t!.category}`),
          `  ${t!.summary}`,
          `  ${c.cyan('usage:')} ${t!.usage}`,
          `  ${c.cyan('cost:')}  ${t!.ramMb} MB RAM, ~${t!.durationSec}s, heat ${t!.heatPerSec}/s`,
          `  ${c.cyan('real:')}  ${t!.realWorld}`,
          `  ${c.cyan('learn more:')} index ${t!.indexEntryId}`,
        ];
      },
      workshop: () => [
        c.bold(c.magenta('WORKSHOP // OFFLINE')) + c.dim('  (coming in a future update)'),
        '  Build your own tools in Bash or Python: a port scanner, an SSH cracker,',
        '  a log watcher, an IDS rule. Test them in the Range, register them, and',
        '  they join your toolkit like anything from the shop: same RAM bar, same',
        '  progress bars, linked to their Index entry.',
        c.dim('  Every tool already runs on one shared interface. Type tools to see it.'),
      ],
      status: () => {
        const n = Object.keys(this.profile.index).length;
        return [
          c.bold(c.cyan('GHOST // status')),
          `  credits   ${c.yellow(this.profile.credits + '¢')}   (earned this op: ${this.run.earned}¢)`,
          `  trace     ${this.run.heat.toFixed(0)}%${this.run.flagged ? c.red('  FLAGGED') : ''}`,
          `  rig RAM   ${this.maxRam} MB`,
          `  op        #${this.profile.runs}  target: ${this.world.org}  seed ${this.world.seed}`,
          `  index     ${n}/${INDEX_ENTRIES.length}`,
          `  record    ${this.profile.extracted} extracted, ${this.profile.traced} traced`,
        ];
      },
      jackout: (args) => {
        const allDone = Object.values(this.run.contracts).every((s) => s === 'done');
        if (!allDone && !args.includes('--force')) {
          return [c.yellow('Jobs still open. Extracting now forfeits them. Use jackout --force to bail.')];
        }
        const bonus = allDone ? Math.round((100 - this.run.heat) * 4) : 0;
        if (bonus) this.pay(bonus, 'Stealth bonus');
        this.profile.extracted += allDone ? 1 : 0;
        const lines = [c.green(c.bold(`  ▸ EXTRACTED.`)) + (bonus ? c.yellow(` Stealth bonus +${bonus}¢`) : '')];
        this.startRun();
        this.emit({ type: 'clear' });
        return [...lines, c.cyan(`New op loaded: ${this.world.org}. Type mail.`)];
      },
    };
    return cmds;
  }

  private headTail(args: string[], stdin: string[] | null, which: 'head' | 'tail'): string[] {
    const o = parseOpts(args, { withValue: ['-n'] });
    const n = Number(o.values['-n'] ?? 10);
    const src = stdin ?? this.commands.cat(o.positional, null);
    return which === 'head' ? src.slice(0, n) : src.slice(-n);
  }
}
