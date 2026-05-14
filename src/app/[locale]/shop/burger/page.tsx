import { buildPageMetadata, resolveLocale } from "@/lib/seo";
import BurgerStoreHome from "../components/BurgerStoreHome";

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
  return buildPageMetadata(resolvedLocale, "shop/burger", {
    title:
      resolvedLocale === "ua"
        ? "Burger Motorsports | JB4 Performance Tuning | One Company"
        : "Burger Motorsports | JB4 Performance Tuning | One Company",
    description:
      resolvedLocale === "ua"
        ? "Чіпи збільшення потужності JB4, flex fuel кіти, впускні системи та performance-деталі для BMW, Mercedes, Porsche та 30+ марок."
        : "JB4 power chips, flex fuel kits, intake systems, and performance parts for BMW, Mercedes, Porsche, and 30+ brands.",
  });
}

export default async function ShopBurgerPage({ params }: Props) {
  const { locale } = await params;
  const resolvedLocale = resolveLocale(locale);

  return <BurgerStoreHome locale={resolvedLocale} />;
}
