import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';

import { assertAdminRequest } from '@/lib/adminAuth';
import { writeAdminAuditLog, ADMIN_PERMISSIONS } from '@/lib/adminRbac';
import { prisma } from '@/lib/prisma';

/**
 * GET    /api/admin/shop/drafts/[id]   → load full draft detail
 * PATCH  /api/admin/shop/drafts/[id]   → update draft fields (description, items via separate endpoint)
 * DELETE /api/admin/shop/drafts/[id]   → discard draft (hard delete since it never became a real order)
 *
 * Special PATCH actions via `action` query param:
 *   ?action=send-quote    → mark quoteSentAt (caller may then trigger email)
 *   ?action=convert       → convert draft to active order (clears isDraft)
 */

type PatchBody = {
  internalNote?: string | null;
  validUntil?: string | null;
  shippingCost?: number;
  taxAmount?: number;
};

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const cookieStore = await cookies();
    assertAdminRequest(cookieStore, ADMIN_PERMISSIONS.SHOP_ORDERS_READ);

    const { id } = await params;
    const draft = await prisma.shopOrder.findUnique({
      where: { id },
      include: {
        items: { orderBy: { createdAt: 'asc' } },
        customer: { select: { id: true, firstName: true, lastName: true, email: true, group: true, companyName: true } },
      },
    });

    if (!draft) return NextResponse.json({ error: 'Draft not found' }, { status: 404 });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if (!(draft as any).isDraft) {
      return NextResponse.json({ error: 'This order is not a draft' }, { status: 400 });
    }

    return NextResponse.json({
      ...draft,
      subtotal: Number(draft.subtotal),
      shippingCost: Number(draft.shippingCost),
      taxAmount: Number(draft.taxAmount),
      total: Number(draft.total),
      items: draft.items.map((it) => ({
        ...it,
        price: Number(it.price),
        total: Number(it.total),
      })),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      isDraft: (draft as any).isDraft,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      draftQuoteToken: (draft as any).draftQuoteToken,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      draftValidUntil: (draft as any).draftValidUntil ? (draft as any).draftValidUntil.toISOString() : null,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      quoteSentAt: (draft as any).quoteSentAt ? (draft as any).quoteSentAt.toISOString() : null,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      quoteAcceptedAt: (draft as any).quoteAcceptedAt ? (draft as any).quoteAcceptedAt.toISOString() : null,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      quoteDeclinedAt: (draft as any).quoteDeclinedAt ? (draft as any).quoteDeclinedAt.toISOString() : null,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      internalNote: (draft as any).internalNote,
      createdAt: draft.createdAt.toISOString(),
      updatedAt: draft.updatedAt.toISOString(),
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    if (message === 'UNAUTHORIZED') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    console.error('Draft GET error:', error);
    return NextResponse.json({ error: 'Failed to load draft' }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const cookieStore = await cookies();
    const session = assertAdminRequest(cookieStore, ADMIN_PERMISSIONS.SHOP_ORDERS_WRITE);

    const { id } = await params;
    const action = request.nextUrl.searchParams.get('action') || '';
    const body = (await request.json().catch(() => ({}))) as PatchBody;

    const draft = await prisma.shopOrder.findUnique({ where: { id } });
    if (!draft) return NextResponse.json({ error: 'Draft not found' }, { status: 404 });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if (!(draft as any).isDraft) {
      return NextResponse.json({ error: 'This order is not a draft' }, { status: 400 });
    }

    // Action: send-quote
    if (action === 'send-quote') {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (prisma as any).shopOrder.update({
        where: { id },
        data: { quoteSentAt: new Date() },
      });
      await writeAdminAuditLog(prisma, session, {
        scope: 'shop',
        action: 'draft.send-quote',
        entityType: 'shop.order',
        entityId: id,
        metadata: { orderNumber: draft.orderNumber },
      });
      return NextResponse.json({ ok: true, sentAt: new Date().toISOString() });
    }

    // Action: convert to order
    if (action === 'convert') {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const updated = await (prisma as any).shopOrder.update({
        where: { id },
        data: {
          isDraft: false,
          status: 'PENDING_PAYMENT',
          quoteAcceptedAt: new Date(),
        },
      });
      await writeAdminAuditLog(prisma, session, {
        scope: 'shop',
        action: 'draft.convert',
        entityType: 'shop.order',
        entityId: id,
        metadata: { orderNumber: draft.orderNumber, total: Number(draft.total) },
      });
      return NextResponse.json({ ok: true, orderId: updated.id });
    }

    // Action: decline (admin marks quote rejected)
    if (action === 'decline') {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (prisma as any).shopOrder.update({
        where: { id },
        data: { quoteDeclinedAt: new Date() },
      });
      await writeAdminAuditLog(prisma, session, {
        scope: 'shop',
        action: 'draft.decline',
        entityType: 'shop.order',
        entityId: id,
        metadata: {},
      });
      return NextResponse.json({ ok: true });
    }

    // Default: regular update
    const data: Record<string, unknown> = {};
    if (body.internalNote !== undefined) data.internalNote = body.internalNote;
    if (body.validUntil !== undefined) data.draftValidUntil = body.validUntil ? new Date(body.validUntil) : null;
    if (body.shippingCost !== undefined) data.shippingCost = body.shippingCost;
    if (body.taxAmount !== undefined) data.taxAmount = body.taxAmount;

    if (Object.keys(data).length === 0) {
      return NextResponse.json({ ok: true });
    }

    // Recompute total if shipping/tax changed
    if (data.shippingCost !== undefined || data.taxAmount !== undefined) {
      data.total = Number(draft.subtotal) + Number(data.shippingCost ?? draft.shippingCost) + Number(data.taxAmount ?? draft.taxAmount);
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (prisma as any).shopOrder.update({ where: { id }, data });
    await writeAdminAuditLog(prisma, session, {
      scope: 'shop',
      action: 'draft.update',
      entityType: 'shop.order',
      entityId: id,
      metadata: { updates: Object.keys(data) },
    });

    return NextResponse.json({ ok: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    if (message === 'UNAUTHORIZED') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (message === 'FORBIDDEN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    console.error('Draft PATCH error:', error);
    return NextResponse.json({ error: 'Failed to update draft' }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const cookieStore = await cookies();
    const session = assertAdminRequest(cookieStore, ADMIN_PERMISSIONS.SHOP_ORDERS_WRITE);

    const { id } = await params;
    const draft = await prisma.shopOrder.findUnique({ where: { id } });
    if (!draft) return NextResponse.json({ error: 'Draft not found' }, { status: 404 });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if (!(draft as any).isDraft) {
      return NextResponse.json({ error: 'Only drafts can be discarded' }, { status: 400 });
    }

    // Hard delete since it was never a real order
    await prisma.shopOrder.delete({ where: { id } });

    await writeAdminAuditLog(prisma, session, {
      scope: 'shop',
      action: 'draft.discard',
      entityType: 'shop.order',
      entityId: id,
      metadata: { orderNumber: draft.orderNumber },
    });

    return NextResponse.json({ ok: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    if (message === 'UNAUTHORIZED') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    console.error('Draft DELETE error:', error);
    return NextResponse.json({ error: 'Failed to discard draft' }, { status: 500 });
  }
}
