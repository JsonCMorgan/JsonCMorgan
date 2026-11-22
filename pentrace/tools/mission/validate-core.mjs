import {
  loadJson,
  loadKillChainTemplates,
  loadArchetypes,
  loadGrammar,
} from './load-config.mjs';

const FORBIDDEN_PATTERNS = [
  /\bSECRET_KEY\b/i,
  /\bterminal_token\b/i,
  /\bapp\.db\b/i,
  /\bnordvpn\b/i,
  /Boundry\.AI/i,
  /\b(?:password|api[_-]?key)\s*[:=]\s*\S+/i,
  /\b(?:10\.|172\.(?:1[6-9]|2\d|3[01])\.|192\.168\.)\d+\.\d+\b/,
];

function validateSchemaShape(draft) {
  const errors = [];
  const required = [
    'archetypeId',
    'fixerId',
    'grammarId',
    'clientFiction',
    'objectiveSummary',
    'mail',
  ];
  for (const k of required) {
    if (draft[k] === undefined || draft[k] === null) errors.push(`missing required field: ${k}`);
  }
  if (draft.mail && (!draft.mail.subject || !Array.isArray(draft.mail.body))) {
    errors.push('mail must have subject and body array');
  }
  if (draft.archetypeId && !['recon', 'breach_retrieve', 'log_analysis'].includes(draft.archetypeId)) {
    errors.push(`invalid archetypeId: ${draft.archetypeId}`);
  }
  if (draft.trainingTags?.sscpDomains) {
    for (const d of draft.trainingTags.sscpDomains) {
      if (d < 1 || d > 7) errors.push(`sscp domain out of range: ${d}`);
    }
  }
  return errors;
}

function scanOpsec(text) {
  const hits = [];
  for (const re of FORBIDDEN_PATTERNS) {
    if (re.test(text)) hits.push(`opsec: forbidden pattern ${re}`);
  }
  const privIp = text.match(/\b(?:10\.|172\.(?:1[6-9]|2\d|3[01])\.|192\.168\.)\d+\.\d+\b/g);
  if (privIp) hits.push(`opsec: private IP not allowed (use TEST-NET): ${privIp[0]}`);
  return hits;
}

export function validateMissionDraft(draft) {
  const errors = [];
  errors.push(...validateSchemaShape(draft));

  const allow = loadJson('fixer_allowlist.json');
  const indexIds = loadJson('index-ids.json').indexEntryIds;

  if (draft.fixerId && !allow.fixerIds.includes(draft.fixerId)) {
    errors.push(`fixerId not allowlisted: ${draft.fixerId}`);
  }
  if (draft.clientFiction && !allow.clientFiction.includes(draft.clientFiction)) {
    errors.push(`clientFiction not allowlisted: ${draft.clientFiction}`);
  }

  const archetype = draft.archetypeId ? loadArchetypes().find((a) => a.id === draft.archetypeId) : null;
  if (draft.archetypeId && !archetype) errors.push(`unknown archetype: ${draft.archetypeId}`);

  const kct = draft.killChainTemplate ?? archetype?.killChainTemplate;
  if (kct) {
    const templates = loadKillChainTemplates();
    const tmpl = templates.find((t) => t.id === kct);
    if (!tmpl) errors.push(`unknown killChainTemplate: ${kct}`);
    else {
      for (const step of tmpl.steps) {
        if (!indexIds.includes(step.indexEntryId)) {
          errors.push(`template references unknown index id: ${step.indexEntryId}`);
        }
      }
    }
  }

  if (draft.grammarId) {
    const g = loadGrammar(draft.grammarId);
    if (!g) errors.push(`unknown grammarId: ${draft.grammarId}`);
  }

  const blob = JSON.stringify(draft);
  errors.push(...scanOpsec(blob));

  for (const line of draft.mail?.body ?? []) {
    errors.push(...scanOpsec(line));
  }
  if (draft.mail?.subject) errors.push(...scanOpsec(draft.mail.subject));

  const pass = errors.length === 0;
  return { pass, errors, killChainTemplate: kct };
}
