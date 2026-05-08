import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';
import { render } from '@react-email/render';
import { Resend } from 'resend';
import { assertAdminRequest } from '@/lib/adminAuth';
import { ADMIN_PERMISSIONS, writeAdminAuditLog } from '@/lib/adminRbac';
import {
  approveCustomerB2B,
  archiveShopCustomer,
  createShopCustomerPasswordSetup,
  restoreShopCustomer,
  revertCustomerToB2C,
} from '@/lib/shopCustomers';
import {
  getShopCustomerAdminDetail,
  normalizeShopCustomerAdminPayload,
} from '@/lib/shopAdminCustomers';
import { prisma } from '@/lib/prisma';
import ShopPasswordResetEmail from '@/emails/ShopPasswordResetEmail';

const resend = new Resend(process.env.RESEND_API_KEY || 're_placeholder');
const FROM_ADDRESS = process.env.RESEND_FROM_EMAIL || 'One Company <noreply@onecompany.global>';

type Params = {
  params: Promise<{ id: string }>;
};

export async function GET(_request: NextRequest, context: Params) {
  try {
    const cookieStore = await cookies();
    assertAdminRequest(cookieStore, ADMIN_PERMISSIONS.SHOP_CUSTOMERS_READ);
    const { id } = await context.params;
    const customer = await getShopCustomerAdminDetail(prisma, id);

    if (!customer) {
      return NextResponse.json({ error: 'Customer not found' }, { status: 404 });
    }

    return NextResponse.json(customer);
  } catch (error) {
    if ((error as Error).message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if ((error as Error).message === 'FORBIDDEN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    console.error('Admin customer detail', error);
    return NextResponse.json({ error: 'Failed to load customer' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest, context: Params) {
  try {
    const cookieStore = await cookies();
    const session = assertAdminRequest(cookieStore, ADMIN_PERMISSIONS.SHOP_CUSTOMERS_WRITE);
    const { id } = await context.params;
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const action = String(body.action ?? '').trim();

    const existing = await prisma.shopCustomer.findUnique({
      where: { id },
      select: { id: true, email: true, group: true, firstName: true, lastName: true, preferredLocale: true },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Customer not found' }, { status: 404 });
    }

    if (action === 'approve_b2b') {
      const customer = await approveCustomerB2B(prisma, id);
      await writeAdminAuditLog(prisma, session, {
        scope: 'shop',
        action: 'customer.b2b.approve',
        entityType: 'shop.customer',
        entityId: id,
        metadata: {
          email: customer.email,
          previousGroup: existing.group,
          nextGroup: customer.group,
        },
      });

      return NextResponse.json(await getShopCustomerAdminDetail(prisma, id));
    }

    if (action === 'revert_b2c') {
      const customer = await revertCustomerToB2C(prisma, id);
      await writeAdminAuditLog(prisma, session, {
        scope: 'shop',
        action: 'customer.b2b.revert',
        entityType: 'shop.customer',
        entityId: id,
        metadata: {
          email: customer.email,
          previousGroup: existing.group,
          nextGroup: customer.group,
        },
      });

      return NextResponse.json(await getShopCustomerAdminDetail(prisma, id));
    }
    
    if (action === 'archive') {
      await archiveShopCustomer(prisma, id);
      await writeAdminAuditLog(prisma, session, {
        scope: 'shop',
        action: 'customer.archive',
        entityType: 'shop.customer',
        entityId: id,
        metadata: { email: existing.email },
      });
      return NextResponse.json(await getShopCustomerAdminDetail(prisma, id));
    }

    if (action === 'restore') {
      await restoreShopCustomer(prisma, id);
      await writeAdminAuditLog(prisma, session, {
        scope: 'shop',
        action: 'customer.restore',
        entityType: 'shop.customer',
        entityId: id,
        metadata: { email: existing.email },
      });
      return NextResponse.json(await getShopCustomerAdminDetail(prisma, id));
    }

    if (action === 'send_password_reset') {
      const setupLink = await createShopCustomerPasswordSetup(prisma, {
        customerId: id,
        preferredLocale: existing.preferredLocale,
      });

      const targetLocale: 'ua' | 'en' = existing.preferredLocale === 'ua' ? 'ua' : 'en';
      const html = await render(
        ShopPasswordResetEmail({
          resetUrl: setupLink.url,
          firstName: existing.firstName,
          locale: targetLocale,
        }),
      );

      let emailSent = true;
      try {
        await resend.emails.send({
          from: FROM_ADDRESS,
          to: existing.email,
          subject:
            targetLocale === 'ua'
              ? 'Скидання пароля — One Company'
              : 'Reset your One Company password',
          html,
        });
      } catch (sendError) {
        emailSent = false;
        console.error('Admin send_password_reset email send', sendError);
      }

      await writeAdminAuditLog(prisma, session, {
        scope: 'shop',
        action: 'customer.password_reset.send',
        entityType: 'shop.customer',
        entityId: id,
        metadata: {
          email: existing.email,
          emailSent,
          expiresAt: setupLink.expiresAt.toISOString(),
        },
      });

      return NextResponse.json({
        ...(await getShopCustomerAdminDetail(prisma, id)),
        passwordResetSent: emailSent,
        passwordResetTo: existing.email,
      });
    }

    if (action === 'generate_password' || action === 'create_setup_link') {
      const setupLink = await createShopCustomerPasswordSetup(prisma, {
        customerId: id,
        preferredLocale: existing.preferredLocale,
      });

      await writeAdminAuditLog(prisma, session, {
        scope: 'shop',
        action: 'customer.password_setup.create',
        entityType: 'shop.customer',
        entityId: id,
        metadata: {
          email: existing.email,
          expiresAt: setupLink.expiresAt.toISOString(),
        },
      });

      return NextResponse.json({
        ...(await getShopCustomerAdminDetail(prisma, id)),
        setupLinkUrl: setupLink.url,
        setupLinkExpiresAt: setupLink.expiresAt.toISOString(),
      });
    }

    const payload = normalizeShopCustomerAdminPayload(body);
    const updated = await prisma.shopCustomer.update({
      where: { id },
      data: {
        firstName: payload.firstName || existing.firstName,
        lastName: payload.lastName || existing.lastName,
        phone: payload.phone,
        companyName: payload.companyName,
        vatNumber: payload.vatNumber,
        notes: payload.notes,
        b2bDiscountPercent: payload.b2bDiscountPercent,
        preferredLocale: payload.preferredLocale,
        isActive: payload.isActive,
        group: payload.group,
      },
      select: {
        id: true,
        email: true,
        group: true,
        b2bDiscountPercent: true,
        isActive: true,
      },
    });

    await writeAdminAuditLog(prisma, session, {
      scope: 'shop',
      action: 'customer.update',
      entityType: 'shop.customer',
      entityId: id,
      metadata: {
        email: updated.email,
        group: updated.group,
        b2bDiscountPercent: updated.b2bDiscountPercent != null ? Number(updated.b2bDiscountPercent) : null,
        isActive: updated.isActive,
      },
    });

    return NextResponse.json(await getShopCustomerAdminDetail(prisma, id));
  } catch (error) {
    if ((error as Error).message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if ((error as Error).message === 'FORBIDDEN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    console.error('Admin customer patch', error);
    return NextResponse.json({ error: 'Failed to update customer' }, { status: 500 });
  }
}

export const runtime = 'nodejs';
