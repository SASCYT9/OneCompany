/**
 * POST /api/shop/account/forgot-password
 * Body: { email: string, locale?: 'ua' | 'en' }
 *
 * Generates a password-reset token (reusing ShopCustomerPasswordSetupToken) and
 * emails it via Resend. Always returns 200 with the same body — never reveals
 * whether the email belongs to a real customer (anti-enumeration).
 */

import { NextRequest, NextResponse } from 'next/server';
import { render } from '@react-email/render';
import { Resend } from 'resend';
import { createShopCustomerPasswordSetup, normalizeCustomerEmail } from '@/lib/shopCustomers';
import { consumeRateLimit, getRequestIp } from '@/lib/shopPublicRateLimit';
import { prisma } from '@/lib/prisma';
import ShopPasswordResetEmail from '@/emails/ShopPasswordResetEmail';

const resend = new Resend(process.env.RESEND_API_KEY || 're_placeholder');
const FROM_ADDRESS = process.env.RESEND_FROM_EMAIL || 'One Company <noreply@onecompany.global>';

const WINDOW_MS = 60 * 60 * 1000; // 1 hour
const MAX_PER_WINDOW = 3;

export async function POST(request: NextRequest) {
  const ip = getRequestIp(request.headers);

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const rawEmail = String(body.email ?? '').trim();
  const localeRaw = String(body.locale ?? '').trim();
  const locale: 'ua' | 'en' = localeRaw === 'ua' ? 'ua' : 'en';

  if (!rawEmail) {
    return NextResponse.json({ error: 'Email is required' }, { status: 400 });
  }
  const email = normalizeCustomerEmail(rawEmail);

  const allowed = await consumeRateLimit({
    keyParts: ['shop-forgot-password', ip, email],
    windowMs: WINDOW_MS,
    maxPerWindow: MAX_PER_WINDOW,
  });
  if (!allowed) {
    return NextResponse.json(
      { error: 'Too many reset attempts, try again later' },
      { status: 429 },
    );
  }

  // Use request headers as the most accurate source of the deployed origin
  // (covers branch-preview URLs even when VERCEL_URL isn't injected).
  const proto = request.headers.get('x-forwarded-proto') ?? 'https';
  const host = request.headers.get('x-forwarded-host') ?? request.headers.get('host') ?? '';
  const requestBaseUrl = host ? `${proto}://${host}` : '';

  try {
    const customer = await prisma.shopCustomer.findUnique({
      where: { email },
      select: {
        id: true,
        email: true,
        firstName: true,
        preferredLocale: true,
      },
    });

    if (customer) {
      const setup = await createShopCustomerPasswordSetup(prisma, {
        customerId: customer.id,
        preferredLocale: customer.preferredLocale ?? locale,
        baseUrl: requestBaseUrl || undefined,
      });

      const html = await render(
        ShopPasswordResetEmail({
          resetUrl: setup.url,
          firstName: customer.firstName,
          locale: (customer.preferredLocale === 'ua' || locale === 'ua') ? 'ua' : 'en',
        }),
      );

      try {
        await resend.emails.send({
          from: FROM_ADDRESS,
          to: customer.email,
          subject:
            locale === 'ua'
              ? 'Скидання пароля — One Company'
              : 'Reset your One Company password',
          html,
        });
      } catch (sendError) {
        // Log but do not surface — keep response identical to the not-found path.
        console.error('Shop forgot-password email send failed', sendError);
      }
    }

    return NextResponse.json({
      ok: true,
      message:
        locale === 'ua'
          ? 'Якщо акаунт існує — лист зі скиданням пароля надіслано.'
          : 'If the account exists, a reset email has been sent.',
    });
  } catch (error) {
    console.error('Shop forgot-password', error);
    return NextResponse.json({ error: 'Failed to process request' }, { status: 500 });
  }
}

export const runtime = 'nodejs';
