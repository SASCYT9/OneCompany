import { NextRequest, NextResponse } from 'next/server';
import { fetchTurn14ItemPricing } from '@/lib/turn14';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Item ID is required' }, { status: 400 });
    }

    const pricingResponse = await fetchTurn14ItemPricing(id);
    
    // The response has { data: { id: "100496", type: "PricingItem", attributes: { purchase_cost: ... } } }
    const purchaseCost = pricingResponse?.data?.attributes?.purchase_cost || null;
    const retailPrice = pricingResponse?.data?.attributes?.pricelists?.find((p: any) => p.name === 'Retail')?.price || null;

    return NextResponse.json({
      success: true,
      purchaseCost,
      retailPrice,
      raw: pricingResponse
    });
  } catch (error: any) {
    console.error('[Turn14 Pricing API]', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
