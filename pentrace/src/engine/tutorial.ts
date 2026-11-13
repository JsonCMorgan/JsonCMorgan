import type { Game } from './game';
import { findHost, openPortCount, TRAINING_CACHE_IP, TRAINING_GW_IP, TRAINING_INTRUDER_IP, TRAINING_VAULT_IP } from './network';
import { VFS } from './vfs';

/** What the player just did; `line` is absent when a step is checked from the game tick. */
export interface StepCtx {
  line?: string;
  names: string[];
  args: string[][];
  prevLine?: string;
  /** Error text if the command failed. */
  error?: string;
  ownedBefore: number;
  usedTab: boolean;
}

export interface TutorialStep {
  id: string;
  title: string;
  say: string[];
  /** The exact thing to type, shown in the NEXT STEP panel. */
  cmd?: string | ((g: Game) => string);
  /** Apply steps give a goal only; the command is revealed by `hint`. */
  unguided?: boolean;
  onEnter?(g: Game): void;
  check(g: Game, c: StepCtx): boolean;
  /** Feedback when the player ran a command that did not satisfy the step. */
  nudge?(g: Game, c: StepCtx): string | null;
}

const GW = TRAINING_GW_IP;
const VAULT = TRAINING_VAULT_IP;
const CACHE = TRAINING_CACHE_IP;
const host = (g: Game, ip: string) => findHost(g.world, ip)!;
const ran = (c: StepCtx, name: string) => c.names.includes(name);

export const TUTORIAL_STEPS: TutorialStep[] = [
  {
    id: 'help',
    title: 'Pull up the command list',
    say: [
      'Ghost. Vex. Before I put you on a paying job, you run my training sim.',
      'Nothing in here can burn you. Everything you learn carries over.',
      'Every op starts with knowing your tools. Type help and press Enter.',
    ],
    cmd: 'help',
    check: (_g, c) => ran(c, 'help'),
  },
  {
    id: 'pwd',
    title: 'Where am I?',
    say: ['pwd prints your working directory: where you are standing in the filesystem.'],
    cmd: 'pwd',
    check: (_g, c) => ran(c, 'pwd'),
  },
  {
    id: 'ls',
    title: 'List what is here',
    say: ['ls lists the files and folders in this directory. Folders show in blue with a slash.'],
    cmd: 'ls',
    check: (_g, c) => ran(c, 'ls'),
  },
  {
    id: 'cd',
    title: 'Move into notes/',
    say: ['cd changes directory. Move into your notes folder.'],
    cmd: 'cd notes',
    check: (g) => g.run.homeCwd === '/home/ghost/notes',
  },
  {
    id: 'tab',
    title: 'Read a file, using TAB',
    say: [
      'cat prints a file. Lazy hackers live longer, so let the shell type for you:',
      'type  cat brea  then press TAB to complete the filename, then Enter.',
    ],
    cmd: 'cat breach-cheatsheet.txt',
    check: (_g, c) => ran(c, 'cat') && c.args.some((a) => a.some((x) => x.includes('breach-cheatsheet'))) && c.usedTab,
    nudge: (_g, c) =>
      ran(c, 'cat') && !c.usedTab ? 'Vex: "Good read. Now do it again, but type  cat brea  and hit TAB to finish the name."' : null,
  },
  {
    id: 'history',
    title: 'Recall it with the up arrow',
    say: ['Your shell remembers. Press the UP arrow to bring back your last command, then Enter.'],
    cmd: '↑ then Enter',
    check: (_g, c) => !!c.line && c.line === c.prevLine,
  },
  {
    id: 'pipe',
    title: 'Filter output with a pipe',
    say: [
      'A pipe | feeds one command into the next. grep keeps only matching lines.',
      'Pull just the nmap line out of the cheatsheet.',
    ],
    cmd: 'cat breach-cheatsheet.txt | grep nmap',
    check: (_g, c) => c.names.length > 1 && ran(c, 'grep'),
  },
  {
    id: 'man',
    title: 'Read a tool manual',
    say: ['man <tool> shows what a tool does, what it costs and its real-world twin.'],
    cmd: 'man sshbrute',
    check: (_g, c) => ran(c, 'man') && c.args.some((a) => a.length > 0),
  },
  {
    id: 'mail',
    title: 'Read your mail',
    say: ['Jobs arrive as mail from me. Read it.'],
    cmd: 'mail',
    check: (_g, c) => ran(c, 'mail'),
  },
  {
    id: 'jobs',
    title: 'Check the contract board',
    say: ['jobs shows the contract board. Real jobs stay LOCKED until you clear this sim.'],
    cmd: 'jobs',
    check: (_g, c) => ran(c, 'jobs') || ran(c, 'contracts'),
  },
  {
    id: 'nmap',
    title: 'Fingerprint the sim gateway',
    say: [
      `Recon first. nmap -sV fingerprints a host: open ports and service versions.`,
      'Tools run as processes. Watch the RAM panel on the left while it runs.',
    ],
    cmd: `nmap -sV ${GW}`,
    check: (g) => host(g, GW).fingerprinted,
  },
  {
    id: 'connect',
    title: 'Connect to the gateway',
    say: ['connect opens a session on a host. Your prompt changes to show where you are.'],
    cmd: `connect ${GW}`,
    check: (g) => g.run.connected === GW,
  },
  {
    id: 'scan',
    title: 'Scan for linked hosts',
    say: ['scan reveals the machines linked to the host you are on. Watch the NETMAP on the right.'],
    cmd: 'scan',
    check: (g) => host(g, VAULT).discovered,
  },
  {
    id: 'dc',
    title: 'Disconnect',
    say: [
      'dc drops your session and puts you back on your rig.',
      'Remember: disconnecting never resets the trace. It only stops you making more noise.',
    ],
    cmd: 'dc',
    check: (g) => g.run.connected === null,
  },
  {
    id: 'firewall-twist',
    title: 'Try the vault head-on',
    say: [
      'You found dojo-vault. Go on, try cracking it directly. I will wait.',
    ],
    cmd: `sshbrute ${VAULT}`,
    check: (_g, c) => !!c.error?.includes('dropped by firewall'),
  },
  {
    id: 'fwrules',
    title: 'Read the vault firewall',
    say: [
      'Dropped. The vault runs a firewall, and it only listens to one source.',
      'Read its rules. Find the ACCEPT rule and its -s source: that is the only box it trusts.',
    ],
    cmd: `fwrules ${VAULT}`,
    check: (g) => !!host(g, VAULT).firewall?.seen,
  },
  {
    id: 'crack-gw',
    title: 'Crack SSH on the gateway',
    say: [
      'The vault trusts the gateway, so you own the gateway first.',
      'sshbrute is a dictionary attack on port 22. It eats 240 MB of RAM and makes noise.',
      'Watch the TRACE meter climb while it runs.',
    ],
    cmd: `sshbrute ${GW}`,
    check: (g) => openPortCount(host(g, GW)) >= 1,
  },
  {
    id: 'root-gw',
    title: 'Get root on the gateway',
    say: ['One port open is enough on this box. getroot escalates you to admin.'],
    cmd: `getroot ${GW}`,
    check: (g) => host(g, GW).root,
  },
  {
    id: 'pivot',
    title: 'Pivot through the trusted gateway',
    say: ['You own the source the firewall trusts. fwbypass routes your traffic through it.'],
    cmd: `fwbypass ${VAULT} --src ${GW}`,
    check: (g) => !!host(g, VAULT).firewall?.bypassed,
  },
  {
    id: 'parallel',
    title: 'Run two crackers at once',
    say: [
      'The vault needs 2 open ports. sshbrute (240 MB) plus webscan (200 MB) fit in 512 MB together.',
      `Launch both without waiting: sshbrute ${VAULT}  then  webscan ${VAULT}`,
      'Run out of RAM and the next tool refuses to start. ps lists processes, kill frees one.',
    ],
    cmd: (g) => {
      const v = host(g, VAULT);
      const sshDone = v.ports.find((p) => p.num === 22)!.open || g.run.procs.some((p) => p.toolId === 'sshbrute' && p.target === VAULT);
      return sshDone ? `webscan ${VAULT}` : `sshbrute ${VAULT}`;
    },
    check: (g) => openPortCount(host(g, VAULT)) >= 2,
  },
  {
    id: 'trace',
    title: 'SOC drill: watch the trace',
    say: [
      'Drill time. I am spiking your trace so you can see what the SOC does.',
      '50%: an analyst starts correlating your activity.',
      '75%: your source gets flagged and every noisy move costs 50% more.',
      '100%: you are traced. The op ends. You keep your credits, tools and Index, but lose the op.',
      'In here it can never hit 100. Check your status.',
    ],
    cmd: 'status',
    onEnter: (g) => {
      if (g.run.heat < 78) g.addHeat(78 - g.run.heat);
    },
    check: (_g, c) => ran(c, 'status'),
  },
  {
    id: 'index',
    title: 'Open your new Index entry',
    say: [
      'Crossing 50% unlocked an entry in the Index, your codex of real techniques.',
      'Every entry has three parts: the real world, how it works in game, and how defenders catch it.',
      'Open the one you just earned. Drill over: I am cooling your trace back down.',
    ],
    cmd: 'index the-trace',
    onEnter: (g) => {
      g.run.heat = 30;
      g.run.flagged = false;
    },
    check: (_g, c) => ran(c, 'index') && c.args.some((a) => a[0] === 'the-trace'),
    nudge: (_g, c) => (ran(c, 'index') ? 'Vex: "Open the trace entry specifically: index the-trace"' : null),
  },
  {
    id: 'root-vault',
    title: 'Get root on the vault',
    say: ['Two ports open, firewall bypassed. Take the vault.'],
    cmd: `getroot ${VAULT}`,
    check: (g) => host(g, VAULT).root,
  },
  {
    id: 'connect-vault',
    title: 'Connect to the vault',
    say: ['Root means you can browse its files. Connect.'],
    cmd: `connect ${VAULT}`,
    check: (g) => g.run.connected === VAULT,
  },
  {
    id: 'scp',
    title: 'Exfiltrate the payload',
    say: ['scp copies a remote file down to ~/downloads on your rig. That is how retrieve jobs pay out.'],
    cmd: 'scp /srv/training/payload.dat',
    check: (g) => !!new VFS(g.home.fs).get('/home/ghost/downloads/payload.dat'),
  },
  {
    id: 'grep-log',
    title: 'Find the intruder in the logs',
    say: [
      'Someone else got into this vault before you. auth.log records every SSH login.',
      'Successful logins say "Accepted". Grep for them.',
    ],
    cmd: 'grep Accepted /var/log/auth.log',
    check: (_g, c) => ran(c, 'grep') && !!c.line?.includes('auth.log'),
  },
  {
    id: 'submit',
    title: 'Report the intruder IP and get paid',
    say: [
      'One Accepted line comes from inside (the gateway). The other is an outside IP that brute forced in.',
      'Submit the outside one: submit drill <ip>',
    ],
    cmd: 'submit drill <ip>',
    check: (g) => g.run.tutorial?.paid === true,
  },
  {
    id: 'rm-logs',
    title: 'Scrub your tracks',
    say: [
      'You left Failed password lines all over this box. Delete the logs on a box you own',
      'to clear its alert and shave some trace. Real SOCs keep copies off-box, so it is not a free pass.',
    ],
    cmd: 'rm /var/log/*',
    check: (g) => host(g, VAULT).cleaned,
  },
  {
    id: 'dc-home',
    title: 'Get out',
    say: ['Job done, logs scrubbed. Disconnect.'],
    cmd: 'dc',
    check: (g) => g.run.connected === null,
  },
  {
    id: 'shop',
    title: 'Spend your pay',
    say: [
      'Credits buy permanent upgrades: new tools, RAM, wordlists, tool mods. They survive every op, even a trace.',
      'Open the shop and buy something. RAM is never a bad call.',
    ],
    cmd: 'buy ram-512',
    check: (g, c) =>
      (ran(c, 'buy') && g.profile.owned.length > c.ownedBefore) ||
      (ran(c, 'shop') && !anyAffordable(g)),
  },
  {
    id: 'graduation',
    title: 'Final exam: bring me graduation.key',
    say: [
      'Final exam. No step-by-step this time.',
      'There is a third box in the sim, dojo-cache, linked behind the vault. Find it, own it,',
      'and bring /srv/graduation.key home. Everything you need, you have already done once.',
      'Stuck? hint still works. Out here, it always will.',
    ],
    unguided: true,
    cmd: (g) => {
      const cache = host(g, CACHE);
      if (!cache.discovered) return g.run.connected === VAULT ? 'scan' : `connect ${VAULT}`;
      if (g.run.procs.length) return 'ps';
      if (openPortCount(cache) < 1) return `sshbrute ${CACHE}`;
      if (!cache.root) return `getroot ${CACHE}`;
      if (g.run.connected !== CACHE) return `connect ${CACHE}`;
      return 'scp /srv/graduation.key';
    },
    check: (g) => !!new VFS(g.home.fs).get('/home/ghost/downloads/graduation.key'),
  },
  {
    id: 'workshop',
    title: 'What comes next',
    say: [
      'Clean. You are cleared for real contracts.',
      'Last thing. Buying tools is the start. Building them is the endgame.',
      'The Workshop is where you will write your own scanners, crackers, log watchers and IDS rules.',
      'Take a look.',
    ],
    cmd: 'workshop',
    check: (_g, c) => ran(c, 'workshop'),
  },
];

function anyAffordable(g: Game): boolean {
  return g.shopItems().some((i) => !g.owns(i.id) && g.profile.credits >= i.price);
}

export const TUTORIAL_PAY_FIRST = 450;
export const TUTORIAL_PAY_REPLAY = 50;
export { TRAINING_INTRUDER_IP };
