import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { resolveShopCart } from '@/lib/shopCart';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { ttnNumber, cartToken } = body;

    if (!ttnNumber || !cartToken) {
      return NextResponse.json({ error: 'Missing TTN or cart token' }, { status: 400 });
    }

    // 1. Resolve cart to get weights and items
    const { cart } = await resolveShopCart(prisma, { cartToken });

    if (!cart || !cart.items) {
      return NextResponse.json({ error: 'Cart is empty or not found' }, { status: 400 });
    }

    const itemCount = cart.items.reduce((acc: number, item: any) => acc + item.quantity, 0);

    // 2. Here we call the delivery service API (e.g. Nova Poshta API)
    // using the ttnNumber and cart payload to calculate correct cost.
    // Dynamic mock calculation for now based on item quantity:
    const calculatedCost = 150.00 + (itemCount * 20.00);

    return NextResponse.json({
      ttn: ttnNumber,
      shippingCost: calculatedCost,
      currency: 'UAH',
      message: 'Delivery cost calculated successfully'
    });
  } catch (err) {
    console.error('TTN calculation error:', err);
    return NextResponse.json({ error: 'Failed to calculate TTN' }, { status: 500 });
  }
}
