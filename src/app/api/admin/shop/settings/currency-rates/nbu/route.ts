import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { assertAdminRequest } from '@/lib/adminAuth';
import { ADMIN_PERMISSIONS, writeAdminAuditLog } from '@/lib/adminRbac';
import { fetchShopCurrencyRatesFromNbu } from '@/lib/shopCurrencyNbu';
import { getOrCreateShopSettings, serializeShopSettings } from '@/lib/shopAdminSettings';
import { prisma } from '@/lib/prisma';

export async function POST() {
  try {
    const cookieStore = await cookies();
    const session = assertAdminRequest(cookieStore, ADMIN_PERMISSIONS.SHOP_SETTINGS_WRITE);

    const nbuRates = await fetchShopCurrencyRatesFromNbu();
    const currentSettings = await getOrCreateShopSettings(prisma);
    const settings = await prisma.shopSettings.update({
      where: { key: currentSettings.key },
      data: {
        currencyRates: nbuRates.currencyRates as Prisma.InputJsonValue,
      },
    });

    await writeAdminAuditLog(prisma, session, {
      scope: 'shop',
      action: 'settings.currency_rates.refresh_nbu',
      entityType: 'shop.settings',
      entityId: settings.key,
      metadata: {
        source: nbuRates.source,
        exchangedAt: nbuRates.exchangedAt,
        eurToUah: nbuRates.eurToUah,
        usdToUah: nbuRates.usdToUah,
        usdPerEur: nbuRates.usdPerEur,
        usdSpecial: nbuRates.usdSpecial,
      },
    });

    return NextResponse.json({
      settings: serializeShopSettings(settings),
      nbu: nbuRates,
    });
  } catch (error) {
    if ((error as Error).message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if ((error as Error).message === 'FORBIDDEN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    console.error('Admin shop settings NBU refresh', error);
    return NextResponse.json({ error: 'Не вдалося оновити курси з НБУ' }, { status: 500 });
  }
}
