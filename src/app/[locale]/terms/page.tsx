import type { Metadata } from "next";
import { resolveLocale, buildPageMetadata, type SupportedLocale } from "@/lib/seo";

export const dynamic = "force-static";

const metaCopy: Record<SupportedLocale, { title: string; description: string }> = {
  en: { title: "Terms of Service · onecompany", description: "Terms governing the use of our services and site." },
  ua: { title: "Умови надання послуг · onecompany", description: "Умови користування нашим сайтом та послугами." },
};

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const l = resolveLocale(locale);
  const meta = metaCopy[l];
  return buildPageMetadata(l, "terms", meta);
}

export default async function TermsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const l = resolveLocale(locale);

  return (
    <div className="mx-auto max-w-4xl px-4 pt-32 pb-16 text-white sm:px-6 lg:px-8">
      <div className="prose prose-invert max-w-none">
        <h1 className="text-3xl font-light sm:text-4xl text-balance mb-8">
          {l === "ua" ? "Умови надання послуг" : "Terms of Service"}
        </h1>

        <div className="space-y-8 text-white/80 font-light">
          <section>
            <p className="text-lg leading-relaxed">
              {l === "ua"
                ? "Ласкаво просимо до OneCompany. Ці Умови надання послуг («Умови») регулюють використання вами нашого веб-сайту та послуг B2B дистрибуції. Отримуючи доступ до нашого Сайту або використовуючи його, ви погоджуєтесь дотримуватися цих Умов."
                : "Welcome to OneCompany. These Terms of Service (\"Terms\") govern your use of our website and B2B distribution services. By accessing or using our Site, you agree to be bound by these Terms."}
            </p>
          </section>

          <section>
            <h2 className="text-xl font-normal text-white mb-4 mt-8">
              {l === "ua" ? "1. Послуги" : "1. Services"}
            </h2>
            <p>
              {l === "ua"
                ? "OneCompany є B2B дистриб'ютором та імпортером автомобільних та мотоциклетних запчастин преміум-класу. Ми надаємо послуги постачання, логістики та технічної підтримки для СТО, тюнінг-ательє та магазинів."
                : "OneCompany is a B2B distributor and importer of premium automotive and motorcycle performance parts. We provide sourcing, logistics, and technical support services for workshops, tuning studios, and retailers."}
            </p>
          </section>

          <section>
            <h2 className="text-xl font-normal text-white mb-4 mt-8">
              {l === "ua" ? "2. Замовлення та оплата" : "2. Orders and Payment"}
            </h2>
            <ul className="list-disc pl-5 mt-4 space-y-2">
              <li>
                <strong className="text-white">{l === "ua" ? "Розміщення замовлень:" : "Order Placement:"}</strong> {l === "ua" ? "Замовлення приймаються через наших менеджерів або офіційні канали зв'язку. Всі замовлення підлягають підтвердженню наявності та ціни." : "Orders are accepted through our account managers or official communication channels. All orders are subject to availability and price confirmation."}
              </li>
              <li>
                <strong className="text-white">{l === "ua" ? "Ціноутворення:" : "Pricing:"}</strong> {l === "ua" ? "Ціни вказані в доларах США або Євро, якщо не зазначено інше. Ми залишаємо за собою право змінювати ціни без попереднього повідомлення у разі зміни курсів валют або цін виробників." : "Prices are quoted in USD or EUR unless otherwise stated. We reserve the right to change prices without notice due to currency fluctuations or manufacturer price changes."}
              </li>
              <li>
                <strong className="text-white">{l === "ua" ? "Умови оплати:" : "Payment Terms:"}</strong> {l === "ua" ? "Оплата здійснюється згідно з виставленим інвойсом. Для спеціальних замовлень може вимагатися передоплата." : "Payment is due as per the issued invoice. Prepayment may be required for special orders."}
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-normal text-white mb-4 mt-8">
              {l === "ua" ? "3. Доставка та логістика" : "3. Shipping and Logistics"}
            </h2>
            <p>
              {l === "ua"
                ? "Ми організовуємо доставку товарів до узгодженого місця призначення. Терміни доставки є орієнтовними і можуть залежати від митних процедур та логістичних партнерів. Ризик втрати або пошкодження товару переходить до покупця в момент передачі товару перевізнику, якщо інше не узгоджено письмово."
                : "We arrange for the shipment of goods to the agreed destination. Delivery times are estimates and may be subject to customs procedures and logistics partners. Risk of loss or damage passes to the buyer upon delivery to the carrier, unless otherwise agreed in writing."}
            </p>
          </section>

          <section>
            <h2 className="text-xl font-normal text-white mb-4 mt-8">
              {l === "ua" ? "4. Гарантія та повернення" : "4. Warranty and Returns"}
            </h2>
            <p>
              {l === "ua"
                ? "Ми транслюємо гарантійні умови виробників. Повернення товарів можливе лише за попереднім узгодженням та у випадку виробничого браку. Товари, виготовлені під індивідуальне замовлення (custom orders), поверненню не підлягають."
                : "We pass through the manufacturer's warranty terms. Returns are only accepted with prior approval and in cases of manufacturing defects. Custom-made or special order items are non-returnable."}
            </p>
          </section>

          <section>
            <h2 className="text-xl font-normal text-white mb-4 mt-8">
              {l === "ua" ? "5. Інтелектуальна власність" : "5. Intellectual Property"}
            </h2>
            <p>
              {l === "ua"
                ? "Весь контент на цьому Сайті, включаючи текст, графіку, логотипи та зображення, є власністю OneCompany або наших партнерів-брендів і захищений законами про авторське право."
                : "All content on this Site, including text, graphics, logos, and images, is the property of OneCompany or our brand partners and is protected by copyright laws."}
            </p>
          </section>

          <section>
            <h2 className="text-xl font-normal text-white mb-4 mt-8">
              {l === "ua" ? "6. Обмеження відповідальності" : "6. Limitation of Liability"}
            </h2>
            <p>
              {l === "ua"
                ? "OneCompany не несе відповідальності за будь-які непрямі, випадкові або побічні збитки, що виникають у зв'язку з використанням наших послуг або товарів, включаючи втрату прибутку або даних."
                : "OneCompany shall not be liable for any indirect, incidental, or consequential damages arising out of or in connection with the use of our services or products, including loss of profits or data."}
            </p>
          </section>

          <section>
            <h2 className="text-xl font-normal text-white mb-4 mt-8">
              {l === "ua" ? "7. Зміни до Умов" : "7. Changes to Terms"}
            </h2>
            <p>
              {l === "ua"
                ? "Ми залишаємо за собою право змінювати ці Умови в будь-який час. Оновлені умови набирають чинності з моменту їх публікації на Сайті."
                : "We reserve the right to modify these Terms at any time. Updated terms are effective immediately upon posting on the Site."}
            </p>
          </section>

          <section>
            <h2 className="text-xl font-normal text-white mb-4 mt-8">
              {l === "ua" ? "8. Контакти" : "8. Contact Us"}
            </h2>
            <div className="mt-4 not-prose border-l-2 border-white/20 pl-4">
              <p className="text-white font-medium">OneCompany</p>
              <p>{l === "ua" ? "вул. Басейна, 21Б" : "21B Baseina St"}</p>
              <p>{l === "ua" ? "Київ, 01004, Україна" : "Kyiv, 01004, Ukraine"}</p>
              <p className="mt-2">Email: info@onecompany.global</p>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
