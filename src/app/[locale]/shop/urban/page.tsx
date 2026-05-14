import { buildPageMetadata, resolveLocale } from "@/lib/seo";
import { JsonLd, generateBrandSchema } from "@/lib/jsonLd";
import UrbanHomeSignature from "../components/UrbanHomeSignature";

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
  return buildPageMetadata(resolvedLocale, "shop/urban", {
    title:
      resolvedLocale === "ua" ? "Urban Automotive | One Company" : "Urban Automotive | One Company",
    description:
      resolvedLocale === "ua"
        ? "Преміальні обвіси Urban Automotive. Виразний widebody-дизайн і вивірена стилістика OEM+."
        : "Premium Urban Automotive body kits. Distinctive widebody design with refined OEM+ presence.",
  });
}

export default async function ShopUrbanPage({ params }: Props) {
  const { locale } = await params;
  const resolvedLocale = resolveLocale(locale);

  const description =
    resolvedLocale === "ua"
      ? "Преміальні обвіси Urban Automotive. Виразний widebody-дизайн і вивірена стилістика OEM+."
      : "Premium Urban Automotive body kits. Distinctive widebody design with refined OEM+ presence.";

  return (
    <>
      <JsonLd
        schema={generateBrandSchema({
          locale: resolvedLocale,
          slug: "shop/urban",
          brandName: "Urban Automotive",
          description,
        })}
      />
      <UrbanHomeSignature locale={resolvedLocale} />
    </>
  );
}
