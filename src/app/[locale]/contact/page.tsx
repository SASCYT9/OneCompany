
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
  });
  const [status, setStatus] = useState<FormState>("idle");
  const [message, setMessage] = useState("");

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleTypeChange = (newType: FormType) => {
    setType(newType);
    setFormData({ model: "", vin: "", wishes: "", budget: "", email: "" });
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
        setFormData({ model: "", vin: "", wishes: "", budget: "", email: "" });
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
      <section className="relative overflow-hidden px-6 py-32 md:px-10 md:py-40">
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-transparent via-[#0f0f0f] to-[#050505]" />
        <div className="pointer-events-none absolute inset-x-0 top-0 h-64 bg-[radial-gradient(circle_at_top,_rgba(245,230,200,0.25),_transparent_60%)]" />
        <div className="relative mx-auto max-w-7xl">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            className="text-center mb-20"
          >
            <p className="text-sm uppercase tracking-[0.4em] text-amber-200/70 mb-6">{t("hero.eyebrow")}</p>
            <h1 className="text-5xl md:text-7xl lg:text-8xl font-extralight tracking-tight text-white mb-8 leading-tight">
              {t("hero.heading")}
            </h1>
            <div className="w-32 h-px bg-amber-200/40 mx-auto mb-10" />
            <p className="text-xl md:text-2xl font-light text-white/70 max-w-3xl mx-auto">
              {t("hero.subheading")}
            </p>
          </motion.div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 lg:gap-24">
            <motion.div
              initial={{ opacity: 0, x: -30 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.8, delay: 0.2 }}
              className="space-y-12 rounded-[32px] border border-white/10 bg-white/5 p-10 backdrop-blur"
            >
              <div>
                <h2 className="text-3xl md:text-4xl font-light text-white mb-8 tracking-wide">
                  {t("info.title")}
                </h2>
                <div className="w-16 h-px bg-amber-200/40 mb-12" />
              </div>

              <div className="space-y-8">
                <div className="flex items-start gap-4 group">
                  <div className="p-3 rounded-full border border-white/10 bg-white/5 text-white group-hover:scale-110 transition-transform duration-300">
                    <Mail className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-sm uppercase tracking-widest text-white/50 mb-2 font-light">{t("info.emailLabel")}</h3>
                    <a
                      href="mailto:info@onecompany.com"
                      className="text-lg font-light text-white hover:text-amber-200 transition-colors"
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
              className="rounded-[32px] border border-white/10 bg-white/5 p-8 backdrop-blur"
            >
              <form onSubmit={handleSubmit} className="space-y-8">
                <div className="flex gap-4">
                  <button
                    type="button"
                    onClick={() => handleTypeChange("auto")}
                    className={`flex-1 py-4 px-6 text-sm uppercase tracking-widest font-light transition-all duration-300 ${
                      type === "auto"
                        ? "bg-gradient-to-r from-amber-200 to-amber-400 text-black shadow-[0_10px_40px_rgba(251,191,36,0.25)]"
                        : "bg-white/5 text-white/60 hover:bg-white/10"
                    }`}
                  >
                    {t("form.typeAuto")}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleTypeChange("moto")}
                    className={`flex-1 py-4 px-6 text-sm uppercase tracking-widest font-light transition-all duration-300 ${
                      type === "moto"
                        ? "bg-gradient-to-r from-amber-200 to-amber-400 text-black shadow-[0_10px_40px_rgba(251,191,36,0.25)]"
                        : "bg-white/5 text-white/60 hover:bg-white/10"
                    }`}
                  >
                    {t("form.typeMoto")}
                  </button>
                </div>

                <div className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label htmlFor="model" className="block text-xs uppercase tracking-widest text-white/50 mb-3 font-light">
                        {modelLabel}
                      </label>
                      <input
                        type="text"
                        id="model"
                        name="model"
                        value={formData.model}
                        onChange={handleChange}
                        className="w-full px-0 py-3 bg-transparent border-b border-white/20 text-white placeholder:text-white/30 focus:outline-none focus:border-amber-200 transition-colors font-light"
                        placeholder={modelPlaceholder}
                        required
                      />
                    </div>
                    <div>
                      <label htmlFor="vin" className="block text-xs uppercase tracking-widest text-white/50 mb-3 font-light">
                        {t("form.vinLabel")} <span className="text-white/40">{t("form.optional")}</span>
                      </label>
                      <input
                        type="text"
                        id="vin"
                        name="vin"
                        value={formData.vin}
                        onChange={handleChange}
                        className="w-full px-0 py-3 bg-transparent border-b border-white/20 text-white placeholder:text-white/30 focus:outline-none focus:border-amber-200 transition-colors font-light"
                        placeholder={t("form.vinPlaceholder")}
                      />
                    </div>
                  </div>

                  <div>
                    <label htmlFor="wishes" className="block text-xs uppercase tracking-widest text-white/50 mb-3 font-light">
                      {t("form.wishesLabel")}
                    </label>
                    <textarea
                      id="wishes"
                      name="wishes"
                      rows={4}
                      value={formData.wishes}
                      onChange={handleChange}
                      className="w-full px-0 py-3 bg-transparent border-b border-white/20 text-white placeholder:text-white/30 focus:outline-none focus:border-amber-200 transition-colors resize-none font-light"
                      placeholder={t("form.wishesPlaceholder")}
                      required
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label htmlFor="budget" className="block text-xs uppercase tracking-widest text-white/50 mb-3 font-light">
                        {t("form.budgetLabel")} <span className="text-white/40">{t("form.optional")}</span>
                      </label>
                      <input
                        type="text"
                        id="budget"
                        name="budget"
                        value={formData.budget}
                        onChange={handleChange}
                        className="w-full px-0 py-3 bg-transparent border-b border-white/20 text-white placeholder:text-white/30 focus:outline-none focus:border-amber-200 transition-colors font-light"
                        placeholder={t("form.budgetPlaceholder")}
                      />
                    </div>
                    <div>
                      <label htmlFor="email" className="block text-xs uppercase tracking-widest text-white/50 mb-3 font-light">
                        {t("form.emailLabel")}
                      </label>
                      <input
                        type="email"
                        id="email"
                        name="email"
                        value={formData.email}
                        onChange={handleChange}
                        className="w-full px-0 py-3 bg-transparent border-b border-white/20 text-white placeholder:text-white/30 focus:outline-none focus:border-amber-200 transition-colors font-light"
                        placeholder="example@mail.com"
                        required
                      />
                    </div>
                  </div>
                </div>

                <div className="pt-6">
                  <motion.button
                    type="submit"
                    disabled={status === "loading"}
                    whileHover={{ scale: status === "loading" ? 1 : 1.02 }}
                    whileTap={{ scale: status === "loading" ? 1 : 0.98 }}
                    className="w-full py-4 px-12 bg-gradient-to-r from-amber-200 to-amber-400 text-black text-sm uppercase tracking-widest font-light hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 flex items-center justify-center gap-3"
                  >
                    {status === "loading" && <Loader className="animate-spin" size={18} />}
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
