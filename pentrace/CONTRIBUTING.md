# Contributing to PenTrace

## Local mission writer (Ollama)

Procedural mission **copy** can be drafted with a local LLM. Mechanics (network layout, kill chains) stay deterministic; Ollama only proposes mail and fiction.

### Prerequisites

1. Install [Ollama](https://ollama.com/) and run `ollama serve` (default `http://127.0.0.1:11434`).
2. Pull a model, for example: `ollama pull llama3.2`
3. From `pentrace/`: `npm install`

### Generate a draft

```bash
npm run mission:draft -- --archetype recon --fixer relay --domain 2
```

Options:

| Flag | Default | Purpose |
| --- | --- | --- |
| `--archetype` | `recon` | `recon`, `breach_retrieve`, `log_analysis` |
| `--fixer` | `relay` | Broker id (see `content/procedural/fixer_allowlist.json`) |
| `--domain` | `3` | SSCP domain id 1–7 for `trainingTags` |
| `--model` | `llama3.2` | Ollama model tag |
| `--base-url` | `http://127.0.0.1:11434` | Ollama API |
| `--seed` | timestamp | Affects fictional client pick |
| `--dry-run` | | Print prompt only |
| `--fallback-grammar` | | Skip Ollama; fill grammar slots (CI-safe) |

Drafts write to `content/drafts/` (gitignored). The CLI runs the validator before saving.

### Validate

```bash
npm run mission:validate -- content/drafts/fixtures/golden-relay-recon.json
```

Golden fixture: `content/drafts/fixtures/golden-relay-recon.json` (checked in for CI).

### Promote to game content

Phase 1: **human review** required. Copy validated mail/objectives into `src/engine/content/contracts.ts` (or future YAML importer in M8). Do not commit raw LLM output without review.

### Opsec

Follow Project `pentrace-opsec-redaction.md`: fictional clients only (Contoso, NorthPeak, Harbor, GreenLeaf), TEST-NET if IPs appear, no secrets or production Boundry details in prompts or commits.

### In-game Ollama

Not shipped in Phase 1. Optional Tauri-only client settings are planned for M8+.
