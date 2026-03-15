import Image from "next/image";
import { SHOP_PRODUCTS, type ShopProduct } from "@/lib/shopCatalog";
import { getBrandLogo } from "@/lib/brandLogos";

const featuredBrands = [
  "Akrapovic",
  "KW Suspension",
  "Eventuri",
  "FI Exhaust",
  "Brembo",
  "HRE wheels",
  "Termignoni",
  "Ohlins",
  "SC-Project",
  "Rizoma",
  "Rotobox",
  "Jetprime",
];

function shopHeader() {
  return (
    <header
      data-layer-name="Header Layer"
      className="rounded-2xl border border-white/20 bg-black/45 px-4 py-3 shadow-[0_10px_30px_rgba(0,0,0,0.35)]"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="rounded-lg border border-white/25 bg-white/10 px-3 py-2 text-[10px] uppercase tracking-[0.24em] text-white">
            One Company Global
          </div>
          <p className="text-[11px] uppercase tracking-[0.3em] text-white/70">Premium Shop</p>
        </div>
        <nav className="flex items-center gap-2.5">
          <span className="rounded-full border border-white/25 px-3 py-1 text-[10px] uppercase tracking-[0.2em] text-white/80">
            Brands
          </span>
          <span className="rounded-full border border-white/25 px-3 py-1 text-[10px] uppercase tracking-[0.2em] text-white/80">
            Catalog
          </span>
          <span className="rounded-full border border-white bg-white px-3 py-1 text-[10px] uppercase tracking-[0.2em] text-black">
            Shop
          </span>
          <span className="rounded-full border border-emerald-300/55 bg-emerald-400/20 px-3 py-1 text-[10px] uppercase tracking-[0.2em] text-emerald-100">
            Live
          </span>
        </nav>
      </div>
    </header>
  );
}

function shopFooter() {
  return (
    <footer
      data-layer-name="Footer Layer"
      className="rounded-2xl border border-white/20 bg-black/45 px-4 py-4 shadow-[0_10px_30px_rgba(0,0,0,0.35)]"
    >
      <div className="flex flex-wrap items-center justify-between gap-4">
        <p className="text-xs text-white/70">© 2026 One Company · Premium Automotive & Motorsport Store</p>
        <div className="flex flex-wrap gap-2">
          <span className="rounded-full border border-white/25 px-3 py-1 text-[10px] uppercase tracking-[0.2em] text-white/70">
            Privacy
          </span>
          <span className="rounded-full border border-white/25 px-3 py-1 text-[10px] uppercase tracking-[0.2em] text-white/70">
            Terms
          </span>
          <span className="rounded-full border border-white/25 px-3 py-1 text-[10px] uppercase tracking-[0.2em] text-white/70">
            Contact
          </span>
        </div>
      </div>
    </footer>
  );
}

function productCard(product: ShopProduct, compact: boolean) {
  return (
    <article key={product.slug} className="overflow-hidden rounded-3xl border border-white/15 bg-black/35">
      <div className={`relative overflow-hidden ${compact ? "aspect-[4/5]" : "aspect-[4/5]"}`}>
        <Image
          src={product.image}
          alt={product.title.ua}
          fill
          sizes={compact ? "(max-width: 1280px) 100vw, 50vw" : "(max-width: 1280px) 100vw, 33vw"}
          className="object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-black/20 to-black/80" />
        <div className="absolute left-4 right-4 top-4 flex items-start justify-between gap-2">
          <div className="rounded-full border border-white/25 bg-black/55 px-3 py-1 text-[10px] uppercase tracking-[0.2em] text-white/80">
            {product.category.ua}
          </div>
          <div
            className={`rounded-full border px-3 py-1 text-[10px] uppercase tracking-[0.2em] ${
              product.stock === "inStock"
                ? "border-emerald-300/45 bg-emerald-400/20 text-emerald-100"
                : "border-amber-300/45 bg-amber-400/20 text-amber-100"
            }`}
          >
            {product.stock === "inStock" ? "В наявності" : "Під замовлення"}
          </div>
        </div>
        <div className="absolute inset-x-4 bottom-4 rounded-2xl border border-white/20 bg-black/65 p-3 backdrop-blur">
          <p className="text-[10px] uppercase tracking-[0.22em] text-white/60">Ціна від</p>
          <p className="mt-1 text-2xl font-light text-white">{product.price.eur.toLocaleString("uk-UA")} EUR</p>
        </div>
      </div>
      <div className="space-y-3 p-4">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-white/20 bg-white/[0.05] p-1">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={getBrandLogo(product.brand)} alt={product.brand} className="h-full w-full object-contain" />
          </div>
          <p className="text-xs uppercase tracking-[0.18em] text-white/60">{product.brand}</p>
        </div>
        <h3 className="text-lg font-light leading-snug text-white">{product.title.ua}</h3>
        <p className="text-sm leading-relaxed text-white/70">{product.shortDescription.ua}</p>
        <p className="text-xs uppercase tracking-[0.2em] text-white/50">Детальніше →</p>
      </div>
    </article>
  );
}

function variantThreeFrame({ mobile = false }: { mobile?: boolean }) {
  const products = mobile ? SHOP_PRODUCTS.slice(0, 4) : SHOP_PRODUCTS.slice(0, 8);

  return (
    <section
      className={`overflow-hidden rounded-[30px] border border-white/20 bg-gradient-to-b from-zinc-900 via-zinc-950 to-black ${
        mobile ? "w-[390px]" : "w-[1280px]"
      }`}
    >
      <div className={`mx-auto flex flex-col gap-6 px-4 py-5 ${mobile ? "max-w-[390px]" : "max-w-[1200px] px-6 py-8"}`}>
        <div data-layer-name={mobile ? "Mobile Header Layer" : "Desktop Header Layer"}>{shopHeader()}</div>

        <div data-layer-name={mobile ? "Mobile Hero Layer" : "Desktop Hero Layer"} className="rounded-[28px] border border-white/15 bg-white/[0.03] p-6">
          <p className="text-[11px] uppercase tracking-[0.34em] text-white/45">one company shop</p>
          <h2 className={`mt-3 font-light leading-[1.06] text-white ${mobile ? "text-3xl" : "text-5xl"}`}>
            One Company Shop - офіційний магазин преміальних авто- та мото-брендів
          </h2>
          <p className="mt-4 max-w-2xl text-sm text-white/70">
            Обирайте бренд, переходьте до категорії та відкривайте товар із великим фото, актуальною ціною й детальним описом у стилі Shopify.
          </p>
          <div className="mt-5 flex gap-2">
            <span className="rounded-full border border-white bg-white px-4 py-1.5 text-xs uppercase tracking-[0.22em] text-black">
              Усе
            </span>
            <span className="rounded-full border border-white/25 bg-black/30 px-4 py-1.5 text-xs uppercase tracking-[0.22em] text-white/75">
              Авто
            </span>
            <span className="rounded-full border border-white/25 bg-black/30 px-4 py-1.5 text-xs uppercase tracking-[0.22em] text-white/75">
              Мото
            </span>
          </div>
        </div>

        <section data-layer-name={mobile ? "Mobile Brands Layer" : "Desktop Brands Layer"} className="space-y-4">
          <div>
            <p className="text-[11px] uppercase tracking-[0.34em] text-white/45">Крок 1</p>
            <h3 className="mt-2 text-3xl font-light text-white">Вибір бренду</h3>
          </div>

          <div className={`grid gap-3 ${mobile ? "grid-cols-1" : "grid-cols-2"}`}>
            {featuredBrands.map((brandName) => {
              const heroImage = SHOP_PRODUCTS.find((product) => product.brand === brandName)?.image ?? "/images/hero.jpg";
              const count = SHOP_PRODUCTS.filter((product) => product.brand === brandName).length;

              return (
                <article key={brandName} className="group relative overflow-hidden rounded-2xl border border-white/15 bg-white/[0.03]">
                  <div className="absolute inset-0">
                    <Image
                      src={heroImage}
                      alt={brandName}
                      fill
                      sizes="(max-width: 1280px) 50vw, 25vw"
                      className="object-cover opacity-20"
                    />
                    <div className="absolute inset-0 bg-gradient-to-b from-black/45 via-black/70 to-black/90" />
                  </div>

                  <div className="relative p-4">
                    <p className="mb-3 inline-flex rounded-full border border-white/20 bg-black/40 px-3 py-1 text-[10px] uppercase tracking-[0.22em]">
                      {count} товари
                    </p>
                    <div className="mb-3 flex h-12 items-center justify-center rounded-lg border border-white/30 bg-white px-3">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={getBrandLogo(brandName)} alt={brandName} className="h-8 w-full object-contain" />
                    </div>
                    <p className="text-sm text-white">{brandName}</p>
                  </div>
                </article>
              );
            })}
          </div>
        </section>

        <section data-layer-name={mobile ? "Mobile Products Layer" : "Desktop Products Layer"} className="space-y-4">
          <div className="flex items-end justify-between">
            <div>
              <p className="text-[11px] uppercase tracking-[0.34em] text-white/45">Крок 3</p>
              <h3 className="mt-2 text-3xl font-light text-white">Товари каталогу</h3>
            </div>
            <p className="rounded-full border border-white/20 px-3 py-1 text-[11px] uppercase tracking-[0.22em] text-white/70">
              {products.length} результатів
            </p>
          </div>

          <div className={`grid gap-4 ${mobile ? "grid-cols-1" : "grid-cols-2"}`}>
            {products.map((product) => productCard(product, mobile))}
          </div>
        </section>

        <div data-layer-name={mobile ? "Mobile Footer Layer" : "Desktop Footer Layer"}>{shopFooter()}</div>
      </div>
    </section>
  );
}

export default function FigmaShopPage() {
  return (
    <main className="min-h-screen bg-[#131418] p-8 text-white">
      <section className="mx-auto flex w-fit flex-col gap-10">
        <div>
          <p className="mb-3 text-xs uppercase tracking-[0.24em] text-white/50">Desktop Version</p>
          {variantThreeFrame({ mobile: false })}
        </div>
        <div>
          <p className="mb-3 text-xs uppercase tracking-[0.24em] text-white/50">Mobile Version</p>
          {variantThreeFrame({ mobile: true })}
        </div>
      </section>
    </main>
  );
}
