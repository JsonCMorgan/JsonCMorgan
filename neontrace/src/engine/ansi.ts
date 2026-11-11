const wrap = (code: string) => (s: string | number) => `\x1b[${code}m${s}\x1b[0m`;

export const c = {
  cyan: wrap('96'),
  magenta: wrap('95'),
  yellow: wrap('93'),
  green: wrap('92'),
  red: wrap('91'),
  blue: wrap('94'),
  dim: wrap('2'),
  bold: wrap('1'),
  white: wrap('97'),
};

export function stripAnsi(s: string): string {
  // eslint-disable-next-line no-control-regex
  return s.replace(/\x1b\[[0-9;]*m/g, '');
}

export function pad(s: string, n: number): string {
  const len = stripAnsi(s).length;
  return len >= n ? s : s + ' '.repeat(n - len);
}
