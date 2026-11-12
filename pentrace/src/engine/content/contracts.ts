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
