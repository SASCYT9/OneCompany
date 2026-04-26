import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';

import { assertAdminRequest } from '@/lib/adminAuth';
import { ADMIN_PERMISSIONS } from '@/lib/adminRbac';
import { prisma } from '@/lib/prisma';

/**
 * Print-optimized HTML invoice that customers/admins can save as PDF
 * via browser print dialog (Ctrl+P → Save as PDF).
 *
 * Auto-triggers `window.print()` on load with a small delay so images load.
 *
 * GET /api/admin/pdf/invoice/[orderId]
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

function formatMoney(value: number, currency: string) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    maximumFractionDigits: 2,
  }).format(value);
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

    if (!order) {
      return new NextResponse('Order not found', { status: 404 });
    }

    const subtotal = Number(order.subtotal);
    const shipping = Number(order.shippingCost);
    const tax = Number(order.taxAmount);
    const total = Number(order.total);
    const paid = order.amountPaid;
    const outstanding = Math.max(0, total - paid);

    const shippingAddress = (order.shippingAddress as Record<string, unknown> | null) ?? {};
    const addrLine1 = String(shippingAddress.line1 ?? '');
    const addrLine2 = String(shippingAddress.line2 ?? '');
    const addrCity = String(shippingAddress.city ?? '');
    const addrRegion = String(shippingAddress.region ?? '');
    const addrPostcode = String(shippingAddress.postcode ?? '');
    const addrCountry = String(shippingAddress.country ?? '');

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Invoice ${escapeHtml(order.orderNumber)}</title>
<style>
  * { box-sizing: border-box; }
  body {
    font-family: 'Inter', -apple-system, system-ui, sans-serif;
    color: #111;
    margin: 0;
    padding: 32px;
    font-size: 13px;
    line-height: 1.5;
    background: #fff;
  }
  .invoice {
    max-width: 720px;
    margin: 0 auto;
  }
  .header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    border-bottom: 2px solid #111;
    padding-bottom: 16px;
    margin-bottom: 24px;
  }
  .brand h1 {
    margin: 0 0 4px 0;
    font-size: 22px;
    font-weight: 800;
    letter-spacing: -0.5px;
  }
  .brand .tagline {
    color: #666;
    font-size: 11px;
    letter-spacing: 0.5px;
    text-transform: uppercase;
  }
  .meta {
    text-align: right;
  }
  .meta .label {
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: 1px;
    color: #888;
  }
  .meta .number {
    font-family: 'JetBrains Mono', monospace;
    font-size: 16px;
    font-weight: 700;
    margin-top: 2px;
  }
  .meta .date {
    color: #555;
    margin-top: 4px;
    font-size: 12px;
  }
  .parties {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 32px;
    margin-bottom: 32px;
  }
  .party h2 {
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: 1px;
    color: #888;
    margin: 0 0 8px 0;
    font-weight: 600;
  }
  .party .name {
    font-weight: 600;
    font-size: 14px;
    margin-bottom: 4px;
  }
  .party .lines {
    color: #555;
    font-size: 12px;
  }
  table {
    width: 100%;
    border-collapse: collapse;
    margin-bottom: 16px;
  }
  th {
    text-align: left;
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: 1px;
    color: #888;
    padding: 8px 12px;
    border-bottom: 2px solid #111;
    font-weight: 600;
  }
  td {
    padding: 10px 12px;
    border-bottom: 1px solid #eee;
    vertical-align: top;
  }
  td.num {
    text-align: right;
    font-variant-numeric: tabular-nums;
  }
  th.num { text-align: right; }
  .item-title { font-weight: 500; }
  .item-meta { color: #888; font-size: 11px; margin-top: 2px; font-family: 'JetBrains Mono', monospace; }
  .totals {
    margin-left: auto;
    width: 320px;
  }
  .totals .row {
    display: flex;
    justify-content: space-between;
    padding: 6px 0;
    font-size: 13px;
  }
  .totals .row.grand {
    border-top: 2px solid #111;
    margin-top: 8px;
    padding-top: 12px;
    font-size: 16px;
    font-weight: 700;
  }
  .totals .row.outstanding {
    color: #c53030;
    font-weight: 600;
  }
  .footer {
    margin-top: 48px;
    padding-top: 16px;
    border-top: 1px solid #ddd;
    color: #888;
    font-size: 11px;
    text-align: center;
  }
  .badge {
    display: inline-block;
    padding: 2px 8px;
    border-radius: 999px;
    font-size: 10px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }
  .badge-paid { background: #d4edda; color: #155724; }
  .badge-unpaid { background: #f8d7da; color: #721c24; }
  .badge-partial { background: #fff3cd; color: #856404; }

  @media print {
    body { padding: 0; }
    .no-print { display: none !important; }
  }
</style>
</head>
<body>
<div class="no-print" style="text-align:center; margin-bottom:16px;">
  <button onclick="window.print()" style="padding:10px 24px; background:#111; color:#fff; border:0; border-radius:6px; font-weight:600; cursor:pointer; font-family: inherit;">
    🖨️  Print or Save as PDF
  </button>
  <span style="color:#888; margin-left:12px; font-size:12px;">Or press Ctrl/Cmd+P</span>
</div>

<div class="invoice">
  <div class="header">
    <div class="brand">
      <h1>OneCompany</h1>
      <div class="tagline">Premium Auto & Moto Parts</div>
    </div>
    <div class="meta">
      <div class="label">Invoice</div>
      <div class="number">${escapeHtml(order.orderNumber)}</div>
      <div class="date">${order.createdAt.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</div>
      <div style="margin-top:8px;">
        ${order.paymentStatus === 'PAID'
          ? '<span class="badge badge-paid">Paid</span>'
          : order.paymentStatus === 'PARTIALLY_PAID'
            ? '<span class="badge badge-partial">Partial</span>'
            : '<span class="badge badge-unpaid">Unpaid</span>'}
      </div>
    </div>
  </div>

  <div class="parties">
    <div class="party">
      <h2>From</h2>
      <div class="name">OneCompany Global</div>
      <div class="lines">
        info@onecompany.global<br>
        onecompany.global
      </div>
    </div>
    <div class="party">
      <h2>Bill to</h2>
      <div class="name">${escapeHtml(order.customerName)}</div>
      <div class="lines">
        ${escapeHtml(order.email)}<br>
        ${order.phone ? `${escapeHtml(order.phone)}<br>` : ''}
        ${addrLine1 ? `${escapeHtml(addrLine1)}<br>` : ''}
        ${addrLine2 ? `${escapeHtml(addrLine2)}<br>` : ''}
        ${addrCity || addrPostcode ? `${escapeHtml([addrPostcode, addrCity].filter(Boolean).join(' '))}<br>` : ''}
        ${addrRegion ? `${escapeHtml(addrRegion)}<br>` : ''}
        ${addrCountry ? escapeHtml(addrCountry) : ''}
      </div>
    </div>
  </div>

  <table>
    <thead>
      <tr>
        <th>Item</th>
        <th class="num">Qty</th>
        <th class="num">Unit price</th>
        <th class="num">Total</th>
      </tr>
    </thead>
    <tbody>
      ${order.items
        .map(
          (it) => `
        <tr>
          <td>
            <div class="item-title">${escapeHtml(it.title)}</div>
            <div class="item-meta">${escapeHtml(it.productSlug)}</div>
          </td>
          <td class="num">${it.quantity}</td>
          <td class="num">${formatMoney(Number(it.price), order.currency)}</td>
          <td class="num">${formatMoney(Number(it.total), order.currency)}</td>
        </tr>
      `
        )
        .join('')}
    </tbody>
  </table>

  <div class="totals">
    <div class="row">
      <span>Subtotal</span>
      <span>${formatMoney(subtotal, order.currency)}</span>
    </div>
    <div class="row">
      <span>Shipping</span>
      <span>${formatMoney(shipping, order.currency)}</span>
    </div>
    ${tax > 0
      ? `<div class="row"><span>Tax</span><span>${formatMoney(tax, order.currency)}</span></div>`
      : ''}
    <div class="row grand">
      <span>Total</span>
      <span>${formatMoney(total, order.currency)}</span>
    </div>
    ${paid > 0
      ? `<div class="row"><span>Paid</span><span>${formatMoney(paid, order.currency)}</span></div>`
      : ''}
    ${outstanding > 0
      ? `<div class="row outstanding"><span>Outstanding</span><span>${formatMoney(outstanding, order.currency)}</span></div>`
      : ''}
  </div>

  <div class="footer">
    Thank you for your order. For questions about this invoice, contact info@onecompany.global<br>
    OneCompany Global · onecompany.global
  </div>
</div>

<script>
  // Auto-print on load (only when not in iframe — admin context)
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
    console.error('Invoice PDF error:', error);
    return new NextResponse('Failed to render invoice', { status: 500 });
  }
}
