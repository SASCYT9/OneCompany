"use client";

import React, { useEffect, useRef } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { motion } from "framer-motion";
import { Instagram, Youtube, Facebook, Mail } from "lucide-react";
import gsap from "gsap";

const Footer = () => {
  const params = useParams();
  const locale = (params?.locale as string) || "en";

  const footerLinks = {
    company: [
      { name: "About", href: `/${locale}/about` },
      { name: "Brands", href: `/${locale}/brands` },
      { name: "Contact", href: `/${locale}/contact` },
    ],
    services: [
      { name: "Automotive", href: `/${locale}/auto` },
      { name: "Moto", href: `/${locale}/moto` },
      { name: "Showcase", href: `/${locale}/showcase` },
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
    <footer className="relative -mt-8 border-t border-white/5 bg-transparent">
      <div className="pointer-events-none absolute inset-x-0 -top-48 h-48 bg-gradient-to-b from-transparent via-[#080808] to-[#050505]" aria-hidden />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(255,179,71,0.12),_transparent_55%)]" aria-hidden />
      <div ref={scopeRef} className="relative mx-auto max-w-6xl px-6 py-16">
        <div
          ref={gradientRef}
          aria-hidden
          className="pointer-events-none -mt-16 mb-10 h-28 w-full rounded-[999px] bg-gradient-to-r from-[#1f1610] via-[#1c120d] to-[#1a110d] opacity-80 shadow-[0_0_60px_rgba(255,179,71,0.25)] blur-3xl"
        />
        <div
          ref={signatureRef}
          id="signature-programs"
          className="mb-16 rounded-[36px] border border-white/10 bg-[radial-gradient(circle_at_top,_rgba(255,255,255,0.08),_rgba(5,5,5,0.85))] p-8 text-center backdrop-blur-2xl"
        >
          <p className="text-sm uppercase tracking-[0.4em] text-white/60">Signature Programs</p>
          <div className="mt-4 text-3xl font-light text-white md:text-4xl">
            Atelier-tier support for KW, Fi, Eventuri
          </div>
          <div className="mt-4 space-y-1 text-[11px] uppercase tracking-[0.35em] text-white/65">
            <p>services worldwide since 2007</p>
            <p className="text-white">200+ brands premium tuning parts</p>
          </div>
          <div className="mt-6 inline-flex items-center gap-3 rounded-full border border-white/20 bg-white/10 px-6 py-3 text-xs font-semibold uppercase tracking-[0.35em] text-white">
            <Mail className="h-4 w-4" /> concierge@onecompany.com
          </div>
        </div>

        <div className="grid gap-10 md:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-6">
            <Link href={`/${locale}`} className="inline-flex text-3xl font-light tracking-tight text-white">
              OneCompany
            </Link>
            <p className="text-sm text-white/60">
              Services worldwide since 2007. Curating over 200 marques with atelier logistics, homologation guidance, and lifetime concierge.
            </p>
            <div className="flex gap-3">
              {socials.map(({ icon: Icon, href, label }) => (
                <motion.a
                  key={label}
                  href={href}
                  target="_blank"
                  rel="noreferrer"
                  whileHover={{ scale: 1.08 }}
                  whileTap={{ scale: 0.95 }}
                  className="flex h-10 w-10 items-center justify-center rounded-full border border-white/15 bg-white/5 text-white/80 transition hover:border-white/40 hover:bg-white/20"
                  aria-label={label}
                >
                  <Icon className="h-4 w-4" />
                </motion.a>
              ))}
            </div>
          </div>

          <div className="space-y-4">
            <p className="text-xs uppercase tracking-[0.35em] text-white/50">The House</p>
            <ul className="space-y-3 text-sm text-white/70">
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
            <p className="text-xs uppercase tracking-[0.35em] text-white/50">Disciplines</p>
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
            <p className="text-xs uppercase tracking-[0.35em] text-white/50">Studio</p>
            <div className="space-y-3 text-sm text-white/70">
              <p>
                21B Baseina St
                <br />Kyiv, 01004
                <br />Ukraine
              </p>
              <a href="tel:+380442781234" className="block transition hover:text-white">
                +380 (44) 278 12 34
              </a>
              <a href="mailto:info@onecompany.com" className="block transition hover:text-white">
                info@onecompany.com
              </a>
            </div>
          </div>
        </div>

        <div className="mt-16 flex flex-col gap-4 border-t border-white/10 pt-6 text-xs text-white/50 md:flex-row md:items-center md:justify-between">
          <p>© {new Date().getFullYear()} OneCompany. Engineered in Kyiv.</p>
          <div className="flex gap-6">
            <Link href={`/${locale}/privacy`} className="transition hover:text-white">
              Privacy
            </Link>
            <Link href={`/${locale}/terms`} className="transition hover:text-white">
              Terms
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
