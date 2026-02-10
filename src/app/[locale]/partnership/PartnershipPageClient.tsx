"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { CheckCircle, AlertCircle, Loader, Building2, Globe, User, Mail, Phone, FileText, Send } from "lucide-react";
import { useTranslations, useLocale } from "next-intl";
import { getTypography, resolveLocale } from "@/lib/typography";
import { trackFormSubmission } from "@/lib/analytics";

type PartnershipType = "sto" | "dealer" | "detailing" | "tuning" | "other";
type FormState = "idle" | "loading" | "success" | "error";

export default function PartnershipPageClient() {
  const t = useTranslations("partnershipPage");
  const locale = useLocale();
  const typography = getTypography(resolveLocale(locale));
  const [formData, setFormData] = useState({
    companyName: "",
    website: "",
    contactName: "",
    email: "",
    phone: "",
    type: "sto" as PartnershipType,
    message: "",
  });
  const [status, setStatus] = useState<FormState>("idle");
  const [message, setMessage] = useState("");

  // Progress (percentage of required fields filled)
  const requiredKeys: (keyof typeof formData)[] = ["companyName", "contactName", "email", "phone", "message"];
  const completion = Math.round(
    (requiredKeys.filter(k => formData[k].trim().length > 0).length / requiredKeys.length) * 100
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus("loading");

    try {
      const res = await fetch("/api/partnership", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      if (!res.ok) throw new Error("Failed to submit");

      setStatus("success");
      setMessage(t("successMessage"));
      trackFormSubmission('partnership', { partner_type: formData.type });
      setFormData({
        companyName: "",
        website: "",
        contactName: "",
        email: "",
        phone: "",
        type: "sto",
        message: "",
      });
    } catch {
      setStatus("error");
      setMessage(t("errorMessage"));
    }
  };

  return (
    <div className="min-h-screen bg-black text-white pt-32 md:pt-40 pb-12 px-4 sm:px-6 lg:px-8 relative overflow-hidden">
      {/* Background Elements */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] right-[-5%] w-[500px] h-[500px] bg-blue-600/10 rounded-full blur-[120px]" />
        <div className="absolute bottom-[-10%] left-[-5%] w-[500px] h-[500px] bg-purple-600/10 rounded-full blur-[120px]" />
      </div>

      <div className="max-w-7xl mx-auto relative z-10">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-24">
          {/* Left Column: Info */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6 }}
          >
            <h1 className={`font-bold mb-6 bg-clip-text text-transparent bg-gradient-to-r from-white to-white/60 ${typography.h1}`}>
              {t("title")}
            </h1>
            <p className={`text-white/60 mb-12 leading-relaxed ${typography.body}`}>
              {t("description")}
            </p>

            <div className="space-y-8">
              <div className="flex items-start space-x-4">
                <div className="p-3 rounded-xl bg-white/5 border border-white/10">
                  <Building2 className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h3 className={`font-semibold mb-2 ${typography.h3}`}>{t("benefits.official.title")}</h3>
                  <p className={`text-white/50 ${typography.bodySmall}`}>{t("benefits.official.description")}</p>
                </div>
              </div>

              <div className="flex items-start space-x-4">
                <div className="p-3 rounded-xl bg-white/5 border border-white/10">
                  <Globe className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h3 className={`font-semibold mb-2 ${typography.h3}`}>{t("benefits.logistics.title")}</h3>
                  <p className={`text-white/50 ${typography.bodySmall}`}>{t("benefits.logistics.description")}</p>
                </div>
              </div>

              <div className="flex items-start space-x-4">
                <div className="p-3 rounded-xl bg-white/5 border border-white/10">
                  <User className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h3 className={`font-semibold mb-2 ${typography.h3}`}>{t("benefits.support.title")}</h3>
                  <p className={`text-white/50 ${typography.bodySmall}`}>{t("benefits.support.description")}</p>
                </div>
              </div>
            </div>

            <div className="mt-12 flex flex-col gap-4">
              <a
                href="https://t.me/OneCompanyAutoBot"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-3 px-6 py-4 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 transition-all hover:scale-[1.02] text-white group w-fit"
              >
                <div className="p-2 rounded-xl bg-white/5 group-hover:bg-white/10 transition-colors">
                  <Send className="w-5 h-5" />
                </div>
                <span className="font-medium tracking-wide">Telegram</span>
              </a>

              <a
                href="mailto:info@onecompany.global"
                className="inline-flex items-center gap-3 px-6 py-4 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 transition-all hover:scale-[1.02] text-white group w-fit"
              >
                <div className="p-2 rounded-xl bg-white/5 group-hover:bg-white/10 transition-colors">
                  <Mail className="w-5 h-5" />
                </div>
                <span className="font-medium tracking-wide">info@onecompany.global</span>
              </a>

              <a
                href="#"
                className="inline-flex items-center gap-3 px-6 py-4 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 transition-all hover:scale-[1.02] text-white group w-fit"
              >
                <div className="p-2 rounded-xl bg-white/5 group-hover:bg-white/10 transition-colors">
                  <Phone className="w-5 h-5" />
                </div>
                <span className="font-medium tracking-wide">+380 66 077 17 00</span>
              </a>
            </div>
          </motion.div>

          {/* Right Column: Form */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-8 relative"
          >
            {/* Progress Bar */}
            <div className="absolute top-0 left-0 w-full h-1 bg-white/5 rounded-t-3xl overflow-hidden">
              <motion.div
                className="h-full bg-gradient-to-r from-blue-500 to-purple-500"
                initial={{ width: 0 }}
                animate={{ width: `${completion}%` }}
                transition={{ duration: 0.5 }}
              />
            </div>

            <form onSubmit={handleSubmit} className="space-y-6 mt-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className={`text-white/60 flex items-center gap-2 ${typography.bodySmall}`}>
                    <Building2 className="w-4 h-4" /> {t("form.companyName")}
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.companyName}
                    onChange={(e) => setFormData({ ...formData, companyName: e.target.value })}
                    className="w-full bg-black/20 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-white/30 transition-colors"
                  />
                </div>
                <div className="space-y-2">
                  <label className={`text-white/60 flex items-center gap-2 ${typography.bodySmall}`}>
                    <Globe className="w-4 h-4" /> {t("form.website")}
                  </label>
                  <input
                    type="text"
                    value={formData.website}
                    onChange={(e) => setFormData({ ...formData, website: e.target.value })}
                    className="w-full bg-black/20 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-white/30 transition-colors"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className={`text-white/60 flex items-center gap-2 ${typography.bodySmall}`}>
                    <User className="w-4 h-4" /> {t("form.contactPerson")}
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.contactName}
                    onChange={(e) => setFormData({ ...formData, contactName: e.target.value })}
                    className="w-full bg-black/20 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-white/30 transition-colors"
                  />
                </div>
                <div className="space-y-2">
                  <label className={`text-white/60 flex items-center gap-2 ${typography.bodySmall}`}>
                    <Mail className="w-4 h-4" /> {t("form.email")}
                  </label>
                  <input
                    type="email"
                    required
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full bg-black/20 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-white/30 transition-colors"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm text-white/60 flex items-center gap-2">
                  <Phone className="w-4 h-4" /> {t("form.phone")}
                </label>
                <input
                  type="tel"
                  required
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className="w-full bg-black/20 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-white/30 transition-colors"
                />
              </div>

              <div className="space-y-2">
                <label className={`text-white/60 ${typography.bodySmall}`}>{t("form.type")}</label>
                <div className="flex flex-wrap gap-2">
                  {(["sto", "dealer", "detailing", "tuning", "other"] as const).map((type) => (
                    <button
                      key={type}
                      type="button"
                      onClick={() => setFormData({ ...formData, type })}
                      className={`px-4 py-2.5 rounded-full font-medium border transition-all duration-300 ${typography.bodySmall} ${formData.type === type
                          ? "bg-white text-black border-white shadow-[0_0_20px_rgba(255,255,255,0.3)]"
                          : "bg-white/5 border-white/10 text-white/60 hover:bg-white/10 hover:border-white/20 hover:text-white"
                        }`}
                    >
                      {t(`types.${type}`)}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm text-white/60 flex items-center gap-2">
                  <FileText className="w-4 h-4" /> {t("form.message")}
                </label>
                <textarea
                  required
                  value={formData.message}
                  onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                  rows={4}
                  className="w-full bg-black/20 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-white/30 transition-colors resize-none"
                />
              </div>

              <button
                type="submit"
                disabled={status === "loading" || completion < 100}
                className={`w-full py-4 rounded-xl font-semibold flex items-center justify-center gap-2 transition-all ${status === "loading" || completion < 100
                    ? "bg-white/10 text-white/40 cursor-not-allowed"
                    : "bg-white text-black hover:bg-white/90"
                  }`}
              >
                {status === "loading" ? (
                  <Loader className="w-5 h-5 animate-spin" />
                ) : (
                  <>
                    {t("form.submit")} <Send className="w-4 h-4" />
                  </>
                )}
              </button>

              <AnimatePresence>
                {status === "success" && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 10 }}
                    className="p-4 rounded-xl bg-green-500/20 border border-green-500/30 text-green-400 flex items-center gap-3"
                  >
                    <CheckCircle className="w-5 h-5" />
                    {message}
                  </motion.div>
                )}
                {status === "error" && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 10 }}
                    className="p-4 rounded-xl bg-red-500/20 border border-red-500/30 text-red-400 flex items-center gap-3"
                  >
                    <AlertCircle className="w-5 h-5" />
                    {message}
                  </motion.div>
                )}
              </AnimatePresence>
            </form>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
