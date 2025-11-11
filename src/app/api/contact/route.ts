import { formatAutoMessage, formatMotoMessage } from '@/lib/telegram';
import type { NextRequest } from 'next/server';

// Basic rate limiting (memory). For production replace with Redis or durable store.
const WINDOW_MS = 60_000; // 1 minute
const MAX_PER_WINDOW = 10;
const hits: Record<string, { count: number; windowStart: number }> = {};

function rateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = hits[ip];
  if (!entry || now - entry.windowStart > WINDOW_MS) {
    hits[ip] = { count: 1, windowStart: now };
    return true;
  }
  if (entry.count >= MAX_PER_WINDOW) return false;
  entry.count++;
  return true;
}

async function sendTelegram(message: string, type: 'auto' | 'moto') {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  // Route to different chat IDs based on inquiry type
  const chatId = type === 'auto' 
    ? process.env.TELEGRAM_AUTO_CHAT_ID 
    : process.env.TELEGRAM_MOTO_CHAT_ID;
  
  if (!token || !chatId) {
    console.error('Telegram environment variables are not set!');
    return { ok: false, error: 'Missing bot env' };
  }
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text: message, parse_mode: 'HTML' })
    });
    const data = await res.json();
    if (!res.ok) {
      console.error('Telegram API Error:', data);
      return { ok: false, error: data.description || 'Telegram API error' };
    }
    return { ok: true };
  } catch (e: any) {
    console.error('Telegram Request Failed:', e);
    return { ok: false, error: e?.message || 'Telegram request failed' };
  }
}

function sanitize(str: string | undefined): string {
  if (!str) return '';
  // Basic sanitization: remove HTML tags and trim whitespace.
  return str.replace(/<[^>]*>/g, '').trim();
}

// Stricter sanitization for use within HTML content.
function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for') || 'local';
  if (!rateLimit(ip)) {
    return new Response(JSON.stringify({ error: 'Rate limited' }), { status: 429 });
  }
  try {
    const body = await req.json();
    const type = (body.type === 'moto' ? 'moto' : 'auto') as 'auto' | 'moto';

    let message: string;

    if (type === 'auto') {
      const formData = {
        carModel: sanitize(body.carModel),
        vin: sanitize(body.vin),
        wishes: sanitize(body.wishes),
        budget: sanitize(body.budget),
        email: sanitize(body.email),
      };
      if (!formData.carModel || !formData.email) {
        return new Response(JSON.stringify({ error: 'Missing required auto fields' }), { status: 400 });
      }
      // Escape fields before putting them into the HTML message
      message = formatAutoMessage({
        ...formData,
        carModel: escapeHtml(formData.carModel),
        vin: escapeHtml(formData.vin),
        wishes: escapeHtml(formData.wishes),
        budget: escapeHtml(formData.budget),
        email: escapeHtml(formData.email),
      });
    } else { // moto
      const formData = {
        motoModel: sanitize(body.motoModel),
        vin: sanitize(body.vin),
        wishes: sanitize(body.wishes),
        budget: sanitize(body.budget),
        email: sanitize(body.email),
      };
      if (!formData.motoModel || !formData.email) {
        return new Response(JSON.stringify({ error: 'Missing required moto fields' }), { status: 400 });
      }
      // Escape fields before putting them into the HTML message
      message = formatMotoMessage({
        ...formData,
        motoModel: escapeHtml(formData.motoModel),
        vin: escapeHtml(formData.vin),
        wishes: escapeHtml(formData.wishes),
        budget: escapeHtml(formData.budget),
        email: escapeHtml(formData.email),
      });
    }

    // Send to Telegram
    const tgResult = await sendTelegram(message, type);

    if (!tgResult.ok) {
      // Log the error but don't block the user response
      console.error('Failed to send to Telegram:', tgResult.error);
      // Optionally, you could have a fallback here, like sending an email
      return new Response(JSON.stringify({ error: 'Failed to process submission' }), { status: 500 });
    }

    return new Response(JSON.stringify({ ok: true }), { status: 200 });
  } catch (e: any) {
    console.error('Server Error:', e);
    return new Response(JSON.stringify({ error: e?.message || 'Server error' }), { status: 500 });
  }
}

export const runtime = 'nodejs';