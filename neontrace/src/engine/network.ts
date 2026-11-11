import { Rng } from './rng';
import { dir, file, VDir } from './vfs';

export interface Port {
  num: number;
  proto: 'tcp' | 'udp';
  service: string;
  version: string;
  open: boolean;
  /** Tool id that can crack this port, if any. */
  crackedBy?: string;
}

export interface Firewall {
  rules: string[];
  /** Source IP the ACCEPT rule trusts for TCP. */
  allowSrc: string;
  bypassed: boolean;
  seen: boolean;
}

export interface Host {
  ip: string;
  hostname: string;
  role: 'home' | 'gateway' | 'soc' | 'finance';
  ports: Port[];
  portsRequired: number;
  firewall: Firewall | null;
  /** Trace heat per second while you stay connected to this host after alerting it. */
  security: number;
  alerted: boolean;
  root: boolean;
  discovered: boolean;
  scanned: boolean;
  fingerprinted: boolean;
  cleaned: boolean;
  links: string[];
  fs: VDir;
  account: { user: string; pass: string; isDefault: boolean };
  credsFound: boolean;
}

export interface World {
  seed: number;
  org: string;
  orgSlug: string;
  homeIp: string;
  hosts: Host[];
  attackerIp: string;
  gatewayIp: string;
  socIp: string;
  financeIp: string;
}

export const HOME_IP = '10.13.37.1';

const ORGS = [
  { name: 'Kestrel Media Group', slug: 'kestrel' },
  { name: 'Halcyon Biotech', slug: 'halcyon' },
  { name: 'Ostrander Freight', slug: 'ostrander' },
  { name: 'Vantablack Capital', slug: 'vanta' },
  { name: 'Mirrorlake Insurance', slug: 'mirrorlake' },
];

export const WORDLIST_MINI = [
  '123456', 'password', 'qwerty', 'letmein', 'dragon', 'monkey', 'sunshine1', 'iloveyou',
  'trustno1', 'princess', 'football', 'shadow', 'Summer2026!', 'Winter2025!', 'P@ssw0rd',
  'welcome1', 'neon4ever', 'hunter2', 'zaq12wsx', 'Spring2026',
];
const DEFAULT_PASSWORDS = ['admin', 'changeme', 'root', 'default'];

const EXTERNAL_NOISE = ['198.51.100.23', '198.51.100.77', '192.0.2.144', '203.0.113.9', '203.0.113.201'];

function authLog(rng: Rng, hostname: string, attackerIp: string, legitIp: string, user: string): string {
  const lines: string[] = [];
  let t = 3 * 3600 + rng.int(0, 1800);
  const stamp = () => {
    t += rng.int(1, 40);
    const h = String(Math.floor(t / 3600) % 24).padStart(2, '0');
    const m = String(Math.floor(t / 60) % 60).padStart(2, '0');
    const s = String(t % 60).padStart(2, '0');
    return `Nov 11 ${h}:${m}:${s}`;
  };
  let pid = rng.int(2000, 4000);
  const line = (msg: string) => lines.push(`${stamp()} ${hostname} sshd[${pid++}]: ${msg}`);
  line(`Accepted publickey for ops from ${legitIp} port ${rng.int(40000, 60000)} ssh2`);
  for (let i = 0; i < 6; i++) {
    const ip = rng.pick(EXTERNAL_NOISE);
    line(`Failed password for invalid user ${rng.pick(['test', 'oracle', 'pi', 'ubuntu'])} from ${ip} port ${rng.int(40000, 60000)} ssh2`);
  }
  const burst = rng.int(14, 22);
  for (let i = 0; i < burst; i++) {
    line(`Failed password for ${user} from ${attackerIp} port ${rng.int(40000, 60000)} ssh2`);
    if (i % 5 === 4) line(`Failed password for invalid user ${rng.pick(['admin', 'root'])} from ${rng.pick(EXTERNAL_NOISE)} port ${rng.int(40000, 60000)} ssh2`);
  }
  line(`Accepted password for ${user} from ${attackerIp} port ${rng.int(40000, 60000)} ssh2`);
  line(`pam_unix(sshd:session): session opened for user ${user} by (uid=0)`);
  line(`Accepted publickey for ops from ${legitIp} port ${rng.int(40000, 60000)} ssh2`);
  return lines.join('\n') + '\n';
}

export function generateWorld(seed: number): World {
  const rng = new Rng(seed);
  const org = rng.pick(ORGS);
  const net = rng.int(20, 90);
  const gatewayIp = `10.${net}.0.${rng.int(2, 9)}`;
  const socIp = `10.${net}.0.${rng.int(10, 30)}`;
  const financeIp = `10.${net}.0.${rng.int(31, 60)}`;
  const attackerIp = `203.0.113.${rng.int(30, 199)}`;

  const home: Host = {
    ip: HOME_IP,
    hostname: 'ghost-rig',
    role: 'home',
    ports: [],
    portsRequired: 0,
    firewall: null,
    security: 0,
    alerted: false,
    root: true,
    discovered: true,
    scanned: true,
    fingerprinted: true,
    cleaned: false,
    links: [gatewayIp],
    account: { user: 'ghost', pass: '', isDefault: false },
    credsFound: true,
    fs: dir({
      home: dir({
        ghost: dir({
          'readme.txt': file(
            'ghost-rig // personal deck\n' +
              'Type `help` for commands, `hint` if you are stuck, `mail` for jobs.\n' +
              'Everything out there is a simulation. Hack freely.\n',
          ),
          downloads: dir(),
          wordlists: dir({ 'rockyou-mini.txt': file(WORDLIST_MINI.join('\n') + '\n') }),
          bin: dir(),
          notes: dir({
            'breach-cheatsheet.txt': file(
              'BREACH CHEATSHEET\n' +
                '1. nmap -sV <ip>         fingerprint the target\n' +
                '2. fwrules <ip>          read the firewall (if active)\n' +
                '3. fwbypass <ip> --src   pivot through a box you own\n' +
                '4. sshbrute / webscan    crack the required ports (watch RAM)\n' +
                '5. getroot <ip>          admin access\n' +
                '6. connect, loot, dc     and keep the trace low\n',
            ),
          }),
        }),
      }),
    }),
  };

  const gwUser = 'admin';
  const gwPass = rng.pick(DEFAULT_PASSWORDS);
  const gateway: Host = {
    ip: gatewayIp,
    hostname: `${org.slug}-gw`,
    role: 'gateway',
    ports: [
      { num: 22, proto: 'tcp', service: 'ssh', version: 'OpenSSH 7.2p2 Ubuntu', open: false, crackedBy: 'sshbrute' },
      { num: 80, proto: 'tcp', service: 'http', version: 'nginx 1.18.0', open: false, crackedBy: 'webscan' },
    ],
    portsRequired: 1,
    firewall: null,
    security: 0.1,
    alerted: false,
    root: false,
    discovered: true,
    scanned: false,
    fingerprinted: false,
    cleaned: false,
    links: [HOME_IP, socIp, financeIp],
    account: { user: gwUser, pass: gwPass, isDefault: true },
    credsFound: false,
    fs: dir({
      etc: dir({ motd: file(`${org.name} edge gateway. Authorized use only.\n`) }),
      home: dir({
        admin: dir({
          'todo.txt': file(
            '- rotate the admin password (still the factory default, oops)\n' +
              '- finance box firewall only trusts THIS gateway. keep it that way\n' +
              '- ask SOC why the syslog server keeps paging at 3am\n',
          ),
        }),
      }),
      var: dir({ log: dir({ 'auth.log': file(authLog(rng, `${org.slug}-gw`, rng.pick(EXTERNAL_NOISE), socIp, 'admin')) }) }),
    }),
  };

  const socUser = 'svc_backup';
  const socPass = rng.pick(WORDLIST_MINI.slice(5, 12));
  const soc: Host = {
    ip: socIp,
    hostname: `${org.slug}-soc`,
    role: 'soc',
    ports: [
      { num: 22, proto: 'tcp', service: 'ssh', version: 'OpenSSH 8.9p1', open: false, crackedBy: 'sshbrute' },
      { num: 514, proto: 'udp', service: 'syslog', version: 'rsyslogd 8.2112', open: false },
    ],
    portsRequired: 1,
    firewall: null,
    security: 0.2,
    alerted: false,
    root: false,
    discovered: false,
    scanned: false,
    fingerprinted: false,
    cleaned: false,
    links: [gatewayIp],
    account: { user: socUser, pass: socPass, isDefault: false },
    credsFound: false,
    fs: dir({
      etc: dir({ motd: file('SOC log collector. All sessions are recorded.\n') }),
      var: dir({
        log: dir({
          'auth.log': file(authLog(rng, `${org.slug}-soc`, attackerIp, gatewayIp, socUser)),
          'syslog': file(`Nov 11 03:00:01 ${org.slug}-soc CRON[811]: (root) CMD (logrotate /etc/logrotate.conf)\n`),
        }),
      }),
      srv: dir({ 'playbook.txt': file('IR playbook v0.3: if in doubt, escalate to Tier 2.\n') }),
    }),
  };

  const finUser = 'fin_ops';
  const finPass = rng.pick(WORDLIST_MINI.slice(10));
  const finance: Host = {
    ip: financeIp,
    hostname: `${org.slug}-fin`,
    role: 'finance',
    ports: [
      { num: 21, proto: 'tcp', service: 'ftp', version: 'vsftpd 3.0.3', open: false, crackedBy: 'ftploot' },
      { num: 22, proto: 'tcp', service: 'ssh', version: 'OpenSSH 7.4', open: false, crackedBy: 'sshbrute' },
      { num: 80, proto: 'tcp', service: 'http', version: 'Apache httpd 2.4.49', open: false, crackedBy: 'webscan' },
    ],
    portsRequired: 2,
    firewall: {
      allowSrc: gatewayIp,
      bypassed: false,
      seen: false,
      rules: [
        '*filter',
        ':INPUT DROP [0:0]',
        ':FORWARD DROP [0:0]',
        ':OUTPUT ACCEPT [0:0]',
        '-A INPUT -i lo -j ACCEPT',
        '-A INPUT -m state --state ESTABLISHED,RELATED -j ACCEPT',
        `-A INPUT -s ${socIp}/32 -p udp --dport 514 -j ACCEPT`,
        `-A INPUT -s ${gatewayIp}/32 -p tcp -m multiport --dports 21,22,80 -j ACCEPT`,
        '-A INPUT -p tcp --dport 80 -j DROP',
        '-A INPUT -j LOG --log-prefix "FW-DROP: "',
        'COMMIT',
      ],
    },
    security: 0.3,
    alerted: false,
    root: false,
    discovered: false,
    scanned: false,
    fingerprinted: false,
    cleaned: false,
    links: [gatewayIp],
    account: { user: finUser, pass: finPass, isDefault: false },
    credsFound: false,
    fs: dir({
      etc: dir({ motd: file(`${org.name} finance. PCI scope. Unauthorized access is prosecuted.\n`) }),
      srv: dir({
        finance: dir({
          'payroll.db': file(
            `SQLite format 3 :: ${org.name} payroll\n` +
              `rows: ${rng.int(180, 420)} employees | Q4 bonus pool: $${rng.int(2, 9)}.${rng.int(1, 9)}M\n` +
              'flag{n30n_tr4c3_p4yr0ll_pull3d}\n',
          ),
          'q3-report.pdf': file('%PDF-1.7 (binary data)\n'),
          'vendors.csv': file('vendor,amount\nArasaka Courier,1200\nMilitech Office Supply,640\n'),
        }),
      }),
      var: dir({ log: dir({ 'auth.log': file(''), 'apache2-access.log': file('') }) }),
    }),
  };

  return {
    seed,
    org: org.name,
    orgSlug: org.slug,
    homeIp: HOME_IP,
    hosts: [home, gateway, soc, finance],
    attackerIp,
    gatewayIp,
    socIp,
    financeIp,
  };
}

export function findHost(world: World, ref: string): Host | undefined {
  const r = ref.toLowerCase();
  return world.hosts.find((h) => h.ip === r || h.hostname === r);
}

export function openPortCount(h: Host): number {
  return h.ports.filter((p) => p.open).length;
}

/** Reveals hosts linked to `from`; returns the newly discovered ones. */
export function scanLinks(world: World, from: Host): Host[] {
  const found: Host[] = [];
  for (const ip of from.links) {
    const h = findHost(world, ip);
    if (h && !h.discovered) {
      h.discovered = true;
      found.push(h);
    }
  }
  return found;
}
