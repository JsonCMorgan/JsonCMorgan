import { INDEX_BY_ID } from './content/index-entries';

export type MissionKind = 'offense' | 'defense' | 'training';

export interface LootItem {
  kind: 'file' | 'card' | 'ioc';
  label: string;
  /** INDEX tier for cards (higher = rarer glow). */
  tier?: number;
}

/** Everything the Mission Complete screen shows. Built by the engine, rendered by src/ui/mission-complete.ts. */
export interface MissionReport {
  missionId: string;
  kind: MissionKind;
  title: string;
  /** Big glitch title: BREACH COMPLETE / CONTRACT CLOSED / TICKET RESOLVED / TRAINING COMPLETE. */
  splash: string;
  subtitle: string;
  credits: number;
  xp: number;
  xpBefore: number;
  rankBefore: number;
  xpAfter: number;
  rankAfter: number;
  /** Unspent perk points after this mission (shown on the PERK POINT EARNED prompt). */
  perkPoints: number;
  /** One line from the fixer or handler; replaces a Standing counter. */
  fixerLine: string;
  loot: LootItem[];
  lessons: string[];
  /** INDEX ids the mission touched, in first-seen order. */
  cards: string[];
  /** Subset of cards unlocked for the first time during this mission. */
  newCards: string[];
  /** Defense ticket closed with the wrong call: QA flag instead of a celebration. */
  flagged?: boolean;
  /** Reopened with the study command: jump straight to the debrief. */
  studyOnly?: boolean;
}

/** What a run remembers about the mission in progress. */
export interface MissionTracking {
  concepts: string[];
  newCards: string[];
  loot: string[];
}

export function emptyTracking(): MissionTracking {
  return { concepts: [], newCards: [], loot: [] };
}

export function recordConcept(t: MissionTracking, id: string, isNew: boolean) {
  if (!INDEX_BY_ID[id]) return;
  if (!t.concepts.includes(id)) t.concepts.push(id);
  if (isNew && !t.newCards.includes(id)) t.newCards.push(id);
}

export function cardLoot(t: MissionTracking): LootItem[] {
  return t.newCards.map((id) => ({ kind: 'card' as const, label: INDEX_BY_ID[id].title, tier: INDEX_BY_ID[id].tier }));
}

export type McStage = 'splash' | 'tally' | 'growth' | 'loot' | 'debrief';

/** Player-paced stage order. study reopens straight into the debrief; loot is skipped when there is none. */
export function missionStages(r: MissionReport): McStage[] {
  if (r.studyOnly) return ['debrief'];
  return ['splash', 'tally', 'growth', ...(r.loot.length ? (['loot'] as const) : []), 'debrief'];
}

/** Saved on the profile so `study` can reopen the last debrief after a reload. */
export type StudySet = Pick<MissionReport, 'missionId' | 'kind' | 'title' | 'lessons' | 'cards'>;
