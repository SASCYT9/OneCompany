import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/authOptions';

type RouteContext = { params: Promise<{ id: string }> };

async function requireAdmin() {
  const session = await getServerSession(authOptions);
  if (!session) throw new Error('Unauthorized');
  return session;
}

async function recalcOrderTotals(orderId: string) {
  const items = await prisma.shopOrderItem.findMany({ where: { orderId } });
  const subtotal = items.reduce((sum, i) => sum + Number(i.total), 0);
  const order = await prisma.shopOrder.findUnique({ where: { id: orderId }, select: { shippingCost: true, taxAmount: true } });
  const shipping = Number(order?.shippingCost || 0);
  const tax = Number(order?.taxAmount || 0);
  await prisma.shopOrder.update({
    where: { id: orderId },
    data: { subtotal, total: subtotal + shipping + tax },
  });
}

/**
 * POST /api/admin/shop/orders/[id]/items — Add item to order
 */
export async function POST(request: NextRequest, ctx: RouteContext) {
  try {
    await requireAdmin();
    const { id: orderId } = await ctx.params;
    const body = await request.json();
    const { title, price, quantity = 1, image = null, productSlug = '' } = body;

    if (!title || price == null) {
      return NextResponse.json({ error: 'title and price are required' }, { status: 400 });
    }

    const order = await prisma.shopOrder.findUnique({ where: { id: orderId } });
    if (!order) return NextResponse.json({ error: 'Order not found' }, { status: 404 });

    const unitPrice = parseFloat(price);
    const qty = parseInt(quantity, 10) || 1;
    const itemTotal = unitPrice * qty;

    const item = await prisma.shopOrderItem.create({
      data: {
        orderId,
        productSlug: productSlug || `admin-${Date.now()}`,
        title,
        quantity: qty,
        price: unitPrice,
        total: itemTotal,
        image,
      },
    });

    await recalcOrderTotals(orderId);

    return NextResponse.json({
      success: true,
      item: { ...item, price: Number(item.price), total: Number(item.total) },
    });
  } catch (error: any) {
    if (error.message === 'Unauthorized') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    console.error('[Admin Items POST]', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

/**
 * PATCH /api/admin/shop/orders/[id]/items — Edit an item
 * Body: { itemId, title?, price?, quantity?, image? }
 */
export async function PATCH(request: NextRequest, ctx: RouteContext) {
  try {
    await requireAdmin();
    const { id: orderId } = await ctx.params;
    const body = await request.json();
    const { itemId, title, price, quantity, image } = body;

    if (!itemId) return NextResponse.json({ error: 'itemId is required' }, { status: 400 });

    const existing = await prisma.shopOrderItem.findFirst({
      where: { id: itemId, orderId },
    });
    if (!existing) return NextResponse.json({ error: 'Item not found' }, { status: 404 });

    const newPrice = price != null ? parseFloat(price) : Number(existing.price);
    const newQty = quantity != null ? parseInt(quantity, 10) : existing.quantity;
    const newTotal = newPrice * newQty;

    const updated = await prisma.shopOrderItem.update({
      where: { id: itemId },
      data: {
        ...(title != null && { title }),
        ...(price != null && { price: newPrice }),
        ...(quantity != null && { quantity: newQty }),
        total: newTotal,
        ...(image !== undefined && { image }),
      },
    });

    await recalcOrderTotals(orderId);

    return NextResponse.json({
      success: true,
      item: { ...updated, price: Number(updated.price), total: Number(updated.total) },
    });
  } catch (error: any) {
    if (error.message === 'Unauthorized') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    console.error('[Admin Items PATCH]', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

/**
 * DELETE /api/admin/shop/orders/[id]/items — Remove an item
 * Body: { itemId }
 */
export async function DELETE(request: NextRequest, ctx: RouteContext) {
  try {
    await requireAdmin();
    const { id: orderId } = await ctx.params;
    const body = await request.json();
    const { itemId } = body;

    if (!itemId) return NextResponse.json({ error: 'itemId is required' }, { status: 400 });

    const existing = await prisma.shopOrderItem.findFirst({
      where: { id: itemId, orderId },
    });
    if (!existing) return NextResponse.json({ error: 'Item not found' }, { status: 404 });

    await prisma.shopOrderItem.delete({ where: { id: itemId } });
    await recalcOrderTotals(orderId);

    return NextResponse.json({ success: true });
  } catch (error: any) {
    if (error.message === 'Unauthorized') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    console.error('[Admin Items DELETE]', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export const runtime = 'nodejs';
