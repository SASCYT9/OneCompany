import Link from "next/link";
import { buildPageMetadata, resolveLocale } from "@/lib/seo";
import { LEGAL_VERSION_TAG } from "@/lib/forged/configSchema";

// Cache-bust 2026-05-14T22: Vercel ISR cache held empty/errored renders for many brand routes — likely DB pool exhaustion during a build/revalidate window. Touching to rebuild.
export const dynamic = "force-static";
export const revalidate = 86400;

type Props = {
  params: Promise<{ locale: string }>;
};

export async function generateMetadata({ params }: Props) {
  const { locale } = await params;
  const resolvedLocale = resolveLocale(locale);
  return buildPageMetadata(resolvedLocale, "shop/forged/legal", {
    title:
      resolvedLocale === "ua"
        ? "Правила та політика реплік — One Company Forged"
        : "Legal & replica policy — One Company Forged",
    description:
      resolvedLocale === "ua"
        ? "Юридичне розкриття щодо репродукованих дизайнів кованих дисків One Company Forged."
        : "Legal disclosure regarding reproduction-style forged-wheel designs at One Company Forged.",
  });
}

export default async function ShopForgedLegalPage({ params }: Props) {
  const { locale } = await params;
  const resolvedLocale = resolveLocale(locale);
  const isUa = resolvedLocale === "ua";

  return (
    <div className="bg-background text-foreground">
      <div className="px-6 pt-6 md:px-12 md:pt-10">
        <Link
          href={`/${resolvedLocale}/shop/forged`}
          className="text-xs uppercase tracking-[0.2em] text-white/50 transition hover:text-white"
        >
          ← {isUa ? "Forged home" : "Forged home"}
        </Link>
      </div>

      <article className="mx-auto max-w-3xl px-6 py-20 md:px-12 md:py-32">
        <p className="mb-4 text-xs uppercase tracking-[0.32em] text-[#c48e4c]">
          {isUa ? "Правила" : "Legal"}
        </p>
        <h1 className="text-balance text-4xl font-light leading-[1.1] tracking-tight md:text-5xl">
          {isUa ? "Правила та політика реплік" : "Legal & replica policy"}
        </h1>

        <div className="prose prose-invert mt-12 max-w-none space-y-6 text-base leading-relaxed text-white/75">
          {isUa ? <UaCopy /> : <EnCopy />}

          <hr className="my-10 border-white/10" />
          <p className="text-xs text-white/40">
            {isUa ? "Версія документа" : "Document version"}: {LEGAL_VERSION_TAG}
          </p>
        </div>
      </article>
    </div>
  );
}

function UaCopy() {
  return (
    <>
      <h2 className="text-xl text-white">Хто ми</h2>
      <p>
        One Company Forged — це власне виробництво кованих дисків компанії OneCompany (Україна,
        Київ). Ми проектуємо, куємо та опрацьовуємо диски з алюмінієвого і магнієвого сплавів, а
        також карбоно-композитних матеріалів, виключно під замовлення.
      </p>

      <h2 className="text-xl text-white">Що означає &quot;дизайн-репродукція&quot;</h2>
      <p>
        Частина дизайнів у нашому каталозі є оригінальними розробками інженерної команди OneCompany
        Forged. Інша частина — це репродукції силуетів, які стали візуальною класикою світового
        тюнінгу. Ми чесно називаємо ці дизайни нашими власними іменами, не вказуючи бренд-прообраз.
      </p>

      <h2 className="text-xl text-white">Це не контрафакт</h2>
      <p>
        На всіх виготовлених нами дисках присутній виключно логотип One Company Forged. Ми не
        використовуємо логотипи, слогани, назви моделей чи інші товарні знаки інших виробників. Ми
        не продаємо нашу продукцію як продукцію цих виробників і нічим не вводимо клієнта в оману
        щодо виробника, матеріалу чи походження виробу.
      </p>

      <h2 className="text-xl text-white">Що замовляє клієнт</h2>
      <p>
        Замовляючи комплект кованих дисків One Company Forged, клієнт отримує: кастомно виготовлені
        під його авто диски, виготовлені на нашому виробництві, з нашим логотипом, з повним пакетом
        документів про походження виробу та матеріалу. Це повністю кастомний продукт, виготовлений
        за замовленням, а не серійна репліка масового бренду.
      </p>

      <h2 className="text-xl text-white">Підтвердження клієнта</h2>
      <p>
        Перед відправкою запиту на прорахунок клієнт явно підтверджує: (а) розуміння того, що
        замовляє кастомний виріб з логотипом One Company Forged; (б) розуміння того, що обраний
        дизайн може бути візуально натхненний існуючим силуетом, але не є оригінальним продуктом
        іншого бренду; (в) що це не порушує його прав чи прав третіх осіб у його юрисдикції.
      </p>
      <p>
        Підтвердження зберігається разом із замовленням (із позначкою часу та хешованим IP) для
        аудиту.
      </p>

      <h2 className="text-xl text-white">Відповідальність та повернення</h2>
      <p>
        Ми гарантуємо якість матеріалу, дотримання геометрії і фінішу за специфікацією, що була
        затверджена в прорахунку. Кастомно виготовлені вироби не підлягають поверненню згідно з
        нормами законодавства, окрім випадків виробничого браку.
      </p>

      <p>Інші запитання — info@onecompany.global або в Telegram @onecompany_global.</p>
    </>
  );
}

function EnCopy() {
  return (
    <>
      <h2 className="text-xl text-white">Who we are</h2>
      <p>
        One Company Forged is the in-house forged-wheel manufacturing arm of OneCompany (Kyiv,
        Ukraine). We design, forge and finish wheel sets from aluminium and magnesium alloys as well
        as carbon composite materials, made strictly to order.
      </p>

      <h2 className="text-xl text-white">What &quot;reproduction-style design&quot; means</h2>
      <p>
        Some designs in our catalog are original work by the OneCompany Forged engineering team.
        Others are reproductions of silhouettes that have become visual classics of global tuning
        culture. We name those designs by our own model names; we do not cite the brand they are
        inspired by.
      </p>

      <h2 className="text-xl text-white">This is not counterfeit</h2>
      <p>
        Every wheel we produce carries the One Company Forged logo only. We do not use the logos,
        names, model designations or other trademarks of any other manufacturer. We do not sell our
        product as theirs and do not mislead the customer about the manufacturer, the material or
        the provenance of the goods.
      </p>

      <h2 className="text-xl text-white">What the customer is ordering</h2>
      <p>
        Ordering a One Company Forged set means: a custom-made wheel set built specifically for your
        vehicle, manufactured at our facility, branded with our logo, accompanied by full
        documentation on origin and material. This is a fully bespoke product, not a mass-market
        replica.
      </p>

      <h2 className="text-xl text-white">Customer acknowledgement</h2>
      <p>
        Before submitting a quote request the customer explicitly confirms: (a) they understand they
        are ordering a custom item carrying the One Company Forged logo; (b) they understand the
        chosen design may be visually inspired by an existing silhouette but is not an original
        product of another brand; (c) that this does not infringe on their rights or third-party
        rights in their jurisdiction.
      </p>
      <p>
        The acknowledgement is stored together with the order (with timestamp and a hashed IP) for
        audit.
      </p>

      <h2 className="text-xl text-white">Liability & returns</h2>
      <p>
        We warrant material quality, dimensional accuracy and finish quality against the
        specification approved in the quote. Custom-made goods are not subject to return under
        applicable consumer-protection law except in cases of manufacturing defect.
      </p>

      <p>Other questions — info@onecompany.global or Telegram @onecompany_global.</p>
    </>
  );
}
