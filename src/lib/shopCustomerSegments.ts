import { prisma } from '@/lib/prisma';

/**
 * Customer Segments — saved rule sets that compute matching customer IDs.
 *
 * Rules are JSON of shape:
 *   {
 *     match: 'all' | 'any',
 *     conditions: Array<{ field: string, operator: string, value: unknown }>
 *   }
 *
 * Supported fields:
 *   group:        equals/in (CustomerGroup)
 *   isActive:     equals (boolean)
 *   country:      equals/in (string from default address)
 *   tag:          has/lacks (string)
 *   totalSpent:   gte/lte (number)
 *   ordersCount:  gte/lte (number)
 *   lastOrderDays: gte/lte (number)  — days since last order
 *
 * The compute function:
 *   1. Filters ShopCustomer by direct fields (group, isActive)
 *   2. Joins addresses for country
 *   3. Joins ShopEntityTag for tag conditions
 *   4. Computes order aggregates (totalSpent, ordersCount, lastOrderDays)
 *   5. Returns matching customer IDs
 */

export type SegmentOperator =
  | 'equals'
  | 'in'
  | 'gte'
  | 'lte'
  | 'has'
  | 'lacks';

export type SegmentCondition = {
  field: string;
  operator: SegmentOperator;
  value: string | number | boolean | string[] | number[];
};

export type SegmentRules = {
  match: 'all' | 'any';
  conditions: SegmentCondition[];
};

type CustomerSnapshot = {
  id: string;
  group: string;
  isActive: boolean;
  country: string | null;
  tags: Set<string>;
  totalSpent: number;
  ordersCount: number;
  lastOrderDays: number | null;
};

export async function computeSegmentMembers(rules: SegmentRules): Promise<string[]> {
  // Load all active customers — this is O(n) but customers ≤ 100k typically
  const customers = await prisma.shopCustomer.findMany({
    select: {
      id: true,
      group: true,
      isActive: true,
      addresses: { select: { country: true, isDefaultShipping: true }, take: 5 },
    },
  });

  const customerIds = customers.map((c) => c.id);
  if (customerIds.length === 0) return [];

  // Order aggregates
  const orderAgg = new Map<string, { totalSpent: number; ordersCount: number; lastOrderAt: Date | null }>();
  const orders = await prisma.shopOrder.findMany({
    where: {
      customerId: { in: customerIds },
      status: { not: 'CANCELLED' },
    },
    select: {
      customerId: true,
      amountPaid: true,
      paymentStatus: true,
      createdAt: true,
    },
  });

  for (const o of orders) {
    if (!o.customerId) continue;
    const cur = orderAgg.get(o.customerId) ?? { totalSpent: 0, ordersCount: 0, lastOrderAt: null };
    cur.ordersCount += 1;
    if (o.paymentStatus === 'PAID') cur.totalSpent += o.amountPaid;
    if (!cur.lastOrderAt || o.createdAt > cur.lastOrderAt) cur.lastOrderAt = o.createdAt;
    orderAgg.set(o.customerId, cur);
  }

  // Tag aggregates
  const tagsByCustomer = new Map<string, Set<string>>();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const tagRows = (await (prisma as any).shopEntityTag.findMany({
    where: {
      entityType: 'shop.customer',
      entityId: { in: customerIds },
    },
    select: { entityId: true, tag: true },
  })) as Array<{ entityId: string; tag: string }>;

  for (const t of tagRows) {
    const set = tagsByCustomer.get(t.entityId) ?? new Set<string>();
    set.add(t.tag);
    tagsByCustomer.set(t.entityId, set);
  }

  const now = Date.now();

  // Build snapshots
  const snapshots: CustomerSnapshot[] = customers.map((c) => {
    const defaultAddress = c.addresses.find((a) => a.isDefaultShipping) ?? c.addresses[0];
    const agg = orderAgg.get(c.id);
    return {
      id: c.id,
      group: c.group,
      isActive: c.isActive,
      country: defaultAddress?.country ?? null,
      tags: tagsByCustomer.get(c.id) ?? new Set<string>(),
      totalSpent: agg?.totalSpent ?? 0,
      ordersCount: agg?.ordersCount ?? 0,
      lastOrderDays:
        agg && agg.lastOrderAt ? Math.floor((now - agg.lastOrderAt.getTime()) / 86_400_000) : null,
    };
  });

  // Evaluate
  const matched: string[] = [];
  for (const s of snapshots) {
    if (matchesSegment(s, rules)) matched.push(s.id);
  }
  return matched;
}

function matchesSegment(snapshot: CustomerSnapshot, rules: SegmentRules): boolean {
  if (!rules.conditions || rules.conditions.length === 0) return true;
  const evals = rules.conditions.map((cond) => evaluateCondition(snapshot, cond));
  if (rules.match === 'any') return evals.some((v) => v);
  return evals.every((v) => v);
}

function evaluateCondition(s: CustomerSnapshot, cond: SegmentCondition): boolean {
  const val = (s as unknown as Record<string, unknown>)[cond.field] as unknown;
  // Coerce 'true'/'false' strings to booleans for boolean fields
  let needle: unknown = cond.value;
  if (typeof val === 'boolean' && typeof cond.value === 'string') {
    if (cond.value === 'true') needle = true;
    else if (cond.value === 'false') needle = false;
  }
  switch (cond.operator) {
    case 'equals':
      return val === needle;
    case 'in':
      return Array.isArray(needle) && (needle as Array<string | number>).includes(val as string & number);
    case 'gte':
      return typeof val === 'number' && val >= (needle as number);
    case 'lte':
      return typeof val === 'number' && val <= (needle as number);
    case 'has':
      return s.tags.has(String(needle));
    case 'lacks':
      return !s.tags.has(String(needle));
    default:
      return false;
  }
}
