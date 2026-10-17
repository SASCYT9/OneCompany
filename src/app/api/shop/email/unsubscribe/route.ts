/**
 * Unsubscribe from reminder emails.
 * - GET  ?t=… — the link in the email: unsubscribes and shows a short confirmation page.
 * - POST ?t=… — RFC 8058 one-click (List-Unsubscribe-Post) from the mail client.
 */
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { unsubscribeCartReminders } from "@/lib/shopCartReminder";

const copy = {
  ua: {
    title: "Ви відписалися",
    done: "Готово: нагадувань про кошик на цю адресу більше не буде.",
    missing: "Посилання застаріло або вже недійсне — нагадувань на нього не буде.",
    back: "Повернутися в магазин",
  },
  en: {
    title: "You are unsubscribed",
    done: "Done: this address will not get cart reminders any more.",
    missing: "This link has expired or is no longer valid — no reminders will follow.",
    back: "Back to the shop",
  },
} as const;

function page(locale: "ua" | "en", ok: boolean, origin: string) {
  const t = copy[locale];
  const html = `<!doctype html>
<html lang="${locale === "ua" ? "uk" : "en"}"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex">
<title>${t.title} · One Company</title></head>
<body style="margin:0;background:#f2f2f2;font-family:system-ui,-apple-system,'Segoe UI',Roboto,Arial,sans-serif;color:#111">
<div style="max-width:560px;margin:0 auto;padding:32px 16px">
<div style="background:#000;padding:26px 0;text-align:center">
<img src="${origin}/branding/email-logo.jpg" width="140" height="51" alt="One Company" style="display:block;margin:0 auto"></div>
<div style="background:#fff;padding:32px 24px">
<h1 style="font-size:24px;font-weight:300;margin:0 0 12px">${t.title}</h1>
<p style="font-size:15px;line-height:24px;color:#555;margin:0 0 24px">${ok ? t.done : t.missing}</p>
<a href="${origin}/${locale}/shop" style="display:inline-block;background:#111;color:#fff;text-decoration:none;font-size:12px;font-weight:600;letter-spacing:.12em;text-transform:uppercase;padding:14px 28px">${t.back}</a>
</div></div></body></html>`;
  return new NextResponse(html, {
    headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" },
  });
}

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("t")?.trim() ?? "";
  const result = await unsubscribeCartReminders(prisma, token);
  return page(result?.locale === "en" ? "en" : "ua", Boolean(result), request.nextUrl.origin);
}

export async function POST(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("t")?.trim() ?? "";
  const result = await unsubscribeCartReminders(prisma, token);
  return NextResponse.json({ ok: Boolean(result) }, { headers: { "Cache-Control": "no-store" } });
}
