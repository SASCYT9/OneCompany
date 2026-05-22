import { notFound } from "next/navigation";
import Link from "next/link";
import { buildPageMetadata, resolveLocale } from "@/lib/seo";
import { prisma } from "@/lib/prisma";

// Cache-bust 2026-05-14T22: Vercel ISR cache held empty/errored renders for many brand routes — likely DB pool exhaustion during a build/revalidate window. Touching to rebuild.
export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ locale: string; token: string }>;
};

export async function generateMetadata({ params }: Props) {
  const { locale } = await params;
  const resolvedLocale = resolveLocale(locale);
  return buildPageMetadata(resolvedLocale, "shop/forged/quote", {
    title:
      resolvedLocale === "ua"
        ? "Запит надіслано — One Company Forged"
        : "Quote received — One Company Forged",
    description:
      resolvedLocale === "ua"
        ? "Ваш запит на прорахунок One Company Forged отримано. Очікуйте відповідь від нашого менеджера протягом 24 годин."
        : "Your One Company Forged quote request has been received. We'll respond within 24 hours.",
  });
}

type ForgedSnapshot = {
  kind?: string;
  designName?: string;
  estimateEur?: number | null;
  leadTimeWeeks?: { weeksMin: number; weeksMax: number } | null;
  config?: Record<string, unknown>;
};

export default async function ShopForgedQuotePage({ params }: Props) {
  const { locale, token } = await params;
  const resolvedLocale = resolveLocale(locale);
  const isUa = resolvedLocale === "ua";

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const order = (await (prisma as any).shopOrder.findFirst({
    where: { draftQuoteToken: token },
    select: {
      id: true,
      orderNumber: true,
      customerName: true,
      email: true,
      total: true,
      currency: true,
      createdAt: true,
      draftValidUntil: true,
      pricingSnapshot: true,
    },
  })) as {
    id: string;
    orderNumber: string;
    customerName: string;
    email: string;
    total: { toString(): string };
    currency: string;
    createdAt: Date;
    draftValidUntil: Date | null;
    pricingSnapshot: ForgedSnapshot | null;
  } | null;

  if (!order) notFound();

  const snap = order.pricingSnapshot ?? {};

  return (
    <div className="bg-background text-foreground">
      <div className="px-6 pt-6 md:px-12 md:pt-10">
        <Link
          href={`/${resolvedLocale}/shop/forged`}
          className="text-xs uppercase tracking-[0.2em] text-white/50 transition hover:text-white"
        >
          ← {isUa ? "Forged home" : "Forged home"}
        </Link>
      </div>

      <main className="mx-auto max-w-3xl px-6 py-20 md:px-12 md:py-32">
        <p className="mb-4 text-xs uppercase tracking-[0.32em] text-[#c48e4c]">
          {isUa ? "Запит отримано" : "Request received"}
        </p>
        <h1 className="text-balance text-4xl font-light leading-[1.1] tracking-tight md:text-5xl">
          {isUa
            ? `Дякуємо, ${order.customerName.split(" ")[0]}.`
            : `Thank you, ${order.customerName.split(" ")[0]}.`}
        </h1>
        <p className="mt-6 max-w-xl text-base leading-relaxed text-white/70 md:text-lg">
          {isUa
            ? "Інженер опрацює конфігурацію та надішле фіксований прорахунок на ваш email протягом 24 годин."
            : "An engineer will review your configuration and email a fixed quote within 24 hours."}
        </p>

        <dl className="mt-12 grid gap-x-12 gap-y-6 border-t border-white/10 pt-10 sm:grid-cols-2">
          <Pair label={isUa ? "Номер запиту" : "Request number"} value={order.orderNumber} />
          <Pair label={isUa ? "Дизайн" : "Design"} value={snap.designName ?? "—"} />
          <Pair
            label={isUa ? "Орієнтовно" : "Estimate"}
            value={
              snap.estimateEur != null
                ? `€${Number(snap.estimateEur).toLocaleString("en-US")}`
                : "—"
            }
          />
          <Pair
            label={isUa ? "Виробництво" : "Lead time"}
            value={
              snap.leadTimeWeeks
                ? `${snap.leadTimeWeeks.weeksMin}–${snap.leadTimeWeeks.weeksMax} ${isUa ? "тижнів" : "weeks"}`
                : "—"
            }
          />
          <Pair label="Email" value={order.email} />
          <Pair
            label={isUa ? "Дійсний до" : "Valid until"}
            value={
              order.draftValidUntil
                ? new Date(order.draftValidUntil).toLocaleDateString(isUa ? "uk-UA" : "en-US", {
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  })
                : "—"
            }
          />
        </dl>

        <p className="mt-12 text-xs leading-relaxed text-white/40">
          {isUa
            ? "Збережіть цю сторінку — ви можете повернутись за посиланням з email-у в будь-який час. Якщо менеджер не зв'яжеться протягом 24 годин — напишіть нам напряму на info@onecompany.global."
            : "Bookmark this page — you can return via the link in the email at any time. If you haven't heard from us within 24 hours, drop a line to info@onecompany.global."}
        </p>
      </main>
    </div>
  );
}

function Pair({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-[0.18em] text-white/40">{label}</dt>
      <dd className="mt-1 text-base text-white/90">{value}</dd>
    </div>
  );
}
