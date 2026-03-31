import { prisma } from '@/lib/prisma';
import {
  AIRTABLE_TABLES,
  createAirtableRecord,
  fetchAirtableCustomers,
  fetchAllAirtableRecords,
} from '@/lib/airtable';

// If true, actually makes network requests to push to Airtable.
// If false, it acts as a structured dry-run and logs what it would push.
const ENABLE_AIRTABLE_PUSH = process.env.ENABLE_AIRTABLE_EXPORT === 'true';

/**
 * Searches for an existing contact in Airtable by exact Email.
 */
async function findAirtableCustomerByEmail(email: string): Promise<string | null> {
  if (!email) return null;
  const customers = await fetchAllAirtableRecords((opts) =>
    fetchAirtableCustomers({
      ...opts,
      filterFormula: `{Email} = '${email.trim()}'`,
    })
  );
  if (customers.length > 0) {
    return customers[0].id; // Return the Record ID
  }
  return null;
}

export async function exportShopOrderToAirtable(shopOrderId: string) {
  console.log(`[Airtable Export] Initiating export for ShopOrder ID: ${shopOrderId}`);

  // 1. Fetch the full ShopOrder from local Postgres
  const order = await prisma.shopOrder.findUnique({
    where: { id: shopOrderId },
    include: { items: true, customer: true },
  });

  if (!order) {
    throw new Error(`Order ${shopOrderId} not found locally.`);
  }

  // Double check if already exported
  if (order.pricingSnapshot && typeof order.pricingSnapshot === 'object') {
    const snap = order.pricingSnapshot as any;
    if (snap.airtableId) {
      console.log(`[Airtable Export] Order ${order.orderNumber} is already synced to Airtable ID: ${snap.airtableId}`);
      return { status: 'already_synced', airtableId: snap.airtableId };
    }
  }

  let airtableCustomerId: string | null = null;

  // 2. Resolve Customer in Airtable
  airtableCustomerId = await findAirtableCustomerByEmail(order.email);
  if (airtableCustomerId) {
    console.log(`[Airtable Export] Found existing Customer in Airtable: ${airtableCustomerId}`);
  } else {
    // Create new customer
    console.log(`[Airtable Export] Creating new Customer in Airtable...`);
    const newCustomerParams = {
      Название: order.customerName || 'Web Customer',
      Email: order.email,
      Тэг: ['Web Store'],
      Телефон: order.phone || '',
    };
    
    if (ENABLE_AIRTABLE_PUSH) {
      const newRec = await createAirtableRecord(AIRTABLE_TABLES.CUSTOMERS, newCustomerParams);
      airtableCustomerId = newRec.id;
      console.log(`[Airtable Export] Created new Customer: ${airtableCustomerId}`);
    } else {
      console.log(`[DRY-RUN] Would create customer with fields:`, newCustomerParams);
      airtableCustomerId = 'dry-run-customer-123';
    }
  }

  // 3. Create the Sales Order
  // (Note: Airtable number might be auto-increment. We store our web order ID in 'Название')
  const orderParams = {
    Название: `Web Order #${order.orderNumber}`,
    'Статус заказа': 'Новый', // Default new
    'Статус оплаты': order.paymentStatus === 'PAID' ? 'Оплачено полностью' : 'Не оплачено',
    'Дата заказа': order.createdAt.toISOString().split('T')[0],
    'Клиент': [airtableCustomerId],
    'Итого к оплате клиентом': Number(order.total),
  };

  let newOrderAirtableId = 'dry-run-order-123';

  if (ENABLE_AIRTABLE_PUSH) {
    const newOrderRec = await createAirtableRecord(AIRTABLE_TABLES.SALES_ORDERS, orderParams);
    newOrderAirtableId = newOrderRec.id;
    console.log(`[Airtable Export] Created Sales Order: ${newOrderAirtableId}`);
  } else {
    console.log(`[DRY-RUN] Would create Sales Order:`, orderParams);
  }

  // 4. Create the Order Items
  for (let i = 0; i < order.items.length; i++) {
    const item = order.items[i];
    
    let brand = '';
    const itemData = await prisma.shopProduct.findFirst({
        where: { slug: item.productSlug }
    });
    if (itemData) {
        brand = itemData.brand || '';
    }

    const itemParams = {
      'Название товара/услуги': item.title,
      'Номер позиции в заказе': i + 1,
      'Бренд (from Товар)': brand ? [brand] : [],
      'Кол-во заказано': item.quantity,
      'Итоговая цена клиента($)': Number(item.total),
      'Цена клиента за шт($)': Number(item.price),
      'Заказ': [newOrderAirtableId],
      'Источник': 'Web Store Front',
      'Статус позиции': 'В обработке'
    };

    if (ENABLE_AIRTABLE_PUSH) {
      const newItemRec = await createAirtableRecord(AIRTABLE_TABLES.ORDER_ITEMS, itemParams);
      console.log(`[Airtable Export] Created Order Item: ${newItemRec.id}`);
    } else {
      console.log(`[DRY-RUN] Would create Order Item ${i+1}:`, itemParams);
    }
  }

  // 5. Save the generated Order Airtable ID back to our local DB
  if (ENABLE_AIRTABLE_PUSH && newOrderAirtableId !== 'dry-run-order-123') {
    const existingSnap = (order.pricingSnapshot as any) || {};
    await prisma.shopOrder.update({
      where: { id: order.id },
      data: {
        pricingSnapshot: {
          ...existingSnap,
          airtableId: newOrderAirtableId,
        },
      },
    });
    console.log(`[Airtable Export] Linked ShopOrder to Airtable ID: ${newOrderAirtableId}`);
  }

  return { status: 'success', airtableId: newOrderAirtableId, dryRun: !ENABLE_AIRTABLE_PUSH };
}
