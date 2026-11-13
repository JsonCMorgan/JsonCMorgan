import fixersData from './content/fixers.json';
import type { ContractId } from './content/contracts';

export const SAVE_VERSION = 3;
export const TRUST_FLOOR_MAX = 5;
export const RUN_STANDING_MAX = 10;
export const BURN_RUN_STANDING_PENALTY = 2;

export type FixerId = 'vex' | 'relay' | 'kurohashi' | 'merit' | 'cap' | 'cipher';
export type PerkId = 'timedrive' | 'ram_overclock';
export type GamePhase = 'offense' | 'defense';

export interface FixerDef {
  id: FixerId;
  name: string;
  tagline: string;
  icon: string;
  role: 'trainer' | 'broker';
  unlock?: string;
  visibleWhenLocked?: boolean;
  hiddenUntilMet?: boolean;
  teaser?: string;
}

export interface GigSetDef {
  setId: number;
  gigIds: ContractId[];
  completeRule: { type: 'any'; count: number };
  standingCap: number;
}

export interface GigProgress {
  setId: number;
  completed: ContractId[];
  /** Trust Floor bump already granted for this set. */
  floorGranted?: boolean;
}

export interface RunStandingState {
  runStanding: Partial<Record<FixerId, number>>;
}

export interface ProgressionProfile {
  version: number;
  operatorRank: number;
  operatorXp: number;
  perkRanks: Partial<Record<PerkId, number>>;
  /** Meta trust per broker (0–5). Rises on set/capstone only; never lowered by burns. */
  trustFloor: Partial<Record<FixerId, number>>;
  gigProgress: Partial<Record<FixerId, GigProgress>>;
  vexGraduated: boolean;
  relayUnlocked: boolean;
  pendingPerkPick: boolean;
  freeRespecThisRun: boolean;
  metFixers: FixerId[];
  /** offense = breach ops; defense = L1 SOC preview / M7 arc */
  gamePhase?: GamePhase;
}

export const FIXERS = fixersData.fixers as FixerDef[];
export const FIXER_BY_ID = Object.fromEntries(FIXERS.map((f) => [f.id, f])) as Record<FixerId, FixerDef>;
export const RELAY_SETS = (fixersData.gigSets as { relay: GigSetDef[] }).relay;
export const MAIL_TEMPLATES = fixersData.mailTemplates;

export const PERK_DEFS: Record<
  PerkId,
  { id: PerkId; name: string; branch: string; max: number; minRank: number; desc: string }
> = {
  timedrive: {
    id: 'timedrive',
    name: 'Timedrive',
    branch: 'breach',
    max: 3,
    minRank: 2,
    desc: '+8% / +12% / +18% duration on breach crackers (sshbrute, webscan, ftploot, getroot, fwbypass).',
  },
  ram_overclock: {
    id: 'ram_overclock',
    name: 'RAM Overclock',
    branch: 'rig',
    max: 3,
    minRank: 6,
    desc: '+64 / +96 / +128 MB effective RAM on remote targets; +5% heat/sec per active cracker.',
  },
};

const TIMEDRIVE_MUL = [1, 1.08, 1.12, 1.18] as const;
const RAM_OVERCLOCK_MB = [0, 64, 96, 128] as const;

/** XP required to advance from rank (r-1) to rank r. */
export function xpToReachRank(r: number): number {
  if (r <= 1) return 0;
  return 200 * r + 50 * r * r;
}

export function totalXpForRank(rank: number): number {
  let t = 0;
  for (let r = 2; r <= rank; r++) t += xpToReachRank(r);
  return t;
}

export function xpProgress(rank: number, xp: number): { into: number; need: number; pct: number } {
  const floor = totalXpForRank(rank);
  const ceiling = totalXpForRank(rank + 1);
  const need = ceiling - floor;
  const into = Math.max(0, xp - floor);
  const pct = need > 0 ? Math.min(100, (into / need) * 100) : 100;
  return { into, need, pct };
}

export function perkPointsAvailable(rank: number, ranks: Partial<Record<PerkId, number>>): number {
  const earned = Math.max(0, rank - 1);
  const spent = Object.values(ranks).reduce((s, n) => s + (n ?? 0), 0);
  return earned - spent;
}

export function respecCreditCost(rank: number): number {
  return 400 + 75 * rank;
}

export function defaultProgression(version: number): Pick<
  ProgressionProfile,
  | 'operatorRank'
  | 'operatorXp'
  | 'perkRanks'
  | 'trustFloor'
  | 'gigProgress'
  | 'vexGraduated'
  | 'relayUnlocked'
  | 'pendingPerkPick'
  | 'freeRespecThisRun'
  | 'metFixers'
> {
  return {
    operatorRank: 1,
    operatorXp: 0,
    perkRanks: {},
    trustFloor: {},
    gigProgress: {},
    vexGraduated: false,
    relayUnlocked: false,
    pendingPerkPick: false,
    freeRespecThisRun: false,
    metFixers: [],
    gamePhase: 'offense',
  };
}

/** Patch v1 saves into M2 progression fields. */
export function migrateProfile(profile: Record<string, unknown>, tutorialDone: boolean): void {
  const prog = defaultProgression(SAVE_VERSION);
  profile.version = SAVE_VERSION;
  profile.operatorRank ??= prog.operatorRank;
  profile.operatorXp ??= prog.operatorXp;
  profile.perkRanks ??= prog.perkRanks;
  if (!profile.trustFloor && profile.fixerStanding) {
    const legacy = profile.fixerStanding as Record<string, number>;
    profile.trustFloor = Object.fromEntries(
      Object.entries(legacy).map(([k, v]) => [k, Math.min(TRUST_FLOOR_MAX, v)]),
    );
    delete profile.fixerStanding;
  }
  profile.trustFloor ??= prog.trustFloor;
  profile.gigProgress ??= prog.gigProgress;
  profile.pendingPerkPick ??= prog.pendingPerkPick;
  profile.freeRespecThisRun ??= prog.freeRespecThisRun;
  profile.metFixers ??= prog.metFixers;
  profile.gamePhase ??= 'offense';
  if (tutorialDone) {
    profile.vexGraduated ??= true;
    profile.relayUnlocked ??= true;
    profile.operatorRank = Math.max(Number(profile.operatorRank) || 1, 2);
    profile.trustFloor = {
      ...((profile.trustFloor as object) ?? {}),
      relay: (profile.trustFloor as Record<string, number>)?.relay ?? 0,
    };
    if (!profile.gigProgress || !Object.keys(profile.gigProgress as object).length) {
      profile.gigProgress = { relay: { setId: 0, completed: [] } };
    }
    profile.metFixers = Array.from(new Set([...(profile.metFixers as FixerId[]), 'vex', 'relay']));
  } else {
    profile.vexGraduated ??= false;
    profile.relayUnlocked ??= false;
  }
}

export function grantOperatorXp(
  profile: Pick<ProgressionProfile, 'operatorRank' | 'operatorXp'>,
  amount: number,
): { gained: number; rankUps: number } {
  if (amount <= 0) return { gained: 0, rankUps: 0 };
  profile.operatorXp += amount;
  let rankUps = 0;
  while (profile.operatorRank < 40 && profile.operatorXp >= totalXpForRank(profile.operatorRank + 1)) {
    profile.operatorRank += 1;
    rankUps += 1;
  }
  return { gained: amount, rankUps };
}

export function timedriveDurationMul(perkRanks: Partial<Record<PerkId, number>>): number {
  const r = Math.min(3, perkRanks.timedrive ?? 0);
  return TIMEDRIVE_MUL[r];
}

export function ramOverclockMb(perkRanks: Partial<Record<PerkId, number>>, inBreach: boolean): number {
  if (!inBreach) return 0;
  const r = Math.min(3, perkRanks.ram_overclock ?? 0);
  return RAM_OVERCLOCK_MB[r];
}

export function overclockHeatMul(perkRanks: Partial<Record<PerkId, number>>, crackersActive: number): number {
  if (crackersActive <= 0 || !(perkRanks.ram_overclock ?? 0)) return 1;
  return 1.05;
}

export function operatorXpForContract(tier: number): number {
  return [80, 120, 160][tier] ?? 100;
}

export function standingRewardForContract(tier: number): number {
  return 1 + Math.min(1, tier);
}

export function clampStanding(n: number): number {
  return Math.max(0, Math.min(RUN_STANDING_MAX, n));
}

/** Effective standing for gates this run (initialized at jack-in from Trust Floor). */
export function effectiveStanding(profile: ProgressionProfile, run: RunStandingState, fixer: FixerId): number {
  const runVal = run.runStanding[fixer];
  if (runVal !== undefined) return clampStanding(runVal);
  return clampStanding(profile.trustFloor[fixer] ?? 0);
}

export function initRunStanding(profile: ProgressionProfile): Partial<Record<FixerId, number>> {
  const out: Partial<Record<FixerId, number>> = {};
  for (const f of FIXERS) {
    if (f.id === 'vex') continue;
    out[f.id] = clampStanding(profile.trustFloor[f.id] ?? 0);
  }
  return out;
}

export function adjustRunStanding(run: RunStandingState, fixer: FixerId, delta: number): number {
  const cur = run.runStanding[fixer] ?? 0;
  const next = clampStanding(cur + delta);
  run.runStanding[fixer] = next;
  return next;
}

export function raiseTrustFloor(profile: Pick<ProgressionProfile, 'trustFloor'>, fixer: FixerId, steps = 1): number {
  const cur = profile.trustFloor[fixer] ?? 0;
  const next = Math.min(TRUST_FLOOR_MAX, cur + steps);
  profile.trustFloor[fixer] = next;
  return next;
}

export function standingLabel(profile: ProgressionProfile, run: RunStandingState, fixer: FixerId): string {
  const runSt = effectiveStanding(profile, run, fixer);
  const floor = profile.trustFloor[fixer] ?? 0;
  return `Run ${runSt} · Floor ${floor}`;
}

export interface Gate {
  standing?: Partial<Record<FixerId, number>>;
  rank?: number;
}

export function parseUnlockRule(
  rule: string | undefined,
  profile: ProgressionProfile,
  standing?: (id: FixerId) => number,
): { met: boolean; reason?: string } {
  const eff = (id: FixerId) => standing?.(id) ?? clampStanding(profile.trustFloor[id] ?? 0);
  if (!rule) return { met: true };
  if (rule === 'vexGraduated') return profile.vexGraduated ? { met: true } : { met: false, reason: 'Complete Vex training.' };
  if (rule === 'cipher') {
    const brokers: FixerId[] = ['relay', 'kurohashi', 'merit', 'cap'];
    const ok = brokers.every((id) => Math.max(eff(id), profile.trustFloor[id] ?? 0) >= 6);
    return ok ? { met: true } : { met: false, reason: 'All brokers at Standing 6+.' };
  }
  const parts = rule.split('|');
  for (const part of parts) {
    if (part.startsWith('rank:')) {
      const need = Number(part.slice(5));
      if (profile.operatorRank >= need) return { met: true };
    }
    if (part.startsWith('standing:')) {
      const [, fid, lvl] = part.split(':');
      if (eff(fid as FixerId) >= Number(lvl)) return { met: true };
    }
  }
  return { met: false, reason: 'Requirements not met.' };
}

export function contactVisibility(
  f: FixerDef,
  profile: ProgressionProfile,
  standing?: (id: FixerId) => number,
): 'active' | 'locked' | 'hidden' | 'teaser' {
  if (f.id === 'vex') return profile.vexGraduated ? 'locked' : 'active';
  if (f.visibleWhenLocked && !parseUnlockRule(f.unlock, profile, standing).met) return 'teaser';
  if (f.hiddenUntilMet && !profile.metFixers.includes(f.id) && !parseUnlockRule(f.unlock, profile, standing).met) return 'hidden';
  const gate = parseUnlockRule(f.unlock, profile, standing);
  return gate.met ? 'active' : 'locked';
}

export function currentRelaySet(profile: ProgressionProfile): GigSetDef | null {
  const prog = profile.gigProgress.relay ?? { setId: 0, completed: [] };
  return RELAY_SETS.find((s) => s.setId === prog.setId) ?? RELAY_SETS[0] ?? null;
}

export function relaySetComplete(profile: ProgressionProfile): boolean {
  const set = currentRelaySet(profile);
  if (!set) return false;
  const done = profile.gigProgress.relay?.completed ?? [];
  return done.length >= set.completeRule.count;
}

export function shopItemGated(
  itemId: string,
  profile: ProgressionProfile,
  relayRunStanding: number,
): { blocked: boolean; reason?: string } {
  if (itemId === 'mod-quiet' && profile.operatorRank < 3) {
    return { blocked: true, reason: 'Requires Operator Rank 3 (perk tree unlocks).' };
  }
  if (itemId === 'ftploot') {
    if (relayRunStanding < 2 && profile.operatorRank < 4) {
      return { blocked: true, reason: 'Requires Relay Run Standing 2+ or Operator Rank 4.' };
    }
  }
  return { blocked: false };
}

export function clearPerks(profile: Pick<ProgressionProfile, 'perkRanks'>) {
  profile.perkRanks = {};
}
