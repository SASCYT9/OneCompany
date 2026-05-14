import { buildPageMetadata, resolveLocale } from "@/lib/seo";
import Link from "next/link";
import { getCsfProductsServer, projectShopProductForListGrid } from "@/lib/shopCatalogServer";
import { Suspense } from "react";
import CSFCatalogGrid from "../../components/CSFCatalogGrid";

type Props = {
  params: Promise<{ locale: string }>;
};

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const resolvedLocale = resolveLocale(locale);
  return buildPageMetadata(resolvedLocale, "shop/csf/collections", {
    title:
      resolvedLocale === "ua"
        ? "Каталог CSF Racing | One Company"
        : "CSF Racing Catalog | One Company",
    description:
      resolvedLocale === "ua"
        ? "Повний каталог радіаторів, інтеркулерів та систем охолодження CSF Racing."
        : "Full catalog of CSF Racing radiators, intercoolers, and cooling systems.",
  });
}

export default async function CSFCollectionsPage({ params }: Props) {
  const { locale } = await params;
  const resolvedLocale = resolveLocale(locale);
  const isUa = resolvedLocale === "ua";

  const csfProducts = (await getCsfProductsServer()).map(projectShopProductForListGrid);

  return (
    <div className="relative min-h-screen bg-background text-foreground">
      {/* Ambient background — dark only */}
      <div className="fixed inset-0 z-0 pointer-events-none hidden dark:block">
        <div className="absolute top-0 left-1/3 w-[900px] h-[500px] bg-[rgba(200,16,46,0.03)] blur-[200px] rounded-full" />
        <div className="absolute bottom-1/4 right-1/4 w-[600px] h-[400px] bg-[rgba(20,20,40,0.12)] blur-[180px] rounded-full" />
      </div>

      <div className="relative z-10 pt-[100px]">
        {/* Back */}
        <div className="w-full max-w-[1700px] mx-auto px-6 md:px-12 lg:px-16 pb-4 pt-2">
          <Link
            href={`/${resolvedLocale}/shop/csf`}
            className="text-[10px] uppercase tracking-[0.2em] text-white/40 hover:text-white transition-colors font-semibold"
          >
            ← {isUa ? "CSF Racing" : "CSF Racing"}
          </Link>
        </div>

        <Suspense
          fallback={
            <div className="flex justify-center items-center min-h-[50vh]">
              <div className="w-8 h-8 rounded-full border-4 border-[#c8102e] border-t-transparent animate-spin" />
            </div>
          }
        >
          <CSFCatalogGrid locale={resolvedLocale} products={csfProducts} />
        </Suspense>
      </div>
    </div>
  );
}
