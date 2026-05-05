import { cookies } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { assertAdminRequest } from '@/lib/adminAuth';
import { ADMIN_PERMISSIONS, writeAdminAuditLog } from '@/lib/adminRbac';
import {
  getOrCreateShopSettings,
  normalizeShopSettingsPayload,
  serializeShopSettings,
} from '@/lib/shopAdminSettings';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    const cookieStore = await cookies();
    assertAdminRequest(cookieStore, ADMIN_PERMISSIONS.SHOP_SETTINGS_READ);

    const settings = await getOrCreateShopSettings(prisma);
    return NextResponse.json(serializeShopSettings(settings));
  } catch (error) {
    if ((error as Error).message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if ((error as Error).message === 'FORBIDDEN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    console.error('Admin shop settings get', error);
    return NextResponse.json({ error: 'Failed to load shop settings' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const session = assertAdminRequest(cookieStore, ADMIN_PERMISSIONS.SHOP_SETTINGS_WRITE);

    const body = await request.json().catch(() => ({}));
    const payload = normalizeShopSettingsPayload(body);

    const settings = await prisma.shopSettings.upsert({
      where: { key: 'shop' },
      create: {
        key: 'shop',
        b2bVisibilityMode: payload.b2bVisibilityMode,
        defaultB2bDiscountPercent: payload.defaultB2bDiscountPercent,
        defaultCurrency: payload.defaultCurrency,
        enabledCurrencies: payload.enabledCurrencies,
        currencyRates: payload.currencyRates as Prisma.InputJsonValue,
        shippingZones: payload.shippingZones as Prisma.InputJsonValue,
        taxRegions: payload.taxRegions as Prisma.InputJsonValue,
        regionalPricingRules: payload.regionalPricingRules as Prisma.InputJsonValue,
        brandShippingRules: payload.brandShippingRules as Prisma.InputJsonValue,
        orderNotificationEmail: payload.orderNotificationEmail,
        b2bNotes: payload.b2bNotes,
        showTaxesIncludedNotice: payload.showTaxesIncludedNotice,
        fopCompanyName: payload.fopCompanyName,
        fopIban: payload.fopIban,
        fopBankName: payload.fopBankName,
        fopEdrpou: payload.fopEdrpou,
        fopDetails: payload.fopDetails,
        whiteBitEnabled: payload.whiteBitEnabled,
      },
      update: {
        b2bVisibilityMode: payload.b2bVisibilityMode,
        defaultB2bDiscountPercent: payload.defaultB2bDiscountPercent,
        defaultCurrency: payload.defaultCurrency,
        enabledCurrencies: payload.enabledCurrencies,
        currencyRates: payload.currencyRates as Prisma.InputJsonValue,
        shippingZones: payload.shippingZones as Prisma.InputJsonValue,
        taxRegions: payload.taxRegions as Prisma.InputJsonValue,
        regionalPricingRules: payload.regionalPricingRules as Prisma.InputJsonValue,
        brandShippingRules: payload.brandShippingRules as Prisma.InputJsonValue,
        orderNotificationEmail: payload.orderNotificationEmail,
        b2bNotes: payload.b2bNotes,
        showTaxesIncludedNotice: payload.showTaxesIncludedNotice,
        fopCompanyName: payload.fopCompanyName,
        fopIban: payload.fopIban,
        fopBankName: payload.fopBankName,
        fopEdrpou: payload.fopEdrpou,
        fopDetails: payload.fopDetails,
        whiteBitEnabled: payload.whiteBitEnabled,
      },
    });

    revalidatePath('/[locale]/shop', 'layout');

    await writeAdminAuditLog(prisma, session, {
      scope: 'shop',
      action: 'settings.update',
      entityType: 'shop.settings',
      entityId: settings.key,
      metadata: {
        b2bVisibilityMode: settings.b2bVisibilityMode,
        defaultB2bDiscountPercent: settings.defaultB2bDiscountPercent != null ? Number(settings.defaultB2bDiscountPercent) : null,
        defaultCurrency: settings.defaultCurrency,
        enabledCurrencies: settings.enabledCurrencies,
      },
    });

    return NextResponse.json(serializeShopSettings(settings));
  } catch (error) {
    if ((error as Error).message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if ((error as Error).message === 'FORBIDDEN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    console.error('Admin shop settings update', error);
    return NextResponse.json({ error: 'Failed to update shop settings' }, { status: 500 });
  }
}
