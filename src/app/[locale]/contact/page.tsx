
"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { CheckCircle, AlertCircle, Loader, Mail, Phone, MapPin } from "lucide-react";
import { useTranslations, useLocale } from "next-intl";
import { getTypography, resolveLocale } from "@/lib/typography";

type FormType = "auto" | "moto";
type FormState = "idle" | "loading" | "success" | "error";

export default function ContactPage() {
  const t = useTranslations("contactPage");
  const locale = useLocale();
  const typography = getTypography(resolveLocale(locale));
  const [type, setType] = useState<FormType>("auto");
  const [formData, setFormData] = useState({
    model: "",
    vin: "",
    wishes: "",
    budget: "",
    email: "",
    phone: "",
    telegramUsername: "",
    contactMethod: "telegram" as "telegram" | "whatsapp",
  });
  const [status, setStatus] = useState<FormState>("idle");
  const [message, setMessage] = useState("");

  // Progress (percentage of required fields filled)
  // telegramUsername is optional, so it's not in requiredKeys unless we want to force it
  const requiredKeys: (keyof typeof formData)[] = ["model", "wishes", "email", "phone"];
  const completion = Math.round(
    (requiredKeys.filter(k => (formData[k] as string).trim().length > 0).length / requiredKeys.length) * 100
  );

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const formatPhoneMask = (value: string) => {
    // Allow user to type + manually at the start
    const hasPlus = value.startsWith('+');
    const digits = value.replace(/\D/g, '');

    if (!digits) return hasPlus ? '+' : '';

    // If user typed +, preserve it; otherwise add it
    const prefix = hasPlus || value.length === 0 ? '+' : '+';

    if (digits.length <= 3) return `${prefix}${digits}`;
    if (digits.length <= 5) return `${prefix}${digits.slice(0, 3)} ${digits.slice(3)}`;
    if (digits.length <= 8) return `${prefix}${digits.slice(0, 3)} ${digits.slice(3, 5)} ${digits.slice(5)}`;
    if (digits.length <= 10) return `${prefix}${digits.slice(0, 3)} ${digits.slice(3, 5)} ${digits.slice(5, 8)} ${digits.slice(8)}`;
    return `${prefix}${digits.slice(0, 3)} ${digits.slice(3, 5)} ${digits.slice(5, 8)} ${digits.slice(8, 10)} ${digits.slice(10, 12)}`;
  };

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatPhoneMask(e.target.value);
    setFormData(prev => ({ ...prev, phone: formatted }));
  };

  const handleTypeChange = (newType: FormType) => {
    setType(newType);
    setFormData({ model: "", vin: "", wishes: "", budget: "", email: "", phone: "", telegramUsername: "", contactMethod: "telegram" });
    setStatus("idle");
    setMessage("");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
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
      telegramUsername: formData.telegramUsername,
      contactMethod: formData.contactMethod,
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
        setMessage(t("form.success"));
        setFormData({ model: "", vin: "", wishes: "", budget: "", email: "", phone: "", telegramUsername: "", contactMethod: "telegram" });
      } else {
        setStatus("error");
        setMessage(result?.error || t("form.error"));
      }
    } catch {
      setStatus("error");
      setMessage(t("form.connectionError"));
    }
  };

  const modelLabel = type === "auto" ? t("form.modelLabelAuto") : t("form.modelLabelMoto");
  const modelPlaceholder =
    type === "auto" ? t("form.modelPlaceholderAuto") : t("form.modelPlaceholderMoto");

  return (
    <div className="min-h-screen bg-black text-white">
      <section className="relative overflow-hidden px-4 pt-24 pb-16 sm:px-6 sm:pt-28 sm:pb-20 md:px-10 md:py-32 lg:py-40">
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-transparent via-black/80 to-black" />
        <div className="pointer-events-none absolute inset-x-0 top-0 h-48 bg-[radial-gradient(circle_at_top,_rgba(255,255,255,0.1),_transparent_60%)] sm:h-64" />
        <div className="relative mx-auto max-w-7xl">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            className="mb-12 text-center sm:mb-16 md:mb-20"
          >
            <p className="mb-4 text-xs uppercase tracking-[0.3em] text-white/60 sm:mb-5 sm:text-sm sm:tracking-[0.4em] md:mb-6">{t("hero.eyebrow")}</p>
            <h1 className="mb-6 text-3xl font-extralight leading-tight tracking-tight text-white sm:text-4xl sm:mb-7 md:text-5xl md:mb-8 lg:text-7xl xl:text-8xl text-balance">
              {t("hero.heading")}
            </h1>
            <div className="mx-auto mb-6 h-px w-20 bg-white/20 sm:w-24 sm:mb-8 md:w-32 md:mb-10" />
            <p className="mx-auto max-w-5xl text-base font-light text-white/70 sm:text-lg md:text-xl lg:text-2xl text-pretty">
              {t("hero.subheading")}
            </p>
          </motion.div>

          <div className="flex flex-col gap-16 lg:gap-24">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.2 }}
              className="mx-auto w-full max-w-6xl rounded-2xl border border-white/10 bg-white/[0.02] p-8 backdrop-blur-3xl sm:rounded-3xl sm:p-12 md:rounded-[32px] md:p-16 shadow-[0_30px_60px_rgba(0,0,0,0.5)]"
            >
              <form onSubmit={handleSubmit} className="space-y-8 sm:space-y-10 md:space-y-12">
                {/* Progress bar */}
                <div className="space-y-1.5">
                  <div className={`flex items-center justify-between tracking-[0.15em] uppercase text-white/40 font-light ${typography.badge}`}>
                    <span>{completion}%</span>
                    <span className="truncate">{status === "loading" ? t("form.submitting") : t("form.progressLabel")}</span>
                  </div>
                  <div className="h-0.5 w-full overflow-hidden rounded-full bg-white/10">
                    <div
                      className="h-full bg-white transition-all duration-500"
                      style={{ width: `${completion}%` }}
                    />
                  </div>
                </div>

                {/* Type selector */}
                <div className="flex gap-2">
                  {(["auto", "moto"] as FormType[]).map(option => (
                    <button
                      key={option}
                      type="button"
                      onClick={() => handleTypeChange(option)}
                      className={
                        `flex-1 px-4 py-2.5 sm:py-3 text-[10px] sm:text-xs font-semibold uppercase tracking-[0.2em] sm:tracking-[0.25em] transition-all duration-300 relative overflow-hidden rounded-lg ` +
                        (type === option
                          ? "bg-white text-black shadow-lg"
                          : "bg-white/5 text-white/50 hover:bg-white/8 hover:text-white/70")
                      }
                      aria-pressed={type === option}
                    >
                      <span className="relative z-10">{option === "auto" ? t("form.typeAuto") : t("form.typeMoto")}</span>
                    </button>
                  ))}
                </div>

                <div className="space-y-6 sm:space-y-8">
                  <div className="grid grid-cols-1 gap-6 sm:gap-8 md:grid-cols-2">
                    <div>
                      <label htmlFor="model" className={`mb-2 block font-light uppercase tracking-[0.15em] text-white/40 ${typography.badge}`}>
                        {modelLabel}
                      </label>
                      <input
                        type="text"
                        id="model"
                        name="model"
                        value={formData.model}
                        onChange={handleChange}
                        className="w-full px-0 py-3 sm:py-4 bg-transparent border-b border-white/20 text-white text-sm placeholder:text-white/25 focus:outline-none focus:border-white focus:border-b-2 transition-all font-light"
                        placeholder={modelPlaceholder}
                        required
                      />
                    </div>
                    <div>
                      <label htmlFor="vin" className={`mb-2 block font-light uppercase tracking-[0.15em] text-white/40 ${typography.badge}`}>
                        {t("form.vinLabel")} <span className="text-white/30 text-[8px]">{t("form.optional")}</span>
                      </label>
                      <input
                        type="text"
                        id="vin"
                        name="vin"
                        value={formData.vin}
                        onChange={handleChange}
                        className="w-full px-0 py-3 sm:py-4 bg-transparent border-b border-white/20 text-white text-sm placeholder:text-white/25 focus:outline-none focus:border-white focus:border-b-2 transition-all font-light"
                        placeholder={t("form.vinPlaceholder")}
                        maxLength={17}
                      />
                    </div>
                  </div>

                  <div>
                    <label htmlFor="wishes" className={`mb-2 block font-light uppercase tracking-[0.15em] text-white/40 ${typography.badge}`}>
                      {t("form.wishesLabel")}
                    </label>
                    <textarea
                      id="wishes"
                      name="wishes"
                      rows={4}
                      value={formData.wishes}
                      onChange={handleChange}
                      className="w-full px-0 py-3 sm:py-4 bg-transparent border-b border-white/20 text-white text-sm placeholder:text-white/25 focus:outline-none focus:border-white focus:border-b-2 transition-all resize-none font-light"
                      placeholder={t("form.wishesPlaceholder")}
                      required
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 sm:gap-8">
                    <div>
                      <label htmlFor="budget" className={`mb-2 block font-light uppercase tracking-[0.15em] text-white/40 ${typography.badge}`}>
                        {t("form.budgetLabel")} <span className="text-white/30 text-[8px]">{t("form.optional")}</span>
                      </label>
                      <input
                        type="text"
                        id="budget"
                        name="budget"
                        value={formData.budget}
                        onChange={handleChange}
                        className="w-full px-0 py-3 sm:py-4 bg-transparent border-b border-white/20 text-white text-sm placeholder:text-white/25 focus:outline-none focus:border-white focus:border-b-2 transition-all font-light"
                        placeholder={t("form.budgetPlaceholder")}
                      />
                    </div>
                    <div>
                      <label htmlFor="email" className={`mb-2 block font-light uppercase tracking-[0.15em] text-white/40 ${typography.badge}`}>
                        {t("form.emailLabel")}
                      </label>
                      <input
                        type="email"
                        id="email"
                        name="email"
                        value={formData.email}
                        onChange={handleChange}
                        className="w-full px-0 py-3 sm:py-4 bg-transparent border-b border-white/20 text-white text-sm placeholder:text-white/25 focus:outline-none focus:border-white focus:border-b-2 transition-all font-light"
                        placeholder="example@mail.com"
                        required
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 sm:gap-8">
                    <div>
                      <label htmlFor="phone" className={`mb-2 block font-light uppercase tracking-[0.15em] text-white/40 ${typography.badge}`}>
                        {t("form.phoneLabel")}
                      </label>
                      <input
                        type="tel"
                        id="phone"
                        name="phone"
                        value={formData.phone}
                        onChange={handlePhoneChange}
                        className="w-full px-0 py-3 sm:py-4 bg-transparent border-b border-white/20 text-white text-sm placeholder:text-white/25 focus:outline-none focus:border-white focus:border-b-2 transition-all font-light"
                        placeholder={t("form.phonePlaceholder")}
                        required
                        aria-label={t("form.phoneLabel")}
                      />
                      <p className="mt-1 text-[8px] text-white/30 tracking-wide">{t("form.phoneHint")}</p>
                    </div>
                    <div>
                      <label className={`mb-2 block font-light uppercase tracking-[0.15em] text-white/40 ${typography.badge}`}>
                        {t("form.contactMethodLabel")}
                      </label>
                      <div className="flex gap-2 pt-1">
                        {(["telegram", "whatsapp"] as const).map(method => (
                          <button
                            key={method}
                            type="button"
                            onClick={() => setFormData(prev => ({ ...prev, contactMethod: method }))}
                            className={`flex-1 relative rounded-full border px-3 py-2.5 sm:py-3 text-[10px] sm:text-xs font-light tracking-[0.1em] transition-all duration-300 ${formData.contactMethod === method ? 'border-white bg-white text-black' : 'border-white/15 text-white/50 hover:border-white/30 hover:text-white/70'}`}
                            aria-pressed={formData.contactMethod === method}
                          >
                            <span className="relative z-10">
                              {t(`form.${method}`)}
                            </span>
                          </button>
                        ))}
                      </div>
                      <AnimatePresence>
                        {formData.contactMethod === "telegram" && (
                          <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: "auto" }}
                            exit={{ opacity: 0, height: 0 }}
                            className="mt-4 overflow-hidden"
                          >
                            <label htmlFor="telegramUsername" className={`mb-2 block font-light uppercase tracking-[0.15em] text-white/40 ${typography.badge}`}>
                              {t("form.telegramUsernameLabel")} <span className="text-white/30 text-[8px]">{t("form.optional")}</span>
                            </label>
                            <input
                              type="text"
                              id="telegramUsername"
                              name="telegramUsername"
                              value={formData.telegramUsername}
                              onChange={handleChange}
                              className="w-full px-0 py-3 sm:py-4 bg-transparent border-b border-white/20 text-white text-sm placeholder:text-white/25 focus:outline-none focus:border-white focus:border-b-2 transition-all font-light"
                              placeholder={t("form.telegramUsernamePlaceholder")}
                            />
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  </div>
                </div>

                <div className="pt-3 sm:pt-4">
                  <motion.button
                    type="submit"
                    disabled={status === "loading"}
                    whileHover={{ scale: status === "loading" ? 1 : 1.01 }}
                    whileTap={{ scale: status === "loading" ? 1 : 0.98 }}
                    className="flex w-full items-center justify-center gap-2 rounded-full border border-white bg-white px-6 py-2.5 sm:py-3 text-[10px] sm:text-xs font-semibold uppercase tracking-[0.2em] sm:tracking-[0.25em] text-black transition-all duration-300 hover:bg-transparent hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {status === "loading" && <Loader className="animate-spin" size={14} />}
                    {status === "loading" ? t("form.submitting") : t("form.submit")}
                  </motion.button>
                </div>

                <AnimatePresence>
                  {message && (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      className={`p-4 flex items-center justify-center gap-3 rounded-xl border ${status === "success"
                          ? "border-green-300/40 bg-green-500/10 text-green-200"
                          : "border-red-300/40 bg-red-500/10 text-red-200"
                        }`}
                    >
                      {status === "success" ? <CheckCircle size={20} /> : <AlertCircle size={20} />}
                      <span className="text-sm font-light">{message}</span>
                    </motion.div>
                  )}
                </AnimatePresence>
              </form>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.4 }}
              className="mx-auto w-full max-w-6xl"
            >
              <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
                <div className="group flex flex-col items-center gap-4 rounded-2xl border border-white/10 bg-white/[0.02] p-8 text-center backdrop-blur-xl transition-all duration-300 hover:bg-white/[0.05] hover:border-white/20">
                  <div className="rounded-full border border-white/10 bg-white/5 p-4 text-white transition-transform duration-300 group-hover:scale-110">
                    <Mail className="h-6 w-6" />
                  </div>
                  <div>
                    <h3 className={`mb-2 font-light uppercase tracking-widest text-white/50 ${typography.label}`}>{t("info.emailLabel")}</h3>
                    <a href="mailto:info@onecompany.global" className="text-lg font-light text-white transition-colors hover:text-white/80">
                      info@onecompany.global
                    </a>
                  </div>
                </div>

                <div className="group flex flex-col items-center gap-4 rounded-2xl border border-white/10 bg-white/[0.02] p-8 text-center backdrop-blur-xl transition-all duration-300 hover:bg-white/[0.05] hover:border-white/20">
                  <div className="rounded-full border border-white/10 bg-white/5 p-4 text-white transition-transform duration-300 group-hover:scale-110">
                    <Phone className="h-6 w-6" />
                  </div>
                  <div>
                    <h3 className={`mb-2 font-light uppercase tracking-widest text-white/50 ${typography.label}`}>{t("info.phoneLabel")}</h3>
                    <a href="tel:+380660771700" className="text-lg font-light text-white transition-colors hover:text-white/80">
                      +380 66 077 17 00
                    </a>
                  </div>
                </div>

                <div className="group flex flex-col items-center gap-4 rounded-2xl border border-white/10 bg-white/[0.02] p-8 text-center backdrop-blur-xl transition-all duration-300 hover:bg-white/[0.05] hover:border-white/20">
                  <div className="rounded-full border border-white/10 bg-white/5 p-4 text-white transition-transform duration-300 group-hover:scale-110">
                    <MapPin className="h-6 w-6" />
                  </div>
                  <div>
                    <h3 className={`mb-2 font-light uppercase tracking-widest text-white/50 ${typography.label}`}>{t("info.locationLabel")}</h3>
                    <p className="text-lg font-light text-white">{t("info.locationValue")}</p>
                  </div>
                </div>
              </div>

              <p className="mt-12 text-center text-sm font-light leading-relaxed text-white/50 max-w-2xl mx-auto">
                {t("info.description")}
              </p>
            </motion.div>
          </div>
        </div>
      </section>
    </div>
  );
}
