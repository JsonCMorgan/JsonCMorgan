import { parseLine, type ParsedCommand } from './parser';

export type CommandDelayPlan = {
  /** Milliseconds to show the busy animation before revealing output. */
  delayMs: number;
  /** After the delay, print multi-line output one line at a time. */
  stream: boolean;
  /** Skip busy animation (terminal-only / UX exceptions). */
  instant: boolean;
  /** Documented reason when instant (PR / tests). */
  instantReason?: 'empty-line' | 'clear-resets-terminal';
};

const CLAMP_MIN = 1000;
const CLAMP_MAX = 5000;

/** Breach / SOC tools that should feel heavier on the wire. */
const HEAVY_WEIGHT: Record<string, number> = {
  nmap: 10,
  scan: 9,
  sshbrute: 10,
  webscan: 9,
  ftploot: 9,
  fwbypass: 9,
  getroot: 10,
  fwrules: 8,
  socsearch: 8,
  grep: 8,
  cat: 7,
  mail: 6,
  jobs: 6,
  shop: 6,
  index: 5,
  submit: 7,
  connect: 6,
  scp: 7,
  rm: 5,
};

const BREACH_TOOLS = new Set([
  'nmap',
  'sshbrute',
  'webscan',
  'ftploot',
  'fwbypass',
  'getroot',
  'scan',
  'socsearch',
]);

function pipelineWeight(pipeline: ParsedCommand[]): number {
  let w = 0;
  for (const { name } of pipeline) {
    w = Math.max(w, HEAVY_WEIGHT[name] ?? (BREACH_TOOLS.has(name) ? 8 : 4));
  }
  if (pipeline.length > 1) w += pipeline.length;
  return w;
}

/**
 * Default: every submitted command gets 1–5s of busy time + staged output.
 * Tiny whitelist for UX (document in PR #4).
 */
export function commandDelayPlan(line: string, outputLines: string[]): CommandDelayPlan {
  const trimmed = line.trim();
  if (!trimmed) {
    return { delayMs: 0, stream: false, instant: true, instantReason: 'empty-line' };
  }

  let pipeline: ParsedCommand[];
  try {
    pipeline = parseLine(trimmed);
  } catch {
    return {
      delayMs: Math.min(CLAMP_MAX, CLAMP_MIN + 400),
      stream: outputLines.length > 1,
      instant: false,
    };
  }

  if (!pipeline.length) {
    return { delayMs: 0, stream: false, instant: true, instantReason: 'empty-line' };
  }

  if (pipeline.length === 1 && pipeline[0].name === 'clear') {
    return { delayMs: 0, stream: false, instant: true, instantReason: 'clear-resets-terminal' };
  }

  const weight = pipelineWeight(pipeline);
  let delayMs = CLAMP_MIN + weight * 220;
  delayMs += Math.min(1200, outputLines.length * 35);
  delayMs = Math.round(Math.min(CLAMP_MAX, Math.max(CLAMP_MIN, delayMs)));

  const stream = outputLines.length > 1;
  return { delayMs, stream, instant: false };
}

/** Per-line pause when streaming multi-line output (ms). */
export function streamLineDelayMs(line: string): number {
  const len = line.replace(/\x1b\[[0-9;]*m/g, '').length;
  return Math.min(120, Math.max(28, 18 + Math.floor(len / 8)));
}
