# One AI golden evals

`stock-ai-cases.json` is a small development regression fixture used against the live One AI
route. It is intentionally not a production release corpus yet. The harness never generates,
duplicates, or pads cases. Product and variant IDs must come from real catalog results and be
confirmed by a reviewer.

## Commands

Run the small local regression corpus:

```bash
SHOP_AI_EVAL_TOKEN=<same-32-byte-server-token> npm run shop:ai:eval
```

The assistant server must have `SHOP_AI_EVAL_ENABLED=1` and the same server-only
`SHOP_AI_EVAL_TOKEN`. The protected request forces V2 for the evaluated turn and bypasses the
public rate limit. This boundary is disabled when `VERCEL_ENV=production`; never expose the
token through a `NEXT_PUBLIC_` variable.

Run the production release gate:

```bash
npm run shop:ai:eval:release
```

Release runs also require `SHOP_AI_EVAL_EXPECTED_COMMIT` with the full 40-character commit
served by the target deployment. The route must confirm that commit plus `v2`/`strict`
provenance headers. Legacy fallback, degraded responses, responses over 100 KB, turns over six
seconds, or P95 full-turn latency over three seconds fail the run.

Authenticated eval responses also record active CPU, retrieval latency, generation calls, and
embedding calls in the JSON report. They are telemetry-only until approved staging baselines
define non-arbitrary release thresholds; these internal metrics are never emitted to public
assistant requests.

The release gate validates the corpus before sending requests. It requires:

- at least 500 committed cases;
- at least 30 cases for every category listed in `stock-ai-release-gate.json`;
- no duplicate normalized locale/query pairs used as corpus padding;
- explicit `metadata.language` on every case.
- explicit human-review metadata on every case: `metadata.reviewer`, a UTC ISO-8601
  `metadata.reviewedAt`, and `metadata.reviewEvidenceId` pointing to the audit record, ticket,
  or other durable review source;
- an explicit `expect.mode` contract on every case:
  - `results` requires `needsClarification: false` plus at least one real
    `expectedProductIds` or `expectedVariantIds` entry;
  - `no_match` requires `needsClarification: false` and expects zero products;
  - `clarification` requires `needsClarification: true` and expects zero products.

Until the real reviewed corpus reaches those thresholds, the release command is expected to
fail. The eight development cases therefore pass fixture validation but honestly fail the
release gate. Do not copy or synthesize cases to make the count pass.

An alternate corpus or category manifest can be selected explicitly:

```bash
npm run shop:ai:eval -- --fixture=tests/shop/evals/my-reviewed-cases.json
npm run shop:ai:eval -- --release-gate --fixture=tests/shop/evals/my-reviewed-cases.json --release-config=tests/shop/evals/my-release-gate.json
```

## Result identity assertions

Every ID in an `expected*` field must be present in the returned product cards. Every ID in
a `forbidden*` field must be absent.

```json
{
  "metadata": {
    "language": "ua",
    "reviewer": "catalog-reviewer@example",
    "reviewedAt": "2026-07-17T08:00:00Z",
    "reviewEvidenceId": "ONEAI-EVAL-123"
  },
  "expect": {
    "mode": "results",
    "needsClarification": false,
    "expectedProductIds": ["real-product-id"],
    "forbiddenProductIds": ["wrong-generation-product-id"],
    "expectedVariantIds": ["real-variant-id"],
    "forbiddenVariantIds": ["wrong-opf-variant-id"]
  }
}
```

These assertions complement the existing vehicle, category, product-kind, OPF/GPF and
forbidden-chassis checks. Do not put placeholder IDs in golden fixtures.

## Language and hard-negative metadata

`metadata.language` describes the language form of the actual query, independently of the
response locale. Supported values are `ua`, `en`, `ru`, `mixed`, and `translit`.

Hard negatives document the near-match that must not leak into the answer:

```json
{
  "metadata": {
    "language": "mixed",
    "tags": ["typo", "emissions-filter"],
    "hardNegative": {
      "dimensions": ["chassis", "opfGpf", "variant"],
      "note": "A reviewed explanation of the dangerous near-match."
    }
  }
}
```

Supported dimensions are `brand`, `category`, `vehicle`, `model`, `chassis`, `year`,
`engine`, `market`, `opfGpf`, `productKind`, `product`, `variant`, and `semantic`.
The metadata is reported by the release gate and stays reviewable in Git.

## Protected release workflow

`.github/workflows/shop-ai-v2-release-eval.yml` is manual-only and must use the protected
`one-ai-v2-release-eval` GitHub Environment with required reviewers. It evaluates an exact
staging commit, writes the JSON eval report, and creates an HMAC-signed marker bound to the
commit, corpus/config hash, and report hash. It does not deploy or promote anything.

Production `SHOP_AI_V2_ENABLED` or `SHOP_AI_V2_SHADOW` activation fails closed unless
`SHOP_AI_V2_RELEASE_GATE_MARKER` verifies with
`SHOP_AI_V2_RELEASE_GATE_SIGNING_SECRET` and matches `VERCEL_GIT_COMMIT_SHA`.

Public rollout stages are restricted to `0`, `10`, `50`, and `100` percent. Shadow and the
protected eval are the internal-canary stages. The separate exact-SKU baseline requires
`SHOP_AI_V2_EXACT_SKU_ENABLED=1`, a canonical SKU match, and no vehicle constraints; it never
turns a null category into `merch` and does not claim vehicle compatibility.

Once a turn selects V2, neither product retrieval nor vehicle resolution falls back to the
legacy catalog. Missing V2 knowledge returns a degraded empty/no-match response and blocks a
release eval.
