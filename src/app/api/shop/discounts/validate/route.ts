import { NextRequest, NextResponse } from 'next/server';

import { validateDiscountCode } from '@/lib/shopDiscountEngine';

/**
 * Public endpoint for cart UI to validate a discount code before/after entering it.
 *
 * POST /api/shop/discounts/validate
 * Body: {
 *   code: string,
 *   currency: string,
 *   subtotal: number,
 *   shippingCost: number,
 *   customerId?: string | null,
 *   customerEmail?: string | null,
 *   customerGroup?: 'B2C' | 'B2B_PENDING' | 'B2B_APPROVED',
 *   items: Array<{ productId?: string; collectionIds?: string[]; quantity: number; price: number; onSale?: boolean }>
 * }
 *
 * Response: { ok: true, amount, freeShipping, code, type } OR { ok: false, reason }
 */

type ValidateBody = {
  code?: string;
  currency?: string;
  subtotal?: number;
  shippingCost?: number;
  customerId?: string | null;
  customerEmail?: string | null;
  customerGroup?: string;
  items?: Array<{
    productId?: string | null;
    collectionIds?: string[];
    quantity?: number;
    price?: number;
    onSale?: boolean;
  }>;
};

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json().catch(() => ({}))) as ValidateBody;

    if (!body.code || !body.currency) {
      return NextResponse.json({ ok: false, reason: 'Code and currency required' }, { status: 400 });
    }

    const result = await validateDiscountCode(body.code, {
      customerId: body.customerId ?? null,
      customerEmail: body.customerEmail ?? null,
      customerGroup: body.customerGroup ?? 'B2C',
      currency: body.currency,
      subtotal: Number(body.subtotal ?? 0),
      shippingCost: Number(body.shippingCost ?? 0),
      items: (body.items ?? []).map((it) => ({
        productId: it.productId ?? null,
        collectionIds: it.collectionIds ?? [],
        quantity: Number(it.quantity ?? 0),
        price: Number(it.price ?? 0),
        onSale: Boolean(it.onSale),
      })),
    });

    if (!result.ok) {
      return NextResponse.json({ ok: false, reason: result.reason });
    }

    return NextResponse.json({
      ok: true,
      code: result.discount.code,
      type: result.discount.type,
      amount: result.amount,
      freeShipping: result.freeShipping,
    });
  } catch (error: unknown) {
    console.error('Discount validation error:', error);
    return NextResponse.json({ ok: false, reason: 'Validation failed' }, { status: 500 });
  }
}
