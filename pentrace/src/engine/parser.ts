export interface ParsedCommand {
  name: string;
  args: string[];
}

export class ParseError extends Error {}

/**
 * Splits a command line into a pipeline of commands.
 * Supports single/double quotes, backslash escapes and `|` pipes.
 */
export function parseLine(line: string): ParsedCommand[] {
  const segments: string[][] = [[]];
  let current = '';
  let hasToken = false;
  let quote: '"' | "'" | null = null;

  const pushToken = () => {
    if (hasToken) segments[segments.length - 1].push(current);
    current = '';
    hasToken = false;
  };

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (quote) {
      if (ch === quote) {
        quote = null;
      } else if (ch === '\\' && quote === '"' && i + 1 < line.length) {
        current += line[++i];
      } else {
        current += ch;
      }
      continue;
    }
    if (ch === '"' || ch === "'") {
      quote = ch;
      hasToken = true;
    } else if (ch === '\\' && i + 1 < line.length) {
      current += line[++i];
      hasToken = true;
    } else if (ch === ' ' || ch === '\t') {
      pushToken();
    } else if (ch === '|') {
      pushToken();
      segments.push([]);
    } else {
      current += ch;
      hasToken = true;
    }
  }
  if (quote) throw new ParseError(`unterminated ${quote === '"' ? 'double' : 'single'} quote`);
  pushToken();

  if (segments.length === 1 && segments[0].length === 0) return [];
  if (segments.some((s) => s.length === 0)) throw new ParseError('syntax error near unexpected token `|\'');
  return segments.map(([name, ...args]) => ({ name, args }));
}

export interface OptSpec {
  /** Flags that take a value, e.g. ['-w', '-u', '-p']. */
  withValue?: string[];
}

export interface ParsedOpts {
  flags: Set<string>;
  values: Record<string, string>;
  positional: string[];
}

/**
 * Small getopt. Keeps nmap-style multi-letter flags (`-sV`, `-T4`) intact
 * and supports `-w file` and `-wfile` for value flags.
 */
export function parseOpts(args: string[], spec: OptSpec = {}): ParsedOpts {
  const withValue = spec.withValue ?? [];
  const flags = new Set<string>();
  const values: Record<string, string> = {};
  const positional: string[] = [];
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === '--') {
      positional.push(...args.slice(i + 1));
      break;
    }
    if (a.startsWith('-') && a.length > 1) {
      const vf = withValue.find((f) => a === f || (a.startsWith(f) && !a.startsWith('--')));
      if (vf) {
        if (a === vf) {
          if (i + 1 >= args.length) throw new ParseError(`option ${vf} requires a value`);
          values[vf] = args[++i];
        } else {
          values[vf] = a.slice(vf.length).replace(/^=/, '');
        }
      } else {
        flags.add(a);
      }
    } else {
      positional.push(a);
    }
  }
  return { flags, values, positional };
}
