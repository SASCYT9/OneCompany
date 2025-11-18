import type { Metadata } from "next";
import { resolveLocale, buildPageMetadata, type SupportedLocale } from "@/lib/seo";

export const dynamic = "force-static";

const metaCopy: Record<SupportedLocale, { title: string; description: string }> = {
  en: { title: "Privacy Policy · onecompany", description: "Our commitment to your privacy and data protection." },
  ua: { title: "Політика конфіденційності · onecompany", description: "Наша політика конфіденційності та захисту даних." },
};

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const l = resolveLocale(locale);
  const meta = metaCopy[l];
  return buildPageMetadata(l, "privacy", meta);
}

export default async function PrivacyPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const l = resolveLocale(locale);

  return (
    <div className="mx-auto max-w-3xl px-4 py-16 text-white">
      <h1 className="text-3xl font-light sm:text-4xl">{l === "ua" ? "Політика конфіденційності" : "Privacy Policy"}</h1>
      <p className="mt-4 text-white/70">
        {l === "ua"
          ? "Ми поважаємо вашу конфіденційність. Ця сторінка є тимчасовим шаблоном; повна версія політики буде додана найближчим часом."
          : "We respect your privacy. This page is a temporary placeholder; the full policy will be published shortly."}
      </p>
    </div>
  );
}
