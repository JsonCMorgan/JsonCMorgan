import type { World } from '../network';

export type ContractId = 'c1' | 'c2' | 'c3';

export interface ContractDef {
  id: ContractId;
  title: string;
  type: 'Recon' | 'Breach & Retrieve' | 'Log Analysis';
  payout: number;
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
    payout: 350,
    indexEntryId: 'port-scanning',
    objective: (w) => `Fingerprint (nmap -sV) every ${w.org} host. Gateway: ${w.gatewayIp}`,
    mail: (w) => ({
      subject: `JOB c1 // Edge Survey // ${w.org}`,
      body: [
        `Fresh client, choom. ${w.org} wants a pentest and they pay on results.`,
        `Their edge gateway sits at ${w.gatewayIp}. Fingerprint it: nmap -sV ${w.gatewayIp}`,
        'Then connect to it and run scan to find what hides behind it.',
        'Fingerprint every host you find. Pays 350.',
      ],
    }),
  },
  {
    id: 'c2',
    title: 'Payroll Pull',
    type: 'Breach & Retrieve',
    payout: 900,
    indexEntryId: 'ssh-credential-attacks',
    objective: (w) => `Exfiltrate /srv/finance/payroll.db from ${w.financeIp} to your rig`,
    mail: (w) => ({
      subject: `JOB c2 // Payroll Pull // ${w.org}`,
      body: [
        `Nice map. Now the real work. The finance box at ${w.financeIp} holds payroll.db.`,
        'It is firewalled. Read the rules with fwrules, find who it trusts, own that box, and pivot.',
        'Then crack two ports, getroot, connect and scp the file home. Pays 900.',
        'Watch your RAM and watch the trace. Disconnecting does not save you.',
      ],
    }),
  },
  {
    id: 'c3',
    title: 'Ghost in the Logs',
    type: 'Log Analysis',
    payout: 600,
    indexEntryId: 'log-analysis',
    objective: (w) => `Find the external IP that broke into ${w.socIp}. submit c3 <ip>`,
    answer: (w) => w.attackerIp,
    mail: (w) => ({
      subject: `JOB c3 // Ghost in the Logs // ${w.org}`,
      body: [
        `Twist: someone beat us into ${w.org}. Their SOC collector at ${w.socIp} has the auth log.`,
        'Breach it, then read /var/log/auth.log. Find the outside IP that brute forced an account and got in.',
        'grep is your friend. Answer with: submit c3 <ip>. Pays 600.',
      ],
    }),
  },
];

export const CONTRACT_BY_ID = Object.fromEntries(CONTRACTS.map((c) => [c.id, c])) as Record<ContractId, ContractDef>;
