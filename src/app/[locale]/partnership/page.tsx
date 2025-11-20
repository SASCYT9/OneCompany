
"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { CheckCircle, AlertCircle, Loader, Building2, Globe, User, Mail, Phone, FileText } from "lucide-react";
import { useTranslations } from "next-intl";

type PartnershipType = "supplier" | "dealer" | "media" | "other";
type FormState = "idle" | "loading" | "success" | "error";

export default function PartnershipPage() {
  const t = useTranslations("partnershipPage");
  const [formData, setFormData] = useState({
    companyName: "",
    website: "",
    contactPerson: "",
    email: "",
    phone: "",
    type: "supplier" as PartnershipType,
    message: "",
  });
  const [status, setStatus] = useState<FormState>("idle");
  const [message, setMessage] = useState("");

  // Progress (percentage of required fields filled)
  const requiredKeys: (keyof typeof formData)[] = ["companyName", "contactPerson", "email", "phone", "message"];
  const completion = Math.round(
    (requiredKeys.filter(k => formData[k].trim().length > 0).length / requiredKeys.length) * 100
  );

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const formatPhoneMask = (value: string) => {
    const hasPlus = value.startsWith('+');
    const digits = value.replace(/\D/g, '');
    if (!digits) return hasPlus ? '+' : '';
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus("loading");
    setMessage("");

    try {
      const response = await fetch("/api/partnership", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      const result = await response.json();

      if (response.ok) {
        setStatus("success");
        setMessage(t("form.success"));
        setFormData({
          companyName: "",
          website: "",
          contactPerson: "",
          email: "",
          phone: "",
          type: "supplier",
          message: "",
        });
      } else {
        setStatus("error");
        setMessage(result?.error || t("form.error"));
      }
    } catch {
      setStatus("error");
      setMessage(t("form.connectionError"));
    }
  };

  return (
    <div className="min-h-screen bg-black text-white font-[family:var(--font-sans)]">
      <section className="relative overflow-hidden px-4 py-16 sm:px-6 sm:py-20 md:px-10 md:py-32 lg:py-40">
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-transparent via-black/80 to-black" />
        <div className="pointer-events-none absolute inset-x-0 top-0 h-48 bg-[radial-gradient(circle_at_top,_rgba(255,255,255,0.1),_transparent_60%)] sm:h-64" />
        
        <div className="relative mx-auto max-w-7xl">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            className="mb-12 text-center sm:mb-16 md:mb-20"
          >
            <p className="mb-4 text-xs uppercase tracking-[0.3em] text-white/60 sm:mb-5 sm:text-sm sm:tracking-[0.4em] md:mb-6">
              {t("hero.eyebrow")}
            </p>
            <h1 className="mb-6 text-3xl font-extralight leading-tight tracking-tight text-white sm:text-4xl sm:mb-7 md:text-5xl md:mb-8 lg:text-7xl xl:text-8xl text-balance">
              {t("hero.heading")}
            </h1>
            <div className="mx-auto mb-6 h-px w-20 bg-white/20 sm:w-24 sm:mb-8 md:w-32 md:mb-10" />
            <p className="mx-auto max-w-3xl text-base font-light text-white/70 sm:text-lg md:text-xl lg:text-2xl text-pretty">
              {t("hero.subheading")}
            </p>
          </motion.div>

          <div className="mx-auto w-full max-w-2xl">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.2 }}
              className="rounded-2xl border border-white/10 bg-white/[0.02] p-6 backdrop-blur-3xl sm:rounded-3xl sm:p-10 md:rounded-[32px] md:p-12 shadow-[0_30px_60px_rgba(0,0,0,0.5)]"
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
                      className="h-full bg-white transition-all duration-500"
                      style={{ width: `${completion}%` }}
                    />
                  </div>
                </div>

                {/* Partnership Type */}
                <div>
                  <label className="mb-3 block text-[9px] sm:text-[10px] font-light uppercase tracking-[0.15em] text-white/40">
                    {t("form.typeLabel")}
                  </label>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                    {(["supplier", "dealer", "media", "other"] as const).map((type) => (
                      <button
                        key={type}
                        type="button"
                        onClick={() => setFormData(prev => ({ ...prev, type }))}
                        className={`
                          relative overflow-hidden rounded-lg border px-2 py-2.5 text-[9px] font-semibold uppercase tracking-[0.15em] transition-all duration-300 sm:text-[10px]
                          ${formData.type === type 
                            ? "border-white bg-white text-black shadow-[0_0_20px_rgba(255,255,255,0.3)]" 
                            : "border-white/10 bg-white/5 text-white/50 hover:border-white/30 hover:text-white/80"}
                        `}
                      >
                        {t(`form.types.${type}`)}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-4 sm:space-y-5">
                  {/* Company & Website */}
                  <div className="grid grid-cols-1 gap-4 sm:gap-5 md:grid-cols-2">
                    <div>
                      <label htmlFor="companyName" className="mb-1.5 flex items-center gap-2 text-[9px] sm:text-[10px] font-light uppercase tracking-[0.15em] text-white/40">
                        <Building2 size={12} />
                        {t("form.companyLabel")}
                      </label>
                      <input
                        type="text"
                        id="companyName"
                        name="companyName"
                        value={formData.companyName}
                        onChange={handleChange}
                        className="w-full border-b border-white/20 bg-transparent px-0 py-2 text-sm font-light text-white placeholder:text-white/25 focus:border-white focus:border-b-2 focus:outline-none transition-all sm:py-2.5"
                        placeholder={t("form.companyPlaceholder")}
                        required
                      />
                    </div>
                    <div>
                      <label htmlFor="website" className="mb-1.5 flex items-center gap-2 text-[9px] sm:text-[10px] font-light uppercase tracking-[0.15em] text-white/40">
                        <Globe size={12} />
                        {t("form.websiteLabel")} <span className="text-[8px] text-white/30">{t("form.optional")}</span>
                      </label>
                      <input
                        type="text"
                        id="website"
                        name="website"
                        value={formData.website}
                        onChange={handleChange}
                        className="w-full border-b border-white/20 bg-transparent px-0 py-2 text-sm font-light text-white placeholder:text-white/25 focus:border-white focus:border-b-2 focus:outline-none transition-all sm:py-2.5"
                        placeholder="https://"
                      />
                    </div>
                  </div>

                  {/* Contact Person */}
                  <div>
                    <label htmlFor="contactPerson" className="mb-1.5 flex items-center gap-2 text-[9px] sm:text-[10px] font-light uppercase tracking-[0.15em] text-white/40">
                      <User size={12} />
                      {t("form.contactPersonLabel")}
                    </label>
                    <input
                      type="text"
                      id="contactPerson"
                      name="contactPerson"
                      value={formData.contactPerson}
                      onChange={handleChange}
                      className="w-full border-b border-white/20 bg-transparent px-0 py-2 text-sm font-light text-white placeholder:text-white/25 focus:border-white focus:border-b-2 focus:outline-none transition-all sm:py-2.5"
                      placeholder={t("form.contactPersonPlaceholder")}
                      required
                    />
                  </div>

                  {/* Email & Phone */}
                  <div className="grid grid-cols-1 gap-4 sm:gap-5 md:grid-cols-2">
                    <div>
                      <label htmlFor="email" className="mb-1.5 flex items-center gap-2 text-[9px] sm:text-[10px] font-light uppercase tracking-[0.15em] text-white/40">
                        <Mail size={12} />
                        {t("form.emailLabel")}
                      </label>
                      <input
                        type="email"
                        id="email"
                        name="email"
                        value={formData.email}
                        onChange={handleChange}
                        className="w-full border-b border-white/20 bg-transparent px-0 py-2 text-sm font-light text-white placeholder:text-white/25 focus:border-white focus:border-b-2 focus:outline-none transition-all sm:py-2.5"
                        placeholder="partner@company.com"
                        required
                      />
                    </div>
                    <div>
                      <label htmlFor="phone" className="mb-1.5 flex items-center gap-2 text-[9px] sm:text-[10px] font-light uppercase tracking-[0.15em] text-white/40">
                        <Phone size={12} />
                        {t("form.phoneLabel")}
                      </label>
                      <input
                        type="tel"
                        id="phone"
                        name="phone"
                        value={formData.phone}
                        onChange={handlePhoneChange}
                        className="w-full border-b border-white/20 bg-transparent px-0 py-2 text-sm font-light text-white placeholder:text-white/25 focus:border-white focus:border-b-2 focus:outline-none transition-all sm:py-2.5"
                        placeholder="+380 XX XXX XX XX"
                        required
                      />
                    </div>
                  </div>

                  {/* Message */}
                  <div>
                    <label htmlFor="message" className="mb-1.5 flex items-center gap-2 text-[9px] sm:text-[10px] font-light uppercase tracking-[0.15em] text-white/40">
                      <FileText size={12} />
                      {t("form.messageLabel")}
                    </label>
                    <textarea
                      id="message"
                      name="message"
                      rows={4}
                      value={formData.message}
                      onChange={handleChange}
                      className="w-full resize-none border-b border-white/20 bg-transparent px-0 py-2 text-sm font-light text-white placeholder:text-white/25 focus:border-white focus:border-b-2 focus:outline-none transition-all sm:py-2.5"
                      placeholder={t("form.messagePlaceholder")}
                      required
                    />
                  </div>
                </div>

                <div className="pt-3 sm:pt-4">
                  <motion.button
                    type="submit"
                    disabled={status === "loading"}
                    whileHover={{ scale: status === "loading" ? 1 : 1.01 }}
                    whileTap={{ scale: status === "loading" ? 1 : 0.98 }}
                    className="flex w-full items-center justify-center gap-2 rounded-full border border-white bg-white px-6 py-2.5 text-[10px] font-semibold uppercase tracking-[0.2em] text-black transition-all duration-300 hover:bg-transparent hover:text-white disabled:cursor-not-allowed disabled:opacity-50 sm:py-3 sm:text-xs sm:tracking-[0.25em]"
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
                      className={`flex items-center justify-center gap-3 rounded-xl border p-4 ${
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
