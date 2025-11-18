import { render } from '@react-email/render';
import { ContactEmail } from '@/components/emails/ContactEmail';
import { formatAutoMessage, formatMotoMessage } from '@/lib/telegram';
import type { NextRequest } from 'next/server';
import { Resend } from 'resend';
import * as fs from 'fs';
import * as path from 'path';
import { PrismaClient } from '@prisma/client';

// Basic rate limiting (memory). For production replace with Redis or durable store.
const WINDOW_MS = 60_000; // 1 minute
const MAX_PER_WINDOW = 10;
const hits: Record<string, { count: number; windowStart: number }> = {};

type ContactType = 'auto' | 'moto';

type ContactRequestBody = {
  type?: ContactType;
  carModel?: string;
  motoModel?: string;
  vin?: string;
  wishes?: string;
  budget?: string;
  email?: string;
  name?: string;
  phone?: string;
  contactMethod?: 'telegram' | 'whatsapp';
};

type ContactFormData = {
  carModel?: string;
  motoModel?: string;
  vin: string;
  wishes: string;
  budget: string;
  email: string;
  name: string;
  phone: string;
  contactMethod: 'telegram' | 'whatsapp';
};

type AutoFormData = ContactFormData & { carModel: string };
type MotoFormData = ContactFormData & { motoModel: string };

type TelegramPayload = {
  chat_id: string;
  text: string;
  parse_mode: 'HTML';
};

const prisma = new PrismaClient();
// Initialize Resend with a fallback key to prevent build-time errors if env var is missing.
// The actual sending logic checks for the presence of the key.
const resend = new Resend(process.env.RESEND_API_KEY || 're_123456789');

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

async function sendTelegram(message: string, type: ContactType) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = type === 'auto' 
    ? process.env.TELEGRAM_AUTO_CHAT_ID 
    : process.env.TELEGRAM_MOTO_CHAT_ID;
  
  if (!token || !chatId) {
    console.error('Telegram environment variables are not set!');
    return { ok: false, error: 'Missing bot env' };
  }

  const payload: TelegramPayload = {
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
  } catch (e: unknown) {
    console.error('Telegram Request Failed:', e);
    const errorMessage = e instanceof Error ? e.message : 'Telegram request failed';
    return { ok: false, error: errorMessage };
  }
}

async function sendEmail(
  subject: string,
  formData: ContactFormData,
  type: ContactType,
  messageId?: string
  , logoSrc?: string
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
    phone: formData.phone,
    contactMethod: formData.contactMethod,
    messageId,
    logoSrc,
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
  } catch (e: unknown) {
    console.error('Email (Resend) Request Failed:', e);
    const errorMessage = e instanceof Error ? e.message : 'Resend request failed';
    return { ok: false, error: errorMessage };
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
  const body = (await req.json()) as ContactRequestBody;
  const type: ContactType = body.type === 'moto' ? 'moto' : 'auto';

  let message: string;
  let model = '';
  let formData: ContactFormData;

    if (type === 'auto') {
      const autoFormData: AutoFormData = {
        carModel: sanitize(body.carModel),
        vin: sanitize(body.vin),
        wishes: sanitize(body.wishes),
        budget: sanitize(body.budget),
        email: sanitize(body.email),
        name: sanitize(body.name) || sanitize(body.email),
        phone: sanitize(body.phone),
        contactMethod: body.contactMethod || 'telegram',
      };
      if (!autoFormData.carModel || !autoFormData.email || !autoFormData.phone) {
        return new Response(JSON.stringify({ error: 'Missing required auto fields' }), { status: 400 });
      }
      model = autoFormData.carModel;
      message = formatAutoMessage(autoFormData);
      formData = autoFormData;
    } else { // moto
      const motoFormData: MotoFormData = {
        motoModel: sanitize(body.motoModel),
        vin: sanitize(body.vin),
        wishes: sanitize(body.wishes),
        budget: sanitize(body.budget),
        email: sanitize(body.email),
        name: sanitize(body.name) || sanitize(body.email),
        phone: sanitize(body.phone),
        contactMethod: body.contactMethod || 'telegram',
      };
      if (!motoFormData.motoModel || !motoFormData.email || !motoFormData.phone) {
        return new Response(JSON.stringify({ error: 'Missing required moto fields' }), { status: 400 });
      }
      model = motoFormData.motoModel;
      message = formatMotoMessage(motoFormData);
      formData = motoFormData;
    }

    // Save to message store
    const savedMessage = await prisma.message.create({
      data: {
        userName: formData.name,
        userEmail: formData.email,
        userPhone: formData.phone,
        contactMethod: formData.contactMethod.toUpperCase() as 'TELEGRAM' | 'WHATSAPP',
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
          phone: formData.phone,
          contactMethod: formData.contactMethod,
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
    } catch (tgError: unknown) {
      const telegramErrorMessage = tgError instanceof Error ? tgError.message : 'Telegram notification failed';
      console.error('❌ Telegram error (non-blocking):', telegramErrorMessage);
    }

    // Send Email via Resend (don't block user if this fails)
    try {
      const emailSubject = `New ${type.charAt(0).toUpperCase() + type.slice(1)} Inquiry: ${model}`;
      // attempt to read logo from public assets and embed as data URI for email clients
      let logoDataUri: string | undefined = undefined;
      try {
        const pngPublicPath = path.join(process.cwd(), 'public', 'branding', 'one-company-logo.png');
        const pngDesignPath = path.join(process.cwd(), 'Design', 'png', 'ONE COMPANY_logo-01.png');
        const svgPublicPath = path.join(process.cwd(), 'public', 'branding', 'one-company-logo.svg');
        const svgDesignPath = path.join(process.cwd(), 'Design', 'svg', 'ONE COMPANY_logo-01.svg');
        if (fs.existsSync(pngPublicPath)) {
          const png = fs.readFileSync(pngPublicPath);
          const base64 = png.toString('base64');
          logoDataUri = `data:image/png;base64,${base64}`;
        } else if (fs.existsSync(pngDesignPath)) {
          const png = fs.readFileSync(pngDesignPath);
          const base64 = png.toString('base64');
          logoDataUri = `data:image/png;base64,${base64}`;
        } else if (fs.existsSync(svgPublicPath)) {
          const svg = fs.readFileSync(svgPublicPath, 'utf8');
          const base64 = Buffer.from(svg).toString('base64');
          logoDataUri = `data:image/svg+xml;base64,${base64}`;
        } else if (fs.existsSync(svgDesignPath)) {
          const svg = fs.readFileSync(svgDesignPath, 'utf8');
          const base64 = Buffer.from(svg).toString('base64');
          logoDataUri = `data:image/svg+xml;base64,${base64}`;
        }
      } catch (err) {
        console.warn('Could not read logo for email inline:', err instanceof Error ? err.message : err);
      }

      const emailResult = await sendEmail(emailSubject, formData, type, savedMessage.id, logoDataUri);

      if (emailResult.ok) {
        console.log('✅ Email notification sent successfully');
      } else {
        console.warn('⚠️ Email notification failed:', emailResult.error);
      }
    } catch (emailError: unknown) {
      const emailErrorMessage = emailError instanceof Error ? emailError.message : 'Email notification failed';
      console.error('❌ Email error (non-blocking):', emailErrorMessage);
    }

    return new Response(JSON.stringify({ 
      ok: true,
      messageId: savedMessage.id 
    }), { status: 200 });
  } catch (e: unknown) {
    console.error('Server Error:', e);
    const errorMessage = e instanceof Error ? e.message : 'Server error';
    return new Response(JSON.stringify({ error: errorMessage }), { status: 500 });
  }
}

export const runtime = 'nodejs';