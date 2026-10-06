/**
 * GET /api/shop/checkout/payment-options
 * Returns enabled payment methods and FOP details for checkout UI.
 */

import { NextResponse } from 'next/server';
import { getOrCreateShopSettings, getShopSettingsRuntime } from '@/lib/shopAdminSettings';
import { prisma } from '@/lib/prisma';
import { isMonobankEnabled } from '@/lib/shopMonobank';

export async function GET() {
  try {
    // Bank-transfer instructions are shown to buyers: never serve a cached copy.
    const settings = getShopSettingsRuntime(await getOrCreateShopSettings(prisma));

    const methods: Array<'FOP' | 'WHITEBIT' | 'MONOBANK'> = ['FOP', 'WHITEBIT'];
    if (isMonobankEnabled() && settings.enabledCurrencies.includes('UAH')) methods.push('MONOBANK');

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
    }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (e) {
    console.error('Payment options', e);
    return NextResponse.json(
      { methods: ['FOP'], fopDetails: null },
      { status: 200 }
    );
  }
}
