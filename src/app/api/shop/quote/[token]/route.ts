import { NextRequest, NextResponse } from 'next/server';

import { prisma } from '@/lib/prisma';

/**
 * Public endpoint for customer-facing quote view at /quote/[token].
 *
 * GET   /api/shop/quote/[token]   → quote details (read-only)
 * POST  /api/shop/quote/[token]?action=accept   → customer accepts the quote → converts to active order
 * POST  /api/shop/quote/[token]?action=decline  → customer declines
 *
 * Returns 404 if token not found, 410 Gone if already accepted/declined or expired.
 */

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;
    if (!token) return NextResponse.json({ error: 'Missing token' }, { status: 400 });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const draft = await (prisma as any).shopOrder.findFirst({
      where: { draftQuoteToken: token, isDraft: true },
      include: {
        items: { orderBy: { createdAt: 'asc' } },
      },
    });

    if (!draft) return NextResponse.json({ error: 'Quote not found' }, { status: 404 });

    // Check expiry
    const expired = draft.draftValidUntil && draft.draftValidUntil < new Date();

    return NextResponse.json({
      orderNumber: draft.orderNumber,
      customerName: draft.customerName,
      email: draft.email,
      currency: draft.currency,
      subtotal: Number(draft.subtotal),
      shippingCost: Number(draft.shippingCost),
      taxAmount: Number(draft.taxAmount),
      total: Number(draft.total),
      validUntil: draft.draftValidUntil ? draft.draftValidUntil.toISOString() : null,
      sentAt: draft.quoteSentAt ? draft.quoteSentAt.toISOString() : null,
      acceptedAt: draft.quoteAcceptedAt ? draft.quoteAcceptedAt.toISOString() : null,
      declinedAt: draft.quoteDeclinedAt ? draft.quoteDeclinedAt.toISOString() : null,
      expired: Boolean(expired),
      items: draft.items.map((it: { price: { toString(): string }; total: { toString(): string } } & Record<string, unknown>) => ({
        title: it.title,
        productSlug: it.productSlug,
        quantity: it.quantity,
        price: Number(it.price),
        total: Number(it.total),
      })),
    });
  } catch (error: unknown) {
    console.error('Quote view error:', error);
    return NextResponse.json({ error: 'Failed to load quote' }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;
    const action = request.nextUrl.searchParams.get('action') || '';

    if (action !== 'accept' && action !== 'decline') {
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const draft = await (prisma as any).shopOrder.findFirst({
      where: { draftQuoteToken: token, isDraft: true },
    });
    if (!draft) return NextResponse.json({ error: 'Quote not found' }, { status: 404 });

    if (draft.quoteAcceptedAt || draft.quoteDeclinedAt) {
      return NextResponse.json({ error: 'Quote already decided' }, { status: 410 });
    }
    if (draft.draftValidUntil && draft.draftValidUntil < new Date()) {
      return NextResponse.json({ error: 'Quote expired' }, { status: 410 });
    }

    if (action === 'accept') {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (prisma as any).shopOrder.update({
        where: { id: draft.id },
        data: {
          isDraft: false,
          status: 'PENDING_PAYMENT',
          quoteAcceptedAt: new Date(),
        },
      });
      return NextResponse.json({ ok: true, status: 'accepted', orderNumber: draft.orderNumber });
    }

    // decline
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (prisma as any).shopOrder.update({
      where: { id: draft.id },
      data: { quoteDeclinedAt: new Date() },
    });
    return NextResponse.json({ ok: true, status: 'declined' });
  } catch (error: unknown) {
    console.error('Quote action error:', error);
    return NextResponse.json({ error: 'Failed to process action' }, { status: 500 });
  }
}
