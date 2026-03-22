import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';
import { assertAdminRequest } from '@/lib/adminAuth';
import { ADMIN_PERMISSIONS } from '@/lib/adminRbac';
import { listShopCustomersAdmin } from '@/lib/shopAdminCustomers';
import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    assertAdminRequest(cookieStore, ADMIN_PERMISSIONS.SHOP_CUSTOMERS_READ);

    const url = new URL(request.url);
    const customers = await listShopCustomersAdmin(prisma, {
      q: url.searchParams.get('q'),
      group: url.searchParams.get('group'),
      status: url.searchParams.get('status'),
    });

    return NextResponse.json(customers);
  } catch (error) {
    if ((error as Error).message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if ((error as Error).message === 'FORBIDDEN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    console.error('Admin customers list', error);
    return NextResponse.json({ error: 'Failed to list customers' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    // Assuming SHOP_CUSTOMERS_READ is sufficient or we can just use simple auth
    assertAdminRequest(cookieStore, ADMIN_PERMISSIONS.SHOP_CUSTOMERS_READ);

    const data = await request.json();
    const { email, firstName, lastName, phone, companyName, group, isActive, preferredLocale, b2bDiscountPercent, preferredCurrency } = data;

    if (!email || !firstName || !lastName) {
      return NextResponse.json(
        { error: 'Email, First Name, and Last Name are required' },
        { status: 400 }
      );
    }

    const existing = await prisma.shopCustomer.findUnique({
      where: { email },
    });
    if (existing) {
      return NextResponse.json(
        { error: 'Customer with this email already exists' },
        { status: 400 }
      );
    }

    const customer = await prisma.shopCustomer.create({
      data: {
        email,
        firstName,
        lastName,
        phone,
        companyName,
        group: group || 'B2C',
        isActive: isActive !== undefined ? isActive : true,
        preferredLocale: preferredLocale || 'en',
        b2bDiscountPercent: b2bDiscountPercent ? parseFloat(b2bDiscountPercent) : 0,
      },
    });

    return NextResponse.json({
      success: true,
      customerId: customer.id,
      customer,
    });
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (error.message === 'FORBIDDEN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    console.error('Admin customer create', error);
    return NextResponse.json({ error: error.message || 'Failed to create customer' }, { status: 500 });
  }
}

export const runtime = 'nodejs';
