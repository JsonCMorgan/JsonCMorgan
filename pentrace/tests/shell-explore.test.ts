import { describe, expect, it } from 'vitest';
import { stripAnsi } from '../src/engine/ansi';
import { findFocus } from '../src/engine/fsviz';
import { Game, LOST_STREAK } from '../src/engine/game';
import { TREE_MAX_DEPTH, treeLines } from '../src/engine/shell-explore';
import { dir, file, VFS } from '../src/engine/vfs';

const text = (lines: string[]) => lines.map(stripAnsi).join('\n');
const fresh = () => new Game(null, 7, { tutorial: false });

describe('shell exploration', () => {
  it('find -name matches globs and prints paths relative to the start', () => {
    const g = fresh();
    const out = g.exec('find ~ -name "*.txt"').map(stripAnsi);
    expect(out).toContain('~/notes/breach-cheatsheet.txt');
    expect(out).toContain('~/readme.txt');
    expect(out.every((l) => l.endsWith('.txt'))).toBe(true);
  });

  it('find -type d lists only directories and rejects bad predicates', () => {
    const g = fresh();
    const out = g.exec('find . -type d').map(stripAnsi);
    expect(out).toContain('./notes');
    expect(out).toContain('./.ssh');
    expect(out.some((l) => l.endsWith('.txt'))).toBe(false);
    expect(text(g.exec('find . -type x'))).toContain('Unknown argument to -type');
    expect(text(g.exec('find . -bogus'))).toContain('unknown predicate');
    expect(text(g.exec('find /nope -name a'))).toContain('No such file or directory');
  });

  it('tree respects -L and caps depth', () => {
    const vfs = new VFS(dir({ a: dir({ b: dir({ c: dir({ d: dir({ e: dir({ f: file('x') }) }) }) }) }) }));
    const shallow = text(treeLines(vfs, '/', ['-L', '1']));
    expect(shallow).toContain('a/');
    expect(shallow).not.toContain('b/');
    const deep = text(treeLines(vfs, '/', ['-L', '9']));
    expect(deep).toContain(`depth capped at ${TREE_MAX_DEPTH}`);
    expect(deep).not.toContain('e/');
  });

  it('tree -L 0 is an error, like the real tool', () => {
    const g = fresh();
    expect(text(g.exec('tree -L 0'))).toContain('Invalid level');
  });

  it('cd - returns to the previous directory and prints it', () => {
    const g = fresh();
    expect(text(g.exec('cd -'))).toContain('OLDPWD not set');
    g.exec('cd notes');
    g.exec('cd /etc');
    expect(text(g.exec('cd -'))).toBe('~/notes');
    expect(g.run.homeCwd).toBe('/home/ghost/notes');
    g.exec('cd -');
    expect(g.run.homeCwd).toBe('/etc');
  });

  it('pushd and popd walk a directory stack', () => {
    const g = fresh();
    expect(text(g.exec('pushd /var/log'))).toBe('/var/log ~');
    g.exec('pushd ~/notes');
    expect(text(g.exec('dirs'))).toBe('~/notes /var/log ~');
    g.exec('popd');
    expect(g.run.homeCwd).toBe('/var/log');
    g.exec('popd');
    expect(g.run.homeCwd).toBe('/home/ghost');
    expect(text(g.exec('popd'))).toContain('directory stack empty');
  });

  it('ls hides dotfiles unless -a, and -l shows fictional metadata', () => {
    const g = fresh();
    expect(text(g.exec('ls'))).not.toContain('.ssh');
    const all = text(g.exec('ls -a'));
    expect(all).toContain('.ssh/');
    expect(all).toContain('.bash_history');
    const long = text(g.exec('ls -la'));
    expect(long).toMatch(/^total \d+/);
    expect(long).toMatch(/drwx------ +\d+ ghost +ghost +4096 Nov .* \.ssh\//);
    expect(text(g.exec('ls -z'))).toContain('invalid option');
  });

  it('ls -R walks subdirectories', () => {
    const g = fresh();
    const out = text(g.exec('ls -R ~/notes'));
    expect(out).toContain('~/notes:');
    expect(out).toContain('breach-cheatsheet.txt');
  });

  it('file and stat describe paths', () => {
    const g = fresh();
    expect(text(g.exec('file ~/.ssh/id_ed25519'))).toContain('OpenSSH private key');
    expect(text(g.exec('file notes'))).toContain('directory');
    const st = text(g.exec('stat ~/.ssh/id_ed25519'));
    expect(st).toContain('Access: (0600/-rw-------)');
    expect(st).toContain('regular file');
  });

  it('history numbers commands and !n re-runs one', () => {
    const g = fresh();
    g.exec('cd notes');
    g.exec('pwd');
    const hist = text(g.exec('history'));
    expect(hist).toMatch(/1 +cd notes/);
    expect(hist).toMatch(/2 +pwd/);
    g.exec('cd ~');
    const rerun = text(g.exec('!1'));
    expect(rerun).toContain('cd notes');
    expect(g.run.homeCwd).toBe('/home/ghost/notes');
    expect(text(g.exec('!99'))).toContain('event not found');
  });

  it('tail -n and head -5 shorthand', () => {
    const g = fresh();
    expect(g.exec('tail -n 2 ~/notes/breach-cheatsheet.txt')).toHaveLength(2);
    expect(g.exec('head -3 ~/notes/breach-cheatsheet.txt')).toHaveLength(3);
  });

  it('less hands the file to the pager instead of printing, unless piped onward', () => {
    const g = fresh();
    expect(g.exec('less ~/notes/breach-cheatsheet.txt')).toEqual([]);
    const pager = g.takePager();
    expect(pager?.title).toBe('~/notes/breach-cheatsheet.txt');
    expect(pager?.lines[0]).toBe('BREACH CHEATSHEET');
    expect(pager?.quitAtEnd).toBe(false);
    const piped = g.exec('less ~/notes/breach-cheatsheet.txt | grep nmap');
    expect(text(piped)).toContain('nmap');
    expect(g.takePager()).toBeNull();
    expect(text(g.exec('more nope.txt'))).toContain('No such file');
  });

  it('help lost shows cwd, home, recent dirs and the next step', () => {
    const g = fresh();
    g.exec('cd notes');
    g.exec('cd /var/log');
    const out = text(g.exec('help lost'));
    expect(out).toContain('cwd      /var/log');
    expect(out).toContain('/home/ghost  (~)');
    expect(out).toMatch(/recent +~\/notes/);
    expect(out).toContain('next');
  });

  it('several "No such file" errors in a row trigger a GUIDE nudge', () => {
    const g = fresh();
    let last = '';
    for (let i = 0; i < LOST_STREAK; i++) last = text(g.exec(`cd nowhere${i}`));
    expect(last).toContain('GUIDE');
    expect(last).toContain('cd ~');
    expect(g.lostStreak).toBe(LOST_STREAK);
    g.exec('pwd');
    expect(g.lostStreak).toBe(0);
  });

  it('cat, less and find tell the FILESYSTEM panel what to light up', () => {
    const g = fresh();
    g.exec('cat ~/notes/breach-cheatsheet.txt');
    expect(g.takeFsTouch()).toMatchObject({ kind: 'cat', listPath: '/home/ghost/notes', highlight: ['breach-cheatsheet.txt'] });
    g.exec('find ~ -name "*.txt"');
    const t = g.takeFsTouch()!;
    expect(t.kind).toBe('find');
    expect(t.listPath).toBe('/home/ghost');
    expect(t.highlight).toEqual(expect.arrayContaining(['notes', 'readme.txt']));
    const snap = g.filesystemSnapshot('/home/ghost/notes', { highlight: ['breach-cheatsheet.txt'] });
    expect(snap?.highlight).toEqual(['breach-cheatsheet.txt']);
  });

  it('findFocus zooms into a shared parent folder', () => {
    expect(findFocus(['/var/log/a.log', '/var/log/b.log'], '/')).toEqual({ listPath: '/var/log', highlight: ['a.log', 'b.log'] });
    expect(findFocus([], '/etc')).toEqual({ listPath: '/etc', highlight: [] });
  });

  it('remote hosts have realistic but fictional files once rooted', () => {
    const g = fresh();
    const gw = g.world.hosts.find((h) => h.role === 'gateway')!;
    gw.root = true;
    g.exec(`connect ${gw.ip}`);
    expect(text(g.exec('ls -a /home/admin'))).toContain('.bash_history');
    expect(text(g.exec('cat /etc/hostname'))).toBe(gw.hostname);
    expect(text(g.exec('find / -name "*.log"'))).toContain('/var/log/auth.log');
  });
});
