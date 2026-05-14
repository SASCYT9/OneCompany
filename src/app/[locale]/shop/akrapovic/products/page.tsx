import { redirect } from "next/navigation";
import { resolveLocale } from "@/lib/seo";

// Cache-bust 2026-05-14T22: Vercel ISR cache held empty/errored renders for many brand routes — likely DB pool exhaustion during a build/revalidate window. Touching to rebuild.
type Props = {
  params: Promise<{ locale: string }>;
};

/**
 * /shop/akrapovic/products → redirect to /shop/akrapovic/collections
 * Akrapovic uses "collections" for its catalog listing.
 * This catch-all prevents 404 when users navigate to /products directly.
 */
export default async function AkrapovicProductsRedirect({ params }: Props) {
  const { locale } = await params;
  const resolvedLocale = resolveLocale(locale);
  redirect(`/${resolvedLocale}/shop/akrapovic/collections`);
}
