import { PrismaClient } from '@prisma/client';

export async function sendOrderToCRM(prisma: PrismaClient, orderId: string) {
  const order = await prisma.shopOrder.findUnique({
    where: { id: orderId },
    include: { items: true, customer: true }
  });
  if (!order) return;
  
  const payload = {
    order_id: order.orderNumber,
    customer_email: order.email,
    customer_phone: order.phone,
    total: order.total,
    currency: order.currency,
    items: order.items.map(item => ({
      sku: item.productSlug,
      qty: item.quantity,
      price: item.price
    })),
    delivery_method: order.deliveryMethod,
    ttn: order.ttnNumber,
    status: order.status
  };

  // NOTE: This is the scaffold for the webhook. 
  // Next steps: Integrate actual KeyCRM / HubSpot API call using fetch() and env variables.
  console.log('[CRM] Webhook payload ready:', payload);
}
