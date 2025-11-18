"use client";

import React, { useEffect, useRef } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { motion } from "framer-motion";
import { Instagram, Youtube, Facebook, Mail } from "lucide-react";
import gsap from "gsap";

const Footer = () => {
  const params = useParams();
  const locale = (params?.locale as string) || "en";
  const t = useTranslations("footer");

  const footerLinks = {
    company: [
      { name: t('home'), href: `/${locale}` },
      { name: t('about'), href: `/${locale}/about` },
      { name: t('brands'), href: `/${locale}/brands` },
      { name: t('contact'), href: `/${locale}/contact` },
    ],
    services: [
      { name: t('automotive'), href: `/${locale}/auto` },
      { name: t('motorcycles'), href: `/${locale}/moto` },
    ],
  };

  const socials = [
    { icon: Instagram, href: "https://instagram.com/onecompany", label: "Instagram" },
    { icon: Youtube, href: "https://youtube.com/@onecompany", label: "YouTube" },
    { icon: Facebook, href: "https://facebook.com/onecompany", label: "Facebook" },
  ];

  const scopeRef = useRef<HTMLDivElement | null>(null);
  const gradientRef = useRef<HTMLDivElement | null>(null);
  const signatureRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const ctx = gsap.context(() => {
      if (gradientRef.current) {
        gsap.fromTo(
          gradientRef.current,
          { opacity: 0, y: 80, scale: 0.92 },
          { opacity: 0.9, y: 0, scale: 1, duration: 1.3, ease: "power3.out" }
        );
      }
      if (signatureRef.current) {
        gsap.fromTo(
          signatureRef.current,
          { opacity: 0, y: 110, filter: "blur(14px)" },
          { opacity: 1, y: 0, filter: "blur(0px)", duration: 1.5, ease: "power4.out", delay: 0.1 }
        );
      }
    }, scopeRef);

    return () => ctx.revert();
  }, []);

  return (
    <footer className="relative -mt-8 border-t border-white/10 bg-black/90 backdrop-blur-xl">
      <div className="pointer-events-none absolute inset-x-0 -top-48 h-48 bg-gradient-to-b from-transparent via-[#080808] to-[#050505]" aria-hidden />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(255,255,255,0.03),_transparent_55%)]" aria-hidden />
      <div ref={scopeRef} className="relative mx-auto max-w-6xl px-6 py-16">
        <div
          ref={gradientRef}
          aria-hidden
          className="pointer-events-none -mt-16 mb-10 h-28 w-full rounded-[999px] bg-gradient-to-r from-white/5 via-white/2 to-transparent opacity-80 shadow-[0_0_60px_rgba(255,255,255,0.05)] blur-3xl"
        />
        <div
          ref={signatureRef}
          id="concierge-programs"
          className="mb-10 rounded-2xl border border-white/10 bg-[radial-gradient(circle_at_top,_rgba(255,255,255,0.08),_rgba(5,5,5,0.85))] p-5 text-center backdrop-blur-2xl sm:mb-16 sm:rounded-[36px] sm:p-8"
        >
          <p className="text-xs uppercase tracking-[0.3em] text-white/60 sm:text-sm sm:tracking-[0.4em]">{t('b2bWholesale')}</p>
          <div className="mt-3 text-xl font-light leading-tight text-white sm:mt-4 sm:text-2xl md:text-3xl lg:text-4xl">
            {t('brandsFor')}
          </div>
          <p className="mt-2 text-xs text-white/60 sm:text-sm">{t('conciergeB2C')}</p>
          <div className="mt-3 space-y-1 text-[9px] uppercase tracking-[0.25em] text-white/65 sm:mt-4 sm:text-[11px] sm:tracking-[0.35em]">
            <p>{t('servicesSince')}</p>
            <p className="text-white">{t('premiumParts')}</p>
          </div>
          <div className="mt-4 inline-flex flex-col items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-2.5 text-[10px] font-semibold uppercase tracking-[0.25em] text-white sm:mt-6 sm:flex-row sm:gap-3 sm:px-6 sm:py-3 sm:text-xs sm:tracking-[0.35em]">
            <Mail className="h-3 w-3 sm:h-4 sm:w-4" />
            <span className="break-all text-center">info@onecompany.global</span>
          </div>
        </div>

        <div className="grid gap-8 sm:grid-cols-2 sm:gap-10 lg:grid-cols-4">
          <div className="space-y-4 sm:space-y-6">
            <Link href={`/${locale}`} className="inline-flex text-2xl font-light tracking-tight text-white sm:text-3xl">
              OneCompany
            </Link>
            <p className="text-xs leading-relaxed text-white/60 sm:text-sm">
              {t('description')}
            </p>
            <div className="flex gap-2 sm:gap-3">
              {socials.map(({ icon: Icon, href, label }) => (
                <motion.a
                  key={label}
                  href={href}
                  target="_blank"
                  rel="noreferrer"
                  whileHover={{ scale: 1.08 }}
                  whileTap={{ scale: 0.95 }}
                  className="flex h-9 w-9 items-center justify-center rounded-full border border-white/15 bg-white/5 text-white/80 transition hover:border-white/40 hover:bg-white/20 sm:h-10 sm:w-10"
                  aria-label={label}
                >
                  <Icon className="h-4 w-4" />
                </motion.a>
              ))}
            </div>
          </div>

          <div className="space-y-3 sm:space-y-4">
            <p className="text-[10px] uppercase tracking-[0.25em] text-white/50 sm:text-xs sm:tracking-[0.35em]">{t('company')}</p>
            <ul className="space-y-2 text-xs text-white/70 sm:space-y-3 sm:text-sm">
              {footerLinks.company.map((link) => (
                <li key={link.name}>
                  <Link className="transition hover:text-white" href={link.href}>
                    {link.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div className="space-y-4">
            <p className="text-xs uppercase tracking-[0.35em] text-white/50">{t('disciplines')}</p>
            <ul className="space-y-3 text-sm text-white/70">
              {footerLinks.services.map((link) => (
                <li key={link.name}>
                  <Link className="transition hover:text-white" href={link.href}>
                    {link.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div className="space-y-4">
            <p className="text-xs uppercase tracking-[0.35em] text-white/50">{t('headquarters')}</p>
            <div className="space-y-3 text-sm text-white/70">
              <p>
                21B Baseina St
                <br />Kyiv, 01004
                <br />Ukraine
              </p>
              <a href="tel:+380442781234" className="block transition hover:text-white">
                +380 (44) 278 12 34
              </a>
              <a href="mailto:info@onecompany.global" className="block transition hover:text-white">
                info@onecompany.global
              </a>
            </div>
          </div>
        </div>

        <div className="mt-10 flex flex-col gap-3 border-t border-white/10 pt-4 text-[10px] text-white/50 sm:mt-16 sm:gap-4 sm:pt-6 sm:text-xs md:flex-row md:items-center md:justify-between">
          <p>© {new Date().getFullYear()} OneCompany. {t('engineeredIn')}.</p>
          <div className="flex gap-4 sm:gap-6">
            <Link href={`/${locale}/privacy`} className="transition hover:text-white">
              {t('privacy')}
            </Link>
            <Link href={`/${locale}/terms`} className="transition hover:text-white">
              {t('terms')}
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
