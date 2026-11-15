import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { validateMissionDraft } from '../tools/mission/validate-core.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

describe('mission draft validator', () => {
  it('accepts golden relay recon fixture', async () => {
    const golden = await import('../content/drafts/fixtures/golden-relay-recon.json', {
      with: { type: 'json' },
    });
    const { pass, errors } = validateMissionDraft(golden.default);
    expect(errors).toEqual([]);
    expect(pass).toBe(true);
  });

  it('rejects non-allowlisted client', async () => {
    const bad = await import('../content/drafts/fixtures/invalid-bad-client.json', {
      with: { type: 'json' },
    });
    const { pass, errors } = validateMissionDraft(bad.default);
    expect(pass).toBe(false);
    expect(errors.some((e) => e.includes('clientFiction'))).toBe(true);
  });

  it('CLI validates golden fixture', () => {
    const script = join(root, 'tools/mission/mission-validate.mjs');
    const fixture = join(root, 'content/drafts/fixtures/golden-relay-recon.json');
    const out = execFileSync('node', [script, fixture], { encoding: 'utf8' });
    expect(out).toContain('validator pass');
  });

  it('fallback-grammar draft passes validator', () => {
    const script = join(root, 'tools/mission/mission-llama.mjs');
    const out = execFileSync(
      'node',
      [script, '--fallback-grammar', '--seed', '42', '--archetype', 'recon', '--fixer', 'relay', '--domain', '2'],
      { encoding: 'utf8', cwd: root },
    );
    expect(out).toContain('validator: pass');
  });
});
