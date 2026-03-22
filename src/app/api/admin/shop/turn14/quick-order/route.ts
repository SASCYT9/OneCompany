import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { cookies } from 'next/headers';
import { assertAdminRequest } from '@/lib/adminAuth';
import { ADMIN_PERMISSIONS } from '@/lib/adminRbac';
import { generateOrderNumber, generateViewToken } from '@/lib/shopOrder';

export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    assertAdminRequest(cookieStore, ADMIN_PERMISSIONS.SHOP_ORDERS_WRITE || 'ADMIN_ALL');

    const data = await request.json();
    const { item, customerEmail, salePrice, currency } = data;

    if (!item || !customerEmail || !salePrice) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // 1. Find Customer
    const customer = await prisma.shopCustomer.findUnique({
      where: { email: customerEmail }
    });

    if (!customer) {
      return NextResponse.json({ error: 'Customer not found. Please register them first.' }, { status: 404 });
    }

    // 2. Import item (or find if already imported)
    // For simplicity we simulate an import or assume we just create an unstructured ShopProduct
    // In actual implementation, we'd use `importTurn14ItemInternal(item)`.
    const itemName = item.attributes?.item_name || 'Turn14 Imported Item';
    const brand = item.attributes?.brand || 'Turn14';
    const partNumber = item.attributes?.part_number || 'UNKNOWN';

    // Ensure there's a reference product in the local DB. We can mock it or create it on the fly.
    let productTitle = `${brand} ${itemName}`;
    let productSlug = `turn14-${partNumber.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;

    // 3. Create Draft ShopOrder
    const orderNumber = await generateOrderNumber();
    const viewToken = generateViewToken();
    const parsedSalePrice = parseFloat(salePrice);

    const orderData = {
      orderNumber,
      status: 'PENDING_PAYMENT' as const,
      paymentMethod: 'FOP',
      customerId: customer.id,
      customerGroupSnapshot: customer.group,
      email: customer.email,
      customerName: `${customer.firstName} ${customer.lastName}`,
      phone: customer.phone,
      shippingAddress: {}, // can be updated later by client or admin
      currency: currency || 'EUR',
      subtotal: parsedSalePrice,
      shippingCost: 0,
      taxAmount: 0,
      total: parsedSalePrice,
      pricingSnapshot: { adminCreated: true },
      viewToken,
      items: {
        create: [
          {
            productSlug,
            productId: null, // we skip exact relation if not needed, or resolve it
            variantId: null,
            title: productTitle + ` (SKU: ${partNumber})`,
            quantity: 1,
            price: parsedSalePrice,
            total: parsedSalePrice,
          }
        ]
      }
    };

    const order = await prisma.shopOrder.create({
      data: orderData
    });

    // We can also subtract debt from customer if they're buying B2B on credit:
    // await prisma.shopCustomer.update({ where: { id: customer.id }, data: { balance: { decrement: parsedSalePrice } } });
    
    return NextResponse.json({ success: true, orderId: order.id, orderNumber });

  } catch (error: any) {
    console.error('Turn14 Quick Order Error:', error);
    return NextResponse.json({ error: error.message || 'Failed to process Quick Order' }, { status: 500 });
  }
}

export const runtime = 'nodejs';
