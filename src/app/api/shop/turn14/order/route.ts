import { calcItemPrice, calcShipping, lbsToKg } from '@/lib/shippingCalc';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import crypto from 'crypto';
import { fetchTurn14ItemPricing, fetchTurn14ItemDetail } from '@/lib/turn14';

/**
 * POST /api/shop/turn14/order
 * 
 * Creates an order directly from a Turn14 catalog item.
 * Since Turn14 items are live (not stored locally), this bypasses the cart
 * and creates a ShopOrder directly with Turn14 metadata.
 * 
 * Body: { item, customerEmail?, customerName?, customerPhone?, quantity }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { item, customerEmail, customerName, customerPhone, quantity = 1, shippingCost = 0 } = body;

    if (!item || !item.name || (!item.turn14Id && !item.id)) {
      return NextResponse.json({ error: 'Valid Item data is required' }, { status: 400 });
    }

    // Generate a unique order number
    const orderCount = await prisma.shopOrder.count();
    const orderNumber = `T14-${String(orderCount + 1001).padStart(5, '0')}`;

    let turn14RealId = String(item.turn14Id || item.id);
    let verifiedUnitPrice = 0;
    const isLocalProduct = !/^\d+$/.test(turn14RealId);

    if (isLocalProduct) {
      console.log('[Checkout] Processing as LOCAL PRODUCT bypass:', item.id);
      // It's a local product from our DB. Trust the passed price for the 1-click stock bypass, 
      // or optionally re-query prisma.shopProduct. For now we trust the Stock modal price.
      verifiedUnitPrice = item.price || 0;
      if (!verifiedUnitPrice) {
        return NextResponse.json({ error: 'Local product is missing a valid price' }, { status: 400 });
      }
    } else {
      console.log('[Turn14 Checkout DEBUG] Fetching pricing for API ID:', turn14RealId);
      const pricingResponse = await fetchTurn14ItemPricing(turn14RealId);
  
      const attrs = pricingResponse?.data?.attributes || {};
      let purchaseCost = attrs.purchase_cost;
      
      // Fallback logic if pure wholesale purchase_cost is hidden or restricted by the brand
      if (!purchaseCost && attrs.pricelists && Array.isArray(attrs.pricelists)) {
        const jobber = attrs.pricelists.find((p: any) => p.name === 'Jobber');
        const retail = attrs.pricelists.find((p: any) => p.name === 'Retail');
        const map = attrs.pricelists.find((p: any) => p.name === 'MAP');
        
        purchaseCost = jobber?.price || map?.price || retail?.price;
      }
      
      if (!purchaseCost) {
        return NextResponse.json({ error: 'Failed to verify live pricing from Turn14 constructor' }, { status: 400 });
      }
  
      // Mathematically re-apply the stored markup rules using unified logic
      const safeMarkupPct = typeof item.markupPct === 'number' ? item.markupPct : 25;
      const priceResult = calcItemPrice({
        baseCostUsd: purchaseCost,
        markupPct: safeMarkupPct,
        discountPct: 0,
        quantity: 1,
      });
      verifiedUnitPrice = priceResult.unitPrice;
    }

    // VERIFY SHIPPING COST (Volumetric)
    // Fetch dimensions from Turn14 catalog and recalculate freight surcharge server-side
    let verifiedShippingCost = 0;
    
    if (isLocalProduct) {
      verifiedShippingCost = Number(shippingCost) || 0;
    } else {
      try {
        const detailRes = await fetchTurn14ItemDetail(turn14RealId);
        const attrs = detailRes?.data?.attributes;
        if (attrs && attrs.dimensions && attrs.dimensions.length > 0) {
          // Dimensions are in inches from API, weight in lbs
          const dim = attrs.dimensions[0];
          const shipRes = calcShipping({
            actualWeightKg: lbsToKg(dim.weight),
            lengthCm: dim.length * 2.54,
            widthCm: dim.width * 2.54,
            heightCm: dim.height * 2.54,
            zone: 'OTHER' // Default generic Turn14 import zone
          });
          verifiedShippingCost = shipRes.totalShipping;
        }
      } catch (err) {
        console.warn('Failed to verify Turn14 shipping dimensions server-side', err);
        // Fallback to client specified amount ONLY if Turn14 fails to respond (low risk fallback)
        verifiedShippingCost = Number(shippingCost) || 0;
      }
    }

    // Price calculation
    const subtotal = verifiedUnitPrice * quantity;
    const total = subtotal + verifiedShippingCost;

    // Try to find or create customer
    let customerId: string | null = null;
    if (customerEmail) {
      const existing = await prisma.shopCustomer.findUnique({
        where: { email: customerEmail },
      });
      if (existing) {
        customerId = existing.id;
      } else {
        const newCustomer = await prisma.shopCustomer.create({
          data: {
            email: customerEmail,
            firstName: customerName?.split(' ')[0] || '',
            lastName: customerName?.split(' ').slice(1).join(' ') || '',
            phone: customerPhone || null,
            group: 'B2C',
            isActive: true,
            preferredLocale: 'ua',
          },
        });
        customerId = newCustomer.id;
      }
    }

    // Create the order
    const order = await prisma.shopOrder.create({
      data: {
        orderNumber,
        email: customerEmail || 'guest@onecompany.local',
        customerName: customerName || 'Гість',
        customerId,
        status: 'PENDING_REVIEW',
        paymentStatus: 'UNPAID',
        currency: 'USD',
        subtotal,
        shippingCost: verifiedShippingCost,
        taxAmount: 0,
        total,
        amountPaid: 0,
        shippingAddress: {
          line1: '',
          city: '',
          country: '',
          phone: customerPhone || '',
        },
        viewToken: crypto.randomUUID(),
        pricingSnapshot: {
          source: 'turn14_catalog',
          turn14Id: item.turn14Id || item.id,
          partNumber: item.partNumber,
          brandName: item.brand,
          itemName: item.name,
          basePrice: item.basePrice,
          markupPct: item.markupPct,
          finalPrice: verifiedUnitPrice,
          quantity,
          shippingCost: verifiedShippingCost,
        },
        items: {
          create: {
            productSlug: `turn14-${item.partNumber || item.id}`,
            title: `${item.name} (${item.brand || 'Turn14'})`,
            quantity,
            price: verifiedUnitPrice,
            total: subtotal,
            image: item.thumbnail || null,
          },
        },
      },
      include: {
        items: true,
      },
    });

    return NextResponse.json({
      success: true,
      orderNumber: order.orderNumber,
      orderId: order.id,
      total: subtotal,
      message: `Замовлення ${order.orderNumber} створено!`,
    });
  } catch (error: any) {
    console.error('[Turn14 Order Error]', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export const runtime = 'nodejs';
