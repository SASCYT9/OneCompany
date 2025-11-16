
"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { CheckCircle, AlertCircle, Loader, Mail, Phone, MapPin } from "lucide-react";
import { useTranslations } from "next-intl";

type FormType = "auto" | "moto";
type FormState = "idle" | "loading" | "success" | "error";

export default function ContactPage() {
  const t = useTranslations("contactPage");
  const [type, setType] = useState<FormType>("auto");
  const [formData, setFormData] = useState({
    model: "",
    vin: "",
    wishes: "",
    budget: "",
    email: "",
    phone: "",
    contactMethod: "telegram" as "telegram" | "whatsapp",
  });
  const [status, setStatus] = useState<FormState>("idle");
  const [message, setMessage] = useState("");

  // Progress (percentage of required fields filled)
  const requiredKeys: (keyof typeof formData)[] = ["model", "wishes", "email", "phone"];
  const completion = Math.round(
    (requiredKeys.filter(k => formData[k].trim().length > 0).length / requiredKeys.length) * 100
  );

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const formatPhoneMask = (value: string) => {
    const digits = value.replace(/\D/g, '');
    if (!digits) return '';
    if (digits.length <= 3) return `+${digits}`;
    if (digits.length <= 5) return `+${digits.slice(0, 3)} ${digits.slice(3)}`;
    if (digits.length <= 8) return `+${digits.slice(0, 3)} ${digits.slice(3, 5)} ${digits.slice(5)}`;
    if (digits.length <= 10) return `+${digits.slice(0, 3)} ${digits.slice(3, 5)} ${digits.slice(5, 8)} ${digits.slice(8)}`;
    return `+${digits.slice(0, 3)} ${digits.slice(3, 5)} ${digits.slice(5, 8)} ${digits.slice(8, 10)} ${digits.slice(10, 12)}`;
  };

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatPhoneMask(e.target.value);
    setFormData(prev => ({ ...prev, phone: formatted }));
  };

  const handleTypeChange = (newType: FormType) => {
    setType(newType);
    setFormData({ model: "", vin: "", wishes: "", budget: "", email: "", phone: "", contactMethod: "telegram" });
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
        setFormData({ model: "", vin: "", wishes: "", budget: "", email: "", phone: "", contactMethod: "telegram" });
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
    <div className="min-h-screen bg-[#050505] text-white">
      <section className="relative overflow-hidden px-4 py-16 sm:px-6 sm:py-20 md:px-10 md:py-32 lg:py-40">
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-transparent via-[#0f0f0f] to-[#050505]" />
        <div className="pointer-events-none absolute inset-x-0 top-0 h-48 bg-[radial-gradient(circle_at_top,_rgba(245,230,200,0.25),_transparent_60%)] sm:h-64" />
        <div className="relative mx-auto max-w-7xl">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            className="mb-12 text-center sm:mb-16 md:mb-20"
          >
            <p className="mb-4 text-xs uppercase tracking-[0.3em] text-amber-200/70 sm:mb-5 sm:text-sm sm:tracking-[0.4em] md:mb-6">{t("hero.eyebrow")}</p>
            <h1 className="mb-6 text-3xl font-extralight leading-tight tracking-tight text-white sm:text-4xl sm:mb-7 md:text-5xl md:mb-8 lg:text-7xl xl:text-8xl">
              {t("hero.heading")}
            </h1>
            <div className="mx-auto mb-6 h-px w-20 bg-amber-200/40 sm:w-24 sm:mb-8 md:w-32 md:mb-10" />
            <p className="mx-auto max-w-3xl text-base font-light text-white/70 sm:text-lg md:text-xl lg:text-2xl">
              {t("hero.subheading")}
            </p>
          </motion.div>

          <div className="grid grid-cols-1 gap-8 sm:gap-12 md:gap-16 lg:grid-cols-2 lg:gap-24">
            <motion.div
              initial={{ opacity: 0, x: -30 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.8, delay: 0.2 }}
              className="space-y-8 rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur sm:space-y-10 sm:rounded-3xl sm:p-8 md:space-y-12 md:rounded-[32px] md:p-10"
            >
              <div>
                <h2 className="mb-6 text-2xl font-light tracking-wide text-white sm:mb-7 sm:text-3xl md:mb-8 md:text-4xl">
                  {t("info.title")}
                </h2>
                <div className="mb-8 h-px w-12 bg-amber-200/40 sm:mb-10 sm:w-14 md:mb-12 md:w-16" />
              </div>

              <div className="space-y-6 sm:space-y-7 md:space-y-8">
                <div className="group flex items-start gap-3 sm:gap-4">
                  <div className="rounded-full border border-white/10 bg-white/5 p-2 text-white transition-transform duration-300 group-hover:scale-110 sm:p-3">
                    <Mail className="h-5 w-5 sm:h-6 sm:w-6" />
                  </div>
                  <div>
                    <h3 className="mb-1.5 text-xs font-light uppercase tracking-widest text-white/50 sm:mb-2 sm:text-sm">{t("info.emailLabel")}</h3>
                    <a
                      href="mailto:info@onecompany.com"
                      className="text-base font-light text-white transition-colors hover:text-amber-200 sm:text-lg"
                    >
                      info@onecompany.com
                    </a>
                  </div>
                </div>

                <div className="flex items-start gap-4 group">
                  <div className="p-3 rounded-full border border-white/10 bg-white/5 text-white group-hover:scale-110 transition-transform duration-300">
                    <Phone className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-sm uppercase tracking-widest text-white/50 mb-2 font-light">{t("info.phoneLabel")}</h3>
                    <a
                      href="tel:+380123456789"
                      className="text-lg font-light text-white hover:text-amber-200 transition-colors"
                    >
                      +380 12 345 67 89
                    </a>
                  </div>
                </div>

                <div className="flex items-start gap-4 group">
                  <div className="p-3 rounded-full border border-white/10 bg-white/5 text-white group-hover:scale-110 transition-transform duration-300">
                    <MapPin className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-sm uppercase tracking-widest text-white/50 mb-2 font-light">{t("info.locationLabel")}</h3>
                    <p className="text-lg font-light text-white">{t("info.locationValue")}</p>
                  </div>
                </div>
              </div>

              <div className="pt-8">
                <p className="text-base font-light text-white/70 leading-relaxed">{t("info.description")}</p>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: 30 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.8, delay: 0.4 }}
              className="rounded-2xl border border-white/10 bg-gradient-to-b from-black/60 via-zinc-950/80 to-black/60 p-5 backdrop-blur sm:rounded-3xl sm:p-6 md:rounded-[32px] md:p-8 shadow-[0_40px_120px_rgba(0,0,0,0.6)]"
            >
              <form onSubmit={handleSubmit} className="space-y-6 sm:space-y-7 md:space-y-8">
                {/* Progress bar */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-[9px] sm:text-[10px] tracking-[0.15em] uppercase text-white/40 font-light">
                    <span>{completion}%</span>
                    <span className="truncate">{status === "loading" ? t("form.submitting") : t("form.progressLabel")}</span>
                  </div>
                  <div className="h-0.5 w-full overflow-hidden rounded-full bg-white/10">
                    <div
                      className="h-full bg-gradient-to-r from-amber-300 to-amber-500 transition-all duration-500"
                      style={{ width: `${completion}%` }}
                    />
                  </div>
                </div>

                {/* Type selector */}
                <div className="flex gap-2">
                  {(["auto","moto"] as FormType[]).map(option => (
                    <button
                      key={option}
                      type="button"
                      onClick={() => handleTypeChange(option)}
                      className={
                        `flex-1 px-4 py-2.5 sm:py-3 text-[10px] sm:text-xs font-light uppercase tracking-[0.2em] sm:tracking-[0.25em] transition-all duration-300 relative overflow-hidden ` +
                        (type === option
                          ? "bg-gradient-to-r from-amber-200 via-amber-300 to-amber-400 text-black shadow-[0_6px_24px_rgba(251,191,36,0.2)]"
                          : "bg-white/5 text-white/50 hover:bg-white/8 hover:text-white/70")
                      }
                      aria-pressed={type===option}
                    >
                      <span className="relative z-10">{option === "auto" ? t("form.typeAuto") : t("form.typeMoto")}</span>
                      {type === option && <span className="absolute inset-0 animate-pulse bg-gradient-to-r from-amber-200/0 via-amber-400/10 to-amber-200/0" />}
                    </button>
                  ))}
                </div>

                <div className="space-y-4 sm:space-y-5">
                  <div className="grid grid-cols-1 gap-4 sm:gap-5 md:grid-cols-2">
                    <div>
                      <label htmlFor="model" className="mb-1.5 block text-[9px] sm:text-[10px] font-light uppercase tracking-[0.15em] text-white/40">
                        {modelLabel}
                      </label>
                      <input
                        type="text"
                        id="model"
                        name="model"
                        value={formData.model}
                        onChange={handleChange}
                        className="w-full px-0 py-2 sm:py-2.5 bg-transparent border-b border-white/20 text-white text-sm placeholder:text-white/25 focus:outline-none focus:border-amber-300/80 focus:border-b-2 transition-all font-light"
                        placeholder={modelPlaceholder}
                        required
                      />
                    </div>
                    <div>
                      <label htmlFor="vin" className="mb-1.5 block text-[9px] sm:text-[10px] font-light uppercase tracking-[0.15em] text-white/40">
                        {t("form.vinLabel")} <span className="text-white/30 text-[8px]">{t("form.optional")}</span>
                      </label>
                      <input
                        type="text"
                        id="vin"
                        name="vin"
                        value={formData.vin}
                        onChange={handleChange}
                        className="w-full px-0 py-2 sm:py-2.5 bg-transparent border-b border-white/20 text-white text-sm placeholder:text-white/25 focus:outline-none focus:border-amber-300/80 focus:border-b-2 transition-all font-light"
                        placeholder={t("form.vinPlaceholder")}
                        maxLength={17}
                      />
                    </div>
                  </div>

                  <div>
                    <label htmlFor="wishes" className="mb-1.5 block text-[9px] sm:text-[10px] font-light uppercase tracking-[0.15em] text-white/40">
                      {t("form.wishesLabel")}
                    </label>
                    <textarea
                      id="wishes"
                      name="wishes"
                      rows={4}
                      value={formData.wishes}
                      onChange={handleChange}
                      className="w-full px-0 py-2 sm:py-2.5 bg-transparent border-b border-white/20 text-white text-sm placeholder:text-white/25 focus:outline-none focus:border-amber-300/80 focus:border-b-2 transition-all resize-none font-light"
                      placeholder={t("form.wishesPlaceholder")}
                      required
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-5">
                    <div>
                      <label htmlFor="budget" className="mb-1.5 block text-[9px] sm:text-[10px] font-light uppercase tracking-[0.15em] text-white/40">
                        {t("form.budgetLabel")} <span className="text-white/30 text-[8px]">{t("form.optional")}</span>
                      </label>
                      <input
                        type="text"
                        id="budget"
                        name="budget"
                        value={formData.budget}
                        onChange={handleChange}
                        className="w-full px-0 py-2 sm:py-2.5 bg-transparent border-b border-white/20 text-white text-sm placeholder:text-white/25 focus:outline-none focus:border-amber-300/80 focus:border-b-2 transition-all font-light"
                        placeholder={t("form.budgetPlaceholder")}
                      />
                    </div>
                    <div>
                      <label htmlFor="email" className="mb-1.5 block text-[9px] sm:text-[10px] font-light uppercase tracking-[0.15em] text-white/40">
                        {t("form.emailLabel")}
                      </label>
                      <input
                        type="email"
                        id="email"
                        name="email"
                        value={formData.email}
                        onChange={handleChange}
                        className="w-full px-0 py-2 sm:py-2.5 bg-transparent border-b border-white/20 text-white text-sm placeholder:text-white/25 focus:outline-none focus:border-amber-300/80 focus:border-b-2 transition-all font-light"
                        placeholder="example@mail.com"
                        required
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-5">
                    <div>
                      <label htmlFor="phone" className="mb-1.5 block text-[9px] sm:text-[10px] font-light uppercase tracking-[0.15em] text-white/40">
                        {t("form.phoneLabel")}
                      </label>
                      <input
                        type="tel"
                        id="phone"
                        name="phone"
                        value={formData.phone}
                        onChange={handlePhoneChange}
                        className="w-full px-0 py-2 sm:py-2.5 bg-transparent border-b border-white/20 text-white text-sm placeholder:text-white/25 focus:outline-none focus:border-amber-300/80 focus:border-b-2 transition-all font-light"
                        placeholder={t("form.phonePlaceholder")}
                        required
                        aria-label={t("form.phoneLabel")}
                      />
                      <p className="mt-1 text-[8px] text-white/30 tracking-wide">{t("form.phoneHint")}</p>
                    </div>
                    <div>
                      <label className="mb-1.5 block text-[9px] sm:text-[10px] font-light uppercase tracking-[0.15em] text-white/40">
                        {t("form.contactMethodLabel")}
                      </label>
                      <div className="flex gap-2 pt-1">
                        {(["telegram","whatsapp"] as const).map(method => (
                          <button
                            key={method}
                            type="button"
                            onClick={() => setFormData(prev => ({ ...prev, contactMethod: method }))}
                            className={`flex-1 relative rounded-full border px-3 py-1.5 sm:py-2 text-[10px] sm:text-xs font-light tracking-[0.1em] transition-all duration-300 ${formData.contactMethod === method ? 'border-amber-300/80 bg-amber-300/10 text-amber-200 shadow-[0_0_12px_rgba(251,191,36,0.15)]' : 'border-white/15 text-white/50 hover:border-white/30 hover:text-white/70'}`}
                            aria-pressed={formData.contactMethod===method}
                          >
                            <span className="relative z-10">
                              {t(`form.${method}`)}
                            </span>
                            {formData.contactMethod === method && (
                              <span className="absolute inset-0 rounded-full bg-gradient-to-r from-amber-200/0 via-amber-400/10 to-amber-200/0 animate-pulse" />
                            )}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="pt-3 sm:pt-4">
                  <motion.button
                    type="submit"
                    disabled={status === "loading"}
                    whileHover={{ scale: status === "loading" ? 1 : 1.01 }}
                    whileTap={{ scale: status === "loading" ? 1 : 0.98 }}
                    className="flex w-full items-center justify-center gap-2 bg-gradient-to-r from-amber-200 to-amber-400 px-6 py-2.5 sm:py-3 text-[10px] sm:text-xs font-light uppercase tracking-[0.2em] sm:tracking-[0.25em] text-black transition-all duration-300 hover:shadow-[0_8px_32px_rgba(251,191,36,0.3)] disabled:cursor-not-allowed disabled:opacity-50"
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
                      className={`p-4 flex items-center justify-center gap-3 rounded-xl border ${
                        status === "success"
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
          </div>
        </div>
      </section>
    </div>
  );
}
