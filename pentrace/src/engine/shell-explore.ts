import { c } from './ansi';
import { FsError, resolvePath, VFS, type VNode } from './vfs';

/** Thrown for shell usage errors; Game turns it into a red line like any other command error. */
export class ShellError extends Error {}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

export function isHidden(name: string): boolean {
  return name.startsWith('.');
}

/** Splits `-la` into `-l -a`; leaves `--long` alone. Returns the letters and the non-flag args. */
export function shortFlags(args: string[]): { letters: Set<string>; rest: string[] } {
  const letters = new Set<string>();
  const rest: string[] = [];
  for (const a of args) {
    if (a.startsWith('-') && !a.startsWith('--') && a.length > 1) for (const ch of a.slice(1)) letters.add(ch);
    else rest.push(a);
  }
  return { letters, rest };
}

export interface FileMeta {
  perms: string;
  owner: string;
  size: number;
  date: string;
  links: number;
}

/**
 * Fictional but stable metadata for ls -l and stat. Nothing here reads the host OS: owner,
 * permissions and dates are derived from the in-game path so the same file always looks the same.
 */
export function fileMeta(path: string, node: VNode, homeUser: string): FileMeta {
  const parts = path.split('/').filter(Boolean);
  const name = parts[parts.length - 1] ?? '/';
  const inHome = parts[0] === 'home' && parts.length >= 2;
  const owner = inHome ? parts[1] : 'root';
  const h = hash(path);
  const date = `${MONTHS[10]} ${String(1 + (h % 11)).padStart(2)} ${String(h % 24).padStart(2, '0')}:${String((h >> 5) % 60).padStart(2, '0')}`;
  if (node.type === 'dir') {
    const perms = name === '.ssh' ? 'drwx------' : parts[0] === 'root' ? 'drwx------' : 'drwxr-xr-x';
    return { perms, owner: owner === 'root' && inHome ? homeUser : owner, size: 4096, date, links: 2 + Object.values(node.children).filter((n) => n.type === 'dir').length };
  }
  let perms = '-rw-r--r--';
  if (parts.includes('.ssh') && !name.endsWith('.pub') && name !== 'known_hosts' && name !== 'config') perms = '-rw-------';
  else if (parts[0] === 'var' && parts[1] === 'log') perms = '-rw-r-----';
  else if (name === 'shadow') perms = '-rw-r-----';
  else if (parts.includes('bin')) perms = '-rwxr-xr-x';
  else if (name === '.bash_history') perms = '-rw-------';
  return { perms, owner, size: node.content.length, date, links: 1 };
}

function colorName(name: string, node: VNode, perms?: string): string {
  if (node.type === 'dir') return c.blue(c.bold(name + '/'));
  if (perms?.includes('x')) return c.green(c.bold(name));
  return name;
}

function listDir(vfs: VFS, path: string, all: boolean): [string, VNode][] {
  const node = vfs.get(path);
  if (!node || node.type !== 'dir') return [];
  return Object.keys(node.children)
    .sort()
    .filter((n) => all || !isHidden(n))
    .map((n) => [n, node.children[n]]);
}

function longLine(path: string, name: string, node: VNode, homeUser: string): string {
  const m = fileMeta(path, node, homeUser);
  return `${m.perms} ${String(m.links).padStart(2)} ${m.owner.padEnd(10)} ${m.owner.padEnd(10)} ${String(m.size).padStart(6)} ${m.date} ${colorName(name, node, m.perms)}`;
}

/** `ls [-l] [-a] [-R] [path]`. */
export function lsLines(vfs: VFS, cwd: string, args: string[], homeUser: string): string[] {
  const { letters, rest } = shortFlags(args);
  for (const l of letters) if (!'laR1hA'.includes(l)) throw new ShellError(`ls: invalid option -- '${l}'. Supported: -l -a -R (try ls -la)`);
  const all = letters.has('a') || letters.has('A');
  const long = letters.has('l');
  const target = rest[0] ?? '.';
  const path = resolvePath(cwd, target);
  const node = vfs.get(path);
  if (!node) throw new FsError(`ls: cannot access '${target}': No such file or directory`);
  if (node.type === 'file') return [long ? longLine(path, target, node, homeUser) : target];

  const block = (dirPath: string): string[] => {
    const entries = listDir(vfs, dirPath, all);
    const withDots: [string, VNode][] =
      all && letters.has('a') ? [['.', vfs.get(dirPath)!], ['..', vfs.get(resolvePath(dirPath, '..'))!], ...entries] : entries;
    if (long) {
      const total = entries.reduce((s, [, n]) => s + Math.ceil((n.type === 'dir' ? 4096 : n.content.length) / 1024), 0);
      return [`total ${total}`, ...withDots.map(([n, child]) => longLine(n === '.' || n === '..' ? dirPath : `${dirPath === '/' ? '' : dirPath}/${n}`, n, child, homeUser))];
    }
    if (!withDots.length) return [];
    return [withDots.map(([n, child]) => colorName(n, child, child.type === 'file' ? fileMeta(`${dirPath}/${n}`, child, homeUser).perms : undefined)).join('  ')];
  };

  if (!letters.has('R')) return block(path);
  const out: string[] = [];
  const walk = (dirPath: string, label: string) => {
    if (out.length) out.push('');
    out.push(c.cyan(label + ':'));
    out.push(...block(dirPath));
    for (const [n, child] of listDir(vfs, dirPath, all)) {
      if (child.type === 'dir') walk(`${dirPath === '/' ? '' : dirPath}/${n}`, `${label === '/' ? '' : label}/${n}`);
    }
  };
  walk(path, target);
  return out;
}

export const TREE_MAX_DEPTH = 4;

/** `tree [-a] [-L n] [path]`, capped so a big host never floods the terminal. */
export function treeLines(vfs: VFS, cwd: string, args: string[]): string[] {
  let depth = 3;
  let all = false;
  let target = '.';
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === '-a') all = true;
    else if (a === '-L') {
      const n = Number(args[++i]);
      if (!Number.isInteger(n) || n < 1) throw new ShellError("tree: Invalid level, must be greater than 0.");
      depth = n;
    } else if (a.startsWith('-')) throw new ShellError(`tree: Invalid argument -\`${a.slice(1)}'. Try tree -L 2 or tree -a.`);
    else target = a;
  }
  const capped = depth > TREE_MAX_DEPTH;
  depth = Math.min(depth, TREE_MAX_DEPTH);
  const path = resolvePath(cwd, target);
  const node = vfs.get(path);
  if (!node) throw new FsError(`${target} [error opening dir]`);
  if (node.type === 'file') return [target, '', '0 directories, 1 file'];
  const out = [c.blue(c.bold(target))];
  let dirs = 0;
  let files = 0;
  const walk = (dirPath: string, prefix: string, level: number) => {
    const entries = listDir(vfs, dirPath, all);
    entries.forEach(([n, child], i) => {
      const last = i === entries.length - 1;
      out.push(prefix + (last ? '└── ' : '├── ') + colorName(n, child));
      if (child.type === 'dir') {
        dirs++;
        if (level < depth) walk(`${dirPath === '/' ? '' : dirPath}/${n}`, prefix + (last ? '    ' : '│   '), level + 1);
        else if (Object.keys(child.children).length) out.push(prefix + (last ? '    ' : '│   ') + c.dim('└── …'));
      } else files++;
    });
  };
  walk(path, '', 1);
  out.push('', `${dirs} director${dirs === 1 ? 'y' : 'ies'}, ${files} file${files === 1 ? '' : 's'}`);
  if (capped) out.push(c.dim(`(depth capped at ${TREE_MAX_DEPTH}; cd deeper and run tree again)`));
  return out;
}

function globToRe(glob: string): RegExp {
  return new RegExp('^' + glob.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*').replace(/\?/g, '.') + '$');
}

export interface FindResult {
  lines: string[];
  /** Absolute paths that matched, for the FILESYSTEM panel. */
  paths: string[];
}

/** `find [path] [-name GLOB] [-iname GLOB] [-type f|d] [-maxdepth n]`. */
export function findPaths(vfs: VFS, cwd: string, args: string[]): FindResult {
  let start = '.';
  let i = 0;
  if (args[0] && !args[0].startsWith('-')) {
    start = args[0];
    i = 1;
  }
  let name: RegExp | null = null;
  let type: 'f' | 'd' | null = null;
  let maxDepth = Infinity;
  for (; i < args.length; i++) {
    const a = args[i];
    const val = args[i + 1];
    if (a === '-name' || a === '-iname') {
      if (val === undefined) throw new ShellError(`find: missing argument to \`${a}'`);
      name = globToRe(val);
      if (a === '-iname') name = new RegExp(name.source, 'i');
      i++;
    } else if (a === '-type') {
      if (val === undefined) throw new ShellError("find: missing argument to `-type'");
      if (val !== 'f' && val !== 'd') throw new ShellError(`find: Unknown argument to -type: ${val}`);
      type = val;
      i++;
    } else if (a === '-maxdepth') {
      const n = Number(val);
      if (!Number.isInteger(n) || n < 0) throw new ShellError(`find: Expected a positive decimal integer argument to -maxdepth, but got '${val ?? ''}'`);
      maxDepth = n;
      i++;
    } else if (a.startsWith('-')) {
      throw new ShellError(`find: unknown predicate \`${a}'. Supported: -name -iname -type f|d -maxdepth`);
    } else {
      throw new ShellError(`find: paths must precede expression: \`${a}'`);
    }
  }
  const root = resolvePath(cwd, start);
  const node = vfs.get(root);
  if (!node) throw new FsError(`find: '${start}': No such file or directory`);
  const lines: string[] = [];
  const paths: string[] = [];
  const visit = (abs: string, shown: string, n: VNode, depth: number) => {
    const base = depth === 0 ? start.replace(/\/$/, '').split('/').pop() || start : abs.split('/').pop()!;
    const typeOk = !type || (type === 'f' ? n.type === 'file' : n.type === 'dir');
    if (typeOk && (!name || name.test(base))) {
      lines.push(shown);
      paths.push(abs);
    }
    if (n.type !== 'dir' || depth >= maxDepth) return;
    for (const child of Object.keys(n.children).sort()) {
      visit(`${abs === '/' ? '' : abs}/${child}`, `${shown.replace(/\/$/, '')}/${child}`, n.children[child], depth + 1);
    }
  };
  visit(root, start, node, 0);
  return { lines, paths };
}

/** `file PATH`: guesses a type from content, like libmagic would. */
export function fileTypeLine(vfs: VFS, cwd: string, target: string): string {
  const path = resolvePath(cwd, target);
  const node = vfs.get(path);
  if (!node) throw new FsError(`${target}: cannot open \`${target}' (No such file or directory)`);
  return `${target}: ${describeType(path, node)}`;
}

function describeType(path: string, node: VNode): string {
  if (node.type === 'dir') return 'directory';
  const t = node.content;
  if (!t) return 'empty';
  if (t.startsWith('SQLite format 3')) return 'SQLite 3.x database';
  if (t.startsWith('%PDF')) return 'PDF document, version 1.7';
  if (t.includes('BEGIN OPENSSH PRIVATE KEY')) return 'OpenSSH private key';
  if (/^ssh-(ed25519|rsa) /.test(t)) return 'OpenSSH ED25519 public key';
  if (t.startsWith('#!')) return `${t.split('\n')[0].slice(2).trim()} script, ASCII text executable`;
  if (path.endsWith('.csv')) return 'CSV text';
  if (/sshd\[\d+\]/.test(t)) return 'ASCII text (syslog-style log)';
  return 'ASCII text';
}

/** `stat PATH`. */
export function statLines(vfs: VFS, cwd: string, target: string, homeUser: string): string[] {
  const path = resolvePath(cwd, target);
  const node = vfs.get(path);
  if (!node) throw new FsError(`stat: cannot statx '${target}': No such file or directory`);
  const m = fileMeta(path, node, homeUser);
  const octal = m.perms
    .slice(1)
    .match(/.{3}/g)!
    .map((t) => (t[0] === 'r' ? 4 : 0) + (t[1] === 'w' ? 2 : 0) + (t[2] === 'x' ? 1 : 0))
    .join('');
  const uid = m.owner === 'root' ? 0 : 1000 + (hash(m.owner) % 50);
  return [
    `  File: ${path}`,
    `  Size: ${m.size}\tBlocks: ${Math.ceil(m.size / 512) * 8}\tIO Block: 4096   ${node.type === 'dir' ? 'directory' : 'regular file'}`,
    `Device: 0,${41 + (hash(path) % 8)}\tInode: ${100000 + (hash(path) % 900000)}\tLinks: ${m.links}`,
    `Access: (0${octal}/${m.perms})  Uid: (${String(uid).padStart(5)}/${m.owner.padStart(8)})   Gid: (${String(uid).padStart(5)}/${m.owner.padStart(8)})`,
    `Modify: 2026-11-${m.date.slice(4, 6).trim().padStart(2, '0')} ${m.date.slice(7)}:00.000000000 +0000`,
  ];
}

/** Expands `!!`, `!n` and `!-n` against the numbered history (1-based). Returns null when no expansion applies. */
export function expandHistory(line: string, history: string[]): { line: string } | { error: string } | null {
  const t = line.trim();
  if (!t.startsWith('!') || t === '!') return null;
  let idx: number;
  if (t === '!!') idx = history.length - 1;
  else if (/^!-\d+$/.test(t)) idx = history.length - Number(t.slice(2));
  else if (/^!\d+$/.test(t)) idx = Number(t.slice(1)) - 1;
  else return { error: `neosh: ${t}: event not found` };
  const hit = history[idx];
  if (hit === undefined) return { error: `neosh: ${t}: event not found` };
  return { line: hit };
}

/** Pager pages for less/more: fixed-height slices plus a status line. */
export function pagerPages(lines: string[], height: number): string[][] {
  const h = Math.max(3, height);
  const pages: string[][] = [];
  for (let i = 0; i < lines.length; i += h) pages.push(lines.slice(i, i + h));
  return pages.length ? pages : [[]];
}
