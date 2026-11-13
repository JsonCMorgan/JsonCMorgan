import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse as parseYaml } from 'yaml';

const __dirname = dirname(fileURLToPath(import.meta.url));
export const PENTRACE_ROOT = join(__dirname, '../..');
export const CONTENT = join(PENTRACE_ROOT, 'content');
export const PROCEDURAL = join(CONTENT, 'procedural');

export function loadJson(rel) {
  return JSON.parse(readFileSync(join(PROCEDURAL, rel), 'utf8'));
}

export function loadYaml(rel) {
  return parseYaml(readFileSync(join(PROCEDURAL, rel), 'utf8'));
}

export function loadArchetypes() {
  return loadYaml('archetypes.yaml').archetypes;
}

export function loadKillChainTemplates() {
  return loadYaml('kill_chain_templates.yaml').templates;
}

export function loadGrammar(grammarId) {
  const dir = join(PROCEDURAL, 'mail_grammars');
  const files = readdirSync(dir).filter((f) => f.endsWith('.yaml'));
  for (const f of files) {
    const g = parseYaml(readFileSync(join(dir, f), 'utf8'));
    if (g.id === grammarId) return g;
  }
  return null;
}

export function getArchetype(id) {
  return loadArchetypes().find((a) => a.id === id) ?? null;
}
