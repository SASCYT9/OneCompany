import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';
import { randomBytes } from 'crypto';

import { assertAdminRequest } from '@/lib/adminAuth';
import { writeAdminAuditLog, ADMIN_PERMISSIONS } from '@/lib/adminRbac';
import { prisma } from '@/lib/prisma';

/**
 * GET  /api/admin/shop/drafts        → list draft orders
 * POST /api/admin/shop/drafts        → create a new draft (B2B quote)
 *
 * GET filters:
 *   ?status=PENDING_REVIEW|...    (active draft only; drafts can be in any non-cancelled status)
 *   ?customerId=...
 *   ?search={term}
 *
 * POST body:
 *   {
 *     customerId?: string,
 *     email: string,
 *     customerName: string,
 *     phone?: string,
 *     currency: string,
 *     shippingAddress: { ... },
 *     items: [{ productSlug, productId?, variantId?, title, quantity, price }],
 *     shippingCost?: number,
 *     internalNote?: string,
 *     validUntil?: ISO string
 *   }
 */

type DraftItem = {
  productSlug: string;
  productId?: string | null;
  variantId?: string | null;
  title: string;
  quantity: number;
  price: number;
  image?: string | null;
};

type CreateDraftBody = {
  customerId?: string | null;
  email?: string;
  customerName?: string;
  phone?: string | null;
  currency?: string;
  shippingAddress?: Record<string, unknown>;
  items?: DraftItem[];
  shippingCost?: number;
  taxAmount?: number;
  internalNote?: string | null;
  validUntil?: string | null;
};

function generateDraftToken(): string {
  return randomBytes(24).toString('base64url');
}

function generateDraftOrderNumber(): string {
  const year = new Date().getFullYear();
  const rand = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `DRAFT-${year}-${rand}`;
}

export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    assertAdminRequest(cookieStore, ADMIN_PERMISSIONS.SHOP_ORDERS_READ);

    const { searchParams } = new URL(request.url);
    const customerId = searchParams.get('customerId') || '';
    const search = searchParams.get('search')?.trim() || '';

    const where: Record<string, unknown> = { isDraft: true };
    if (customerId) where.customerId = customerId;
    if (search) {
      where.OR = [
        { orderNumber: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { customerName: { contains: search, mode: 'insensitive' } },
      ];
    }

    const drafts = await prisma.shopOrder.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 200,
      include: {
        customer: { select: { firstName: true, lastName: true, email: true, group: true } },
        _count: { select: { items: true } },
      },
    });

    return NextResponse.json({
      drafts: drafts.map((d) => ({
        id: d.id,
        orderNumber: d.orderNumber,
        customerId: d.customerId,
        customerName: d.customerName,
        email: d.email,
        currency: d.currency,
        subtotal: Number(d.subtotal),
        total: Number(d.total),
        itemsCount: d._count.items,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        draftQuoteToken: (d as any).draftQuoteToken,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        quoteSentAt: (d as any).quoteSentAt ? (d as any).quoteSentAt.toISOString() : null,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        quoteAcceptedAt: (d as any).quoteAcceptedAt ? (d as any).quoteAcceptedAt.toISOString() : null,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        quoteDeclinedAt: (d as any).quoteDeclinedAt ? (d as any).quoteDeclinedAt.toISOString() : null,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        draftValidUntil: (d as any).draftValidUntil ? (d as any).draftValidUntil.toISOString() : null,
        customerGroupSnapshot: d.customerGroupSnapshot,
        createdAt: d.createdAt.toISOString(),
        updatedAt: d.updatedAt.toISOString(),
      })),
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    if (message === 'UNAUTHORIZED') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (message === 'FORBIDDEN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    console.error('Drafts list error:', error);
    return NextResponse.json({ error: 'Failed to load drafts' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const session = assertAdminRequest(cookieStore, ADMIN_PERMISSIONS.SHOP_ORDERS_WRITE);

    const body = (await request.json().catch(() => ({}))) as CreateDraftBody;

    if (!body.email || !body.customerName) {
      return NextResponse.json({ error: 'email and customerName are required' }, { status: 400 });
    }
    if (!body.currency) return NextResponse.json({ error: 'currency is required' }, { status: 400 });
    if (!body.items || !Array.isArray(body.items) || body.items.length === 0) {
      return NextResponse.json({ error: 'At least one line item is required' }, { status: 400 });
    }

    let customerGroup: 'B2C' | 'B2B_PENDING' | 'B2B_APPROVED' = 'B2C';
    if (body.customerId) {
      const customer = await prisma.shopCustomer.findUnique({
        where: { id: body.customerId },
        select: { group: true },
      });
      if (customer) customerGroup = customer.group as typeof customerGroup;
    }

    const subtotal = body.items.reduce((sum, it) => sum + it.price * it.quantity, 0);
    const shippingCost = body.shippingCost ?? 0;
    const taxAmount = body.taxAmount ?? 0;
    const total = subtotal + shippingCost + taxAmount;

    const orderNumber = generateDraftOrderNumber();
    const viewToken = generateDraftToken();
    const draftQuoteToken = generateDraftToken();

    const draft = await prisma.shopOrder.create({
      data: {
        orderNumber,
        viewToken,
        status: 'PENDING_REVIEW',
        email: body.email,
        customerName: body.customerName,
        phone: body.phone ?? null,
        customerId: body.customerId ?? null,
        customerGroupSnapshot: customerGroup,
        currency: body.currency,
        subtotal,
        shippingCost,
        taxAmount,
        total,
        shippingAddress: (body.shippingAddress ?? {}) as object,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ...({
          isDraft: true,
          draftQuoteToken,
          draftValidUntil: body.validUntil ? new Date(body.validUntil) : null,
          internalNote: body.internalNote ?? null,
        } as Record<string, unknown>),
        items: {
          create: body.items.map((it) => ({
            productSlug: it.productSlug,
            productId: it.productId ?? null,
            variantId: it.variantId ?? null,
            title: it.title,
            quantity: it.quantity,
            price: it.price,
            total: it.price * it.quantity,
            image: it.image ?? null,
          })),
        },
      },
    });

    await writeAdminAuditLog(prisma, session, {
      scope: 'shop',
      action: 'draft.create',
      entityType: 'shop.order',
      entityId: draft.id,
      metadata: { orderNumber, isDraft: true, customerId: body.customerId, total },
    });

    return NextResponse.json({ id: draft.id, orderNumber: draft.orderNumber, draftQuoteToken });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    if (message === 'UNAUTHORIZED') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (message === 'FORBIDDEN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    console.error('Draft create error:', error);
    return NextResponse.json({ error: 'Failed to create draft' }, { status: 500 });
  }
}
