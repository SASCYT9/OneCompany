# Catalog V2 data/release package

Date: 2026-09-07  
Code package: `2a7cd32f8d8bfa6205915d031a27329bbf909914`

This document is a runbook for a separately approved production operation. No
production database was read or written while preparing it.

## Required order

1. Apply the additive Prisma migration and regenerate the Prisma client.
2. Validate current source revisions and immutable payload/provenance hashes.
3. Run the bounded dry-run-first promotion for KW/FI and every source revision;
   retain old revisions and policies, create supersedes links, and record the
   reviewer and source evidence hash.
4. Run the resumable projection rebuild in bounded pages. On the final empty page,
   pass the complete immutable source manifest to `sourceCoverage`; checkpoint
   completion and coverage marker must commit atomically.
5. Verify UA/EN projection parity, active source heads, visibility, publication
   receipts, outbox lag, failed/dead-letter jobs, and selector readiness.
6. Collect signed shadow and scale evidence for the exact deployed commit.
7. Only then perform the progressive canary, observation window, and any explicit
   SSR activation allowed by the reader guard.

## Data invariants

- Existing product, variant, revision, provenance, and source IDs are retained.
- Unknown, inferred, unsupported, and review facts never become verified exact matches.
- KW/FI incomplete engine/year/fuel facts remain `UNKNOWN` or review-only.
- Each verified application stays clause-correlated; no cross-product broadening is allowed.
- Every published product has both `ua` and `en` projection rows at the same version.
- Version cursors, receipts, and coverage markers are monotonic and idempotent.

## Abort and rollback

Stop before activation if any source record is incomplete, any projection is
missing/stale, any marker version conflicts, or any receipt/dead-letter gate is
non-zero. Roll back the reader to `off`; preserve all data and inspect the
bounded evidence before retrying. A code rollback does not undo an already
committed source revision, so the next promotion must use its explicit version
and supersedes chain.

## Counts and evidence to record

Record the exact manifest denominator, source revisions, canonical policy counts,
UA/EN projection counts, media/provenance parity, outbox and receipt status,
shadow sample count/mismatch rate, and commit-to-visible latency. The historical
local fixture counts (15,163 legacy + 1,999 KW + 223 FI) are planning references,
not production assertions; recompute them from the current source manifest.

