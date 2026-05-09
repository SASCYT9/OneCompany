<!--
PR title must follow Conventional Commits, e.g.:
  feat(shop): add tiered shipping calculator for premium brands
  fix(cart): prevent double-submit on checkout
  chore(deps): bump next from 16.2.4 to 16.3.0

See .github/CONTRIBUTING.md for details.
-->

## Summary

<!-- 1–3 bullets: what changed and why. -->

-
-

## Type of change

<!-- Check one. -->

- [ ] `feat` — new feature
- [ ] `fix` — bug fix
- [ ] `perf` — performance improvement
- [ ] `refactor` — internal change, no behavior change
- [ ] `docs` — documentation
- [ ] `test` — tests only
- [ ] `build` / `ci` / `chore` — tooling, deps, infra

## Linked issues

<!-- e.g. Closes #123, Refs #456 -->

## Production safety checklist

- [ ] **No master DB migrations** in this PR (read [no-prod-changes policy](../.github/CONTRIBUTING.md))
- [ ] **No mass updates** to product titles / descriptions / images via Turn14 sync
- [ ] **No new secrets** committed; all sensitive values are in env vars
- [ ] **`.env.example`** updated if new env vars were added
- [ ] **Vercel preview** deploys cleanly (check the bot comment below)

## Test plan

<!-- How did you verify this works? -->

- [ ]
- [ ]

## Screenshots / recordings

<!-- For UI changes. Drag images here. Delete this section if N/A. -->

## Breaking changes

<!-- If yes, describe the migration path. Otherwise: "None." -->

None.

## Deployment notes

<!-- Anything reviewers / deployers need to know? Feature flags, env-var changes,
     manual steps, ordering with other PRs. Otherwise: "None." -->

None.
