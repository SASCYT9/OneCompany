import { redirect } from "next/navigation";
import { resolveLocale } from "@/lib/seo";

type Props = {
  params: Promise<{ locale: string }>;
};

/**
 * /shop/ilmberger/products → redirect to /shop/ilmberger/collections.
 * Ilmberger uses "collections" for its catalog listing.
 * Prevents 404 when users navigate to /products directly.
 */
export default async function IlmbergerProductsRedirect({ params }: Props) {
  const { locale } = await params;
  const resolvedLocale = resolveLocale(locale);
  redirect(`/${resolvedLocale}/shop/ilmberger/collections`);
}
