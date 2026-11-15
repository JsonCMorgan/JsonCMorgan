#!/usr/bin/env node
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  PENTRACE_ROOT,
  loadJson,
  getArchetype,
  loadGrammar,
} from './load-config.mjs';
import { validateMissionDraft } from './validate-core.mjs';

function parseArgs(argv) {
  const out = {
    seed: String(Date.now()),
    archetype: 'recon',
    fixer: 'relay',
    domain: '3',
    model: 'llama3.2',
    baseUrl: 'http://127.0.0.1:11434',
    dryRun: false,
    fallbackGrammar: false,
    outDir: join(PENTRACE_ROOT, 'content/drafts'),
  };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--dry-run') out.dryRun = true;
    else if (a === '--fallback-grammar') out.fallbackGrammar = true;
    else if (a === '--seed' && argv[i + 1]) out.seed = argv[++i];
    else if (a === '--archetype' && argv[i + 1]) out.archetype = argv[++i];
    else if (a === '--fixer' && argv[i + 1]) out.fixer = argv[++i];
    else if (a === '--domain' && argv[i + 1]) out.domain = argv[++i];
    else if (a === '--model' && argv[i + 1]) out.model = argv[++i];
    else if (a === '--base-url' && argv[i + 1]) out.baseUrl = argv[++i];
  }
  return out;
}

function buildPrompt(args, archetype, allow, grammarId) {
  const client =
    allow.clientFiction[parseInt(args.seed, 10) % allow.clientFiction.length] ??
    'Contoso';
  return `You are a mission copywriter for the cybersecurity training game PenTrace.
Output ONLY valid JSON matching this shape (no markdown):
{
  "archetypeId": "${args.archetype}",
  "fixerId": "${args.fixer}",
  "grammarId": "${grammarId}",
  "killChainTemplate": "${archetype.killChainTemplate}",
  "clientFiction": "${client}",
  "objectiveSummary": "one sentence using real infosec jargon",
  "trainingTags": { "sscpDomains": [${args.domain}] },
  "mail": { "subject": "...", "body": ["...", "..."] }
}

Rules:
- Use minimal professional tone (no choom slang).
- Teach industry terms: scope, exfil, lateral movement, IOC, SOC, CVE-style wording.
- Fictional client only: Contoso, NorthPeak, Harbor, or GreenLeaf.
- No credentials, API keys, or real company names.
- No private RFC1918 IPs; use placeholders like GATEWAY_IP or TEST-NET 203.0.113.x if needed.
- Contract type: ${archetype.title}.`;
}

function fallbackDraft(args, archetype, allow, grammarId) {
  const client =
    allow.clientFiction[parseInt(args.seed, 10) % allow.clientFiction.length] ??
    'Contoso';
  const grammar = loadGrammar(grammarId);
  const title = archetype.title;
  const payout = archetype.defaultBands[1] * 250 + 200;
  const objective =
    archetype.id === 'recon'
      ? `Run service detection (nmap -sV) on authorized edge assets for ${client}; document open ports and scope.`
      : archetype.id === 'log_analysis'
        ? `Correlate auth failures in scope; identify external IOC and document TP disposition narrative.`
        : `Breach in-scope segment, retrieve authorized artifact, exfil with Heat managed below threshold.`;
  const body = (grammar?.bodyTemplate ?? ['{{objective}}']).map((line) =>
    line
      .replace(/\{\{client\}\}/g, client)
      .replace(/\{\{objective\}\}/g, objective)
      .replace(/\{\{scope_line\}\}/g, 'Scope: authorized pentest window only.')
      .replace(/\{\{payout_credits\}\}/g, String(payout))
      .replace(/\{\{org\}\}/g, client)
      .replace(/\{\{title\}\}/g, title)
      .replace(/\{\{artifact\}\}/g, 'contract deliverable')
      .replace(/\{\{heat_warning\}\}/g, 'Heat correlates to SOC escalation.'),
  );
  const subject = (grammar?.subjectTemplate ?? 'JOB // {{title}}')
    .replace(/\{\{client\}\}/g, client)
    .replace(/\{\{title\}\}/g, title);
  return {
    archetypeId: args.archetype,
    fixerId: args.fixer,
    grammarId,
    killChainTemplate: archetype.killChainTemplate,
    clientFiction: client,
    objectiveSummary: objective,
    trainingTags: { sscpDomains: [Number(args.domain) || 3] },
    mail: { subject, body },
    meta: { seed: args.seed, generatedBy: 'fallback-grammar' },
  };
}

async function callOllama(baseUrl, model, prompt) {
  const res = await fetch(`${baseUrl}/api/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      prompt,
      stream: false,
      format: 'json',
    }),
  });
  if (!res.ok) throw new Error(`Ollama HTTP ${res.status}`);
  const data = await res.json();
  return data.response;
}

async function main() {
  const args = parseArgs(process.argv);
  const archetype = getArchetype(args.archetype);
  if (!archetype) {
    console.error(`Unknown archetype: ${args.archetype}`);
    process.exit(2);
  }
  const allow = loadJson('fixer_allowlist.json');
  const grammarId =
    allow.grammarByFixer[args.fixer] ?? archetype.grammarIds[0] ?? 'relay_scope_v1';

  if (args.dryRun) {
    console.log(buildPrompt(args, archetype, allow, grammarId));
    process.exit(0);
  }

  let draft;
  if (args.fallbackGrammar) {
    draft = fallbackDraft(args, archetype, allow, grammarId);
  } else {
    try {
      const raw = await callOllama(args.baseUrl, args.model, buildPrompt(args, archetype, allow, grammarId));
      draft = JSON.parse(raw);
      draft.meta = { seed: args.seed, generatedBy: 'ollama', model: args.model };
      if (!draft.killChainTemplate) draft.killChainTemplate = archetype.killChainTemplate;
      if (!draft.grammarId) draft.grammarId = grammarId;
    } catch (e) {
      console.error(`Ollama failed: ${e.message}`);
      process.exit(1);
    }
  }

  const { pass, errors } = validateMissionDraft(draft);
  if (!pass) {
    console.error('Validator rejected draft:', errors.join('; '));
    process.exit(2);
  }

  mkdirSync(args.outDir, { recursive: true });
  const file = join(args.outDir, `${Date.now()}-${args.seed}.json`);
  writeFileSync(file, JSON.stringify(draft, null, 2));
  console.log(`validator: pass\nwrote ${file}`);
}

main();
