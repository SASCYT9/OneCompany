import { buildPageMetadata, resolveLocale } from "@/lib/seo";
import { getForgedDesigns } from "@/lib/forged/catalog";
import ForgedHomeSignature from "../components/ForgedHomeSignature";

// Cache-bust 2026-05-14T22: Vercel ISR cache held empty/errored renders for many brand routes — likely DB pool exhaustion during a build/revalidate window. Touching to rebuild.
export const dynamic = "force-static";
export const revalidate = 3600;

type Props = {
  params: Promise<{ locale: string }>;
};

export async function generateMetadata({ params }: Props) {
  const { locale } = await params;
  const resolvedLocale = resolveLocale(locale);
  return buildPageMetadata(resolvedLocale, "shop/forged", {
    title:
      resolvedLocale === "ua"
        ? "One Company Forged — Ковані Диски На Замовлення"
        : "One Company Forged — Custom Forged Wheels",
    description:
      resolvedLocale === "ua"
        ? "Ковані диски One Company Forged на замовлення: будь-який дизайн, будь-який розмір, алюміній / магній / карбон. 3D-конфігуратор з примірянням на ваше авто."
        : "One Company Forged custom forged wheels: any design, any size, aluminium / magnesium / carbon. 3D configurator with on-car preview.",
  });
}

export default async function ShopForgedPage({ params }: Props) {
  const { locale } = await params;
  const resolvedLocale = resolveLocale(locale);
  const designs = getForgedDesigns();
  return <ForgedHomeSignature locale={resolvedLocale} designs={designs} />;
}
