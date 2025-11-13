import { NextResponse } from 'next/server';

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;

/**
 * Налаштовує веб-хук для Telegram бота
 * Викликайте цей endpoint після деплою: GET /api/telegram/setup
 */
export async function GET() {
  try {
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
        allowed_updates: ['message'],
        drop_pending_updates: true,
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

  } catch (error: any) {
    console.error('Setup error:', error);
    return NextResponse.json(
      { 
        error: 'Failed to setup webhook',
        message: error.message
      },
      { status: 500 }
    );
  }
}

/**
 * Видаляє веб-хук (корисно для тестування)
 * DELETE /api/telegram/setup
 */
export async function DELETE() {
  try {
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

  } catch (error: any) {
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}
