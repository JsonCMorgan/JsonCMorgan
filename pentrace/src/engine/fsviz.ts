import type { VDir } from './vfs';

export type FsEntryKind = 'dir' | 'file';

export type FsEntry = { name: string; kind: FsEntryKind };

export type FsVizModel = {
  hostname: string;
  cwd: string;
  displayCwd: string;
  listPath: string;
  displayListPath: string;
  entries: FsEntry[];
  /** Entry names to glow (cat/less target, find hits). */
  highlight?: string[];
};

export type FsCrumb = { label: string; abs: string };

/** Breadcrumb trail for an absolute cwd (home prefix shown as ~). */
export function cwdBreadcrumb(cwd: string, homeAbs = '/home/ghost'): FsCrumb[] {
  const crumbs: FsCrumb[] = [{ label: '/', abs: '/' }];
  if (cwd === '/') return crumbs;
  if (cwd === homeAbs || cwd.startsWith(homeAbs + '/')) {
    crumbs.push({ label: '~', abs: homeAbs });
    const rest = cwd === homeAbs ? [] : cwd.slice(homeAbs.length + 1).split('/').filter(Boolean);
    let acc = homeAbs;
    for (const part of rest) {
      acc += '/' + part;
      crumbs.push({ label: part, abs: acc });
    }
    return crumbs;
  }
  const parts = cwd.split('/').filter(Boolean);
  let acc = '';
  for (const part of parts) {
    acc += '/' + part;
    crumbs.push({ label: part, abs: acc });
  }
  return crumbs;
}

/** Human path with ~ for the operator home prefix. */
export function displayPath(abs: string, homeAbs = '/home/ghost'): string {
  if (abs === homeAbs || abs.startsWith(homeAbs + '/')) {
    return '~' + abs.slice(homeAbs.length);
  }
  return abs || '/';
}

export function entriesFromDir(node: VDir): FsEntry[] {
  return Object.keys(node.children)
    .sort()
    .map((name) => ({
      name,
      kind: node.children[name].type,
    }));
}
/**
 * Where the panel should look after `find`: the shared parent folder when every hit lives in one
 * place, otherwise the search root with the top-level folders that contain hits lit up.
 */
export function findFocus(paths: string[], startAbs: string): { listPath: string; highlight: string[] } {
  if (!paths.length) return { listPath: startAbs, highlight: [] };
  const parent = (p: string) => p.slice(0, p.lastIndexOf('/')) || '/';
  const parents = new Set(paths.map(parent));
  if (parents.size === 1) {
    const only = [...parents][0];
    return { listPath: only, highlight: paths.map((p) => p.slice(p.lastIndexOf('/') + 1)) };
  }
  const prefix = startAbs === '/' ? '/' : startAbs + '/';
  const tops = new Set<string>();
  for (const p of paths) {
    if (!p.startsWith(prefix)) continue;
    tops.add(p.slice(prefix.length).split('/')[0]);
  }
  return { listPath: startAbs, highlight: [...tops] };
}
