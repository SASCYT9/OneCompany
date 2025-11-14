import { render } from '@react-email/render';
import { ContactEmail } from '@/components/emails/ContactEmail';
import { formatAutoMessage, formatMotoMessage } from '@/lib/telegram';
import type { NextRequest } from 'next/server';
import { Resend } from 'resend';
import { PrismaClient } from '@prisma/client';

// Basic rate limiting (memory). For production replace with Redis or durable store.
const WINDOW_MS = 60_000; // 1 minute
const MAX_PER_WINDOW = 10;
const hits: Record<string, { count: number; windowStart: number }> = {};

const prisma = new PrismaClient();
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

async function sendEmail(
  subject: string,
  formData: any,
  type: 'auto' | 'moto'
) {
  const from = process.env.EMAIL_FROM;
  const to = type === 'auto' ? process.env.EMAIL_AUTO : process.env.EMAIL_MOTO;

  if (!from || !to || !process.env.RESEND_API_KEY) {
    console.error('Email (Resend) environment variables are not set!');
    return { ok: false, error: 'Missing email env vars' };
  }

  const emailHtml = await render(ContactEmail({
    name: formData.name || formData.email,
    contact: formData.email,
    message: formData.wishes,
    inquiryType: type === 'auto' ? 'Auto' : 'Moto',
    model: formData.carModel || formData.motoModel,
    vin: formData.vin,
    budget: formData.budget,
  }));

  try {
    const { data, error } = await resend.emails.send({
      from: `OneCompany <${from}>`,
      to: [to],
      subject: subject,
      html: emailHtml,
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
    let formData: any = {};

    if (type === 'auto') {
      formData = {
        carModel: sanitize(body.carModel),
        vin: sanitize(body.vin),
        wishes: sanitize(body.wishes),
        budget: sanitize(body.budget),
        email: sanitize(body.email),
        name: sanitize(body.name) || sanitize(body.email),
      };
      if (!formData.carModel || !formData.email) {
        return new Response(JSON.stringify({ error: 'Missing required auto fields' }), { status: 400 });
      }
      model = formData.carModel;
      message = formatAutoMessage(formData);
    } else { // moto
      formData = {
        motoModel: sanitize(body.motoModel),
        vin: sanitize(body.vin),
        wishes: sanitize(body.wishes),
        budget: sanitize(body.budget),
        email: sanitize(body.email),
        name: sanitize(body.name) || sanitize(body.email),
      };
      if (!formData.motoModel || !formData.email) {
        return new Response(JSON.stringify({ error: 'Missing required moto fields' }), { status: 400 });
      }
      model = formData.motoModel;
      message = formatMotoMessage(formData);
    }

    // Save to message store
    const savedMessage = await prisma.message.create({
      data: {
        userName: formData.name,
        userEmail: formData.email,
        messageText: formData.wishes,
        category: type === 'auto' ? 'AUTO' : 'MOTO',
        status: 'NEW',
        metadata: {
          type,
          model,
          vin: formData.vin,
          budget: formData.budget,
          email: formData.email,
          name: formData.name,
        }
      }
    });

    console.log('✅ Message saved to database:', savedMessage.id);

    // Send to Telegram (don't block user if this fails)
    try {
      const tgResult = await sendTelegram(message, type);
      
      if (tgResult.ok) {
        console.log('✅ Telegram notification sent successfully');
      } else {
        console.warn('⚠️ Telegram notification failed:', tgResult.error);
      }
    } catch (tgError: any) {
      console.error('❌ Telegram error (non-blocking):', tgError.message);
    }

    // Send Email via Resend (don't block user if this fails)
    try {
      const emailSubject = `New ${type.charAt(0).toUpperCase() + type.slice(1)} Inquiry: ${model}`;
      const emailResult = await sendEmail(emailSubject, formData, type);

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