#!/usr/bin/env node
// Creates the PenTrace roadmap milestones and issues from roadmap.json.
// Idempotent: existing milestones and issues (matched by exact title) are skipped.
//
//   node .github/roadmap/seed.mjs --dry-run
//   node .github/roadmap/seed.mjs [--repo owner/name]
//
// Needs the GitHub CLI (`gh`) authenticated with issues write access.

import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const repoFlag = args.indexOf('--repo');
const repo =
  repoFlag >= 0
    ? args[repoFlag + 1]
    : process.env.GITHUB_REPOSITORY ||
      gh(['repo', 'view', '--json', 'nameWithOwner', '--jq', '.nameWithOwner']).trim();

const roadmap = JSON.parse(readFileSync(new URL('./roadmap.json', import.meta.url), 'utf8'));

function gh(argv, input) {
  return execFileSync('gh', argv, {
    encoding: 'utf8',
    input,
    stdio: ['pipe', 'pipe', 'inherit'],
  });
}

function api(path, { method = 'GET', body, paginate = false } = {}) {
  const argv = ['api', path, '--method', method];
  if (paginate) argv.push('--paginate', '--slurp');
  if (body) argv.push('--input', '-');
  const out = gh(argv, body ? JSON.stringify(body) : undefined);
  const parsed = out.trim() ? JSON.parse(out) : null;
  return paginate ? parsed.flat() : parsed;
}

const existingMilestones = new Map(
  api(`repos/${repo}/milestones?state=all&per_page=100`, { paginate: true }).map((m) => [
    m.title,
    m.number,
  ]),
);
const existingIssues = new Set(
  api(`repos/${repo}/issues?state=all&per_page=100`, { paginate: true })
    .filter((i) => !i.pull_request)
    .map((i) => i.title),
);
const existingLabels = new Set(
  api(`repos/${repo}/labels?per_page=100`, { paginate: true }).map((l) => l.name),
);

const created = { milestones: [], issues: [], labels: [] };

function ensureLabels(labels) {
  for (const name of labels) {
    if (existingLabels.has(name)) continue;
    existingLabels.add(name);
    created.labels.push(name);
    if (!dryRun) api(`repos/${repo}/labels`, { method: 'POST', body: { name, color: 'ededed' } });
  }
}

function ensureIssue(issue, milestoneNumber) {
  if (existingIssues.has(issue.title)) {
    console.log(`  = issue exists: ${issue.title}`);
    return;
  }
  ensureLabels(issue.labels);
  const body = {
    title: issue.title,
    body: `${issue.body}\n\n---\n_Seeded from \`.github/roadmap/roadmap.json\`._`,
    labels: issue.labels,
  };
  if (milestoneNumber) body.milestone = milestoneNumber;
  if (dryRun) {
    console.log(`  + would create issue: ${issue.title}`);
  } else {
    const res = api(`repos/${repo}/issues`, { method: 'POST', body });
    console.log(`  + created #${res.number}: ${issue.title}`);
  }
  created.issues.push(issue.title);
}

console.log(`${dryRun ? '[dry run] ' : ''}Seeding roadmap into ${repo}`);

for (const m of roadmap.milestones) {
  let number = existingMilestones.get(m.title);
  if (number) {
    console.log(`= milestone exists: ${m.title} (#${number})`);
  } else if (dryRun) {
    console.log(`+ would create milestone: ${m.title}`);
    created.milestones.push(m.title);
  } else {
    number = api(`repos/${repo}/milestones`, {
      method: 'POST',
      body: { title: m.title, description: m.description },
    }).number;
    console.log(`+ created milestone: ${m.title} (#${number})`);
    created.milestones.push(m.title);
  }
  for (const issue of m.issues) ensureIssue(issue, number);
}

console.log('Unscheduled engineering follow-ups');
for (const issue of roadmap.unscheduled ?? []) ensureIssue(issue);

console.log(
  `\nDone: ${created.milestones.length} milestones, ${created.issues.length} issues, ` +
    `${created.labels.length} labels ${dryRun ? 'would be ' : ''}created.`,
);
