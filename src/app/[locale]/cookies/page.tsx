import type { Metadata } from "next";
import { resolveLocale, buildPageMetadata, type SupportedLocale } from "@/lib/seo";

export const dynamic = "force-static";

const metaCopy: Record<SupportedLocale, { title: string; description: string }> = {
  en: { title: "Cookies Policy · onecompany", description: "Information about how we use cookies." },
  ua: { title: "Політика Cookies · onecompany", description: "Інформація про використання файлів cookie." },
};

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const l = resolveLocale(locale);
  const meta = metaCopy[l];
  return buildPageMetadata(l, "cookies", meta);
}

export default async function CookiesPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const l = resolveLocale(locale);

  return (
    <div className="mx-auto max-w-4xl px-4 pt-32 pb-16 text-white sm:px-6 lg:px-8">
      <div className="prose prose-invert max-w-none">
        <h1 className="text-3xl font-light sm:text-4xl text-balance mb-8">
          {l === "ua" ? "Політика використання файлів Cookie" : "Cookies Policy"}
        </h1>

        <div className="space-y-8 text-white/80 font-light">
          <section>
            <p className="text-lg leading-relaxed">
              {l === "ua"
                ? "Ця Політика використання файлів Cookie пояснює, що таке файли cookie, як ми їх використовуємо, типи файлів cookie, які ми можемо використовувати, та як ви можете керувати налаштуваннями cookie."
                : "This Cookies Policy explains what cookies are, how we use them, the types of cookies we may use, and how you can manage your cookie settings."}
            </p>
          </section>

          <section>
            <h2 className="text-xl font-normal text-white mb-4 mt-8">
              {l === "ua" ? "1. Що таке файли cookie?" : "1. What are cookies?"}
            </h2>
            <p>
              {l === "ua"
                ? "Файли cookie — це невеликі текстові файли, які веб-сайт зберігає на вашому комп'ютері або мобільному пристрої, коли ви відвідуєте сайт. Вони дозволяють сайту запам'ятовувати ваші дії та налаштування (наприклад, логін, мову, розмір шрифту) протягом певного часу."
                : "Cookies are small text files that a website stores on your computer or mobile device when you visit the site. They allow the website to remember your actions and preferences (such as login, language, font size) over a period of time."}
            </p>
          </section>

          <section>
            <h2 className="text-xl font-normal text-white mb-4 mt-8">
              {l === "ua" ? "2. Як ми використовуємо cookie?" : "2. How do we use cookies?"}
            </h2>
            <p>
              {l === "ua"
                ? "Ми використовуємо файли cookie для:"
                : "We use cookies to:"}
            </p>
            <ul className="list-disc pl-5 mt-4 space-y-2">
              <li>{l === "ua" ? "Забезпечення коректної роботи веб-сайту (технічні cookie)." : "Ensure the website functions correctly (technical cookies)."}</li>
              <li>{l === "ua" ? "Збереження ваших налаштувань та вподобань (функціональні cookie)." : "Save your settings and preferences (functional cookies)."}</li>
              <li>{l === "ua" ? "Аналізу відвідуваності сайту для покращення користувацького досвіду (аналітичні cookie)." : "Analyze site traffic to improve user experience (analytical cookies)."}</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-normal text-white mb-4 mt-8">
              {l === "ua" ? "3. Типи файлів cookie" : "3. Types of cookies"}
            </h2>
            <div className="space-y-4">
              <div>
                <strong className="text-white block mb-1">{l === "ua" ? "Необхідні (Essential):" : "Essential:"}</strong>
                <p>{l === "ua" ? "Ці файли cookie є обов'язковими для роботи сайту і не можуть бути вимкнені в наших системах." : "These cookies are necessary for the website to function and cannot be switched off in our systems."}</p>
              </div>
              <div>
                <strong className="text-white block mb-1">{l === "ua" ? "Аналітичні (Analytics):" : "Analytics:"}</strong>
                <p>{l === "ua" ? "Дозволяють нам підраховувати відвідування та джерела трафіку, щоб ми могли вимірювати та покращувати продуктивність нашого сайту." : "Allow us to count visits and traffic sources so we can measure and improve the performance of our site."}</p>
              </div>
            </div>
          </section>

          <section>
            <h2 className="text-xl font-normal text-white mb-4 mt-8">
              {l === "ua" ? "4. Управління файлами cookie" : "4. Managing cookies"}
            </h2>
            <p>
              {l === "ua"
                ? "Ви можете контролювати та/або видаляти файли cookie за бажанням. Ви можете видалити всі файли cookie, які вже є на вашому комп'ютері, і ви можете налаштувати більшість браузерів так, щоб вони не дозволяли їх розміщення. Однак, якщо ви це зробите, вам, можливо, доведеться вручну налаштовувати деякі параметри кожного разу, коли ви відвідуєте сайт."
                : "You can control and/or delete cookies as you wish. You can delete all cookies that are already on your computer and you can set most browsers to prevent them from being placed. If you do this, however, you may have to manually adjust some preferences every time you visit a site."}
            </p>
          </section>

          <section>
            <h2 className="text-xl font-normal text-white mb-4 mt-8">
              {l === "ua" ? "5. Контакти" : "5. Contact Us"}
            </h2>
            <div className="mt-4 not-prose border-l-2 border-white/20 pl-4">
              <p className="text-white font-medium">OneCompany</p>
              <p className="mt-2">Email: support@onecompany.global</p>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
