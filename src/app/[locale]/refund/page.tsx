import type { Metadata } from "next";
import { resolveLocale, buildPageMetadata, type SupportedLocale } from "@/lib/seo";

export const dynamic = "force-static";

const metaCopy: Record<SupportedLocale, { title: string; description: string }> = {
  en: { title: "Refund Policy · onecompany", description: "Our refund and returns policy." },
  ua: {
    title: "Повернення коштів · onecompany",
    description: "Політика повернення коштів та обміну товарів.",
  },
};

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const l = resolveLocale(locale);
  const meta = metaCopy[l];
  return buildPageMetadata(l, "refund", meta);
}

export default async function RefundPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const l = resolveLocale(locale);

  return (
    <div className="mx-auto max-w-4xl px-4 pt-32 pb-16 text-foreground sm:px-6 lg:px-8">
      <div className="prose prose-invert max-w-none">
        <h1 className="text-3xl font-light sm:text-4xl text-balance mb-8">
          {l === "ua" ? "Повернення коштів" : "Refund Policy"}
        </h1>

        <div className="space-y-8 text-foreground/95 dark:text-foreground/80 font-light">
          <section>
            <p className="text-lg leading-relaxed">
              {l === "ua"
                ? "Умови повернення та обміну регулюються Законом України «Про захист прав споживачів»."
                : "Refunds and exchanges are governed by the Consumer Rights Protection Law of Ukraine."}
            </p>
          </section>

          <section>
            <h2 className="text-xl font-normal text-foreground mb-4 mt-8">
              {l === "ua"
                ? "1. Право на повернення товарів належної якості"
                : "1. Right to Return Good Quality Items"}
            </h2>
            <p>
              {l === "ua"
                ? "Споживач має право обміняти непродовольчий товар належної якості на аналогічний, якщо товар не задовольнив його за формою, габаритами, фасоном, кольором, розміром або з інших причин не може бути ним використаний за призначенням. Обмін можливий протягом 14 днів, не рахуючи дня купівлі. Повернення можливе, якщо:"
                : "Consumers have the right to exchange non-food items of good quality for similar ones if the requested item did not satisfy their needs in form, dimensions, style, color, size, or for other reasons it cannot be used. Exchange is possible within 14 days, excluding the day of purchase. Return is possible if:"}
            </p>
            <ul className="list-disc pl-5 mt-4 space-y-2">
              <li>{l === "ua" ? "Товар не використовувався." : "The item has not been used."}</li>
              <li>
                {l === "ua"
                  ? "Збережено товарний вигляд, споживчі властивості, пломби, ярлики."
                  : "Original condition, consumer properties, seals, and tags are preserved."}
              </li>
              <li>
                {l === "ua"
                  ? "Є розрахунковий документ (чек, квитанція)."
                  : "A receipt or proof of purchase is present."}
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-normal text-foreground mb-4 mt-8">
              {l === "ua" ? "2. Товари під замовлення (Custom Orders)" : "2. Custom Orders"}
            </h2>
            <p>
              {l === "ua"
                ? "Товари, які були виготовлені під індивідуальне замовлення, або імпортовані спеціально під вимоги замовника (наприклад, індивідуальні параметри дисків або кастомні елементи інтер'єру), не підлягають поверненню."
                : "Products manufactured as custom orders or specifically imported for a customer's unique specifications (e.g. custom wheel offsets, custom interior elements) are non-refundable."}
            </p>
          </section>

          <section>
            <h2 className="text-xl font-normal text-foreground mb-4 mt-8">
              {l === "ua" ? "3. Процедура повернення коштів" : "3. Refund Procedure"}
            </h2>
            <ul className="list-disc pl-5 mt-4 space-y-2">
              <li>
                {l === "ua"
                  ? "Для ініціалізації повернення необхідно звернутися до нашої служби підтримки за контактами, вказаними на Сайті."
                  : "To initiate a return, please contact our support team using the contacts listed on the Site."}
              </li>
              <li>
                {l === "ua"
                  ? "Кошти повертаються в той самий спосіб, яким була здійснена оплата, протягом 7 банківських днів після схвалення запиту."
                  : "Refunds are processed to the original payment method within 7 banking days after approval."}
              </li>
            </ul>
          </section>
        </div>
      </div>
    </div>
  );
}
