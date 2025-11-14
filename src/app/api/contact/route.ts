import { formatAutoMessage, formatMotoMessage } from '@/lib/telegram';
import { messageStore } from '@/lib/messageStore';
import type { NextRequest } from 'next/server';
import { Resend } from 'resend';

// Basic rate limiting (memory). For production replace with Redis or durable store.
const WINDOW_MS = 60_000; // 1 minute
const MAX_PER_WINDOW = 10;
const hits: Record<string, { count: number; windowStart: number }> = {};

const resend = new Resend(process.env.RESEND_API_KEY);

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
  const chatId = type === 'auto' 
    ? process.env.TELEGRAM_AUTO_CHAT_ID 
    : process.env.TELEGRAM_MOTO_CHAT_ID;
  
  if (!token || !chatId) {
    console.error('Telegram environment variables are not set!');
    return { ok: false, error: 'Missing bot env' };
  }

  const payload: any = {
    chat_id: chatId,
    text: message,
    parse_mode: 'HTML',
  };

  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
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

async function sendEmail(subject: string, message: string, type: 'auto' | 'moto') {
  const from = process.env.EMAIL_FROM;
  const to = type === 'auto' ? process.env.EMAIL_AUTO : process.env.EMAIL_MOTO;

  if (!from || !to || !process.env.RESEND_API_KEY) {
    console.error('Email (Resend) environment variables are not set!');
    return { ok: false, error: 'Missing email env vars' };
  }

  try {
    const { data, error } = await resend.emails.send({
      from: `OneCompany <${from}>`,
      to: [to],
      subject: subject,
      html: message.replace(/\n/g, '<br>'), // Use the same message, but format for HTML
    });

    if (error) {
      console.error('Resend API Error:', error);
      return { ok: false, error: error.message };
    }

    console.log('✅ Email sent successfully:', data?.id);
    return { ok: true, data };
  } catch (e: any) {
    console.error('Email (Resend) Request Failed:', e);
    return { ok: false, error: e?.message || 'Resend request failed' };
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
    let model: string = '';

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
      model = formData.carModel;
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
      model = formData.motoModel;
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

    // Save to message store
    const savedMessage = messageStore.addMessage({
      chatId: 0,
      userId: 0,
      userName: body.email || 'Contact Form',
      messageText: `${type.toUpperCase()}: ${model}\n${message}`,
      type: 'contact_form',
      category: type,
      metadata: {
        type,
        model,
        email: body.email,
        wishes: body.wishes || '',
      }
    });

    console.log('✅ Message saved to store:', savedMessage.id);

    // Send to Telegram (don't block user if this fails)
    try {
      const tgResult = await sendTelegram(message, type);
      
      if (tgResult.ok) {
        console.log('✅ Telegram notification sent successfully');
      } else {
        console.warn('⚠️ Telegram notification failed:', tgResult.error);
        // Message is saved in store, so we still return success to user
      }
    } catch (tgError: any) {
      console.error('❌ Telegram error (non-blocking):', tgError.message);
      // Still continue - message is saved
    }

    // Send Email via Resend (don't block user if this fails)
    try {
      const emailSubject = `New Contact Request (${type}): ${model}`;
      const emailResult = await sendEmail(emailSubject, message, type);

      if (emailResult.ok) {
        console.log('✅ Email notification sent successfully');
      } else {
        console.warn('⚠️ Email notification failed:', emailResult.error);
      }
    } catch (emailError: any) {
      console.error('❌ Email error (non-blocking):', emailError.message);
    }

    return new Response(JSON.stringify({ 
      ok: true,
      messageId: savedMessage.id 
    }), { status: 200 });
  } catch (e: any) {
    console.error('Server Error:', e);
    return new Response(JSON.stringify({ error: e?.message || 'Server error' }), { status: 500 });
  }
}

export const runtime = 'nodejs';