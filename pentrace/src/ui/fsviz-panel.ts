import type { Game } from '../engine/game';
import { cwdBreadcrumb, displayPath, type FsVizModel } from '../engine/fsviz';
import { esc } from './panels';

export type FsVizAnim = { kind: 'ls' | 'cd'; key: number };

export function fsVizHtml(model: FsVizModel | null, anim: FsVizAnim | null): string {
  if (!model) {
    return `
    <div class="panel-title">FILESYSTEM <span class="dim">// viz</span></div>
    <p class="dim fsviz-empty">Connect or get root to browse remote paths. Your rig shows here at home.</p>`;
  }

  const homeAbs = '/home/ghost';
  const crumbHtml = cwdBreadcrumb(model.cwd, homeAbs)
    .map((crumb) => {
      const active = crumb.abs === model.cwd;
      return `<span class="fsviz-crumb ${active ? 'active' : ''}" data-path="${esc(crumb.abs)}">${esc(crumb.label)}</span>`;
    })
    .join('<span class="fsviz-crumb-sep">▸</span>');

  const folderOpen = anim?.kind === 'ls';
  const cdHop = anim?.kind === 'cd';
  const animKey = anim?.key ?? 0;

  const listLabel =
    model.listPath === model.cwd
      ? displayPath(model.cwd, homeAbs)
      : displayPath(model.listPath, homeAbs);

  const entries =
    model.entries.length === 0
      ? '<div class="fsviz-empty-dir dim">empty directory</div>'
      : model.entries
          .map((e) => {
            const inCwd = model.listPath === model.cwd;
            const here =
              inCwd && e.kind === 'dir' && model.cwd.endsWith('/' + e.name)
                ? ' here'
                : '';
            return `<div class="fsviz-entry ${e.kind}${here}" title="${esc(e.name)}">
              <span class="fsviz-glyph">${e.kind === 'dir' ? '▣' : '▤'}</span>
              <span class="fsviz-name">${esc(e.name)}${e.kind === 'dir' ? '/' : ''}</span>
            </div>`;
          })
          .join('');

  return `
  <div class="panel-title">FILESYSTEM <span class="dim">// ${esc(model.hostname)}</span></div>
  <div class="fsviz-host dim">cwd <b>${esc(model.displayCwd)}</b></div>
  <nav class="fsviz-crumbbar ${cdHop ? 'fsviz-cd-hop' : ''}" data-anim="${animKey}">${crumbHtml}</nav>
  <div class="fsviz-stage">
    <div class="fsviz-folder ${folderOpen ? 'fsviz-folder-open' : ''}" data-anim="${animKey}">
      <div class="fsviz-folder-lid"></div>
      <div class="fsviz-folder-body">
        <div class="fsviz-folder-label">${esc(listLabel)}</div>
        <div class="fsviz-entries">${entries}</div>
      </div>
    </div>
  </div>
  <div class="dim fsviz-hint">${folderOpen ? 'ls · listing' : cdHop ? 'cd · path change' : 'ls and cd update this panel'}</div>`;
}

export function gameFsVizModel(g: Game, listPath?: string): FsVizModel | null {
  return g.filesystemSnapshot(listPath);
}