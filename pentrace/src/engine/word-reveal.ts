import { stripAnsi } from './ansi';

/** Target words per second before context multipliers (clamped to 8–14). */
export const DEFAULT_WPS = 11;

/** Applied when `game.run.tutorial` is active (pedagogical pacing). */
export const TUTORIAL_WPS_MULTIPLIER = 0.78;

/** Extra slowdown when line looks like Vex / mission narrative. */
export const DIALOGUE_WPS_MULTIPLIER = 0.88;

/** Slightly faster for repetitive scan-style tables (still word-by-word). */
export const SCAN_TABLE_WPS_MULTIPLIER = 1.22;

const WPS_MIN = 8;
const WPS_MAX = 14;

// eslint-disable-next-line no-control-regex
const ANSI_RE = /^\x1b\[[0-9;]*m/;

export type RevealToken = { kind: 'ansi'; text: string } | { kind: 'word'; text: string };

/** Split a line into ANSI sequences and word chunks (trailing space kept on each word). */
export function tokenizeRevealLine(line: string): RevealToken[] {
  const tokens: RevealToken[] = [];
  let i = 0;
  while (i < line.length) {
    const rest = line.slice(i);
    const ansi = rest.match(ANSI_RE);
    if (ansi) {
      tokens.push({ kind: 'ansi', text: ansi[0] });
      i += ansi[0].length;
      continue;
    }
    let j = i;
    while (j < line.length) {
      const tail = line.slice(j);
      if (tail.match(ANSI_RE)) break;
      j++;
    }
    const chunk = line.slice(i, j);
    if (chunk) {
      const parts = chunk.match(/\s*\S+\s*|\s+/g) ?? [chunk];
      for (const p of parts) tokens.push({ kind: 'word', text: p });
    }
    i = j;
  }
  return tokens;
}

export function countRevealWords(line: string): number {
  return tokenizeRevealLine(line).filter((t) => t.kind === 'word').length;
}

export type RevealPacingContext = {
  tutorial?: boolean;
  line: string;
};

const DIALOGUE_MARKERS =
  /\bVex\b|TRAINING|training sim|>>\s|◆\s|MISSION\b|OBJECTIVE\b|hint:/i;
const SCAN_TABLE_MARKERS = /PORT\s+STATE|\/tcp|\/udp|\[\s*\+\s*\]|Nmap scan|Starting Nmap/i;

export function wordsPerSecond(ctx: RevealPacingContext): number {
  let wps = DEFAULT_WPS;
  const plain = stripAnsi(ctx.line);
  if (ctx.tutorial) wps *= TUTORIAL_WPS_MULTIPLIER;
  if (DIALOGUE_MARKERS.test(plain)) wps *= DIALOGUE_WPS_MULTIPLIER;
  if (SCAN_TABLE_MARKERS.test(plain)) wps *= SCAN_TABLE_WPS_MULTIPLIER;
  return Math.min(WPS_MAX, Math.max(WPS_MIN, wps));
}

export function delayMsPerWord(wps: number): number {
  return 1000 / wps;
}

/** Rejoin tokens to the full line (round-trip for tests). */
export function joinRevealTokens(tokens: RevealToken[]): string {
  return tokens.map((t) => t.text).join('');
}