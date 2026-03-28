import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { hashShopCustomerPassword } from '@/lib/shopCustomers';
import { CustomerGroup } from '@prisma/client';
import {
  buildAdminProductCreateData,
  buildAdminProductUpdateData,
  normalizeAdminProductPayload,
} from '@/lib/shopAdminCatalog';

export async function GET() {
  const emails = ['b2b@gmail.com', 'b2c@gmail.com'];
  const log = [];
  
  for (const email of emails) {
    let customer = await prisma.shopCustomer.findUnique({
      where: { email },
      include: { account: true }
    });
    
    if (!customer) {
      log.push(`Customer ${email} not found. Creating...`);
      const group: CustomerGroup = email.includes('b2b') ? CustomerGroup.B2B_APPROVED : CustomerGroup.B2C;
      customer = await prisma.shopCustomer.create({
        data: {
          email,
          firstName: email.includes('b2b') ? 'B2B' : 'B2C',
          lastName: 'Test',
          group,
          b2bDiscountPercent: email.includes('b2b') ? 15 : null,
        },
        include: { account: true }
      });
    } else {
      log.push(`Found ${email}, Discount: ${customer.b2bDiscountPercent}%, Group: ${customer.group}`);
      if (email.includes('b2b') && (customer.b2bDiscountPercent === null || Number(customer.b2bDiscountPercent) === 0)) {
        log.push(`Setting 15% discount for ${email}...`);
        const updated = await prisma.shopCustomer.update({
          where: { email },
          data: { b2bDiscountPercent: 15 },
          include: { account: true }
        });
        customer = updated;
      }
    }

    if (!customer.account) {
      log.push(`No account for ${email}. Setting password to '123456'...`);
      const hash = await hashShopCustomerPassword('123456');
      await prisma.shopCustomerAccount.create({
        data: {
          customerId: customer.id,
          passwordHash: hash,
          plainPassword: '123456'
        }
      });
    } else if (customer.account.plainPassword !== '123456') {
      const hash = await hashShopCustomerPassword('123456');
      await prisma.shopCustomerAccount.update({
        where: { customerId: customer.id },
        data: { 
          passwordHash: hash,
          plainPassword: '123456'
        }
      });
      log.push(`Updated password to '123456' for ${email}`);
    } else {
      log.push(`Account exists for ${email} with password '123456'`);
    }
  }

  return NextResponse.json({ success: true, log });
}

/**
 * Temporary POST handler for bulk DO88 product import.
 * Accepts { products: ProductPayload[] } and upserts into the database.
 * DELETE this handler after import is complete.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const products = body.products;

    if (!Array.isArray(products) || products.length === 0) {
      return NextResponse.json({ error: 'products array is required' }, { status: 400 });
    }

    const results = {
      created: 0,
      updated: 0,
      errors: [] as { slug: string; error: string }[],
    };

    for (const productInput of products) {
      try {
        const { data, errors } = normalizeAdminProductPayload(productInput);
        if (errors.length) {
          results.errors.push({ slug: productInput.slug || 'unknown', error: errors.join(', ') });
          continue;
        }

        const existing = await prisma.shopProduct.findUnique({ where: { slug: data.slug } });

        if (existing) {
          await prisma.shopProduct.update({
            where: { slug: data.slug },
            data: buildAdminProductUpdateData(data),
          });
          results.updated++;
        } else {
          await prisma.shopProduct.create({
            data: buildAdminProductCreateData(data),
          });
          results.created++;
        }
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        results.errors.push({
          slug: productInput.slug || 'unknown',
          error: message.substring(0, 200),
        });
      }
    }

    return NextResponse.json(results);
  } catch (error) {
    console.error('DO88 bulk import error', error);
    return NextResponse.json({ error: 'Import failed' }, { status: 500 });
  }
}

