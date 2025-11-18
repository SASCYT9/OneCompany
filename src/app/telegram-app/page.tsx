import type { Metadata } from "next";
import Link from "next/link";
import { ArrowUpRight, MessageCircle, Phone, Send, Shield, Sparkles, Clock } from "lucide-react";

import TelegramUserGreeting from "@/components/telegram/TelegramUserGreeting";
import { readSiteContent } from "@/lib/siteContentServer";
import type { ContactChannel } from "@/types/site-content";

export const metadata: Metadata = {
  title: "OneCompany · Telegram Web App",
  description:
    "Миттєва Telegram-версія OneCompany: заявки, статуси та преміум-консьєрж для авто й мото клієнтів.",
  robots: {
    index: false,
  },
};

const conciergeSteps = [
  {
    label: "01",
    title: "Brief",
    body: "Опишіть авто / мото, бюджет і дедлайни. Ми відповідаємо українською, англійською та польською.",
  },
  {
    label: "02",
    title: "Spec",
    body: "Уточнюємо VIN, фіналізуємо список брендів і резервуємо складські позиції по всьому світу.",
  },
  {
    label: "03",
    title: "Logistics",
    body: "Тримаємо в курсі онлайн: митниця, монтаж, трек-сесії та відправка до вашого міста.",
  },
] as const;

const responseMetrics = [
  { label: "Середня відповідь", value: "≤15 хв", detail: "робочі години" },
  { label: "Марок у каталозі", value: "200+", detail: "auto · moto" },
  { label: "Активні build-и", value: "12", detail: "цього місяця" },
] as const;

export default async function TelegramAppPage() {
  const siteContent = await readSiteContent();
  const contact = siteContent.contactPage;
  const normalizedSiteUrl = (process.env.NEXT_PUBLIC_SITE_URL || "https://onecompany.com.ua").replace(/\/$/, "");
  const contactFormUrl = `${normalizedSiteUrl}/uk/contact`;

  const findChannel = (type: ContactChannel["type"]) =>
    contact.channels.find((channel) => channel.type === type);

  const telegramChannel = findChannel("telegram");
  const whatsappChannel = findChannel("whatsapp");
  const emailChannel = findChannel("email");

  const quickActions = [
    {
      title: "Telegram priority lane",
      description: telegramChannel?.note ?? "Пріоритетна відповідь",
      href: contact.messengerHandles.telegram,
      badge: "UA · EN",
      icon: Send,
      newTab: true,
    },
    {
      title: "WhatsApp concierge",
      description: whatsappChannel?.note ?? "Глобальні клієнти",
      href: contact.messengerHandles.whatsapp,
      badge: "Worldwide",
      icon: MessageCircle,
      newTab: true,
    },
    {
      title: "Call importer",
      description: contact.timezoneNote,
      href: `tel:${contact.messengerHandles.phone}`,
      badge: "Voice",
      icon: Phone,
      newTab: false,
    },
    {
      title: "Email importer",
      description: emailChannel?.note ?? "Відправте бриф",
      href: `mailto:${emailChannel?.value ?? "info@onecompany.global"}`,
      badge: "Detailed brief",
      icon: Sparkles,
      newTab: false,
    },
  ] as const;

  const successStories = contact.successStories.slice(0, 2);

  return (
    <main className="relative isolate min-h-screen overflow-hidden bg-[#04050a] pb-16 pt-10 text-white">
      <div className="pointer-events-none absolute inset-0 opacity-80">
        <div className="absolute -left-24 top-0 h-72 w-72 rounded-full bg-[radial-gradient(circle,_rgba(255,179,71,0.25),_transparent_65%)] blur-[140px]" />
        <div className="absolute right-0 top-40 h-64 w-64 rounded-full bg-[radial-gradient(circle,_rgba(92,188,255,0.25),_transparent_60%)] blur-[120px]" />
      </div>

      <div className="relative mx-auto flex w-full max-w-6xl flex-col gap-10 px-4 sm:px-6 lg:px-8">
        <section className="glass-panel gradient-border rounded-[38px] border border-white/10 p-6 sm:p-10">
          <p className="text-[11px] uppercase tracking-[0.55em] text-white/45">Telegram mini app · onecompany</p>
          <h1 className="mt-5 text-3xl font-semibold text-white sm:text-4xl lg:text-[44px]">
            Concierge importer прямо у Telegram
          </h1>
          <p className="mt-4 max-w-3xl text-base text-white/70 sm:text-lg">
            {contact.infoBody} {contact.slaPromise}
          </p>
          <TelegramUserGreeting className="mt-6" />

          <div className="mt-8 grid gap-4 sm:grid-cols-3">
            {responseMetrics.map((metric) => (
              <div
                key={metric.label}
                className="rounded-3xl border border-white/10 bg-white/5 px-5 py-4 backdrop-blur-xl"
              >
                <p className="text-sm uppercase tracking-[0.35em] text-white/40">{metric.label}</p>
                <p className="mt-2 text-3xl font-semibold text-white">{metric.value}</p>
                <p className="text-sm text-white/60">{metric.detail}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="glass-panel rounded-[32px] border border-white/10 p-6 sm:p-8">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-[11px] uppercase tracking-[0.5em] text-white/45">Швидкі дії</p>
                <h2 className="mt-3 text-2xl font-semibold">Месенджери & прямі контакти</h2>
              </div>
              <Clock className="h-10 w-10 text-white/40" />
            </div>
            <div className="mt-6 grid gap-4 md:grid-cols-2">
              {quickActions.map((action) => {
                const Icon = action.icon;
                return (
                  <a
                    key={action.title}
                    href={action.href}
                    target={action.newTab ? "_blank" : undefined}
                    rel={action.newTab ? "noreferrer" : undefined}
                    className="group flex flex-col justify-between rounded-[26px] border border-white/10 bg-white/5 px-5 py-6 transition hover:border-white/40"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] uppercase tracking-[0.45em] text-white/40">{action.badge}</span>
                      <Icon className="h-5 w-5 text-primary transition group-hover:text-white" />
                    </div>
                    <div className="mt-5">
                      <p className="text-lg font-semibold text-white">{action.title}</p>
                      <p className="mt-2 text-sm text-white/60">{action.description}</p>
                    </div>
                    <ArrowUpRight className="mt-6 h-5 w-5 text-white/30 transition group-hover:translate-x-1 group-hover:-translate-y-1 group-hover:text-white" />
                  </a>
                );
              })}
            </div>
          </div>

          <div className="glass-panel rounded-[32px] border border-white/10 p-6 sm:p-8">
            <p className="text-[11px] uppercase tracking-[0.5em] text-white/45">Процес</p>
            <h2 className="mt-3 text-2xl font-semibold">Як працює Telegram experience</h2>
            <div className="mt-6 space-y-6">
              {conciergeSteps.map((step) => (
                <div key={step.label} className="flex gap-4 rounded-3xl border border-white/10 bg-white/5 p-4">
                  <div className="text-sm font-semibold text-white/50">{step.label}</div>
                  <div>
                    <p className="text-lg font-semibold text-white">{step.title}</p>
                    <p className="text-sm text-white/60">{step.body}</p>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-6 rounded-3xl border border-white/10 bg-gradient-to-r from-white/10 to-transparent p-4">
              <p className="text-sm text-white/70">{contact.messengerTagline}</p>
              <div className="mt-3 flex items-center gap-2 text-xs uppercase tracking-[0.35em] text-white/40">
                <Shield className="h-4 w-4" />
                <span>Захищене зʼєднання 24/7</span>
              </div>
            </div>
          </div>
        </section>

        <section className="grid gap-6 lg:grid-cols-2">
          {successStories.map((story) => (
            <article
              key={story.id}
              className="glass-panel rounded-[32px] border border-white/10 p-6 sm:p-7"
            >
              <div className="flex items-center justify-between gap-4">
                <span className="text-[11px] uppercase tracking-[0.45em] text-white/45">{story.badge}</span>
                <div className="flex items-baseline gap-1 text-white">
                  <span className="text-3xl font-semibold">{story.metric}</span>
                  <span className="text-xs uppercase tracking-[0.4em] text-white/40">{story.metricLabel}</span>
                </div>
              </div>
              <h3 className="mt-4 text-2xl font-semibold">{story.title}</h3>
              <p className="mt-3 text-sm text-white/60">{story.summary}</p>
            </article>
          ))}
        </section>

        <section className="glass-panel rounded-[36px] border border-white/10 p-6 sm:p-8">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-[11px] uppercase tracking-[0.45em] text-white/45">Наступний крок</p>
              <h2 className="mt-3 text-3xl font-semibold text-white">Залишіть бриф або продовжіть у Telegram</h2>
              <p className="mt-3 text-sm text-white/60">
                Підготуйте VIN, список бажаних брендів та дедлайни. Ми зберемо пропозицію, оновлення статусу
                та доставку в один чат.
              </p>
              <div className="mt-4 flex flex-wrap gap-3 text-sm text-white/60">
                {contact.budgets.map((budget) => (
                  <span key={budget} className="rounded-full border border-white/15 px-4 py-2">
                    {budget}
                  </span>
                ))}
              </div>
            </div>
            <div className="flex flex-wrap gap-3">
              <Link
                href={"/"}
                className="rounded-full border border-white/20 px-6 py-3 text-sm uppercase tracking-[0.35em] text-white"
              >
                На головну
              </Link>
              <a
                href={contactFormUrl}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-2 rounded-full bg-white px-6 py-3 text-sm font-semibold uppercase tracking-[0.35em] text-black"
              >
                Веб форма
                <ArrowUpRight className="h-4 w-4" />
              </a>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
