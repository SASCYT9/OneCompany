import { buildPageMetadata, resolveLocale } from "@/lib/seo";
import ConfiguratorShell from "@/components/forged/ConfiguratorShell";

// Cache-bust 2026-05-14T22: Vercel ISR cache held empty/errored renders for many brand routes — likely DB pool exhaustion during a build/revalidate window. Touching to rebuild.
export const dynamic = "force-static";
export const revalidate = 3600;

type Props = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ design?: string }>;
};

export async function generateMetadata({ params }: Props) {
  const { locale } = await params;
  const resolvedLocale = resolveLocale(locale);
  return buildPageMetadata(resolvedLocale, "shop/forged/configurator", {
    title:
      resolvedLocale === "ua"
        ? "Конфігуратор — One Company Forged"
        : "Configurator — One Company Forged",
    description:
      resolvedLocale === "ua"
        ? "Інтерактивний конфігуратор кованих дисків One Company Forged: оберіть дизайн, розмір, матеріал, фініш — і подивіться, як виглядає на вашому авто."
        : "Interactive One Company Forged configurator: pick design, size, material, finish — and see it rendered on your car.",
  });
}

export default async function ShopForgedConfiguratorPage({ params, searchParams }: Props) {
  const [{ locale }, sp] = await Promise.all([params, searchParams]);
  const resolvedLocale = resolveLocale(locale);
  return <ConfiguratorShell locale={resolvedLocale} initialDesignSlug={sp.design} />;
}
