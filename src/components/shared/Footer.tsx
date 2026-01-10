"use client";

import React, { useEffect, useRef } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { motion } from "framer-motion";
import { Instagram, Facebook } from "lucide-react";
import gsap from "gsap";
import { Logo } from "@/components/ui/Logo";
import { getTypography, resolveLocale } from "@/lib/typography";

const Footer = () => {
  const params = useParams();
  const locale = (params?.locale as string) || "en";
  const t = useTranslations("footer");
  const typography = getTypography(resolveLocale(locale));

  const footerLinks = {
    company: [
      { name: t('home'), href: `/${locale}` },
      { name: t('about'), href: `/${locale}/about` },
      { name: t('contact'), href: `/${locale}/contact` },
    ],
    services: [
      { name: t('automotive'), href: `/${locale}/auto` },
      { name: t('motorcycles'), href: `/${locale}/moto` },
    ],
  };

  const socials = [
    { icon: Instagram, href: "https://www.instagram.com/onecompany.global?igsh=N3JrZDEzaDJmdXho&utm_source=qr", label: "Instagram" },
    { icon: Facebook, href: "https://facebook.com/onecompany", label: "Facebook" },
    { 
      icon: (props: React.SVGProps<SVGSVGElement>) => (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          {...props}
        >
          <path d="M15 10l-4 4l6 6l4 -16l-18 7l4 2l2 6l3 -4" />
        </svg>
      ),
      href: "https://t.me/OneCompanyAutoBot", 
      label: "Telegram Bot" 
    },
  ];

  const scopeRef = useRef<HTMLDivElement | null>(null);
  const gradientRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const ctx = gsap.context(() => {
      if (gradientRef.current) {
        gsap.fromTo(
          gradientRef.current,
          { opacity: 0, y: 80, scale: 0.92 },
          { opacity: 0.9, y: 0, scale: 1, duration: 1.3, ease: "power3.out" }
        );
      }
    }, scopeRef);

    return () => ctx.revert();
  }, []);

  return (
    <footer className="relative z-20 font-display border-t border-white/5 bg-black text-white overflow-hidden">
      {/* Ambient Background */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-3xl h-[500px] bg-white/[0.02] blur-[120px] rounded-full" />
        <div className="absolute bottom-0 right-0 w-[500px] h-[500px] bg-blue-500/[0.03] blur-[100px] rounded-full" />
      </div>

      <div ref={scopeRef} className="relative mx-auto max-w-7xl px-6 pt-12 pb-8 sm:px-8 sm:pt-20 sm:pb-12 lg:px-12">
        
        <div className="grid gap-8 sm:gap-12 lg:grid-cols-12 lg:gap-8 border-t border-white/10 pt-12 sm:pt-16 text-center lg:text-left">
          {/* Brand Column */}
          <div className="lg:col-span-4 space-y-6">
            <Link href={`/${locale}`} className="block" aria-label="OneCompany Home">
              <Logo tone="light" className="w-40 mx-auto lg:mx-0" />
            </Link>
            <p className={`leading-relaxed text-white/50 max-w-xs mx-auto lg:mx-0 ${typography.body}`}>
              {t('description')}
            </p>
            <div className="flex gap-4 pt-2 justify-center lg:justify-start">
              {socials.map(({ icon: Icon, href, label }) => (
                <motion.a
                  key={label}
                  href={href}
                  target="_blank"
                  rel="noreferrer"
                  whileHover={{ y: -3 }}
                  className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/5 text-white/70 transition-colors hover:border-white/30 hover:bg-white/10 hover:text-white"
                  aria-label={label}
                >
                  <Icon className="h-4 w-4" />
                </motion.a>
              ))}
            </div>
          </div>

          {/* Links Columns */}
          <div className="lg:col-span-2 lg:col-start-6 space-y-6">
            <h3 className="text-[10px] font-semibold uppercase tracking-[0.2em] text-white/70">{t('company')}</h3>
            <ul className="space-y-4">
              {footerLinks.company.map((link) => (
                <li key={link.name}>
                  <Link className={`text-white/70 transition-colors hover:text-white hover:underline decoration-white/30 underline-offset-4 ${typography.body}`} href={link.href}>
                    {link.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div className="lg:col-span-2 space-y-6">
            <h3 className="text-[10px] font-semibold uppercase tracking-[0.2em] text-white/70">{t('disciplines')}</h3>
            <ul className="space-y-4">
              {footerLinks.services.map((link) => (
                <li key={link.name}>
                  <Link className={`text-white/70 transition-colors hover:text-white hover:underline decoration-white/30 underline-offset-4 ${typography.body}`} href={link.href}>
                    {link.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div className="lg:col-span-3 space-y-6">
            <h3 className="text-[10px] font-semibold uppercase tracking-[0.2em] text-white/70">{t('headquarters')}</h3>
            <div className={`space-y-4 text-white/70 ${typography.body}`}>
              <p className="leading-relaxed">
                {t('addressLine1')}<br />
                {t('addressLine2')}<br />
                {t('addressLine3')}
              </p>
              <div className="space-y-2">
                <a href="tel:+380660771700" className="block transition-colors hover:text-white">
                  +380 66 077 17 00
                </a>
                <p className="text-white/60">{t('workingHours')}</p>
              </div>
              
              {/* Map Embed */}
              <div className="h-32 w-full overflow-hidden rounded-md border border-white/10 bg-white/5 grayscale opacity-80 hover:grayscale-0 hover:opacity-100 transition-all duration-500">
                <iframe 
                  width="100%" 
                  height="100%" 
                  title="OneCompany Location"
                  src="https://maps.google.com/maps?q=21B%20Baseina%20St%2C%20Kyiv%2C%20Ukraine&t=&z=15&ie=UTF8&iwloc=&output=embed" 
                  style={{ border: 0 }}
                  loading="lazy"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className={`mt-12 sm:mt-20 flex flex-col items-center justify-between gap-6 border-t border-white/5 pt-8 text-white/60 sm:flex-row ${typography.body}`}>
          <p className="text-center sm:text-left">© {new Date().getFullYear()} One Company. {t('engineeredIn')}.</p>
          <div className="flex flex-wrap justify-center gap-4 sm:gap-8">
            <Link href={`/${locale}/privacy`} className="transition-colors hover:text-white">
              {t('privacy')}
            </Link>
            <Link href={`/${locale}/terms`} className="transition-colors hover:text-white">
              {t('terms')}
            </Link>
            <Link href={`/${locale}/cookies`} className="transition-colors hover:text-white">
              {t('cookies')}
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
