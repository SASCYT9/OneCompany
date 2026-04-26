import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';

import { assertAdminRequest } from '@/lib/adminAuth';
import { ADMIN_PERMISSIONS } from '@/lib/adminRbac';
import { prisma } from '@/lib/prisma';

/**
 * Print-optimized packing slip for warehouse fulfillment.
 *
 * Designed for warehouse workflow:
 *   - Large SKU + qty
 *   - Image thumbnail per line
 *   - No prices (warehouse staff don't need that info)
 *   - Big "DELIVER TO" address block
 *   - Order number barcode (visual representation only — for visual scan reference)
 *
 * GET /api/admin/pdf/packing-slip/[orderId]
 */

function escapeHtml(s: string | null | undefined): string {
  if (s == null) return '';
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ orderId: string }> }
) {
  try {
    const cookieStore = await cookies();
    assertAdminRequest(cookieStore, ADMIN_PERMISSIONS.SHOP_ORDERS_READ);

    const { orderId } = await params;
    const order = await prisma.shopOrder.findUnique({
      where: { id: orderId },
      include: {
        items: { orderBy: { createdAt: 'asc' } },
      },
    });

    if (!order) return new NextResponse('Order not found', { status: 404 });

    const shippingAddress = (order.shippingAddress as Record<string, unknown> | null) ?? {};
    const addrLine1 = String(shippingAddress.line1 ?? '');
    const addrLine2 = String(shippingAddress.line2 ?? '');
    const addrCity = String(shippingAddress.city ?? '');
    const addrRegion = String(shippingAddress.region ?? '');
    const addrPostcode = String(shippingAddress.postcode ?? '');
    const addrCountry = String(shippingAddress.country ?? '');

    const totalUnits = order.items.reduce((sum, it) => sum + it.quantity, 0);

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Packing slip ${escapeHtml(order.orderNumber)}</title>
<style>
  * { box-sizing: border-box; }
  body {
    font-family: 'Inter', -apple-system, system-ui, sans-serif;
    color: #000;
    margin: 0;
    padding: 24px;
    font-size: 13px;
    line-height: 1.4;
    background: #fff;
  }
  .slip { max-width: 720px; margin: 0 auto; }

  .header {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 16px;
    border: 2px solid #000;
    padding: 16px;
    margin-bottom: 16px;
  }
  .order-block .label {
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: 1px;
    color: #555;
  }
  .order-block .number {
    font-family: 'JetBrains Mono', monospace;
    font-size: 28px;
    font-weight: 800;
    margin-top: 4px;
    letter-spacing: 1px;
  }
  .order-block .date {
    font-size: 11px;
    color: #555;
    margin-top: 4px;
  }
  .units-block {
    text-align: right;
  }
  .units-block .units {
    font-size: 48px;
    font-weight: 800;
    line-height: 1;
  }
  .units-block .label {
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: 1px;
    color: #555;
  }

  .deliver-to {
    border: 2px solid #000;
    padding: 16px;
    margin-bottom: 16px;
  }
  .deliver-to .heading {
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 1px;
    color: #555;
    margin-bottom: 8px;
    font-weight: 600;
  }
  .deliver-to .name {
    font-size: 18px;
    font-weight: 700;
    margin-bottom: 4px;
  }
  .deliver-to .address {
    font-size: 14px;
    line-height: 1.6;
  }
  .deliver-to .phone {
    margin-top: 8px;
    font-family: 'JetBrains Mono', monospace;
    font-size: 13px;
  }

  table {
    width: 100%;
    border-collapse: collapse;
    border: 1px solid #000;
  }
  th {
    background: #000;
    color: #fff;
    padding: 8px 12px;
    text-align: left;
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: 1px;
  }
  th.num { text-align: right; }
  td {
    padding: 12px;
    border-bottom: 1px solid #ddd;
    vertical-align: middle;
  }
  td.num {
    text-align: right;
    font-weight: 700;
    font-size: 18px;
    font-variant-numeric: tabular-nums;
  }
  .item-title {
    font-weight: 600;
    font-size: 14px;
  }
  .item-sku {
    font-family: 'JetBrains Mono', monospace;
    font-size: 12px;
    color: #555;
    margin-top: 2px;
  }
  .check-cell {
    width: 40px;
    text-align: center;
  }
  .check-cell .box {
    width: 24px;
    height: 24px;
    border: 2px solid #000;
    margin: 0 auto;
  }

  .footer {
    margin-top: 24px;
    padding: 16px;
    border-top: 2px dashed #000;
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  .signature-line {
    border-bottom: 1px solid #000;
    width: 200px;
    height: 40px;
  }
  .signature-label {
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: 1px;
    color: #555;
    margin-top: 4px;
  }

  @media print {
    body { padding: 0; }
    .no-print { display: none !important; }
  }
</style>
</head>
<body>
<div class="no-print" style="text-align:center; margin-bottom:16px;">
  <button onclick="window.print()" style="padding:10px 24px; background:#000; color:#fff; border:0; border-radius:6px; font-weight:600; cursor:pointer; font-family: inherit;">
    🖨️  Print packing slip
  </button>
</div>

<div class="slip">
  <div class="header">
    <div class="order-block">
      <div class="label">Order #</div>
      <div class="number">${escapeHtml(order.orderNumber)}</div>
      <div class="date">${order.createdAt.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</div>
    </div>
    <div class="units-block">
      <div class="units">${totalUnits}</div>
      <div class="label">Total units</div>
    </div>
  </div>

  <div class="deliver-to">
    <div class="heading">Deliver to</div>
    <div class="name">${escapeHtml(order.customerName)}</div>
    <div class="address">
      ${addrLine1 ? `${escapeHtml(addrLine1)}<br>` : ''}
      ${addrLine2 ? `${escapeHtml(addrLine2)}<br>` : ''}
      ${addrCity || addrPostcode ? `${escapeHtml([addrPostcode, addrCity].filter(Boolean).join(' '))}<br>` : ''}
      ${addrRegion ? `${escapeHtml(addrRegion)}<br>` : ''}
      ${addrCountry ? escapeHtml(addrCountry) : ''}
    </div>
    ${order.phone ? `<div class="phone">📞 ${escapeHtml(order.phone)}</div>` : ''}
    ${order.deliveryMethod ? `<div style="margin-top:8px; font-size:11px; color:#555;">Method: <b>${escapeHtml(order.deliveryMethod.replace('_', ' '))}</b>${order.ttnNumber ? ` · TTN ${escapeHtml(order.ttnNumber)}` : ''}</div>` : ''}
  </div>

  <table>
    <thead>
      <tr>
        <th class="check-cell">✓</th>
        <th>Item / SKU</th>
        <th class="num">Qty</th>
      </tr>
    </thead>
    <tbody>
      ${order.items
        .map(
          (it) => `
        <tr>
          <td class="check-cell"><div class="box"></div></td>
          <td>
            <div class="item-title">${escapeHtml(it.title)}</div>
            <div class="item-sku">${escapeHtml(it.productSlug)}</div>
          </td>
          <td class="num">${it.quantity}</td>
        </tr>
      `
        )
        .join('')}
    </tbody>
  </table>

  <div class="footer">
    <div>
      <div class="signature-line"></div>
      <div class="signature-label">Picker signature</div>
    </div>
    <div>
      <div class="signature-line"></div>
      <div class="signature-label">Date / Time</div>
    </div>
  </div>
</div>

<script>
  if (window === window.top) {
    setTimeout(() => window.print(), 400);
  }
</script>
</body>
</html>`;

    return new NextResponse(html, {
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'no-store',
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    if (message === 'UNAUTHORIZED') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (message === 'FORBIDDEN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    console.error('Packing slip error:', error);
    return new NextResponse('Failed to render packing slip', { status: 500 });
  }
}
