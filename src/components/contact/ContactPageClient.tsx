"use client";

import { useEffect, useMemo, useState } from "react";
import clsx from "clsx";
import { AnimatePresence, motion } from "framer-motion";
import {
  AlertCircle,
  CheckCircle,
  Clock,
  Loader,
  Mail,
  MapPin,
  MessageCircle,
  Phone,
  Send,
  Sparkles,
} from "lucide-react";
import { useTranslations } from "next-intl";
import type { SupportedLocale } from "@/lib/seo";
import type { ContactPageContent, ContactChannel } from "@/types/site-content";
import { trackEvent } from "@/lib/analytics";

const channelIcons: Record<ContactChannel["type"], typeof Mail> = {
  email: Mail,
  phone: Phone,
  telegram: Send,
  whatsapp: MessageCircle,
};

type FormType = "auto" | "moto";

type ContactPageClientProps = {
  locale: SupportedLocale;
  pageUrl: string;
  heroPoster: string;
  contactContent: ContactPageContent;
};

type FormState = {
  model: string;
  vin: string;
  wishes: string;
  budget: string;
  email: string;
  phone: string;
  contactMethod: "telegram" | "whatsapp";
};

const blankForm: FormState = {
  model: "",
  vin: "",
  wishes: "",
  budget: "",
  email: "",
  phone: "",
  contactMethod: "telegram",
};

const progressKeys: Array<keyof FormState> = ["model", "wishes", "email", "phone"];

function computeTimes(locale: SupportedLocale) {
  const now = new Date();
  const formatter = new Intl.DateTimeFormat(locale, {
    hour: "2-digit",
    minute: "2-digit",
  });
  const kyivFormatter = new Intl.DateTimeFormat(locale, {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Kiev",
  });
  return {
    user: formatter.format(now),
    kyiv: kyivFormatter.format(now),
  };
}

function normalizeChannelUrl(channel: ContactChannel) {
  if (channel.type === "telegram") {
    if (channel.value.startsWith("http")) return channel.value;
    const handle = channel.value.replace(/^@/, "");
    return `https://t.me/${handle}`;
  }
  if (channel.type === "whatsapp") {
    if (channel.value.startsWith("http")) return channel.value;
    const digits = channel.value.replace(/[^\d]/g, "");
    return `https://wa.me/${digits}`;
  }
  return channel.value;
}

export default function ContactPageClient({ locale, pageUrl, heroPoster, contactContent }: ContactPageClientProps) {
  const t = useTranslations("contactPage");
  const isUA = locale === "ua";
  const [type, setType] = useState<FormType>("auto");
  const [formData, setFormData] = useState<FormState>(blankForm);
  const [selectedChannelId, setSelectedChannelId] = useState<string>(contactContent.channels[0]?.id ?? "email");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [message, setMessage] = useState("");
  const [times, setTimes] = useState(() => computeTimes(locale));

  useEffect(() => {
    const interval = setInterval(() => setTimes(computeTimes(locale)), 60_000);
    return () => clearInterval(interval);
  }, [locale]);

  const completion = useMemo(() => {
    const filled = progressKeys.filter((key) => formData[key].trim().length > 0).length;
    return Math.round((filled / progressKeys.length) * 100);
  }, [formData]);

  const selectedChannel = contactContent.channels.find((channel) => channel.id === selectedChannelId) ?? contactContent.channels[0];

  const contactSchema = useMemo(() => {
    const contactPoints = contactContent.channels.map((channel) => {
      const base = {
        "@type": "ContactPoint",
        contactType: channel.label,
        areaServed: ["Worldwide"],
        availableLanguage: ["English", "Ukrainian"],
        hoursAvailable: contactContent.slaPromise,
      };
      if (channel.type === "email") {
        return { ...base, email: channel.value };
      }
      if (channel.type === "phone" || channel.type === "whatsapp") {
        return { ...base, telephone: channel.value };
      }
      return { ...base, url: normalizeChannelUrl(channel) };
    });

    return {
      "@context": "https://schema.org",
      "@type": "ContactPage",
      name: t("heroTitle"),
      description: t("heroSubtitle"),
      url: pageUrl,
      mainEntity: {
        "@type": "Organization",
        name: "onecompany",
        url: pageUrl,
        image: heroPoster,
        email: contactContent.channels.find((channel) => channel.type === "email")?.value ?? "info@onecompany.global",
        telephone: contactContent.messengerHandles.phone,
        address: {
          "@type": "PostalAddress",
          streetAddress: "21B Baseina St",
          addressLocality: "Kyiv",
          addressCountry: "UA",
        },
        areaServed: ["Europe", "North America", "Middle East", "Asia"],
      },
      contactPoint: contactPoints,
    };
  }, [contactContent, heroPoster, pageUrl, t]);

  const handleChange = (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = event.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleTypeChange = (newType: FormType) => {
    setType(newType);
    setFormData(blankForm);
    setStatus("idle");
    setMessage("");
  };

  const handleBudgetPreset = (preset: string) => {
    setFormData((prev) => ({ ...prev, budget: preset }));
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setStatus("loading");
    setMessage("");

    const payload = {
      type,
      ...(type === "auto" ? { carModel: formData.model } : { motoModel: formData.model }),
      vin: formData.vin,
      wishes: formData.wishes,
      budget: formData.budget,
      email: formData.email,
      phone: formData.phone,
      contactMethod: formData.contactMethod,
      preferredChannel: selectedChannel?.id,
    };

    try {
      const response = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = await response.json();

      if (response.ok) {
        setStatus("success");
        setMessage(t("successMessage"));
        setFormData(blankForm);
        trackEvent("contact_form_submit_success", {
          type,
          preferredChannel: selectedChannel?.id,
        });
      } else {
        setStatus("error");
        setMessage(result.error || t("genericError"));
        trackEvent("contact_form_submit_error", {
          type,
          error: result.error || "unknown",
          status: response.status,
        });
      }
    } catch (error) {
      setStatus("error");
      setMessage(t("networkError"));
      trackEvent("contact_form_submit_error", {
        type,
        error: error instanceof Error ? error.message : "network-error",
        status: "network-failure",
      });
    }
  };

  const modelLabel = type === "auto" ? t("modelAutoLabel") : t("modelMotoLabel");
  const modelPlaceholder = type === "auto" ? t("modelAutoPlaceholder") : t("modelMotoPlaceholder");
  const heroTitleClass = clsx(
    "mt-6 font-extralight tracking-tight text-white leading-[1.05]",
    isUA ? "text-4xl md:text-6xl lg:text-7xl" : "text-5xl md:text-7xl lg:text-8xl"
  );
  const sectionTitleClass = clsx(
    "font-light text-white leading-tight",
    isUA ? "text-[2rem] md:text-[2.75rem]" : "text-[2.5rem] md:text-[3rem]",
    isUA && "tracking-[0.08em]"
  );
  const leadParagraphClass = clsx(
    "text-white/70",
    isUA ? "text-base md:text-lg" : "text-lg md:text-xl"
  );

  return (
    <div data-locale={locale} className="relative min-h-screen bg-gradient-to-b from-black via-[#050505] to-[#020202] text-white">
      <script
        type="application/ld+json"
        suppressHydrationWarning
        dangerouslySetInnerHTML={{ __html: JSON.stringify(contactSchema) }}
      />
      <section className="relative overflow-hidden">
        <div className="absolute inset-0">
          <div
            className="h-full w-full bg-cover bg-center"
            style={{ backgroundImage: `url(${heroPoster})` }}
          />
          <div className="absolute inset-0 bg-gradient-to-b from-black/80 via-black/70 to-[#050505]" />
        </div>
        <div className="relative mx-auto max-w-5xl px-6 py-28 text-center">
          <p className="text-[11px] uppercase tracking-[0.5em] text-white/60">{contactContent.heroBadge}</p>
          <h1 className={heroTitleClass}>{t("heroTitle")}</h1>
          <div className="mx-auto mt-6 h-px w-24 bg-white/20" />
          <p className={clsx("mx-auto mt-6 max-w-3xl font-light", leadParagraphClass)}>{t("heroSubtitle")}</p>
        </div>
      </section>

      <section className="relative px-6 py-20">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(255,255,255,0.08),_transparent_55%)] opacity-70" />
        <div className="relative mx-auto grid max-w-7xl gap-16 lg:grid-cols-[1.1fr_1fr]">
          <motion.div initial={{ opacity: 0, x: -30 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.8 }} className="space-y-10">
            <div>
              <p className="uppercase text-[11px] tracking-[0.45em] text-white/40">{contactContent.heroBadge}</p>
              <h2 className={clsx("mt-4", sectionTitleClass)}>{t("infoTitle")}</h2>
              <p className={clsx("mt-6 leading-relaxed text-white/70", isUA ? "text-sm" : "text-base")}>{contactContent.infoBody}</p>
            </div>

            <div className="space-y-4">
              {contactContent.channels.map((channel) => {
                const Icon = channelIcons[channel.type] ?? Sparkles;
                return (
                  <div key={channel.id} className="flex items-start gap-4 rounded-2xl border border-white/10 bg-white/5 p-4">
                    <div className="rounded-2xl border border-white/20 bg-black/40 p-3">
                      <Icon className="h-5 w-5 text-white" />
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-[0.45em] text-white/40">{channel.label}</p>
                      <p className="mt-1 text-lg font-light">{channel.value}</p>
                      <p className="text-sm text-white/50">{channel.note}</p>
                    </div>
                  </div>
                );
              })}
              <div className="flex items-center gap-4 rounded-2xl border border-white/10 bg-white/5 p-4">
                <div className="rounded-2xl border border-white/20 bg-black/40 p-3">
                  <MapPin className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-xs uppercase tracking-[0.45em] text-white/40">{t("locationLabel")}</p>
                  <p className="text-lg font-light">{t("locationValue")}</p>
                  <p className="text-sm text-white/50">{contactContent.timezoneNote}</p>
                </div>
              </div>
            </div>

            <div className="grid gap-4 rounded-3xl border border-white/10 bg-gradient-to-br from-white/5 via-black/40 to-black/80 p-6">
              <div className="flex items-center gap-3 text-white/70">
                <Clock className="h-5 w-5" />
                <p className="text-sm uppercase tracking-[0.4em]">SLA</p>
              </div>
              <p className="text-base font-light text-white">{contactContent.slaPromise}</p>
              <div className="flex flex-wrap gap-6 text-sm text-white/70">
                <div>
                  <p className="text-xs uppercase tracking-[0.35em] text-white/40">Kyiv</p>
                  <p className="text-lg text-white">{times.kyiv}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-[0.35em] text-white/40">{locale === "ua" ? "Ваш час" : "Your time"}</p>
                  <p className="text-lg text-white">{times.user}</p>
                </div>
              </div>
            </div>

            <div className="space-y-4 rounded-3xl border border-white/10 bg-white/5 p-6">
              <p className="text-xs uppercase tracking-[0.45em] text-white/50">{contactContent.messengerTagline}</p>
              <div className="flex flex-wrap gap-4">
                <a href={contactContent.messengerHandles.telegram} target="_blank" className="inline-flex items-center gap-2 rounded-full border border-white/20 px-5 py-2 text-sm uppercase tracking-[0.35em] text-white transition hover:bg-white hover:text-black" rel="noreferrer">
                  Telegram ↗
                </a>
                <a href={contactContent.messengerHandles.whatsapp} target="_blank" className="inline-flex items-center gap-2 rounded-full border border-white/20 px-5 py-2 text-sm uppercase tracking-[0.35em] text-white transition hover:bg-white hover:text-black" rel="noreferrer">
                  WhatsApp ↗
                </a>
                <a href={`tel:${contactContent.messengerHandles.phone}`} className="inline-flex items-center gap-2 rounded-full border border-white/20 px-5 py-2 text-sm uppercase tracking-[0.35em] text-white transition hover:bg-white hover:text-black">
                  Call • {contactContent.messengerHandles.phone}
                </a>
              </div>
            </div>
          </motion.div>

          <motion.div initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.8 }}>
            <form onSubmit={handleSubmit} className="space-y-8 rounded-[32px] border border-white/10 bg-black/60 p-8 shadow-[0_40px_120px_rgba(0,0,0,0.6)]">
              <div>
                <div className="flex items-center justify-between text-xs uppercase tracking-[0.4em] text-white/40">
                  <span>{completion}%</span>
                  <span>{status === "loading" ? t("submittingCta") : t("submitCta")}</span>
                </div>
                <div className="mt-3 h-1 overflow-hidden rounded-full bg-white/10">
                  <div className="h-full bg-white transition-all duration-500" style={{ width: `${completion}%` }} />
                </div>
              </div>

              <div className="flex gap-4">
                {(["auto", "moto"] as const).map((item) => (
                  <button
                    key={item}
                    type="button"
                    onClick={() => handleTypeChange(item)}
                    className={clsx(
                      "flex-1 rounded-full border px-6 py-3 text-sm uppercase tracking-[0.4em] transition",
                      type === item
                        ? "border-white bg-white text-black shadow-[0_10px_40px_rgba(255,255,255,0.2)]"
                        : "border-white/20 bg-white/5 text-white/60 hover:border-white/40 hover:text-white"
                    )}
                  >
                    {item === "auto" ? t("typeAuto") : t("typeMoto")}
                  </button>
                ))}
              </div>

              <div className="grid gap-6">
                <div>
                  <label className="text-xs uppercase tracking-[0.4em] text-white/40">{modelLabel}</label>
                  <input
                    type="text"
                    id="model"
                    name="model"
                    value={formData.model}
                    onChange={handleChange}
                    placeholder={modelPlaceholder}
                    required
                    className="mt-3 w-full border-b border-white/20 bg-transparent pb-2 text-lg font-light outline-none transition focus:border-white"
                  />
                </div>
                <div className="grid gap-6 md:grid-cols-2">
                  <div>
                    <label className="text-xs uppercase tracking-[0.4em] text-white/40">
                      {t("vinLabel")} <span className="text-white/30">{t("optionalSuffix")}</span>
                    </label>
                    <input
                      type="text"
                      id="vin"
                      name="vin"
                      value={formData.vin}
                      onChange={handleChange}
                      placeholder={t("vinPlaceholder")}
                      className="mt-3 w-full border-b border-white/20 bg-transparent pb-2 text-base font-light outline-none transition focus:border-white"
                    />
                  </div>
                  <div>
                    <label className="text-xs uppercase tracking-[0.4em] text-white/40">{t("emailFieldLabel")}</label>
                    <input
                      type="email"
                      id="email"
                      name="email"
                      value={formData.email}
                      onChange={handleChange}
                      placeholder={t("emailPlaceholder")}
                      required
                      className="mt-3 w-full border-b border-white/20 bg-transparent pb-2 text-base font-light outline-none transition focus:border-white"
                    />
                  </div>
                </div>
                <div className="grid gap-6 md:grid-cols-2">
                  <div>
                    <label className="text-xs uppercase tracking-[0.4em] text-white/40">Phone Number</label>
                    <input
                      type="tel"
                      id="phone"
                      name="phone"
                      value={formData.phone}
                      onChange={handleChange}
                      placeholder="+380 XX XXX XX XX"
                      required
                      className="mt-3 w-full border-b border-white/20 bg-transparent pb-2 text-base font-light outline-none transition focus:border-white"
                    />
                  </div>
                  <div>
                    <label className="text-xs uppercase tracking-[0.4em] text-white/40">Preferred Contact</label>
                    <div className="mt-3 flex gap-3">
                      <button
                        type="button"
                        onClick={() => setFormData(prev => ({ ...prev, contactMethod: "telegram" }))}
                        className={clsx(
                          "flex-1 rounded-full border px-4 py-2 text-sm transition",
                          formData.contactMethod === "telegram"
                            ? "border-white bg-white text-black"
                            : "border-white/20 bg-white/5 text-white/60 hover:border-white/40"
                        )}
                      >
                        Telegram
                      </button>
                      <button
                        type="button"
                        onClick={() => setFormData(prev => ({ ...prev, contactMethod: "whatsapp" }))}
                        className={clsx(
                          "flex-1 rounded-full border px-4 py-2 text-sm transition",
                          formData.contactMethod === "whatsapp"
                            ? "border-white bg-white text-black"
                            : "border-white/20 bg-white/5 text-white/60 hover:border-white/40"
                        )}
                      >
                        WhatsApp
                      </button>
                    </div>
                  </div>
                </div>
                <div>
                  <label className="text-xs uppercase tracking-[0.4em] text-white/40">{t("wishesLabel")}</label>
                  <textarea
                    id="wishes"
                    name="wishes"
                    rows={4}
                    value={formData.wishes}
                    onChange={handleChange}
                    placeholder={t("wishesPlaceholder")}
                    required
                    className="mt-3 w-full border-b border-white/20 bg-transparent pb-2 text-base font-light outline-none transition focus:border-white"
                  />
                </div>
                <div>
                  <label className="text-xs uppercase tracking-[0.4em] text-white/40">
                    {t("budgetLabel")} <span className="text-white/30">{t("optionalSuffix")}</span>
                  </label>
                  <input
                    type="text"
                    id="budget"
                    name="budget"
                    value={formData.budget}
                    onChange={handleChange}
                    placeholder={t("budgetPlaceholder")}
                    className="mt-3 w-full border-b border-white/20 bg-transparent pb-2 text-base font-light outline-none transition focus:border-white"
                  />
                  <div className="mt-4 flex flex-wrap gap-3">
                    {contactContent.budgets.map((preset) => (
                      <button
                        key={preset}
                        type="button"
                        onClick={() => handleBudgetPreset(preset)}
                        className="rounded-full border border-white/20 px-4 py-2 text-xs uppercase tracking-[0.35em] text-white/70 transition hover:border-white hover:text-white"
                      >
                        {preset}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div>
                <p className="text-xs uppercase tracking-[0.4em] text-white/40">Preferred channel</p>
                <div className="mt-4 grid gap-4 md:grid-cols-2">
                  {contactContent.channels.map((channel) => {
                    const Icon = channelIcons[channel.type] ?? Sparkles;
                    const isActive = selectedChannelId === channel.id;
                    return (
                      <button
                        type="button"
                        key={channel.id}
                        onClick={() => setSelectedChannelId(channel.id)}
                        className={clsx(
                          "flex items-center gap-3 rounded-2xl border px-4 py-3 text-left transition",
                          isActive
                            ? "border-white bg-white/10 text-white"
                            : "border-white/10 bg-white/0 text-white/60 hover:border-white/20 hover:bg-white/5"
                        )}
                      >
                        <Icon className="h-5 w-5" />
                        <div>
                          <p className="text-sm font-light">{channel.label}</p>
                          <p className="text-xs text-white/50">{channel.note}</p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              <motion.button
                type="submit"
                disabled={status === "loading"}
                whileHover={{ scale: status === "loading" ? 1 : 1.02 }}
                whileTap={{ scale: status === "loading" ? 1 : 0.98 }}
                className="w-full rounded-full bg-white px-10 py-4 text-sm uppercase tracking-[0.4em] text-black transition hover:bg-white/90 disabled:opacity-50"
              >
                {status === "loading" ? (
                  <span className="flex items-center justify-center gap-3">
                    <Loader className="h-4 w-4 animate-spin" />
                    {t("submittingCta")}
                  </span>
                ) : (
                  t("submitCta")
                )}
              </motion.button>

              <AnimatePresence>
                {message && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className={clsx(
                      "rounded-2xl border px-4 py-3 text-sm",
                      status === "success"
                        ? "border-green-400/30 bg-green-500/10 text-green-200"
                        : "border-red-400/30 bg-red-500/10 text-red-200"
                    )}
                  >
                    <div className="flex items-center gap-2">
                      {status === "success" ? <CheckCircle className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
                      <span>{message}</span>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </form>
          </motion.div>
        </div>
      </section>

      <section className="relative px-6 pb-24">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-48 bg-gradient-to-b from-white/10/10 via-transparent to-transparent" />
        <div className="relative mx-auto max-w-6xl">
          <div className="flex flex-col gap-4 text-center md:flex-row md:items-end md:justify-between md:text-left">
            <div>
              <p className="text-xs uppercase tracking-[0.4em] text-white/40">Case studies</p>
              <h3 className={clsx("mt-3", sectionTitleClass)}>Lead-to-delivery приклади</h3>
            </div>
            <p className="text-sm text-white/60">{contactContent.slaPromise}</p>
          </div>
          <div className="mt-10 grid gap-6 md:grid-cols-3">
            {contactContent.successStories.map((story) => (
              <div key={story.id} className="rounded-3xl border border-white/10 bg-gradient-to-b from-white/10 via-black/40 to-black/80 p-6">
                <p className="text-xs uppercase tracking-[0.5em] text-white/50">{story.badge}</p>
                <h4 className="mt-3 text-2xl font-light text-white">{story.title}</h4>
                <p className="mt-3 text-sm text-white/70">{story.summary}</p>
                <div className="mt-6 flex items-baseline gap-3 text-white">
                  <span className="text-4xl font-light">{story.metric}</span>
                  <span className="text-xs uppercase tracking-[0.4em] text-white/50">{story.metricLabel}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
