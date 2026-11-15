#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { validateMissionDraft } from './validate-core.mjs';

const paths = process.argv.slice(2).filter((a) => !a.startsWith('-'));
if (paths.length === 0) {
  console.error('Usage: mission-validate.mjs <draft.json> [...]');
  process.exit(2);
}

let failed = false;
for (const p of paths) {
  let draft;
  try {
    draft = JSON.parse(readFileSync(p, 'utf8'));
  } catch {
    console.error(`${p}: invalid JSON`);
    failed = true;
    continue;
  }
  const { pass, errors } = validateMissionDraft(draft);
  if (pass) console.log(`${p}: validator pass`);
  else {
    failed = true;
    console.error(`${p}: validator fail\n  - ${errors.join('\n  - ')}`);
  }
}
process.exit(failed ? 1 : 0);
