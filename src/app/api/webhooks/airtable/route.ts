import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import {
  fetchAirtableOrders,
  fetchAirtableCustomers,
  fetchAllAirtableRecords,
  AirtableOrder,
  AirtableCustomer,
} from '@/lib/airtable';
import { syncAllCrmData } from '@/lib/crmSync';
import crypto from 'crypto';

/**
 * POST /api/webhooks/airtable
 * 
 * Receives Airtable webhook notifications when data changes.
 * Automatically syncs affected records into local DB.
 * Also called by cron for periodic sync.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    
    // Airtable webhook sends a payload with changed records
    // But we also support manual/cron trigger with no body
    console.log('[Airtable Webhook] Received notification, starting auto-sync...');

    const results = {
      customersCreated: 0,
      customersUpdated: 0,
      ordersCreated: 0,
      ordersUpdated: 0,
      errors: [] as string[],
    };

    // ═══ Auto-sync customers ═══
    const customers = await fetchAllAirtableRecords<AirtableCustomer>((opts) =>
      fetchAirtableCustomers({ ...opts, maxRecords: 100 })
    );

    for (const atCustomer of customers) {
      try {
        const airtableId = atCustomer.id;
        const customerName = atCustomer.name || 'Unknown';

        const existing = await prisma.shopCustomer.findFirst({
          where: {
            OR: [
              { notes: { contains: airtableId } },
              { companyName: customerName },
            ],
          },
        });

        if (existing) {
          await prisma.shopCustomer.update({
            where: { id: existing.id },
            data: {
              companyName: customerName,
              notes: `[Airtable:${airtableId}] Balance: $${atCustomer.balance.toFixed(2)} | ${atCustomer.whoOwes}`,
            },
          });
          results.customersUpdated++;
        } else {
          const email = `${customerName.toLowerCase().replace(/[^a-z0-9]+/g, '.')}@crm.onecompany.local`;
          await prisma.shopCustomer.create({
            data: {
              email,
              firstName: customerName.split(' ')[0] || customerName,
              lastName: customerName.split(' ').slice(1).join(' ') || '',
              companyName: customerName,
              group: atCustomer.tags.includes('Клиент') ? 'B2B_APPROVED' : 'B2C',
              isActive: true,
              preferredLocale: 'ua',
              notes: `[Airtable:${airtableId}] Balance: $${atCustomer.balance.toFixed(2)} | ${atCustomer.whoOwes}`,
            },
          });
          results.customersCreated++;
        }
      } catch (err: any) {
        results.errors.push(`Customer "${atCustomer.name}": ${err.message}`);
      }
    }

    // ═══ Auto-sync orders ═══
    const statusMap: Record<string, string> = {
      'Новый': 'PENDING_REVIEW',
      'В обработке': 'CONFIRMED',
      'В производстве': 'CONFIRMED',
      'В пути': 'SHIPPED',
      'Выполнен': 'DELIVERED',
      'Отменен': 'CANCELLED',
    };

    const orders = await fetchAllAirtableRecords<AirtableOrder>((opts) =>
      fetchAirtableOrders({ ...opts, maxRecords: 100 })
    );

    for (const atOrder of orders) {
      try {
        const orderNumber = `AT-${atOrder.number}`;
        let customerId: string | null = null;
        if (atOrder.customerIds.length > 0) {
          const customer = await prisma.shopCustomer.findFirst({
            where: { notes: { contains: atOrder.customerIds[0] } },
            select: { id: true },
          });
          customerId = customer?.id || null;
        }

        const existing = await prisma.shopOrder.findFirst({ where: { orderNumber } });
        const orderStatus = statusMap[atOrder.orderStatus] || 'PENDING_REVIEW';

        if (existing) {
          await prisma.shopOrder.update({
            where: { id: existing.id },
            data: {
              status: orderStatus as any,
              paymentStatus: atOrder.paymentStatus === 'Оплачено' ? 'PAID' :
                             atOrder.paymentStatus === 'Частично оплачено' ? 'PARTIALLY_PAID' : 'UNPAID',
              pricingSnapshot: {
                airtableId: atOrder.id,
                airtableName: atOrder.name,
                airtableStatus: atOrder.orderStatus,
                profit: atOrder.profit,
                marginality: atOrder.marginality,
                purchaseCost: atOrder.purchaseCost,
                tag: atOrder.tag,
                lastSync: new Date().toISOString(),
              },
            },
          });
          results.ordersUpdated++;
        } else {
          await prisma.shopOrder.create({
            data: {
              orderNumber,
              email: 'crm@onecompany.local',
              customerName: atOrder.name || `Airtable Order #${atOrder.number}`,
              customerId,
              status: orderStatus as any,
              paymentStatus: atOrder.paymentStatus === 'Оплачено' ? 'PAID' :
                             atOrder.paymentStatus === 'Частично оплачено' ? 'PARTIALLY_PAID' : 'UNPAID',
              currency: 'USD',
              subtotal: atOrder.totalAmount || 0,
              shippingCost: 0,
              taxAmount: 0,
              total: atOrder.clientTotal || atOrder.totalAmount || 0,
              amountPaid: atOrder.paymentStatus === 'Оплачено' ? (atOrder.clientTotal || atOrder.totalAmount || 0) : 0,
              shippingAddress: { line1: 'From Airtable CRM', city: '', country: '' },
              viewToken: crypto.randomUUID(),
              pricingSnapshot: {
                airtableId: atOrder.id,
                airtableNumber: atOrder.number,
                airtableName: atOrder.name,
                source: 'airtable',
                profit: atOrder.profit,
                marginality: atOrder.marginality,
                purchaseCost: atOrder.purchaseCost,
                additionalCosts: atOrder.additionalCosts,
                tag: atOrder.tag,
                lastSync: new Date().toISOString(),
              },
            },
          });
          results.ordersCreated++;
        }
      } catch (err: any) {
        results.errors.push(`Order #${atOrder.number}: ${err.message}`);
      }
    }

    console.log(`[Airtable Webhook] Shop sync: ${results.customersCreated}+${results.customersUpdated} customers, ${results.ordersCreated}+${results.ordersUpdated} orders`);

    // Also sync into CRM analytics tables
    let crmSyncResult = null;
    try {
      crmSyncResult = await syncAllCrmData();
      console.log(`[Airtable Webhook] CRM DB sync: ${crmSyncResult.customers.synced} customers, ${crmSyncResult.orders.synced} orders, ${crmSyncResult.items.synced} items`);
    } catch (err: any) {
      console.error('[Airtable Webhook] CRM DB sync error:', err.message);
    }

    return NextResponse.json({ success: true, ...results, crmSync: crmSyncResult });
  } catch (error: any) {
    console.error('[Airtable Webhook Error]', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// GET is used for Airtable webhook verification ping
export async function GET() {
  return NextResponse.json({ status: 'ok', service: 'airtable-webhook' });
}

export const runtime = 'nodejs';
export const maxDuration = 120;
