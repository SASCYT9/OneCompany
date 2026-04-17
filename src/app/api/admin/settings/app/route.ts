'use server';

import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';
import { assertAdminRequest } from '@/lib/adminAuth';
import { ADMIN_PERMISSIONS, writeAdminAuditLog } from '@/lib/adminRbac';
import { getOrCreateShopSettings } from '@/lib/shopAdminSettings';
import { prisma } from '@/lib/prisma';

// ─── Validation Constants ───
const ALLOWED_CURRENCIES = ['USD', 'EUR', 'UAH'] as const;
const ALLOWED_LANGUAGES = ['ua', 'en'] as const;
const MAX_LENGTHS = {
  companyName: 100,
  contactEmail: 254,
  contactPhone: 30,
  address: 200,
  metaTitle: 60,
  metaDescription: 160,
  ogImage: 500,
  accentColor: 9,
  logoUrl: 500,
} as const;

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Only allow https:// URLs or relative paths starting with / */
function isValidUrl(url: string): boolean {
  const trimmed = url.trim();
  if (trimmed.startsWith('/')) return true;
  try {
    const parsed = new URL(trimmed);
    return parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

/** Strip HTML tags to prevent stored XSS */
function sanitizeText(text: string): string {
  return text.replace(/<[^>]*>/g, '').trim();
}

/**
 * Admin App-Level Settings API
 * 
 * Handles the "general" admin settings — company info, SEO, appearance,
 * notification preferences. These were previously stored in localStorage
 * and have been migrated to ShopSettings model fields (prefixed with `app*`).
 */

type AppSettingsResponse = {
  soundEnabled: boolean;
  companyName: string;
  contactEmail: string;
  contactPhone: string;
  address: string;
  defaultCurrency: string;
  defaultMarkup: number;
  defaultLanguage: string;
  showPricesWithVat: boolean;
  metaTitle: string;
  metaDescription: string;
  ogImage: string;
  accentColor: string;
  logoUrl: string;
  darkMode: boolean;
};

function mapToResponse(record: {
  appSoundEnabled: boolean;
  appCompanyName: string | null;
  appContactEmail: string | null;
  appContactPhone: string | null;
  appAddress: string | null;
  defaultCurrency: string;
  appDefaultMarkup: number;
  appDefaultLanguage: string;
  appShowPricesWithVat: boolean;
  appMetaTitle: string | null;
  appMetaDescription: string | null;
  appOgImage: string | null;
  appAccentColor: string;
  appLogoUrl: string | null;
  appDarkMode: boolean;
}): AppSettingsResponse {
  return {
    soundEnabled: record.appSoundEnabled,
    companyName: record.appCompanyName ?? 'OneCompany',
    contactEmail: record.appContactEmail ?? 'info@onecompany.com.ua',
    contactPhone: record.appContactPhone ?? '',
    address: record.appAddress ?? 'Україна',
    defaultCurrency: record.defaultCurrency,
    defaultMarkup: record.appDefaultMarkup,
    defaultLanguage: record.appDefaultLanguage,
    showPricesWithVat: record.appShowPricesWithVat,
    metaTitle: record.appMetaTitle ?? 'OneCompany — Premium Tuning & Performance Parts',
    metaDescription: record.appMetaDescription ?? '',
    ogImage: record.appOgImage ?? '/branding/one-company-logo.png',
    accentColor: record.appAccentColor,
    logoUrl: record.appLogoUrl ?? '/branding/one-company-logo.png',
    darkMode: record.appDarkMode,
  };
}

export async function GET() {
  try {
    const cookieStore = await cookies();
    assertAdminRequest(cookieStore, ADMIN_PERMISSIONS.SHOP_SETTINGS_READ);

    const settings = await getOrCreateShopSettings(prisma);
    return NextResponse.json(mapToResponse(settings));
  } catch (error) {
    if ((error as Error).message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if ((error as Error).message === 'FORBIDDEN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    console.error('Admin app settings GET error:', error);
    return NextResponse.json({ error: 'Failed to load settings' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const session = assertAdminRequest(cookieStore, ADMIN_PERMISSIONS.SHOP_SETTINGS_WRITE);

    const body = await request.json().catch(() => ({}));

    // ─── Validate & Sanitize incoming payload ───
    const updateData: Record<string, unknown> = {};
    const errors: string[] = [];

    if (typeof body.soundEnabled === 'boolean') updateData.appSoundEnabled = body.soundEnabled;

    if (typeof body.companyName === 'string') {
      const val = sanitizeText(body.companyName).slice(0, MAX_LENGTHS.companyName);
      updateData.appCompanyName = val || null;
    }

    if (typeof body.contactEmail === 'string') {
      const val = body.contactEmail.trim().slice(0, MAX_LENGTHS.contactEmail);
      if (val && !EMAIL_REGEX.test(val)) {
        errors.push('contactEmail: invalid email format');
      } else {
        updateData.appContactEmail = val || null;
      }
    }

    if (typeof body.contactPhone === 'string') {
      updateData.appContactPhone = sanitizeText(body.contactPhone).slice(0, MAX_LENGTHS.contactPhone) || null;
    }

    if (typeof body.address === 'string') {
      updateData.appAddress = sanitizeText(body.address).slice(0, MAX_LENGTHS.address) || null;
    }

    if (typeof body.defaultCurrency === 'string') {
      if (!(ALLOWED_CURRENCIES as readonly string[]).includes(body.defaultCurrency)) {
        errors.push(`defaultCurrency: must be one of ${ALLOWED_CURRENCIES.join(', ')}`);
      } else {
        updateData.defaultCurrency = body.defaultCurrency;
      }
    }

    if (typeof body.defaultMarkup === 'number' && Number.isFinite(body.defaultMarkup)) {
      updateData.appDefaultMarkup = Math.max(0, Math.min(999, Math.round(body.defaultMarkup)));
    }

    if (typeof body.defaultLanguage === 'string') {
      if (!(ALLOWED_LANGUAGES as readonly string[]).includes(body.defaultLanguage)) {
        errors.push(`defaultLanguage: must be one of ${ALLOWED_LANGUAGES.join(', ')}`);
      } else {
        updateData.appDefaultLanguage = body.defaultLanguage;
      }
    }

    if (typeof body.showPricesWithVat === 'boolean') updateData.appShowPricesWithVat = body.showPricesWithVat;

    if (typeof body.metaTitle === 'string') {
      updateData.appMetaTitle = sanitizeText(body.metaTitle).slice(0, MAX_LENGTHS.metaTitle) || null;
    }

    if (typeof body.metaDescription === 'string') {
      updateData.appMetaDescription = sanitizeText(body.metaDescription).slice(0, MAX_LENGTHS.metaDescription) || null;
    }

    if (typeof body.ogImage === 'string') {
      const val = body.ogImage.trim().slice(0, MAX_LENGTHS.ogImage);
      if (val && !isValidUrl(val)) {
        errors.push('ogImage: must be a valid https:// URL or relative path');
      } else {
        updateData.appOgImage = val || null;
      }
    }

    if (typeof body.accentColor === 'string') {
      // Only allow valid hex colors
      const hex = body.accentColor.trim().slice(0, MAX_LENGTHS.accentColor);
      updateData.appAccentColor = /^#[0-9a-fA-F]{3,8}$/.test(hex) ? hex : '#6366f1';
    }

    if (typeof body.logoUrl === 'string') {
      const val = body.logoUrl.trim().slice(0, MAX_LENGTHS.logoUrl);
      if (val && !isValidUrl(val)) {
        errors.push('logoUrl: must be a valid https:// URL or relative path');
      } else {
        updateData.appLogoUrl = val || null;
      }
    }

    if (typeof body.darkMode === 'boolean') updateData.appDarkMode = body.darkMode;

    if (errors.length > 0) {
      return NextResponse.json({ error: 'Validation failed', details: errors }, { status: 400 });
    }

    if (!Object.keys(updateData).length) {
      return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 });
    }

    const settings = await prisma.shopSettings.update({
      where: { key: 'shop' },
      data: updateData,
    });

    await writeAdminAuditLog(prisma, session, {
      scope: 'admin',
      action: 'settings.app.update',
      entityType: 'app.settings',
      entityId: 'shop',
      metadata: {
        updatedFields: Object.keys(updateData),
      },
    });

    return NextResponse.json(mapToResponse(settings));
  } catch (error) {
    if ((error as Error).message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if ((error as Error).message === 'FORBIDDEN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    console.error('Admin app settings PATCH error:', error);
    return NextResponse.json({ error: 'Failed to update settings' }, { status: 500 });
  }
}
