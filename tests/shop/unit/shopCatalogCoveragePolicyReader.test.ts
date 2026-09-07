import assert from "node:assert/strict";
import { registerHooks } from "./testHooks.mjs";
import path from "node:path";
import test from "node:test";
import { pathToFileURL } from "node:url";

import type { PrismaClient } from "@prisma/client";

const serverOnlyStub = pathToFileURL(
  path.resolve("tests/shop/unit/fixtures/server-only-stub.cjs")
).href;
registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === "server-only") return { url: serverOnlyStub, shortCircuit: true };
    return nextResolve(specifier, context);
  },
});

function afterId(input: unknown) {
  if (!input || typeof input !== "object") return null;
  const value = (input as { gt?: unknown }).gt;
  return typeof value === "string" ? value : null;
}

function selectPage<T extends { id: string }>(
  rows: readonly T[],
  parent: keyof T,
  where: { id?: unknown } & Record<string, unknown>,
  take: number
) {
  const filter = where[parent as string] as { in?: unknown } | undefined;
  const ids = Array.isArray(filter?.in)
    ? filter.in.filter((value): value is string => typeof value === "string")
    : [];
  const after = afterId(where.id);
  return rows
    .filter((row) => ids.includes(String(row[parent])) && (!after || row.id > after))
    .slice(0, take);
}

test("coverage policy reader reconstructs every paged relation without broad reads", async () => {
  const { readCoveragePoliciesWithClient } =
    await import("../../../src/lib/shopCatalogCoveragePolicyReader.server");
  const policies = [
    {
      id: "policy-1",
      targetKey: "variant:1",
      isActive: true,
      sourceRecord: { recordKey: "record", source: { key: "gate-burger" } },
      dimensionRules: [],
    },
  ];
  const clauses = Array.from({ length: 251 }, (_, index) => ({
    id: `clause-${String(index).padStart(3, "0")}`,
    policyId: "policy-1",
    clauseKey: `key-${index}`,
    position: index,
    verification: "VERIFIED",
    sourceRecordId: null,
    sourceRef: "record",
    evidenceHash: null,
    createdAt: new Date(),
  }));
  const constraints = Array.from({ length: 1003 }, (_, index) => ({
    id: `constraint-${String(index).padStart(4, "0")}`,
    clauseId: clauses[0]!.id,
    dimension: "MAKE",
    state: "EXACT",
  }));
  const values = constraints.flatMap((constraint, index) =>
    [0, 1].map((ordinal) => ({
      id: `value-${String(index * 2 + ordinal).padStart(4, "0")}`,
      constraintId: constraint.id,
      dimension: "MAKE",
      state: "EXACT",
      ordinal,
      textValue: `make-${index}`,
      numberValue: null,
      booleanValue: null,
      yearFrom: null,
      yearTo: null,
      makeId: null,
      modelId: null,
      generationId: null,
      powertrainId: null,
      make: null,
      model: null,
      generation: null,
      powertrain: null,
    }))
  );
  const calls: Array<{
    table: string;
    count: number;
    cursor: string | null;
    parentIds: string[];
    take: number;
  }> = [];
  const client = {
    shopCatalogCompatibilityPolicy: {
      findMany: async () => {
        calls.push({
          table: "policy",
          count: policies.length,
          cursor: null,
          parentIds: [],
          take: 0,
        });
        return policies;
      },
    },
    shopCatalogCompatibilityClause: {
      findMany: async (args: { where: { policyId: unknown; id?: unknown }; take: number }) => {
        const page = selectPage(clauses, "policyId", args.where, args.take);
        calls.push({
          table: "clause",
          count: page.length,
          cursor: afterId(args.where.id),
          parentIds: (args.where.policyId as { in?: string[] }).in ?? [],
          take: args.take,
        });
        return page;
      },
    },
    shopCatalogCompatibilityConstraint: {
      findMany: async (args: { where: { clauseId: unknown; id?: unknown }; take: number }) => {
        const page = selectPage(constraints, "clauseId", args.where, args.take);
        calls.push({
          table: "constraint",
          count: page.length,
          cursor: afterId(args.where.id),
          parentIds: (args.where.clauseId as { in?: string[] }).in ?? [],
          take: args.take,
        });
        return page;
      },
    },
    shopCatalogCompatibilityValue: {
      findMany: async (args: { where: { constraintId: unknown; id?: unknown }; take: number }) => {
        const page = selectPage(values, "constraintId", args.where, args.take);
        calls.push({
          table: "value",
          count: page.length,
          cursor: afterId(args.where.id),
          parentIds: (args.where.constraintId as { in?: string[] }).in ?? [],
          take: args.take,
        });
        return page;
      },
    },
  } as unknown as PrismaClient;
  const result = await readCoveragePoliciesWithClient(client, ["variant:1"]);
  assert.equal(result.length, 1);
  assert.equal(result[0]!.clauses.length, 251);
  assert.equal(result[0]!.clauses.flatMap((clause) => clause.constraints).length, 1003);
  assert.equal(
    result[0]!.clauses
      .flatMap((clause) => clause.constraints)
      .flatMap((constraint) => constraint.values).length,
    2006
  );
  assert.ok(calls.filter((call) => call.table === "clause").length >= 2);
  assert.ok(calls.filter((call) => call.table === "constraint").length >= 2);
  assert.ok(calls.filter((call) => call.table === "value").length >= 2);
  assert.ok(calls.length < 100, "pagination must make bounded progress");
  for (const table of ["clause", "constraint", "value"] as const) {
    const pages = calls.filter((call) => call.table === table);
    assert.equal(pages[0]!.cursor, null, `${table} first page has no cursor`);
    assert.ok(
      pages.some((call) => call.count > 0 && call.cursor != null),
      `${table} advances with its child id`
    );
    assert.ok(
      pages.every((call) => call.take <= (table === "clause" ? 250 : 500)),
      `${table} page is bounded`
    );
    assert.ok(
      pages
        .filter((call) => call.table !== "clause")
        .every((call) => call.parentIds.length <= (table === "constraint" ? 250 : 500)),
      `${table} parent filter is bounded`
    );
  }
  assert.ok(
    calls
      .filter((call) => call.table === "constraint")
      .flatMap((call) => call.parentIds)
      .every((id) => id.startsWith("clause-"))
  );
  assert.ok(
    calls
      .filter((call) => call.table === "value")
      .flatMap((call) => call.parentIds)
      .every((id) => id.startsWith("constraint-"))
  );
});

test("coverage policy reader rejects broad input and skips every query for empty input", async () => {
  const { readCoveragePoliciesWithClient } =
    await import("../../../src/lib/shopCatalogCoveragePolicyReader.server");
  const client = {
    shopCatalogCompatibilityPolicy: {
      findMany: async () => {
        throw new Error("must not query");
      },
    },
  } as unknown as PrismaClient;
  assert.deepEqual(await readCoveragePoliciesWithClient(client, []), []);
  await assert.rejects(
    () =>
      readCoveragePoliciesWithClient(
        client,
        Array.from({ length: 51 }, (_, index) => `product:${index}`)
      ),
    /at most 50/
  );
  await assert.rejects(
    () =>
      readCoveragePoliciesWithClient(
        client,
        Array.from({ length: 51 }, () => "product:duplicate")
      ),
    /at most 50/
  );
});
