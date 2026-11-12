import { c } from '../ansi';
import { INDEX_BY_ID } from './index-entries';
import pagesJson from './help-pages.json';

export interface HelpPage {
  n: number;
  title: string;
  indexIds: string[];
  lines: string[];
}

export const HELP_PAGES: HelpPage[] = pagesJson.pages as HelpPage[];
export const HELP_PAGE_COUNT = HELP_PAGES.length;

export function formatHelpIndex(): string[] {
  const lines = [
    c.bold(c.cyan('PENTRACE // help pages')),
    c.dim('Type help <n> for a topic. Examples: help 5 (firewalls), help 6 (jobs).'),
    '',
  ];
  for (const p of HELP_PAGES) {
    lines.push(`  ${c.yellow(String(p.n))}  ${p.title}`);
  }
  lines.push('', c.magenta(' QUICK   ') + 'help  hint  clear  hints [off|nudge|training|auto]');
  return lines;
}

export function formatHelpPage(n: number): string[] {
  const page = HELP_PAGES.find((p) => p.n === n);
  if (!page) {
    return [c.red(`help: no page ${n}. Type help for the list (1–${HELP_PAGE_COUNT}).`)];
  }
  const lines: string[] = [
    c.bold(c.cyan(`HELP ${page.n} // ${page.title}`)),
    c.dim(`help ${page.n + 1 <= HELP_PAGE_COUNT ? page.n + 1 : 1} for next topic · help for index`),
    '',
  ];
  for (const l of page.lines) lines.push('  ' + l);
  if (page.indexIds.length) {
    lines.push('', c.dim('Index entries:'));
    for (const id of page.indexIds) {
      const entry = INDEX_BY_ID[id];
      lines.push(entry ? `  ${c.cyan(id)}  ${entry.title}` : `  ${c.dim(id)}`);
    }
    lines.push(c.dim('  Open INDEX in the top bar or type: index <entry-id>'));
  }
  return lines;
}
