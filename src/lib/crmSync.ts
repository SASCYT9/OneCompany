/**
 * CRM Sync Service — Full Airtable → Local DB replication
 * 
 * Pulls ALL customers, orders, and order items from Airtable
 * and upserts them into local CrmCustomer, CrmOrder, CrmOrderItem tables.
 */

import { prisma } from '@/lib/prisma';
import {
  fetchAllAirtableRecords,
  fetchAirtableCustomers,
  fetchAirtableOrders,
  fetchAirtableOrderItems,
  fetchAirtableProductsByIds,
  type AirtableCustomer,
  type AirtableOrder,
  type AirtableOrderItem,
} from '@/lib/airtable';

export type SyncResult = {
  customers: { synced: number; errors: number };
  orders: { synced: number; errors: number };
  items: { synced: number; errors: number };
  duration: number;
};

/**
 * Full sync: pull everything from Airtable and upsert into local DB
 */
export async function syncAllCrmData(): Promise<SyncResult> {
  const start = Date.now();
  const result: SyncResult = {
    customers: { synced: 0, errors: 0 },
    orders: { synced: 0, errors: 0 },
    items: { synced: 0, errors: 0 },
    duration: 0,
  };

  // 1. Sync Customers
  try {
    const customers = await fetchAllAirtableRecords<AirtableCustomer>(
      (opts) => fetchAirtableCustomers({ ...opts, maxRecords: 100 })
    );

    for (const c of customers) {
      try {
        await prisma.crmCustomer.upsert({
          where: { airtableId: c.id },
          update: {
            name: c.name,
            email: c.email,
            businessName: c.businessName,
            tags: c.tags,
            totalProfit: c.totalProfit,
            totalSales: c.totalSales,
            totalPayments: c.totalPayments,
            balance: c.balance,
            whoOwes: c.whoOwes || null,
            syncedAt: new Date(),
          },
          create: {
            airtableId: c.id,
            name: c.name,
            email: c.email,
            businessName: c.businessName,
            tags: c.tags,
            totalProfit: c.totalProfit,
            totalSales: c.totalSales,
            totalPayments: c.totalPayments,
            balance: c.balance,
            whoOwes: c.whoOwes || null,
          },
        });
        result.customers.synced++;
      } catch (err) {
        console.error(`[CRM Sync] Customer ${c.id} error:`, err);
        result.customers.errors++;
      }
    }
  } catch (err) {
    console.error('[CRM Sync] Customers fetch error:', err);
  }

  // 2. Sync Orders
  try {
    const orders = await fetchAllAirtableRecords<AirtableOrder>(
      (opts) => fetchAirtableOrders({ ...opts, maxRecords: 100 })
    );

    // Build customer airtableId → local ID map
    const customerMap = new Map<string, string>();
    const allLocalCustomers = await prisma.crmCustomer.findMany({
      select: { id: true, airtableId: true },
    });
    for (const lc of allLocalCustomers) {
      customerMap.set(lc.airtableId, lc.id);
    }

    for (const o of orders) {
      try {
        // Link to first customer if available
        const customerAirtableId = o.customerIds?.[0];
        const localCustomerId = customerAirtableId ? customerMap.get(customerAirtableId) : null;

        await prisma.crmOrder.upsert({
          where: { airtableId: o.id },
          update: {
            number: o.number,
            name: o.name,
            orderStatus: o.orderStatus,
            paymentStatus: o.paymentStatus,
            orderDate: o.orderDate ? new Date(o.orderDate) : null,
            completionDate: o.completionDate ? new Date(o.completionDate) : null,
            purchaseCost: o.purchaseCost,
            additionalCosts: o.additionalCosts,
            fullCost: o.fullCost,
            totalAmount: o.totalAmount,
            clientTotal: o.clientTotal,
            profit: o.profit,
            marginality: o.marginality,
            tag: o.tag,
            allShipped: o.allShipped,
            itemCount: o.itemCount,
            customerId: localCustomerId || null,
            syncedAt: new Date(),
          },
          create: {
            airtableId: o.id,
            number: o.number,
            name: o.name,
            orderStatus: o.orderStatus,
            paymentStatus: o.paymentStatus,
            orderDate: o.orderDate ? new Date(o.orderDate) : null,
            completionDate: o.completionDate ? new Date(o.completionDate) : null,
            purchaseCost: o.purchaseCost,
            additionalCosts: o.additionalCosts,
            fullCost: o.fullCost,
            totalAmount: o.totalAmount,
            clientTotal: o.clientTotal,
            profit: o.profit,
            marginality: o.marginality,
            tag: o.tag,
            allShipped: o.allShipped,
            itemCount: o.itemCount,
            customerId: localCustomerId || null,
          },
        });
        result.orders.synced++;
      } catch (err) {
        console.error(`[CRM Sync] Order ${o.id} error:`, err);
        result.orders.errors++;
      }
    }
  } catch (err) {
    console.error('[CRM Sync] Orders fetch error:', err);
  }

  // 3. Sync Order Items
  try {
    const items = await fetchAllAirtableRecords<AirtableOrderItem>(
      (opts) => fetchAirtableOrderItems(opts)
    );

    // Build order airtableId → local ID map
    const orderMap = new Map<string, string>();
    const allLocalOrders = await prisma.crmOrder.findMany({
      select: { id: true, airtableId: true },
    });
    for (const lo of allLocalOrders) {
      orderMap.set(lo.airtableId, lo.id);
    }

    // --- NEW: Fetch SKUs and Image URLs ---
    const uniqueProductIds = Array.from(new Set(items.map(i => i.productId).filter(Boolean))) as string[];
    
    // Chunk requests if large, but fetchAirtableProductsByIds handles batching locally
    const productsLite = await fetchAirtableProductsByIds(uniqueProductIds);
    const skuMap = new Map<string, string>();
    for (const p of productsLite) {
      if (p.sku) skuMap.set(p.id, p.sku);
    }

    // Lookup images from Turn14/DO88 catalog based on extracted SKUs
    const allSkus = Array.from(skuMap.values());
    const turn14Items = await prisma.turn14Item.findMany({
      where: { partNumber: { in: allSkus } },
      select: { partNumber: true, attributes: true }
    });
    const imageMap = new Map<string, string>();
    for (const t14 of turn14Items) {
      if (t14.attributes) {
        const attrs = t14.attributes as any;
        const img = attrs.product_images?.[0] || attrs.thumbnail;
        if (img) imageMap.set(t14.partNumber, img);
      }
    }

    for (const item of items) {
      try {
        const orderAirtableId = item.orderIds?.[0];
        const localOrderId = orderAirtableId ? orderMap.get(orderAirtableId) : null;
        
        const sku = item.productId ? skuMap.get(item.productId) : null;
        const imageUrl = sku ? imageMap.get(sku) : null;

        await prisma.crmOrderItem.upsert({
          where: { airtableId: item.id },
          update: {
            positionNumber: item.positionNumber,
            productName: Array.isArray(item.productName) ? item.productName.join(', ') : String(item.productName || ''),
            brand: Array.isArray(item.brand) ? item.brand.join(', ') : String(item.brand || ''),
            category: Array.isArray(item.category) ? item.category.join(', ') : String(item.category || ''),
            quantity: item.quantity,
            rrpPerUnit: item.rrpPerUnit,
            clientPricePerUnit: item.clientPricePerUnit,
            clientTotal: item.clientTotal,
            actualSalePrice: item.actualSalePrice,
            actualSaleTotal: item.actualSaleTotal,
            purchasePrice: item.purchasePrice,
            purchaseTotal: item.purchaseTotal,
            profitPerItem: item.profitPerItem,
            marginality: item.marginality,
            status: item.status,
            source: item.source,
            productId: item.productId || null,
            sku: sku || null,
            imageUrl: imageUrl || null,
            orderId: localOrderId || null,
            syncedAt: new Date(),
          },
          create: {
            airtableId: item.id,
            positionNumber: item.positionNumber,
            productName: Array.isArray(item.productName) ? item.productName.join(', ') : String(item.productName || ''),
            brand: Array.isArray(item.brand) ? item.brand.join(', ') : String(item.brand || ''),
            category: Array.isArray(item.category) ? item.category.join(', ') : String(item.category || ''),
            quantity: item.quantity,
            rrpPerUnit: item.rrpPerUnit,
            clientPricePerUnit: item.clientPricePerUnit,
            clientTotal: item.clientTotal,
            actualSalePrice: item.actualSalePrice,
            actualSaleTotal: item.actualSaleTotal,
            purchasePrice: item.purchasePrice,
            purchaseTotal: item.purchaseTotal,
            profitPerItem: item.profitPerItem,
            marginality: item.marginality,
            status: item.status,
            source: item.source,
            productId: item.productId || null,
            sku: sku || null,
            imageUrl: imageUrl || null,
            orderId: localOrderId || null,
          },
        });
        result.items.synced++;
      } catch (err) {
        console.error(`[CRM Sync] Item ${item.id} error:`, err);
        result.items.errors++;
      }
    }
  } catch (err: any) {
    console.error('[CRM Sync] Items fetch error:', err);
    throw new Error(`Items fetch error: ${err.message}`);
  }

  result.duration = Date.now() - start;
  console.log(`[CRM Sync] Done in ${result.duration}ms:`, result);
  return result;
}

/**
 * Bridge CRM order items → ShopOrderItem records
 * 
 * For each ShopOrder that was synced from Airtable (has pricingSnapshot.airtableId),
 * finds the corresponding CrmOrder and its CrmOrderItems, and creates
 * ShopOrderItem records so items appear in both admin and client portal.
 */
export async function bridgeCrmItemsToShopOrders(): Promise<{ bridged: number; skipped: number; errors: number }> {
  const result = { bridged: 0, skipped: 0, errors: 0 };

  // Get all ShopOrders that start with AT- (Airtable synced)
  const shopOrders = await prisma.shopOrder.findMany({
    where: { orderNumber: { startsWith: 'AT-' } },
    include: { items: true },
    orderBy: { createdAt: 'desc' },
  });

  // Get all CrmOrders with their items
  const crmOrders = await prisma.crmOrder.findMany({
    include: { items: true },
  });

  // Build airtableId → CrmOrder map
  const crmOrderByAirtableId = new Map(crmOrders.map(o => [o.airtableId, o]));

  for (const shopOrder of shopOrders) {
    try {
      const snap = shopOrder.pricingSnapshot as Record<string, any> | null;
      const airtableId = snap?.airtableId;
      if (!airtableId) {
        result.skipped++;
        continue;
      }

      const crmOrder = crmOrderByAirtableId.get(airtableId);
      if (!crmOrder || crmOrder.items.length === 0) {
        result.skipped++;
        continue;
      }

      // Check which items already exist (by productSlug pattern)
      const existingSlugs = new Set(shopOrder.items.map(i => i.productSlug));

      let bridgedInThisOrder = 0;

      for (const crmItem of crmOrder.items) {
        const slug = `crm-${crmItem.airtableId}`;
        if (existingSlugs.has(slug)) continue; // already bridged

        const title = crmItem.brand
          ? `${crmItem.productName} (${crmItem.brand})`
          : crmItem.productName || `Позиція #${crmItem.positionNumber}`;

        const unitPrice = crmItem.clientPricePerUnit || crmItem.actualSalePrice || 0;
        const itemTotal = crmItem.clientTotal || crmItem.actualSaleTotal || (unitPrice * crmItem.quantity);

        await prisma.shopOrderItem.create({
          data: {
            orderId: shopOrder.id,
            productSlug: slug,
            title,
            quantity: crmItem.quantity,
            price: unitPrice,
            total: itemTotal,
            image: null,
          },
        });
        bridgedInThisOrder++;
        result.bridged++;
      }

      // If we added new items, or if the order was imported with a $0 total but has items now, recalculate the total
      if (bridgedInThisOrder > 0 || (shopOrder.items.length > 0 && Number(shopOrder.total) === 0)) {
        const updatedOrder = await prisma.shopOrder.findUnique({
          where: { id: shopOrder.id },
          include: { items: true }
        });
        if (updatedOrder && updatedOrder.items.length > 0) {
          const subtotal = updatedOrder.items.reduce((acc, item) => acc + Number(item.total || 0), 0);
          const total = subtotal + Number(updatedOrder.shippingCost || 0) + Number(updatedOrder.taxAmount || 0);
          
          await prisma.shopOrder.update({
            where: { id: shopOrder.id },
            data: { subtotal, total }
          });
        }
      }
    } catch (err) {
      console.error(`[CRM Bridge] ShopOrder ${shopOrder.orderNumber} error:`, err);
      result.errors++;
    }
  }

  console.log(`[CRM Bridge] Done: ${result.bridged} bridged, ${result.skipped} skipped, ${result.errors} errors`);
  return result;
}

/**
 * Get sync stats from local DB
 */
export async function getCrmSyncStats() {
  const [customers, orders, items, lastCustomer, lastOrder] = await Promise.all([
    prisma.crmCustomer.count(),
    prisma.crmOrder.count(),
    prisma.crmOrderItem.count(),
    prisma.crmCustomer.findFirst({ orderBy: { syncedAt: 'desc' }, select: { syncedAt: true } }),
    prisma.crmOrder.findFirst({ orderBy: { syncedAt: 'desc' }, select: { syncedAt: true } }),
  ]);

  return {
    customers,
    orders,
    items,
    lastSyncAt: lastCustomer?.syncedAt || lastOrder?.syncedAt || null,
  };
}
