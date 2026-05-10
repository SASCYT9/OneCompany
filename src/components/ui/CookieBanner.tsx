"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { X, Cookie, Shield } from "lucide-react";

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
  }
}

const translations = {
  en: {
    title: "We use cookies",
    description:
      'We use cookies to enhance your browsing experience, analyze site traffic, and personalize content. By clicking "Accept All", you consent to our use of cookies.',
    acceptAll: "Accept All",
    acceptNecessary: "Only Necessary",
    learnMore: "Learn more",
    privacyLink: "/en/cookies",
  },
  ua: {
    title: "Ми використовуємо cookies",
    description:
      'Ми використовуємо cookies для покращення роботи сайту, аналізу трафіку та персоналізації контенту. Натискаючи "Прийняти все", ви погоджуєтесь з використанням cookies.',
    acceptAll: "Прийняти все",
    acceptNecessary: "Тільки необхідні",
    learnMore: "Дізнатись більше",
    privacyLink: "/ua/cookies",
  },
};

interface CookieBannerProps {
  locale?: string;
}

export default function CookieBanner({ locale = "ua" }: CookieBannerProps) {
  const pathname = usePathname();
  const [isVisible, setIsVisible] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);

  const isShopRoute = pathname ? /^\/(ua|en)\/shop(?:\/|$)/.test(pathname) : false;
  const t = translations[locale as keyof typeof translations] || translations.ua;

  useEffect(() => {
    if (isShopRoute) {
      setIsVisible(false);
      setIsAnimating(false);
      return;
    }

    // Check if user has already made a choice
    const consent = localStorage.getItem("cookie-consent");
    if (!consent) {
      // Small delay before showing banner for better UX
      const timer = setTimeout(() => {
        setIsVisible(true);
        setTimeout(() => setIsAnimating(true), 50);
      }, 1500);
      return () => clearTimeout(timer);
    } else {
      // Restore previous consent for GA4 Consent Mode v2
      try {
        const parsed = JSON.parse(consent);
        if (parsed.analytics && typeof window.gtag === "function") {
          window.gtag("consent", "update", {
            analytics_storage: "granted",
            ad_storage: parsed.marketing ? "granted" : "denied",
            ad_user_data: parsed.marketing ? "granted" : "denied",
            ad_personalization: parsed.marketing ? "granted" : "denied",
          });
        }
      } catch {
        // Invalid consent data, ignore
      }
    }
  }, [isShopRoute]);

  const handleAccept = (type: "all" | "necessary") => {
    const consent = {
      necessary: true,
      analytics: type === "all",
      marketing: type === "all",
      timestamp: new Date().toISOString(),
    };
    localStorage.setItem("cookie-consent", JSON.stringify(consent));

    // Update GA4 Consent Mode v2
    if (typeof window !== "undefined" && typeof window.gtag === "function") {
      if (type === "all") {
        window.gtag("consent", "update", {
          analytics_storage: "granted",
          ad_storage: "granted",
          ad_user_data: "granted",
          ad_personalization: "granted",
        });
      } else {
        window.gtag("consent", "update", {
          analytics_storage: "denied",
          ad_storage: "denied",
          ad_user_data: "denied",
          ad_personalization: "denied",
        });
      }
    }

    // Animate out
    setIsAnimating(false);
    setTimeout(() => setIsVisible(false), 300);
  };

  if (isShopRoute || !isVisible) return null;

  return (
    <div
      className={`fixed bottom-0 left-0 right-0 z-9999 p-2 sm:p-4 transition-all duration-300 ease-out ${
        isAnimating ? "translate-y-0 opacity-100" : "translate-y-full opacity-0"
      }`}
    >
      <div className="max-w-4xl mx-auto">
        <div className="bg-card/95 backdrop-blur-xl border border-foreground/15 rounded-xl sm:rounded-2xl shadow-2xl overflow-hidden">
          {/* Gradient accent line */}
          <div className="h-px bg-linear-to-r from-transparent via-foreground/30 to-transparent" />

          <div className="p-4 sm:p-6">
            <div className="flex items-start gap-3 sm:gap-4">
              {/* Icon - hidden on mobile */}
              <div className="hidden sm:flex items-center justify-center w-12 h-12 rounded-xl bg-foreground/5 border border-foreground/15 shrink-0">
                <Cookie className="w-6 h-6 text-foreground/65" />
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1.5 sm:mb-2">
                  <h3 className="text-foreground font-semibold text-base sm:text-lg">{t.title}</h3>
                  <Shield className="w-4 h-4 text-foreground/55 hidden xs:block" />
                </div>

                <p className="text-foreground/75 text-xs sm:text-sm leading-relaxed mb-3 sm:mb-4">
                  {t.description}{" "}
                  <Link
                    href={t.privacyLink}
                    className="text-primary hover:text-primary/80 underline underline-offset-2 transition-colors"
                  >
                    {t.learnMore}
                  </Link>
                </p>

                {/* Buttons - stack on mobile */}
                <div className="flex flex-col xs:flex-row gap-2 sm:gap-3">
                  <button
                    onClick={() => handleAccept("all")}
                    className="w-full xs:w-auto px-5 sm:px-6 py-2.5 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold text-sm sm:text-base rounded-xl transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]"
                  >
                    {t.acceptAll}
                  </button>

                  <button
                    onClick={() => handleAccept("necessary")}
                    className="w-full xs:w-auto px-5 sm:px-6 py-2.5 bg-foreground/5 hover:bg-foreground/10 text-foreground/80 hover:text-foreground font-medium text-sm sm:text-base rounded-xl border border-foreground/15 transition-all duration-200"
                  >
                    {t.acceptNecessary}
                  </button>
                </div>
              </div>

              {/* Close button (accepts necessary only) */}
              <button
                onClick={() => handleAccept("necessary")}
                className="p-1.5 sm:p-2 text-foreground/55 hover:text-foreground hover:bg-foreground/10 rounded-lg transition-colors shrink-0"
                aria-label="Close"
              >
                <X className="w-4 h-4 sm:w-5 sm:h-5" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
