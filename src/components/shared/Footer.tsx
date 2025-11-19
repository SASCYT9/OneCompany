"use client";

import React, { useEffect, useRef } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { motion } from "framer-motion";
import { Instagram, Youtube, Facebook, Mail, ArrowUpRight } from "lucide-react";
import gsap from "gsap";
import { Logo } from "@/components/ui/Logo";

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
    <footer className="relative border-t border-white/5 bg-[#050505] text-white overflow-hidden">
      {/* Ambient Background */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-3xl h-[500px] bg-white/[0.02] blur-[120px] rounded-full" />
        <div className="absolute bottom-0 right-0 w-[500px] h-[500px] bg-blue-500/[0.03] blur-[100px] rounded-full" />
      </div>

      <div ref={scopeRef} className="relative mx-auto max-w-7xl px-6 pt-20 pb-12 sm:px-8 lg:px-12">
        
        {/* Main CTA Card */}
        <div
          ref={signatureRef}
          className="relative mb-20 overflow-hidden rounded-[2rem] border border-white/10 bg-white/[0.02] p-8 sm:p-12 lg:p-16 backdrop-blur-3xl"
        >
          <div className="absolute inset-0 bg-gradient-to-br from-white/[0.05] via-transparent to-transparent" />
          <div className="relative z-10 flex flex-col items-start justify-between gap-8 lg:flex-row lg:items-end">
            <div className="max-w-2xl space-y-6">
              <div className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/5 px-3 py-1 text-[10px] uppercase tracking-[0.2em] text-white/80 backdrop-blur-md">
                <span className="h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse" />
                {t('b2bWholesale')}
              </div>
              <h2 className="font-display text-3xl font-light leading-tight tracking-tight sm:text-4xl lg:text-5xl text-balance">
                {t('brandsFor')}
              </h2>
              <p className="text-sm text-white/60 sm:text-base max-w-lg leading-relaxed">
                {t('aboutText')}
              </p>
            </div>
            
            <div className="flex flex-col gap-4 sm:flex-row">
              <Link 
                href={`/${locale}/contact`}
                className="group relative inline-flex items-center justify-center gap-3 overflow-hidden rounded-full bg-white px-8 py-4 text-sm font-medium text-black transition-transform duration-300 hover:scale-105"
              >
                <span className="uppercase tracking-widest">{t('contactUs')}</span>
                <ArrowUpRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1 group-hover:-translate-y-1" />
              </Link>
              <a 
                href="mailto:info@onecompany.global"
                className="group inline-flex items-center justify-center gap-3 rounded-full border border-white/20 bg-white/5 px-8 py-4 text-sm font-medium text-white transition-all duration-300 hover:bg-white/10 hover:border-white/40"
              >
                <Mail className="h-4 w-4" />
                <span className="uppercase tracking-widest">info@onecompany.global</span>
              </a>
            </div>
          </div>
        </div>

        <div className="grid gap-12 lg:grid-cols-12 lg:gap-8 border-t border-white/10 pt-16">
          {/* Brand Column */}
          <div className="lg:col-span-4 space-y-6">
            <Link href={`/${locale}`} className="block" aria-label="OneCompany Home">
              <Logo tone="light" className="w-40" />
            </Link>
            <p className="text-sm leading-relaxed text-white/50 max-w-xs">
              {t('description')}
            </p>
            <div className="flex gap-4 pt-2">
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
            <h3 className="text-xs font-semibold uppercase tracking-[0.2em] text-white/40">{t('company')}</h3>
            <ul className="space-y-4">
              {footerLinks.company.map((link) => (
                <li key={link.name}>
                  <Link className="text-sm text-white/70 transition-colors hover:text-white hover:underline decoration-white/30 underline-offset-4" href={link.href}>
                    {link.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div className="lg:col-span-2 space-y-6">
            <h3 className="text-xs font-semibold uppercase tracking-[0.2em] text-white/40">{t('disciplines')}</h3>
            <ul className="space-y-4">
              {footerLinks.services.map((link) => (
                <li key={link.name}>
                  <Link className="text-sm text-white/70 transition-colors hover:text-white hover:underline decoration-white/30 underline-offset-4" href={link.href}>
                    {link.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div className="lg:col-span-3 space-y-6">
            <h3 className="text-xs font-semibold uppercase tracking-[0.2em] text-white/40">{t('headquarters')}</h3>
            <div className="space-y-4 text-sm text-white/70">
              <p className="leading-relaxed">
                {t('addressLine1')}<br />
                {t('addressLine2')}<br />
                {t('addressLine3')}
              </p>
              <div className="space-y-2">
                <a href="tel:+380442781234" className="block transition-colors hover:text-white">
                  +380 (44) 278 12 34
                </a>
                <p className="text-xs text-white/40">{t('workingHours')}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="mt-20 flex flex-col items-center justify-between gap-6 border-t border-white/5 pt-8 text-xs text-white/40 sm:flex-row">
          <p>© {new Date().getFullYear()} OneCompany. {t('engineeredIn')}.</p>
          <div className="flex gap-8">
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
