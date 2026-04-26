import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';

import { assertAdminRequest } from '@/lib/adminAuth';
import { prisma } from '@/lib/prisma';
import { OrderStatus } from '@prisma/client';

/**
 * Generic CSV export endpoint for admin list pages.
 *
 * GET /api/admin/export/[entity]?format=csv&filters={base64-json}
 *   entity: 'orders' | 'customers' | 'products' | 'inventory'
 *
 * Returns:
 *   text/csv with UTF-8 BOM for Excel compatibility
 *   Content-Disposition: attachment; filename="{entity}-{timestamp}.csv"
 */

type ExportEntity = 'orders' | 'customers' | 'products' | 'inventory';

const VALID_ENTITIES: readonly ExportEntity[] = ['orders', 'customers', 'products', 'inventory'] as const;

export async function GET(request: NextRequest, { params }: { params: Promise<{ entity: string }> }) {
  try {
    const cookieStore = await cookies();
    assertAdminRequest(cookieStore);

    const { entity } = await params;
    if (!VALID_ENTITIES.includes(entity as ExportEntity)) {
      return NextResponse.json({ error: 'Unknown entity' }, { status: 400 });
    }

    const { searchParams } = new URL(request.url);
    const filtersRaw = searchParams.get('filters');
    let filters: Record<string, string> = {};
    if (filtersRaw) {
      try {
        filters = JSON.parse(Buffer.from(filtersRaw, 'base64').toString('utf-8'));
      } catch {
        // ignore malformed filters
      }
    }

    let csv: string;
    let filename: string;

    switch (entity as ExportEntity) {
      case 'orders':
        ({ csv, filename } = await exportOrders(filters));
        break;
      case 'customers':
        ({ csv, filename } = await exportCustomers(filters));
        break;
      case 'products':
        ({ csv, filename } = await exportProducts(filters));
        break;
      case 'inventory':
        ({ csv, filename } = await exportInventory(filters));
        break;
    }

    // UTF-8 BOM for Excel
    const body = '﻿' + csv;

    return new NextResponse(body, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    if (message === 'UNAUTHORIZED') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    console.error('Export error:', error);
    return NextResponse.json({ error: 'Failed to export' }, { status: 500 });
  }
}

// ═══════════════════════════════════════════════════
// CSV utilities
// ═══════════════════════════════════════════════════

function csvCell(value: unknown): string {
  if (value == null) return '';
  const s = typeof value === 'string' ? value : String(value);
  // Escape: wrap in quotes if contains comma/quote/newline; double-up internal quotes
  if (/[",\n\r]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function csvRow(cells: unknown[]): string {
  return cells.map(csvCell).join(',');
}

function buildCsv(headers: string[], rows: unknown[][]): string {
  return [csvRow(headers), ...rows.map(csvRow)].join('\n');
}

function timestampedFilename(entity: string): string {
  const now = new Date();
  const stamp = now.toISOString().slice(0, 19).replace(/[:T]/g, '-');
  return `onecompany-${entity}-${stamp}.csv`;
}

// ═══════════════════════════════════════════════════
// Per-entity exporters
// ═══════════════════════════════════════════════════

async function exportOrders(filters: Record<string, string>) {
  const where: Record<string, unknown> = {};
  if (filters.status) where.status = filters.status;
  if (filters.paymentStatus) where.paymentStatus = filters.paymentStatus;
  if (filters.currency) where.currency = filters.currency;
  if (filters.search) {
    where.OR = [
      { orderNumber: { contains: filters.search, mode: 'insensitive' } },
      { email: { contains: filters.search, mode: 'insensitive' } },
      { customerName: { contains: filters.search, mode: 'insensitive' } },
    ];
  }

  const orders = await prisma.shopOrder.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: 10000,
    include: {
      customer: { select: { firstName: true, lastName: true, email: true } },
      _count: { select: { items: true, shipments: true } },
    },
  });

  const headers = [
    'Order #',
    'Created',
    'Status',
    'Payment',
    'Customer',
    'Email',
    'Group',
    'Currency',
    'Subtotal',
    'Shipping',
    'Tax',
    'Total',
    'Paid',
    'Outstanding',
    'Items',
    'Shipments',
    'Delivery method',
    'TTN',
  ];
  const rows = orders.map((o) => {
    const subtotal = Number(o.subtotal);
    const total = Number(o.total);
    const outstanding = Math.max(0, total - o.amountPaid);
    return [
      o.orderNumber,
      o.createdAt.toISOString(),
      o.status,
      o.paymentStatus,
      o.customerName,
      o.email,
      o.customerGroupSnapshot,
      o.currency,
      subtotal.toFixed(2),
      Number(o.shippingCost).toFixed(2),
      Number(o.taxAmount).toFixed(2),
      total.toFixed(2),
      o.amountPaid.toFixed(2),
      outstanding.toFixed(2),
      o._count.items,
      o._count.shipments,
      o.deliveryMethod ?? '',
      o.ttnNumber ?? '',
    ];
  });

  return { csv: buildCsv(headers, rows), filename: timestampedFilename('orders') };
}

async function exportCustomers(filters: Record<string, string>) {
  const where: Record<string, unknown> = {};
  if (filters.group && filters.group !== 'ALL') where.group = filters.group;
  if (filters.status === 'ACTIVE') where.isActive = true;
  if (filters.status === 'INACTIVE') where.isActive = false;
  if (filters.search) {
    where.OR = [
      { email: { contains: filters.search, mode: 'insensitive' } },
      { firstName: { contains: filters.search, mode: 'insensitive' } },
      { lastName: { contains: filters.search, mode: 'insensitive' } },
      { companyName: { contains: filters.search, mode: 'insensitive' } },
    ];
  }

  const customers = await prisma.shopCustomer.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: 10000,
    include: {
      _count: { select: { orders: true, addresses: true } },
    },
  });

  const headers = [
    'Email',
    'First name',
    'Last name',
    'Phone',
    'Company',
    'Group',
    'Active',
    'Locale',
    'Orders',
    'Addresses',
    'Created',
    'Updated',
  ];
  const rows = customers.map((c) => [
    c.email,
    c.firstName,
    c.lastName,
    c.phone ?? '',
    c.companyName ?? '',
    c.group,
    c.isActive ? 'true' : 'false',
    c.preferredLocale,
    c._count.orders,
    c._count.addresses,
    c.createdAt.toISOString(),
    c.updatedAt.toISOString(),
  ]);

  return { csv: buildCsv(headers, rows), filename: timestampedFilename('customers') };
}

async function exportProducts(filters: Record<string, string>) {
  const where: Record<string, unknown> = {};
  if (filters.status) where.status = filters.status;
  if (filters.brand) where.brand = filters.brand;
  if (filters.search) {
    where.OR = [
      { titleEn: { contains: filters.search, mode: 'insensitive' } },
      { titleUa: { contains: filters.search, mode: 'insensitive' } },
      { sku: { contains: filters.search, mode: 'insensitive' } },
      { slug: { contains: filters.search, mode: 'insensitive' } },
    ];
  }

  const products = await prisma.shopProduct.findMany({
    where,
    orderBy: { updatedAt: 'desc' },
    take: 10000,
    select: {
      id: true,
      slug: true,
      sku: true,
      titleEn: true,
      titleUa: true,
      brand: true,
      vendor: true,
      status: true,
      isPublished: true,
      priceEur: true,
      priceUsd: true,
      priceUah: true,
      compareAtEur: true,
      image: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  const headers = [
    'SKU',
    'Slug',
    'Title (EN)',
    'Title (UA)',
    'Brand',
    'Vendor',
    'Status',
    'Published',
    'Price EUR',
    'Price USD',
    'Price UAH',
    'Compare-at EUR',
    'Image',
    'Created',
    'Updated',
  ];
  const rows = products.map((p) => [
    p.sku ?? '',
    p.slug,
    p.titleEn,
    p.titleUa,
    p.brand ?? '',
    p.vendor ?? '',
    p.status,
    p.isPublished ? 'true' : 'false',
    p.priceEur != null ? Number(p.priceEur).toFixed(2) : '',
    p.priceUsd != null ? Number(p.priceUsd).toFixed(2) : '',
    p.priceUah != null ? Number(p.priceUah).toFixed(2) : '',
    p.compareAtEur != null ? Number(p.compareAtEur).toFixed(2) : '',
    p.image ?? '',
    p.createdAt.toISOString(),
    p.updatedAt.toISOString(),
  ]);

  return { csv: buildCsv(headers, rows), filename: timestampedFilename('products') };
}

async function exportInventory(_filters: Record<string, string>) {
  const variants = await prisma.shopProductVariant.findMany({
    orderBy: [{ product: { brand: 'asc' } }, { product: { titleEn: 'asc' } }, { position: 'asc' }],
    take: 10000,
    include: {
      product: { select: { titleEn: true, titleUa: true, brand: true, slug: true, status: true } },
      inventoryLevels: {
        select: {
          locationId: true,
          stockedQuantity: true,
          reservedQuantity: true,
          incomingQuantity: true,
          location: { select: { code: true, name: true } },
        },
      },
    },
  });

  const headers = [
    'Brand',
    'Product (EN)',
    'Product (UA)',
    'Variant',
    'SKU',
    'Barcode',
    'Status',
    'Total qty',
    'Inventory policy',
    'Tracker',
    'Location code',
    'Location name',
    'Stocked',
    'Reserved',
    'Incoming',
  ];
  const rows: unknown[][] = [];
  for (const v of variants) {
    if (v.inventoryLevels.length === 0) {
      rows.push([
        v.product?.brand ?? '',
        v.product?.titleEn ?? '',
        v.product?.titleUa ?? '',
        v.title,
        v.sku ?? '',
        v.barcode ?? '',
        v.product?.status ?? '',
        v.inventoryQty,
        v.inventoryPolicy,
        v.inventoryTracker ?? '',
        '',
        '',
        '',
        '',
        '',
      ]);
    } else {
      for (const level of v.inventoryLevels) {
        rows.push([
          v.product?.brand ?? '',
          v.product?.titleEn ?? '',
          v.product?.titleUa ?? '',
          v.title,
          v.sku ?? '',
          v.barcode ?? '',
          v.product?.status ?? '',
          v.inventoryQty,
          v.inventoryPolicy,
          v.inventoryTracker ?? '',
          level.location?.code ?? '',
          level.location?.name ?? '',
          level.stockedQuantity,
          level.reservedQuantity,
          level.incomingQuantity,
        ]);
      }
    }
  }

  return { csv: buildCsv(headers, rows), filename: timestampedFilename('inventory') };
}
