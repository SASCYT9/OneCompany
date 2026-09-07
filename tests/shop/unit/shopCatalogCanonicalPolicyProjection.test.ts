import assert from "node:assert/strict";
import test from "node:test";
import { canonicalPoliciesToProjectionV2 } from "../../../src/lib/shopCatalogCanonicalPolicyProjection";

test("canonical mapper preserves clause-scoped powertrain identity", () => {
  const policies = canonicalPoliciesToProjectionV2([
    {
      productId: "p",
      variantId: "v",
      mode: "VEHICLE_SPECIFIC",
      dimensionRules: [{ dimension: "ENGINE", isRequired: true, defaultState: "UNKNOWN" }],
      clauses: [
        {
          id: "bmw",
          verification: "VERIFIED",
          constraints: [
            {
              dimension: "ENGINE",
              state: "EXACT",
              values: [{ powertrainId: "pt-bmw", powertrain: { code: "S68" } }],
            },
          ],
        },
        {
          id: "other",
          verification: "NEEDS_REVIEW",
          constraints: [{ dimension: "ENGINE", state: "UNKNOWN", values: [] }],
        },
      ],
    },
  ]);
  const engine = policies[0]!.clauses[0]!.constraints[0]!;
  assert.deepEqual(engine, {
    dimension: "engine",
    state: "EXACT",
    values: [{ kind: "powertrain", powertrainId: "pt-bmw", code: "S68" }],
  });
  assert.equal(policies[0]!.clauses[1]!.verification, "NEEDS_REVIEW");
});

test("canonical mapper rejects incomplete engine identity", () => {
  assert.throws(
    () =>
      canonicalPoliciesToProjectionV2([
        {
          productId: "p",
          mode: "VEHICLE_SPECIFIC",
          clauses: [
            {
              id: "c",
              verification: "VERIFIED",
              constraints: [
                { dimension: "ENGINE", state: "EXACT", values: [{ textValue: "S68" }] },
              ],
            },
          ],
        },
      ]),
    /requires NEEDS_REVIEW/
  );
});

test("review clauses preserve unresolved engine text and cannot promote it", () => {
  const review = canonicalPoliciesToProjectionV2([
    {
      productId: "p",
      mode: "NEEDS_REVIEW",
      clauses: [
        {
          id: "c",
          verification: "NEEDS_REVIEW",
          constraints: [{ dimension: "ENGINE", state: "EXACT", values: [{ textValue: "S68" }] }],
        },
      ],
    },
  ]);
  const engine = review[0]!.clauses[0]!.constraints[0]!;
  assert.ok(engine.state === "EXACT");
  assert.equal(engine.values[0], "S68");
  assert.throws(
    () =>
      canonicalPoliciesToProjectionV2([
        {
          productId: "p",
          mode: "VEHICLE_SPECIFIC",
          clauses: [
            {
              id: "c",
              verification: "VERIFIED",
              constraints: [
                { dimension: "ENGINE", state: "EXACT", values: [{ textValue: "S68" }] },
              ],
            },
          ],
        },
      ]),
    /requires NEEDS_REVIEW/
  );
});

test("canonical mapper preserves every dimension state, variant, and parent target", () => {
  const dimensions = [
    "SCOPE",
    "MAKE",
    "MODEL",
    "GENERATION",
    "CHASSIS",
    "YEAR",
    "ENGINE",
    "FUEL",
    "BODY_STYLE",
    "DRIVETRAIN",
    "TRANSMISSION",
    "MARKET",
    "OPF_GPF",
  ];
  const policy = canonicalPoliciesToProjectionV2([
    {
      productId: "child",
      variantId: "child-v",
      parentProductId: "parent",
      parentVariantId: "parent-v",
      mode: "PARENT_DEPENDENT",
      dimensionRules: dimensions.map((dimension, index) => ({
        dimension,
        isRequired: index === 0,
        defaultState: index % 2 ? "ANY" : "UNKNOWN",
      })),
      clauses: [
        {
          id: "review",
          verification: "NEEDS_REVIEW",
          constraints: dimensions.map((dimension, index) => ({
            dimension,
            state: index % 2 ? "ANY" : "UNKNOWN",
            values: [],
          })),
        },
      ],
    },
  ])[0]!;
  assert.deepEqual(policy.target, { productId: "child", variantId: "child-v" });
  assert.deepEqual(policy.parentTarget, { productId: "parent", variantId: "parent-v" });
  assert.equal(policy.clauses[0]!.constraints.length, 13);
  assert.equal(policy.clauses[0]!.verification, "NEEDS_REVIEW");
});
