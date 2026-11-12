import { describe, expect, it } from 'vitest';
import { formatHelpIndex, formatHelpPage, HELP_PAGE_COUNT } from '../src/engine/content/help';

describe('help pages', () => {
  it('lists every page in the index', () => {
    const lines = formatHelpIndex().join('\n');
    for (let n = 1; n <= HELP_PAGE_COUNT; n++) {
      expect(lines).toContain(String(n));
    }
  });

  it('formats firewall page with index ids', () => {
    const out = formatHelpPage(5).join('\n');
    expect(out).toContain('HELP 5');
    expect(out).toMatch(/fwbypass|fwrules/i);
    expect(out).toContain('firewall-rules');
  });

  it('rejects unknown page numbers', () => {
    const out = formatHelpPage(99).join('\n');
    expect(out).toMatch(/no page/i);
  });
});
