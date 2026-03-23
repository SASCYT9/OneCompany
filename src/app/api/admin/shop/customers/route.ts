import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';
import { assertAdminRequest } from '@/lib/adminAuth';
import { ADMIN_PERMISSIONS } from '@/lib/adminRbac';
import { listShopCustomersAdmin } from '@/lib/shopAdminCustomers';
import { hashShopCustomerPassword } from '@/lib/shopCustomers';
import { prisma } from '@/lib/prisma';
import crypto from 'crypto';

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
    assertAdminRequest(cookieStore, ADMIN_PERMISSIONS.SHOP_CUSTOMERS_WRITE);

    const data = await request.json();
    const { email, firstName, lastName, phone, companyName, group, isActive, preferredLocale, b2bDiscountPercent, password } = data;

    if (!email || !firstName || !lastName) {
      return NextResponse.json(
        { error: 'Email, First Name, and Last Name are required' },
        { status: 400 }
      );
    }

    const normalizedEmail = String(email).trim().toLowerCase();
    const existing = await prisma.shopCustomer.findUnique({
      where: { email: normalizedEmail },
    });
    if (existing) {
      return NextResponse.json(
        { error: 'Customer with this email already exists' },
        { status: 400 }
      );
    }

    // Generate password: use provided or generate random 12-char
    const actualPassword = password ? String(password).trim() : crypto.randomBytes(6).toString('base64url');
    const passwordHash = await hashShopCustomerPassword(actualPassword);

    const customer = await prisma.shopCustomer.create({
      data: {
        email: normalizedEmail,
        firstName: String(firstName).trim(),
        lastName: String(lastName).trim(),
        phone: phone ? String(phone).trim() : null,
        companyName: companyName ? String(companyName).trim() : null,
        group: group || 'B2C',
        isActive: isActive !== false,
        preferredLocale: preferredLocale || 'en',
        b2bDiscountPercent: b2bDiscountPercent ? parseFloat(b2bDiscountPercent) : null,
        account: {
          create: {
            passwordHash,
            plainPassword: actualPassword,
          },
        },
      },
      include: { account: true },
    });

    return NextResponse.json({
      success: true,
      customerId: customer.id,
      customer: {
        id: customer.id,
        email: customer.email,
        firstName: customer.firstName,
        lastName: customer.lastName,
        group: customer.group,
        password: actualPassword,
      },
    });
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (error.message === 'FORBIDDEN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    console.error('Admin customer create', error);
    return NextResponse.json({ error: error.message || 'Failed to create customer' }, { status: 500 });
  }
}

export const runtime = 'nodejs';
