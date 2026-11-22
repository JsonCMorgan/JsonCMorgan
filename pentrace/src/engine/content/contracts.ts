import type { FixerId } from '../progression';
import type { World } from '../network';

export type ContractId = 'c1' | 'c2' | 'c3';

export interface ContractDef {
  id: ContractId;
  title: string;
  type: 'Recon' | 'Breach & Retrieve' | 'Log Analysis';
  fixerId: FixerId;
  setId: number;
  tier: number;
  payout: number;
  operatorXp: number;
  standingReward: number;
  indexEntryId: string;
  /** Mission Complete debrief: three to five big-picture takeaways. */
  lessons: string[];
  /** Fixer's one-liner on the Mission Complete tally (Standing is appended). */
  fixerLine: string;
  objective(w: World): string;
  mail(w: World): { subject: string; body: string[] };
  /** Contracts verified by an answer use `submit <id> <answer>`. */
  answer?(w: World): string;
}

export const CONTRACTS: ContractDef[] = [
  {
    id: 'c1',
    title: 'Edge Survey',
    type: 'Recon',
    fixerId: 'relay',
    setId: 0,
    tier: 0,
    payout: 350,
    operatorXp: 80,
    standingReward: 1,
    indexEntryId: 'port-scanning',
    fixerLine: 'Clean survey. The client has a map now.',
    lessons: [
      'Recon comes first: nmap -sV turns open ports into version strings, and versions are what map to known CVEs.',
      'You can only scan what you can reach. Pivoting from the gateway revealed hosts the internet never sees.',
      'Every scan is logged somewhere. A quiet survey keeps the trace low for the jobs that follow.',
    ],
    objective: (w) => `Fingerprint (nmap -sV) every ${w.org} host. Gateway: ${w.gatewayIp}`,
    mail: (w) => ({
      subject: `JOB c1 // Edge Survey // ${w.org}`,
      body: [
        `Client authorized external pentest. ${w.org} pays on deliverables.`,
        `Edge gateway: ${w.gatewayIp}. Run service detection: nmap -sV ${w.gatewayIp}`,
        'Pivot from the gateway with scan. Fingerprint every in-scope host before you touch creds.',
        'Scope: external footprint only until I clear lateral movement. 350 credits on completion.',
      ],
    }),
  },
  {
    id: 'c2',
    title: 'Payroll Pull',
    type: 'Breach & Retrieve',
    fixerId: 'relay',
    setId: 0,
    tier: 1,
    payout: 900,
    operatorXp: 120,
    standingReward: 1,
    indexEntryId: 'ssh-credential-attacks',
    fixerLine: 'Payroll is in hand and nobody saw you leave.',
    lessons: [
      'Firewall rules match top-down. The one ACCEPT rule that trusted the gateway became your way in.',
      'Owning a trusted host lets you pivot past segmentation. That is why defenders move to zero trust: internal does not mean safe.',
      'Exfiltration is the step defenders most want to catch. A large outbound transfer from a PCI box should page someone.',
      'Two cracked ports plus a privilege escalation is a chain. Breaking any link (keys only SSH, patched Apache) stops it.',
    ],
    objective: (w) => `Exfiltrate /srv/finance/payroll.db from ${w.financeIp} to your rig`,
    mail: (w) => ({
      subject: `JOB c2 // Payroll Pull // ${w.org}`,
      body: [
        `Objective: exfil /srv/finance/payroll.db from finance host ${w.financeIp}.`,
        'Host is segment-restricted. fwrules, identify trusted pivot, own it, then fwbypass.',
        'Two open ports minimum before getroot. SCP to ~/downloads when root is stable.',
        'SOC will correlate noisy tools. Manage Heat through the breach. 900 credits.',
      ],
    }),
  },
  {
    id: 'c3',
    title: 'Ghost in the Logs',
    type: 'Log Analysis',
    fixerId: 'relay',
    setId: 0,
    tier: 1,
    payout: 600,
    operatorXp: 120,
    standingReward: 1,
    indexEntryId: 'log-analysis',
    fixerLine: 'Right IP. That is blue-team work, and it pays.',
    lessons: [
      'Successful logins from an outside IP are the IOC, not the failed ones.',
      'A burst of Failed lines followed by one Accepted from the same IP tells the whole brute force story in one grep.',
      'Preserve evidence before you clean up. The log you wanted to scrub held the answer.',
    ],
    objective: (w) => `Find the external IP that broke into ${w.socIp}. submit c3 <ip>`,
    answer: (w) => w.attackerIp,
    mail: (w) => ({
      subject: `JOB c3 // Ghost in the Logs // ${w.org}`,
      body: [
        `Incident already in flight at ${w.org}. SOC collector ${w.socIp} holds auth.log.`,
        'Breach the collector, grep for Accepted SSH sessions. Identify the external source IP (IOC).',
        'Submit: submit c3 <ip>. Blue-team flavored work; good Operator XP. 600 credits.',
      ],
    }),
  },
];

export const CONTRACT_BY_ID = Object.fromEntries(CONTRACTS.map((c) => [c.id, c])) as Record<ContractId, ContractDef>;
