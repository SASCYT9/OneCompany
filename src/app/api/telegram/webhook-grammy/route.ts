// grammY Telegram Webhook Handler
import { NextRequest, NextResponse } from 'next/server';
import { handleUpdate } from '@/lib/bot';

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '';

// Webhook secret for validation (optional but recommended)
const WEBHOOK_SECRET = process.env.TELEGRAM_WEBHOOK_SECRET || '';

export async function POST(request: NextRequest) {
  try {
    // Validate secret token if set
    if (WEBHOOK_SECRET) {
      const secretHeader = request.headers.get('x-telegram-bot-api-secret-token');
      if (secretHeader !== WEBHOOK_SECRET) {
        console.error('Invalid webhook secret');
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
    }
    
    // Parse the update
    const update = await request.json();
    
    // Handle the update with grammY
    await handleUpdate(TELEGRAM_BOT_TOKEN, update);
    
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Webhook error:', error);
    // Always return 200 to Telegram to prevent retries
    return NextResponse.json({ ok: true });
  }
}

// For setting up the webhook
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const action = searchParams.get('action');
  const secret = searchParams.get('secret');
  
  // Require secret for webhook setup
  if (secret !== process.env.ADMIN_API_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  
  if (action === 'set') {
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://onecompany.ua';
    const webhookUrl = `${siteUrl}/api/telegram/webhook-grammy`;
    
    try {
      const response = await fetch(
        `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/setWebhook`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            url: webhookUrl,
            allowed_updates: ['message', 'callback_query', 'inline_query'],
            drop_pending_updates: true,
            ...(WEBHOOK_SECRET && { secret_token: WEBHOOK_SECRET }),
          }),
        }
      );
      
      const result = await response.json();
      return NextResponse.json({ 
        action: 'set',
        url: webhookUrl,
        result 
      });
    } catch (error) {
      return NextResponse.json({ 
        error: 'Failed to set webhook',
        details: String(error)
      }, { status: 500 });
    }
  }
  
  if (action === 'delete') {
    try {
      const response = await fetch(
        `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/deleteWebhook`,
        { method: 'POST' }
      );
      
      const result = await response.json();
      return NextResponse.json({ 
        action: 'delete',
        result 
      });
    } catch (error) {
      return NextResponse.json({ 
        error: 'Failed to delete webhook',
        details: String(error)
      }, { status: 500 });
    }
  }
  
  if (action === 'info') {
    try {
      const response = await fetch(
        `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getWebhookInfo`
      );
      
      const result = await response.json();
      return NextResponse.json({ 
        action: 'info',
        result 
      });
    } catch (error) {
      return NextResponse.json({ 
        error: 'Failed to get webhook info',
        details: String(error)
      }, { status: 500 });
    }
  }
  
  return NextResponse.json({
    message: 'grammY Telegram Webhook',
    actions: ['set', 'delete', 'info'],
    usage: '?action=set&secret=YOUR_SECRET',
  });
}
