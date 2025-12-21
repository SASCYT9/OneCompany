import { NextRequest, NextResponse } from 'next/server';

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_WEBHOOK_SECRET = process.env.TELEGRAM_WEBHOOK_SECRET;
const ADMIN_API_SECRET = process.env.ADMIN_API_SECRET;

function verifySetupAccess(req: NextRequest): boolean {
  if (!ADMIN_API_SECRET) return false;

  const authHeader = req.headers.get('authorization');
  if (authHeader?.startsWith('Bearer ')) {
    return authHeader.slice(7) === ADMIN_API_SECRET;
  }

  const url = new URL(req.url);
  return url.searchParams.get('secret') === ADMIN_API_SECRET;
}

/**
 * Налаштовує веб-хук для Telegram бота
 * Викликайте цей endpoint після деплою: GET /api/telegram/setup
 */
export async function GET(req: NextRequest) {
  try {
    if (!verifySetupAccess(req)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!TELEGRAM_BOT_TOKEN) {
      return NextResponse.json(
        { error: 'TELEGRAM_BOT_TOKEN not configured in environment variables' },
        { status: 500 }
      );
    }

    // Отримуємо базовий URL (наприклад, з Vercel)
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || process.env.VERCEL_URL;
    
    if (!baseUrl) {
      return NextResponse.json(
        { 
          error: 'Base URL not configured',
          hint: 'Set NEXT_PUBLIC_BASE_URL in your environment variables'
        },
        { status: 500 }
      );
    }

    const webhookUrl = `${baseUrl.startsWith('http') ? baseUrl : `https://${baseUrl}`}/api/telegram/webhook`;

    // Налаштовуємо веб-хук в Telegram
    const setWebhookUrl = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/setWebhook`;
    
    const response = await fetch(setWebhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        url: webhookUrl,
        allowed_updates: ['message', 'callback_query'],
        drop_pending_updates: true,
        ...(TELEGRAM_WEBHOOK_SECRET ? { secret_token: TELEGRAM_WEBHOOK_SECRET } : {}),
      }),
    });

    const data = await response.json();

    if (!response.ok || !data.ok) {
      return NextResponse.json(
        { 
          error: 'Failed to set webhook',
          details: data
        },
        { status: 500 }
      );
    }

    // Отримуємо інформацію про веб-хук
    const getWebhookUrl = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getWebhookInfo`;
    const webhookInfo = await fetch(getWebhookUrl);
    const webhookData = await webhookInfo.json();

    return NextResponse.json({
      success: true,
      message: 'Webhook configured successfully',
      webhook_url: webhookUrl,
      webhook_info: webhookData.result,
    });

  } catch (error: unknown) {
    console.error('Setup error:', error);
    const message = error instanceof Error ? error.message : 'Failed to setup webhook';
    return NextResponse.json(
      { 
        error: 'Failed to setup webhook',
        message
      },
      { status: 500 }
    );
  }
}

/**
 * Видаляє веб-хук (корисно для тестування)
 * DELETE /api/telegram/setup
 */
export async function DELETE(req: NextRequest) {
  try {
    if (!verifySetupAccess(req)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!TELEGRAM_BOT_TOKEN) {
      return NextResponse.json(
        { error: 'TELEGRAM_BOT_TOKEN not configured' },
        { status: 500 }
      );
    }

    const deleteWebhookUrl = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/deleteWebhook`;
    
    const response = await fetch(deleteWebhookUrl, {
      method: 'POST',
    });

    const data = await response.json();

    return NextResponse.json({
      success: data.ok,
      message: 'Webhook deleted',
      details: data,
    });

  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to delete webhook';
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}
