import { CONTRACT_BY_ID, type ContractDef, type ContractId } from './content/contracts';
import type { Game } from './game';
import { findHost } from './network';
import { VFS } from './vfs';

export interface ChecklistItem {
  id: string;
  label: string;
  done: boolean;
}

const TRAINING_PHASES: { id: string; label: string; untilStep: number }[] = [
  { id: 'shell', label: 'Learn the shell (help, pwd, ls, files)', untilStep: 8 },
  { id: 'recon', label: 'Scan and map the lab network', untilStep: 18 },
  { id: 'breach', label: 'Firewall, crackers, and trace thresholds', untilStep: 28 },
  { id: 'objective', label: 'Finish the training drill (submit + pay)', untilStep: 31 },
  { id: 'extract', label: 'Jack out clean', untilStep: 32 },
];

export function trainingChecklist(g: Game): ChecklistItem[] {
  const step = g.run.tutorial?.step ?? 0;
  const paid = g.run.tutorial?.paid ?? false;
  return TRAINING_PHASES.map((ph) => ({
    id: ph.id,
    label: ph.label,
    done: ph.id === 'objective' ? paid : step >= ph.untilStep,
  }));
}

export function liveJobChecklist(g: Game, job: ContractDef): ChecklistItem[] {
  const w = g.world;
  const scope = w.hosts.filter((h) => h.role !== 'home');
  switch (job.type) {
    case 'Recon':
      return [
        { id: 'op', label: 'Jack in and read mail scope', done: g.profile.runs >= 1 },
        { id: 'discover', label: 'Discover in-scope hosts (scan / nmap)', done: scope.every((h) => h.discovered) },
        { id: 'fingerprint', label: 'Fingerprint every host (nmap -sV)', done: scope.every((h) => h.fingerprinted) },
        {
          id: 'complete',
          label: 'Edge survey pays out automatically',
          done: g.run.contracts[job.id] === 'done',
        },
      ];
    case 'Breach & Retrieve': {
      const fin = findHost(w, w.financeIp);
      const hasFile = !!new VFS(g.home.fs).get('/home/ghost/downloads/payroll.db');
      return [
        { id: 'recon', label: 'Recon finance segment (fwrules if blocked)', done: !!fin?.discovered },
        { id: 'bypass', label: 'Bypass firewall or pivot if needed', done: !fin?.firewall || !!fin.firewall.bypassed },
        { id: 'breach', label: 'Open required ports and escalate (getroot)', done: !!fin?.root },
        { id: 'exfil', label: 'SCP payroll.db to ~/downloads', done: hasFile },
        {
          id: 'complete',
          label: 'Contract completes on exfil',
          done: g.run.contracts[job.id] === 'done',
        },
      ];
    }
    case 'Log Analysis': {
      const soc = findHost(w, w.socIp);
      return [
        { id: 'reach', label: 'Reach the SOC collector host', done: !!soc?.discovered },
        { id: 'breach', label: 'Breach SOC (ports + access)', done: !!(soc && soc.root) },
        { id: 'logs', label: 'grep Accepted in /var/log/auth.log', done: g.run.contracts[job.id] === 'done' || g.run.heat > 0 },
        {
          id: 'submit',
          label: 'submit c3 <external-ip>',
          done: g.run.contracts[job.id] === 'done',
        },
      ];
    }
    default:
      return [];
  }
}

export function activeJobChecklist(g: Game): ChecklistItem[] | null {
  if (g.run.tutorial) return trainingChecklist(g);
  const active = (['c1', 'c2', 'c3'] as const).find((id) => g.run.contracts[id] === 'active');
  if (!active) return null;
  return liveJobChecklist(g, CONTRACT_BY_ID[active as ContractId]);
}
