# Legacy local agent experiments

These scripts are historical/manual experiments, not part of the application,
build, CI, Vercel deployment, or current Codex workflow. They were not reclassified
as production tooling during the 2026-08-14 architecture review.

- `Start-LocalClaude.ps1` and `litellm_config.yaml` are an old Windows/local Ollama
  compatibility setup. Model aliases and local dependencies may be obsolete.
- `run_gemma_wiki.py` can overwrite wiki files with model-generated drafts.
- `gemma_batch_processor.ts` is a mock/demo processor; it does not parse the filename
  passed to it and writes synthetic output.
- `obsidian_git_changelog.js` mutates a wiki changelog if a matching file exists.

Do not run any of these automatically. A user must explicitly request the exact
local experiment, and its paths, model names, inputs, output, and overwrite behavior
must be reviewed first. Generated prose is never an authority for architecture,
provider state, product facts, pricing, or production status.

The sibling `.agents/scratch/` directory is also historical and may contain
database-mutating one-off scripts. Never run a scratch script until its target,
queries, transaction/backup behavior, and output have been explicitly reviewed.
