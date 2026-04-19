import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { prisma } from '@/lib/prisma';
import {
  fetchAirtableOrders,
  fetchAirtableCustomers,
  fetchAllAirtableRecords,
  AirtableOrder,
  AirtableCustomer,
} from '@/lib/airtable';
import { assertAdminRequest } from '@/lib/adminAuth';
import crypto from 'crypto';

/**
 * POST /api/admin/crm/sync
 * 
 * Synchronizes Airtable CRM data into the local database:
 * 1. Pulls all customers (Контрагенты) → creates/updates ShopCustomer records
 * 2. Pulls all orders (Заказы) → creates/updates ShopOrder records
 * 3. Links orders to customers
 */
export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    assertAdminRequest(cookieStore);
    const body = await request.json().catch(() => ({}));
    const syncType = body.type || 'full'; // 'customers' | 'orders' | 'full'

    const results = {
      customersCreated: 0,
      customersUpdated: 0,
      ordersCreated: 0,
      ordersUpdated: 0,
      errors: [] as string[],
    };

    // ═══ Sync Customers ═══
    if (syncType === 'customers' || syncType === 'full') {
      console.log('[CRM Sync] Fetching Airtable customers...');
      const customers = await fetchAllAirtableRecords<AirtableCustomer>((opts) =>
        fetchAirtableCustomers({ ...opts, maxRecords: 100 })
      );

      console.log(`[CRM Sync] Found ${customers.length} customers in Airtable`);

      for (const atCustomer of customers) {
        try {
          const airtableId = atCustomer.id;
          const customerName = atCustomer.name || 'Unknown';

          // Look up by airtable ID in notes or by company name
          const existing = await prisma.shopCustomer.findFirst({
            where: {
              OR: [
                { notes: { contains: airtableId } },
                { companyName: customerName },
              ],
            },
          });

          // Use real email from Airtable if available, otherwise generate unique one
          const airtableEmail = atCustomer.email?.trim();
          const generateEmail = () => {
            // Transliterate Cyrillic → Latin for email-safe slug
            const cyMap: Record<string,string> = {
              'а':'a','б':'b','в':'v','г':'g','д':'d','е':'e','ё':'yo','ж':'zh',
              'з':'z','и':'i','й':'y','к':'k','л':'l','м':'m','н':'n','о':'o',
              'п':'p','р':'r','с':'s','т':'t','у':'u','ф':'f','х':'kh','ц':'ts',
              'ч':'ch','ш':'sh','щ':'shch','ъ':'','ы':'y','ь':'','э':'e','ю':'yu','я':'ya',
              'і':'i','ї':'yi','є':'ye','ґ':'g',
            };
            const slug = customerName.toLowerCase().split('').map(c => cyMap[c] || c).join('')
              .replace(/[^a-z0-9]+/g, '.').replace(/^\.+|\.+$/g, '') || 'customer';
            // Add short Airtable ID suffix for uniqueness
            const suffix = airtableId.replace(/^rec/, '').slice(0, 6).toLowerCase();
            return `${slug}.${suffix}@crm.onecompany.local`;
          };
          const email = airtableEmail || generateEmail();

          // Detect region from customer name for notes
          const regionHints: Record<string, string> = {
            'казахстан': 'KZ', 'kz': 'KZ', 'kazakhstan': 'KZ',
            'україна': 'UA', 'украина': 'UA', 'ua': 'UA', 'ukraine': 'UA',
            'сша': 'US', 'usa': 'US', 'us': 'US',
            'eu': 'EU', 'europe': 'EU', 'європа': 'EU',
          };
          let region = '';
          const lowerName = customerName.toLowerCase();
          for (const [hint, code] of Object.entries(regionHints)) {
            if (lowerName.includes(hint)) { region = code; break; }
          }

          if (existing) {
            // Update existing customer — also sync email from Airtable
            const updateData: any = {
              companyName: customerName,
              notes: `[Airtable:${airtableId}]${region ? ` [Region:${region}]` : ''} Balance: $${atCustomer.balance.toFixed(2)} | ${atCustomer.whoOwes}`,
            };
            // If Airtable has a real email, update local email to match
            if (airtableEmail && existing.email.endsWith('@crm.onecompany.local')) {
              updateData.email = airtableEmail;
            }

            await prisma.shopCustomer.update({
              where: { id: existing.id },
              data: updateData,
            });
            results.customersUpdated++;
          } else {
            // Check email collision before create
            const emailConflict = await prisma.shopCustomer.findUnique({ where: { email } });
            const finalEmail = emailConflict ? generateEmail() : email;

            await prisma.shopCustomer.create({
              data: {
                email: finalEmail,
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
    }

    // ═══ Sync Orders ═══
    if (syncType === 'orders' || syncType === 'full') {
      console.log('[CRM Sync] Fetching Airtable orders...');
      const orders = await fetchAllAirtableRecords<AirtableOrder>((opts) =>
        fetchAirtableOrders({ ...opts, maxRecords: 100 })
      );

      console.log(`[CRM Sync] Found ${orders.length} orders in Airtable`);

      // Map Airtable status → our OrderStatus enum
      const statusMap: Record<string, string> = {
        'Новый': 'PENDING_REVIEW',
        'В обработке': 'CONFIRMED',
        'В производстве': 'CONFIRMED',
        'В пути': 'SHIPPED',
        'Выполнен': 'DELIVERED',
        'Отменен': 'CANCELLED',
      };

      for (const atOrder of orders) {
        try {
          const orderNumber = `AT-${atOrder.number}`;

          // Find linked customer
          let customerId: string | null = null;
          if (atOrder.customerIds.length > 0) {
            const customer = await prisma.shopCustomer.findFirst({
              where: { notes: { contains: atOrder.customerIds[0] } },
              select: { id: true },
            });
            customerId = customer?.id || null;
          }

          // Check if order already exists
          const existing = await prisma.shopOrder.findFirst({
            where: { orderNumber },
          });

          const orderStatus = statusMap[atOrder.orderStatus] || 'PENDING_REVIEW';

          if (existing) {
            // Update status AND re-link customer (in case customer was created after order)
            await prisma.shopOrder.update({
              where: { id: existing.id },
              data: {
                status: orderStatus as any,
                customerId: customerId || existing.customerId,
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
                },
              },
            });
            results.ordersUpdated++;
          } else {
            // Create new
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
                },
              },
            });
            results.ordersCreated++;
          }
        } catch (err: any) {
          results.errors.push(`Order #${atOrder.number} "${atOrder.name}": ${err.message}`);
        }
      }
    }

    return NextResponse.json({
      success: true,
      ...results,
      message: `CRM Sync complete! Customers: ${results.customersCreated} new, ${results.customersUpdated} updated. Orders: ${results.ordersCreated} new, ${results.ordersUpdated} updated. Errors: ${results.errors.length}`,
    });
  } catch (error: any) {
    console.error('[CRM Sync Error]', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export const runtime = 'nodejs';
export const maxDuration = 120;
