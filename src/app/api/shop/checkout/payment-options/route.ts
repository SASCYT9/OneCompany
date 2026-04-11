/**
 * GET /api/shop/checkout/payment-options
 * Returns enabled payment methods and FOP details for checkout UI.
 */

import { NextResponse } from 'next/server';
import { getOrCreateShopSettings, getShopSettingsRuntime } from '@/lib/shopAdminSettings';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    const record = await getOrCreateShopSettings(prisma);
    const settings = getShopSettingsRuntime(record);

    const methods: Array<'FOP' | 'STRIPE' | 'WHITEBIT'> = ['FOP', 'WHITEBIT'];

    const fopDetails =
      settings.fopCompanyName ||
      settings.fopIban ||
      settings.fopBankName ||
      settings.fopEdrpou ||
      settings.fopDetails
        ? {
            companyName: settings.fopCompanyName ?? null,
            iban: settings.fopIban ?? null,
            bankName: settings.fopBankName ?? null,
            edrpou: settings.fopEdrpou ?? null,
            details: settings.fopDetails ?? null,
          }
        : null;

    return NextResponse.json({
      methods,
      fopDetails,
    });
  } catch (e) {
    console.error('Payment options', e);
    return NextResponse.json(
      { methods: ['FOP'], fopDetails: null },
      { status: 200 }
    );
  }
}
