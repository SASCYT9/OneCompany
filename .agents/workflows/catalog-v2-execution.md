# Catalog V2 execution workflow

Use this workflow for unified catalog performance, fitment standardization, catalog
read-model, admin publication, and Catalog V2 migration tasks.

## Required read order

1. Repository `AGENTS.md`.
2. `.agents/PROJECT_CONTEXT.md`.
3. `docs/catalog-v2/MASTER_PLAN.md`.
4. `docs/catalog-v2/STATUS.md`.
5. The complete current owner path for the assigned work item.

Code and Prisma/deployment configuration override documentation when they disagree.
Fix the stale plan/status entry as part of the task.

## Before editing

1. Run `git status --short --branch`.
2. Preserve all unrelated changes; `src/app/globals.css` is currently user-owned.
3. Select exactly one work-item ID from `STATUS.md` or receive one from the parent
   agent.
4. State file ownership and avoid files assigned to another active workstream.
5. Trace the flow end to end: writer → canonical data → projection/cache → API/RSC →
   customer-visible result.
6. Use generated snapshots only as read-only local/resilience artifacts.

## Implementation rules

- Make changes additive and flag-controlled until parity gates pass.
- Never hand-edit generated files under `public/catalog-*` or `data/*.snapshot.json`.
- Do not run migrations, imports, sync commits, external writes, deploys, or
  production E2E without explicit authorization.
- Do not add runtime `if (brand === ...)` compatibility logic.
- Do not treat `NULL`/missing as wildcard. Use explicit compatibility state.
- Do not introduce a request-time full-catalog read, unbounded ID list, or offset
  deep pagination.
- Do not calculate commerce prices ad hoc. Reuse the pricing domain.
- Partial mutations preserve omitted fields/relations and stable IDs.
- Every schema change includes a forward migration, constraints/indexes, and a
  disposable-DB replay plan. Never use `prisma db push`.
- Server Components call shared read services directly; route handlers reuse those
  services for client reads.
- Pass only JSON-serializable initial data across RSC/client boundaries.
- Cache/invalidation changes must name the exact canonical and projection versions
  they affect.

## Compatibility review checklist

- Are clauses OR and dimensions within a clause AND?
- Does every constrained dimension distinguish `EXACT`, `ANY`,
  `NOT_APPLICABLE`, and `UNKNOWN`?
- Can UNKNOWN ever appear as a verified match? If yes, stop.
- Is the rule per product/variant rather than inferred from brand identity?
- Are aliases resolved before runtime query matching?
- Are source raw values and provenance retained?
- Are ambiguous Cartesian combinations quarantined instead of invented?
- Are ADRO, Eventuri, and RaceChip golden cases covered?

## Query review checklist

- Is page size bounded at the database/search layer?
- Does pagination use a stable cursor?
- Are text, SKU, fitment, and typed attributes indexed?
- Are functions avoided on indexed hot columns by storing normalized values?
- Are facets based on the filtered candidate set?
- Are price/stock hydrated only for returned IDs?
- Does any loop grow with the full catalog inside a request? If yes, stop.
- Are query duration, DB query count, and catalog/projection versions observable?

## Mutation/publication review checklist

- Does one transaction write canonical data, version, revision/audit, and outbox?
- Does replay preserve product/variant/relation identity?
- Can an older event overwrite a newer projection? If yes, stop.
- Is `Saved` distinct from `Published`?
- Do price/stock changes avoid broad ISR invalidation?
- Is cron only recovery, not the normal visibility path?
- Are retries/backlog/dead letters measurable?

## Verification order

1. Narrow unit/contract tests for changed behavior.
2. Relevant shop unit tests.
3. `npm run typecheck`.
4. `npm run lint` and report warnings honestly; zero errors is blocking.
5. Browser/API verification against local or explicitly disposable environment.
6. Scale/query-plan tests when the work item touches the read path.

Do not run `npm run build` casually: it generates catalog artifacts and can require a
catalog database. Do not run `test:shop` without confirming its database and E2E
side-effect requirements.

## Completion and handoff

Update `docs/catalog-v2/STATUS.md` only when coordinated by the root/owning agent, or
send the owner a handoff containing:

```text
Work item:
Outcome:
Files changed:
Contracts changed:
Tests run and exact result:
Data-loss/compatibility risks:
Known follow-ups:
Production actions performed: none
```

An item is not done merely because code compiles. Its acceptance gate in the master
plan must be proven, and all remaining uncertainty must be explicit.
