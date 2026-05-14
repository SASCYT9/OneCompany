import { redirect } from "next/navigation";
import { resolveLocale } from "@/lib/seo";

// Cache-bust 2026-05-14T22: Vercel ISR cache held empty/errored renders for many brand routes — likely DB pool exhaustion during a build/revalidate window. Touching to rebuild.
type Props = {
  params: Promise<{ locale: string }>;
};

/**
 * /shop/racechip/products → redirect to /shop/racechip/catalog
 * RaceChip uses "catalog" for its catalog listing.
 */
export default async function RacechipProductsRedirect({ params }: Props) {
  const { locale } = await params;
  const resolvedLocale = resolveLocale(locale);
  redirect(`/${resolvedLocale}/shop/racechip/catalog`);
}
