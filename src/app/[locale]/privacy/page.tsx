import type { Metadata } from "next";
import { resolveLocale, buildPageMetadata, type SupportedLocale } from "@/lib/seo";

export const dynamic = "force-static";

const metaCopy: Record<SupportedLocale, { title: string; description: string }> = {
  en: { title: "Privacy Policy · onecompany", description: "Our commitment to your privacy and data protection." },
  ua: { title: "Політика конфіденційності · onecompany", description: "Наша політика конфіденційності та захисту даних." },
};

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const l = resolveLocale(locale);
  const meta = metaCopy[l];
  return buildPageMetadata(l, "privacy", meta);
}

export default async function PrivacyPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const l = resolveLocale(locale);

  return (
    <div className="mx-auto max-w-4xl px-4 pt-32 pb-16 text-white sm:px-6 lg:px-8">
      <div className="prose prose-invert max-w-none">
        <h1 className="text-3xl font-light sm:text-4xl text-balance mb-8">
          {l === "ua" ? "Політика конфіденційності" : "Privacy Policy"}
        </h1>
        
        <div className="space-y-8 text-white/80 font-light">
          <section>
            <p className="text-lg leading-relaxed">
              {l === "ua" 
                ? "One Company («ми», «нас» або «наш») зобов'язується захищати вашу конфіденційність. Ця Політика конфіденційності пояснює, як ми збираємо, використовуємо, розкриваємо та захищаємо вашу інформацію, коли ви відвідуєте наш веб-сайт, користуєтесь нашими послугами B2B дистрибуції або взаємодієте з нами."
                : "One Company (\"we\", \"us\", or \"our\") is committed to protecting your privacy. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you visit our website, use our B2B distribution services, or interact with us."}
            </p>
          </section>

          <section>
            <h2 className="text-xl font-normal text-white mb-4 mt-8">
              {l === "ua" ? "1. Збір інформації" : "1. Information Collection"}
            </h2>
            <p>
              {l === "ua"
                ? "Ми можемо збирати інформацію про вас різними способами. Інформація, яку ми можемо збирати на Сайті, включає:"
                : "We may collect information about you in a variety of ways. The information we may collect on the Site includes:"}
            </p>
            <ul className="list-disc pl-5 mt-4 space-y-2">
              <li>
                <strong className="text-white">{l === "ua" ? "Особисті дані:" : "Personal Data:"}</strong> {l === "ua" ? "Ім'я, адреса електронної пошти, номер телефону та назва компанії, які ви добровільно надаєте нам при реєстрації або заповненні форм." : "Name, email address, phone number, and company name that you voluntarily give to us when you register or fill out forms."}
              </li>
              <li>
                <strong className="text-white">{l === "ua" ? "Ділові дані:" : "Business Data:"}</strong> {l === "ua" ? "Інформація про ваш бізнес, податковий номер, адреси доставки та платіжні реквізити для обробки замовлень." : "Information about your business, tax ID, shipping addresses, and payment details for processing orders."}
              </li>
              <li>
                <strong className="text-white">{l === "ua" ? "Технічні дані:" : "Technical Data:"}</strong> {l === "ua" ? "IP-адреса, тип браузера, операційна система, час доступу та переглянуті сторінки." : "IP address, browser type, operating system, access times, and the pages you have viewed."}
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-normal text-white mb-4 mt-8">
              {l === "ua" ? "2. Використання інформації" : "2. Use of Information"}
            </h2>
            <p>
              {l === "ua"
                ? "Наявність точної інформації про вас дозволяє нам надавати вам безперебійний, ефективний та персоналізований досвід. Зокрема, ми можемо використовувати інформацію, зібрану про вас, для:"
                : "Having accurate information about you permits us to provide you with a smooth, efficient, and customized experience. Specifically, we may use information collected about you via the Site to:"}
            </p>
            <ul className="list-disc pl-5 mt-4 space-y-2">
              <li>{l === "ua" ? "Обробки та виконання B2B замовлень та логістичних операцій." : "Process and fulfill B2B orders and logistics operations."}</li>
              <li>{l === "ua" ? "Надсилання вам підтверджень замовлень, інвойсів та оновлень статусу доставки." : "Send you order confirmations, invoices, and shipping status updates."}</li>
              <li>{l === "ua" ? "Надання технічної підтримки та консультацій щодо продуктів." : "Provide technical support and product consultation."}</li>
              <li>{l === "ua" ? "Повідомлення про оновлення асортименту, спеціальні пропозиції та новини індустрії." : "Notify you of inventory updates, special offers, and industry news."}</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-normal text-white mb-4 mt-8">
              {l === "ua" ? "3. Розкриття інформації" : "3. Disclosure of Information"}
            </h2>
            <p>
              {l === "ua"
                ? "Ми можемо ділитися інформацією, яку ми зібрали про вас, у певних ситуаціях. Ваша інформація може бути розкрита:"
                : "We may share information we have collected about you in certain situations. Your information may be disclosed as follows:"}
            </p>
            <ul className="list-disc pl-5 mt-4 space-y-2">
              <li>
                <strong className="text-white">{l === "ua" ? "Постачальникам послуг:" : "Service Providers:"}</strong> {l === "ua" ? "Ми можемо ділитися вашою інформацією зі сторонніми постачальниками, які надають послуги нам або від нашого імені, включаючи обробку платежів, аналіз даних, доставку електронної пошти, хостинг, обслуговування клієнтів та логістику." : "We may share your information with third-party vendors who perform services for us or on our behalf, including payment processing, data analysis, email delivery, hosting services, customer service, and logistics."}
              </li>
              <li>
                <strong className="text-white">{l === "ua" ? "За вимогами закону:" : "By Law or to Protect Rights:"}</strong> {l === "ua" ? "Якщо ми вважаємо, що розкриття інформації про вас є необхідним для реагування на судовий процес, розслідування або усунення потенційних порушень нашої політики, або для захисту прав, власності та безпеки інших осіб." : "If we believe the release of information about you is necessary to respond to legal process, to investigate or remedy potential violations of our policies, or to protect the rights, property, and safety of others."}
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-normal text-white mb-4 mt-8">
              {l === "ua" ? "4. Безпека даних" : "4. Data Security"}
            </h2>
            <p>
              {l === "ua"
                ? "Ми використовуємо адміністративні, технічні та фізичні заходи безпеки для захисту вашої особистої інформації. Хоча ми вжили розумних заходів для захисту особистої інформації, яку ви нам надаєте, пам'ятайте, що жодні заходи безпеки не є досконалими або непроникними, і жоден метод передачі даних не може бути гарантований від будь-якого перехоплення або іншого типу зловживання."
                : "We use administrative, technical, and physical security measures to help protect your personal information. While we have taken reasonable steps to secure the personal information you provide to us, please be aware that despite our efforts, no security measures are perfect or impenetrable, and no method of data transmission can be guaranteed against any interception or other type of misuse."}
            </p>
          </section>

          <section>
            <h2 className="text-xl font-normal text-white mb-4 mt-8">
              {l === "ua" ? "5. Контакти" : "5. Contact Us"}
            </h2>
            <p>
              {l === "ua"
                ? "Якщо у вас є запитання або коментарі щодо цієї Політики конфіденційності, будь ласка, зв'яжіться з нами:"
                : "If you have questions or comments about this Privacy Policy, please contact us at:"}
            </p>
            <div className="mt-4 not-prose border-l-2 border-white/20 pl-4">
              <p className="text-white font-medium">One Company</p>
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
