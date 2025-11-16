import type { Metadata } from "next";
import { resolveLocale, buildPageMetadata, type SupportedLocale } from "@/lib/seo";

export const dynamic = "force-static";

const metaCopy: Record<SupportedLocale, { title: string; description: string }> = {
  en: { title: "Terms of Service · onecompany", description: "Terms governing the use of our services and site." },
  ua: { title: "Умови надання послуг · onecompany", description: "Умови користування нашим сайтом та послугами." },
};

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const l = resolveLocale(locale);
  const meta = metaCopy[l];
  return buildPageMetadata(l, "terms", meta);
}

export default async function TermsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const l = resolveLocale(locale);

  return (
    <div className="mx-auto max-w-3xl px-4 py-16 text-white">
      <h1 className="text-3xl font-light sm:text-4xl">{l === "ua" ? "Умови надання послуг" : "Terms of Service"}</h1>
      <p className="mt-4 text-white/70">
        {l === "ua"
          ? "Це тимчасова версія сторінки з умовами. Остаточний текст буде опубліковано найближчим часом."
          : "This is a temporary version of the terms. The final content will be published shortly."}
      </p>
    </div>
  );
}
