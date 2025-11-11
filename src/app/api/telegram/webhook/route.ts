import type { NextRequest } from 'next/server';

/**
 * Handles incoming webhook updates from Telegram.
 * https://core.telegram.org/bots/api#update
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    console.log('Received Telegram Webhook:', JSON.stringify(body, null, 2));

    // Here we will add logic to process the message:
    // 1. Check if it's a message we should handle.
    // 2. Save the message to a database/store.
    // 3. Potentially trigger a notification in the Mini App.

    return new Response(JSON.stringify({ ok: true }), { status: 200 });
  } catch (e: any) {
    console.error('Error processing Telegram webhook:', e);
    return new Response(JSON.stringify({ error: e.message }), { status: 500 });
  }
}

export const runtime = 'nodejs';
