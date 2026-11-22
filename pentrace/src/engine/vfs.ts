export interface VFile {
  type: 'file';
  content: string;
}
export interface VDir {
  type: 'dir';
  children: Record<string, VNode>;
}
export type VNode = VFile | VDir;

export class FsError extends Error {}

export function dir(children: Record<string, VNode> = {}): VDir {
  return { type: 'dir', children };
}
export function file(content: string): VFile {
  return { type: 'file', content };
}

/** Normalizes `path` against `cwd` into an absolute path ("/a/b"). */
export function resolvePath(cwd: string, path: string): string {
  const base = path.startsWith('/') ? [] : cwd.split('/').filter(Boolean);
  if (path === '~' || path.startsWith('~/')) {
    return resolvePath('/', path.replace(/^~/, '/home/ghost'));
  }
  for (const part of path.split('/')) {
    if (!part || part === '.') continue;
    if (part === '..') base.pop();
    else base.push(part);
  }
  return '/' + base.join('/');
}

export class VFS {
  constructor(public root: VDir = dir()) {}

  get(path: string): VNode | undefined {
    let node: VNode = this.root;
    for (const part of path.split('/').filter(Boolean)) {
      if (node.type !== 'dir') return undefined;
      const next: VNode | undefined = node.children[part];
      if (!next) return undefined;
      node = next;
    }
    return node;
  }

  private parentOf(path: string): { parent: VDir; name: string } {
    const parts = path.split('/').filter(Boolean);
    const name = parts.pop();
    if (!name) throw new FsError('cannot modify /');
    const parent = this.get('/' + parts.join('/'));
    if (!parent || parent.type !== 'dir') throw new FsError(`${'/' + parts.join('/')}: No such file or directory`);
    return { parent, name };
  }

  list(path: string): string[] {
    const node = this.get(path);
    if (!node) throw new FsError(`${path}: No such file or directory`);
    if (node.type === 'file') return [path.split('/').pop()!];
    return Object.keys(node.children).sort();
  }

  read(path: string): string {
    const node = this.get(path);
    if (!node) throw new FsError(`${path}: No such file or directory`);
    if (node.type === 'dir') throw new FsError(`${path}: Is a directory`);
    return node.content;
  }

  write(path: string, content: string): void {
    const { parent, name } = this.parentOf(path);
    const existing = parent.children[name];
    if (existing?.type === 'dir') throw new FsError(`${path}: Is a directory`);
    parent.children[name] = file(content);
  }

  mkdirp(path: string): void {
    let node = this.root;
    for (const part of path.split('/').filter(Boolean)) {
      const next = node.children[part];
      if (!next) node = node.children[part] = dir() as VDir;
      else if (next.type === 'dir') node = next;
      else throw new FsError(`${path}: Not a directory`);
    }
  }

  remove(path: string): void {
    const { parent, name } = this.parentOf(path);
    const node = parent.children[name];
    if (!node) throw new FsError(`${path}: No such file or directory`);
    if (node.type === 'dir') throw new FsError(`${path}: Is a directory`);
    delete parent.children[name];
  }

  move(from: string, to: string): void {
    const src = this.parentOf(from);
    const node = src.parent.children[src.name];
    if (!node) throw new FsError(`${from}: No such file or directory`);
    const target = this.get(to);
    const dest = target?.type === 'dir' ? `${to.replace(/\/$/, '')}/${src.name}` : to;
    const d = this.parentOf(dest);
    d.parent.children[d.name] = node;
    delete src.parent.children[src.name];
  }

  /** Expands a trailing `*` glob within one directory, e.g. /var/log/*. */
  glob(path: string): string[] {
    if (!path.includes('*')) return [path];
    const slash = path.lastIndexOf('/');
    const dirPath = path.slice(0, slash) || '/';
    const pattern = path.slice(slash + 1);
    const node = this.get(dirPath);
    if (!node || node.type !== 'dir') return [];
    const re = new RegExp('^' + pattern.split('*').map(escapeRe).join('.*') + '$');
    return Object.keys(node.children)
      .filter((n) => re.test(n))
      .sort()
      .map((n) => `${dirPath === '/' ? '' : dirPath}/${n}`);
  }
}

function escapeRe(s: string) {
  return s.replace(/[.+?^${}()|[\]\\]/g, '\\$&');
}
