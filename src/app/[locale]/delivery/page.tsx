import type { Metadata } from "next";
import { resolveLocale, buildPageMetadata, type SupportedLocale } from "@/lib/seo";

export const dynamic = "force-static";

const metaCopy: Record<SupportedLocale, { title: string; description: string }> = {
  en: { title: "Delivery & Payment · onecompany", description: "Information about delivery options and payment methods." },
  ua: { title: "Доставка та оплата · onecompany", description: "Інформація про варіанти доставки та способи оплати." },
};

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const l = resolveLocale(locale);
  const meta = metaCopy[l];
  return buildPageMetadata(l, "delivery", meta);
}

export default async function DeliveryPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const l = resolveLocale(locale);

  return (
    <div className="mx-auto max-w-4xl px-4 pt-32 pb-16 text-white sm:px-6 lg:px-8">
      <div className="prose prose-invert max-w-none">
        <h1 className="text-3xl font-light sm:text-4xl text-balance mb-8">
          {l === "ua" ? "Доставка та оплата" : "Delivery & Payment"}
        </h1>

        <div className="space-y-8 text-white/80 font-light">
          {/* Payment Section */}
          <section>
            <h2 className="text-xl font-normal text-white mb-4 mt-8">
              {l === "ua" ? "1. Оплата" : "1. Payment"}
            </h2>
            <p className="text-lg leading-relaxed">
              {l === "ua"
                ? "Ми пропонуємо кілька варіантів оплати для вашої зручності:"
                : "We offer several payment options for your convenience:"}
            </p>
            <ul className="list-disc pl-5 mt-4 space-y-2">
              <li>
                <strong className="text-white">{l === "ua" ? "Оплата картою онлайн:" : "Online Payment via Card:"}</strong>{" "}
                {l === "ua"
                  ? "Ми приймаємо платежі через захищену платіжну систему онлайн. Оплата можлива картами Visa та Mastercard. Передача даних здійснюється через захищене з'єднання."
                  : "We accept payments through a secure online payment system. We support Visa and Mastercard. Data transmission is handled via secure connection."}
              </li>
              <li>
                <strong className="text-white">{l === "ua" ? "Банківський переказ:" : "Bank Transfer:"}</strong>{" "}
                {l === "ua"
                  ? "Можлива оплата безготівковим розрахунком згідно з виставленим інвойсом для B2B партнерів."
                  : "Bank transfers can be made for B2B partners based on an issued invoice."}
              </li>
            </ul>
            <p className="mt-4">
              {l === "ua"
                ? "Всі ціни вказані та оплачуються у національній валюті (Гривня, UAH) відповідно до чинного законодавства."
                : "All prices are listed and paid in the national currency (Ukrainian Hryvnia, UAH) in accordance with applicable laws."}
            </p>
          </section>

          {/* Delivery Section */}
          <section>
            <h2 className="text-xl font-normal text-white mb-4 mt-8">
              {l === "ua" ? "2. Доставка" : "2. Delivery"}
            </h2>
            <p>
              {l === "ua"
                ? "Ми забезпечуємо швидку та надійну доставку через партнерських перевізників:"
                : "We ensure fast and reliable delivery through our logistics partners:"}
            </p>
            <ul className="list-disc pl-5 mt-4 space-y-3">
              <li>
                <strong className="text-white">{l === "ua" ? "Нова Пошта (по Україні):" : "Nova Poshta (within Ukraine):"}</strong>{" "}
                {l === "ua"
                  ? "Доставка на відділення, у поштомати або кур'єром за вказаною адресою. Терміни та вартість доставки — згідно з тарифами перевізника."
                  : "Delivery to branches, parcel lockers, or by courier to a specified address. Timelines and shipping costs are according to the carrier's rates."}
              </li>
              <li>
                <strong className="text-white">{l === "ua" ? "DHL Express (міжнародна доставка):" : "DHL Express (international delivery):"}</strong>{" "}
                {l === "ua"
                  ? "Міжнародна експрес-доставка в будь-яку точку світу. Терміни та вартість — згідно з тарифами перевізника та залежать від країни призначення."
                  : "International express delivery anywhere in the world. Timelines and costs are according to the carrier's rates and depend on the destination country."}
              </li>
            </ul>
            <p className="mt-4">
              {l === "ua"
                ? "Після відправлення замовлення ви отримаєте трек-номер (ТТН) для відстеження посилки."
                : "After your order is shipped, you will receive a tracking number (TTN) to track your package."}
            </p>
          </section>

          {/* Restrictions Section */}
          <section>
            <h2 className="text-xl font-normal text-white mb-4 mt-8">
              {l === "ua" ? "3. Обмеження" : "3. Restrictions"}
            </h2>
            <p>
              {l === "ua"
                ? "Ми не продаємо товари і не надаємо послуги жителям росії та білорусі. Замовлення з цих територій не обробляються та не відправляються."
                : "We do not sell goods or provide services to residents of Russia and Belarus. Orders from these territories will not be processed or shipped."}
            </p>
          </section>

          {/* Company Requisites Section */}
          <section>
            <h2 className="text-xl font-normal text-white mb-4 mt-8">
              {l === "ua" ? "4. Реквізити" : "4. Company Details"}
            </h2>
            <div className="not-prose border-l-2 border-white/20 pl-4 space-y-1">
              <p className="text-white font-medium">
                {l === "ua" ? "ФОП Побережець Іван Юрійович" : "PE Poberezhets Ivan Yuriiovych"}
              </p>
              <p>{l === "ua" ? "ЄДРПОУ: 3803206192" : "Registration No: 3803206192"}</p>
              <p className="mt-2">
                {l === "ua" ? "вул. Басейна, 21Б" : "21B Baseina St"}
              </p>
              <p>{l === "ua" ? "Київ, 01024, Україна" : "Kyiv, 01024, Ukraine"}</p>
              <p className="mt-2">Email: info@onecompany.global</p>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
