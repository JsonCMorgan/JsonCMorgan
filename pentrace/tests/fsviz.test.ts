import { describe, expect, it } from 'vitest';
import { dir, file } from '../src/engine/vfs';
import { cwdBreadcrumb, displayPath, entriesFromDir } from '../src/engine/fsviz';

describe('fsviz helpers', () => {
  it('formats home-relative display paths', () => {
    expect(displayPath('/home/ghost')).toBe('~');
    expect(displayPath('/home/ghost/notes')).toBe('~/notes');
    expect(displayPath('/var/log')).toBe('/var/log');
  });

  it('builds breadcrumbs with ~ at home', () => {
    const crumbs = cwdBreadcrumb('/home/ghost/notes');
    expect(crumbs.map((c) => c.label)).toEqual(['/', '~', 'notes']);
    expect(crumbs[crumbs.length - 1].abs).toBe('/home/ghost/notes');
  });

  it('lists sorted directory entries', () => {
    const d = dir({
      notes: dir(),
      zeta: file('z'),
      alpha: file('a'),
    });
    expect(entriesFromDir(d)).toEqual([
      { name: 'alpha', kind: 'file' },
      { name: 'notes', kind: 'dir' },
      { name: 'zeta', kind: 'file' },
    ]);
  });
});