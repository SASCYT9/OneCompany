import { buildPageMetadata, resolveLocale } from "@/lib/seo";
import { JsonLd, generateBrandSchema } from "@/lib/jsonLd";
import BrabusHomeSignature from "../components/BrabusHomeSignature";

// ISR: cache rendered HTML for 1 hour. Public content, no per-user data on server.
// Cache-bust 2026-05-14T22: Vercel ISR cache held empty/errored renders for many brand routes — likely DB pool exhaustion during a build/revalidate window. Touching to rebuild.
export const dynamic = "force-static";
export const revalidate = 3600;

type Props = {
  params: Promise<{ locale: string }>;
};

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const resolvedLocale = resolveLocale(locale);
  return buildPageMetadata(resolvedLocale, "shop/brabus", {
    title: resolvedLocale === "ua" ? "Brabus | One Company" : "Brabus | One Company",
    description:
      resolvedLocale === "ua"
        ? "Преміальний тюнінг Brabus. Аеродинамічні обвіси, ковані диски та фірмовий ефект 1-Second-Wow."
        : "Premium Brabus tuning. Aerodynamic kits, forged wheels, and the signature 1-Second-Wow effect.",
  });
}

export default async function ShopBrabusPage({ params }: Props) {
  const { locale } = await params;
  const resolvedLocale = resolveLocale(locale);

  const description =
    resolvedLocale === "ua"
      ? "Преміальний тюнінг Brabus. Аеродинамічні обвіси, ковані диски та фірмовий ефект 1-Second-Wow."
      : "Premium Brabus tuning. Aerodynamic kits, forged wheels, and the signature 1-Second-Wow effect.";

  return (
    <>
      <JsonLd
        schema={generateBrandSchema({
          locale: resolvedLocale,
          slug: "shop/brabus",
          brandName: "Brabus",
          description,
        })}
      />
      {/* 1. Cinematic Home: Hero + Showcases + Fleet + Rocket */}
      <BrabusHomeSignature locale={resolvedLocale} />
    </>
  );
}
