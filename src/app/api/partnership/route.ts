import { render } from '@react-email/render';
import { PartnershipEmail } from '@/components/emails/PartnershipEmail';
import { formatPartnershipMessage } from '@/lib/telegram';
import type { NextRequest } from 'next/server';
import { Resend } from 'resend';
import * as fs from 'fs';
import * as path from 'path';
import { PrismaClient } from '@prisma/client';

// Basic rate limiting (memory).
const WINDOW_MS = 60_000; // 1 minute
const MAX_PER_WINDOW = 10;
const hits: Record<string, { count: number; windowStart: number }> = {};

type PartnershipRequestBody = {
  companyName: string;
  website?: string;
  type: 'sto' | 'dealer' | 'detailing' | 'tuning' | 'other';
  contactName: string;
  email: string;
  phone: string;
  message?: string;
};

type TelegramPayload = {
  chat_id: string;
  text: string;
  parse_mode: 'HTML';
};

const prisma = new PrismaClient();
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

async function sendTelegram(message: string) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  // Use AUTO chat ID as default for partnerships or maybe a general one if available.
  // Assuming AUTO is the main channel for now.
  const chatId = process.env.TELEGRAM_AUTO_CHAT_ID || process.env.TELEGRAM_CHAT_ID;
  
  if (!token || !chatId) {
    console.error('Telegram env is missing for partnership notification', {
      hasToken: !!token,
      hasChatId: !!chatId,
      requiredChatEnv: ['TELEGRAM_AUTO_CHAT_ID', 'TELEGRAM_CHAT_ID'],
    });
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
  formData: PartnershipRequestBody,
  messageId?: string,
  logoSrc?: string
) {
  const from = process.env.EMAIL_FROM;
  // Send to AUTO email as default for partnerships
  const to = process.env.EMAIL_AUTO;

  if (!from || !to || !process.env.RESEND_API_KEY) {
    console.error('Email (Resend) environment variables are not set!');
    return { ok: false, error: 'Missing email env vars' };
  }

  const emailHtml = await render(PartnershipEmail({
    companyName: formData.companyName,
    website: formData.website,
    type: formData.type,
    contactName: formData.contactName,
    email: formData.email,
    phone: formData.phone,
    message: formData.message,
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
  return str.replace(/<[^>]*>/g, '').trim();
}

export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for') || 'local';
  if (!rateLimit(ip)) {
    return new Response(JSON.stringify({ error: 'Rate limited' }), { status: 429 });
  }
  try {
    const body = (await req.json()) as PartnershipRequestBody;

    const formData: PartnershipRequestBody = {
      companyName: sanitize(body.companyName),
      website: sanitize(body.website),
      type: body.type,
      contactName: sanitize(body.contactName),
      email: sanitize(body.email),
      phone: sanitize(body.phone),
      message: sanitize(body.message),
    };

    if (!formData.companyName || !formData.email || !formData.phone || !formData.contactName) {
      return new Response(JSON.stringify({ error: 'Missing required fields' }), { status: 400 });
    }

    const message = formatPartnershipMessage(formData);

    // Save to message store
    const savedMessage = await prisma.message.create({
      data: {
        userName: formData.contactName,
        userEmail: formData.email,
        userPhone: formData.phone,
        contactMethod: 'TELEGRAM', // Defaulting to Telegram as it's not in the form
        messageText: formData.message || `Partnership request from ${formData.companyName} (${formData.type})`,
        category: 'GENERAL', // Using GENERAL for partnerships
        status: 'NEW',
        metadata: {
          type: 'partnership',
          partnershipType: formData.type,
          companyName: formData.companyName,
          website: formData.website,
          contactName: formData.contactName,
          email: formData.email,
          phone: formData.phone,
          message: formData.message,
        }
      }
    });

    console.log('✅ Partnership message saved to database:', savedMessage.id);

    // Send to Telegram
    try {
      const tgResult = await sendTelegram(message);
      if (tgResult.ok) {
        console.log('✅ Telegram notification sent successfully');
      } else {
        console.warn('⚠️ Telegram notification failed:', tgResult.error);
      }
    } catch (tgError: unknown) {
      const telegramErrorMessage = tgError instanceof Error ? tgError.message : 'Telegram notification failed';
      console.error('❌ Telegram error (non-blocking):', telegramErrorMessage);
    }

    // Send Email
    try {
      const emailSubject = `New Partnership Request: ${formData.companyName}`;
      
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

      const emailResult = await sendEmail(emailSubject, formData, savedMessage.id, logoDataUri);

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
