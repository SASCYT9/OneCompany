import "server-only";

import { Prisma, type PrismaClient } from "@prisma/client";

const MAX_TARGETS = 50;
const CLAUSE_PAGE_SIZE = 250;
const CONSTRAINT_PAGE_SIZE = 500;
const VALUE_PAGE_SIZE = 500;

const policyInclude = {
  sourceRecord: { select: { recordKey: true, source: { select: { key: true } } } },
  dimensionRules: true,
} as const satisfies Prisma.ShopCatalogCompatibilityPolicyInclude;

type PolicyRow = Prisma.ShopCatalogCompatibilityPolicyGetPayload<{ include: typeof policyInclude }>;
type ClauseRow =
  Prisma.ShopCatalogCompatibilityClauseGetPayload<Prisma.ShopCatalogCompatibilityClauseDefaultArgs>;
type ConstraintRow =
  Prisma.ShopCatalogCompatibilityConstraintGetPayload<Prisma.ShopCatalogCompatibilityConstraintDefaultArgs>;
type ValueRow = Prisma.ShopCatalogCompatibilityValueGetPayload<{
  include: { make: true; model: true; generation: true; powertrain: true };
}>;

export type CoveragePolicyRow = PolicyRow & { clauses: CoverageClauseRow[] };
export type CoverageClauseRow = ClauseRow & { constraints: CoverageConstraintRow[] };
export type CoverageConstraintRow = ConstraintRow & { values: ValueRow[] };

/**
 * Offline coverage reader. It avoids relation-join nesting for a large source
 * page while preserving the exact policy → clause → constraint → value graph.
 */
export async function readCoveragePoliciesWithClient(
  client: PrismaClient,
  targetKeys: readonly string[]
): Promise<CoveragePolicyRow[]> {
  if (targetKeys.length > MAX_TARGETS) {
    throw new RangeError(`Coverage policy reader accepts at most ${MAX_TARGETS} target keys`);
  }
  const uniqueTargets = [...new Set(targetKeys)];
  if (uniqueTargets.length === 0) return [];

  const policyRows = await client.shopCatalogCompatibilityPolicy.findMany({
    where: { isActive: true, targetKey: { in: uniqueTargets } },
    include: policyInclude,
  });
  const policies = policyRows.map((policy) => ({ ...policy, clauses: [] }));
  const policyById = new Map<string, CoveragePolicyRow>(
    policies.map((policy) => [policy.id, policy])
  );
  if (policyById.size === 0) return policies;

  let clauseAfter: string | null = null;
  for (;;) {
    const clauseRows: ClauseRow[] = await client.shopCatalogCompatibilityClause.findMany({
      where: {
        policyId: { in: [...policyById.keys()] },
        ...(clauseAfter ? { id: { gt: clauseAfter } } : {}),
      },
      orderBy: { id: "asc" },
      take: CLAUSE_PAGE_SIZE,
    });
    if (clauseRows.length === 0) break;
    clauseAfter = clauseRows.at(-1)!.id;
    const clauses = clauseRows.map((clause) => ({ ...clause, constraints: [] }));
    const clauseById = new Map<string, CoverageClauseRow>(
      clauses.map((clause) => [clause.id, clause])
    );
    for (const clause of clauses) policyById.get(clause.policyId)?.clauses.push(clause);

    let constraintAfter: string | null = null;
    const constraintById = new Map<string, CoverageConstraintRow>();
    for (;;) {
      const constraintRows: ConstraintRow[] =
        await client.shopCatalogCompatibilityConstraint.findMany({
          where: {
            clauseId: { in: [...clauseById.keys()] },
            ...(constraintAfter ? { id: { gt: constraintAfter } } : {}),
          },
          orderBy: { id: "asc" },
          take: CONSTRAINT_PAGE_SIZE,
        });
      if (constraintRows.length === 0) break;
      constraintAfter = constraintRows.at(-1)!.id;
      for (const constraint of constraintRows) {
        const assembled = { ...constraint, values: [] };
        constraintById.set(assembled.id, assembled);
        clauseById.get(assembled.clauseId)?.constraints.push(assembled);
      }
      let valueAfter: string | null = null;
      const constraintIds = constraintRows.map((constraint) => constraint.id);
      for (;;) {
        const valueRows: ValueRow[] = await client.shopCatalogCompatibilityValue.findMany({
          where: {
            constraintId: { in: constraintIds },
            ...(valueAfter ? { id: { gt: valueAfter } } : {}),
          },
          orderBy: { id: "asc" },
          take: VALUE_PAGE_SIZE,
          include: { make: true, model: true, generation: true, powertrain: true },
        });
        if (valueRows.length === 0) break;
        valueAfter = valueRows.at(-1)!.id;
        for (const value of valueRows) constraintById.get(value.constraintId)?.values.push(value);
      }
    }
  }
  return policies;
}
