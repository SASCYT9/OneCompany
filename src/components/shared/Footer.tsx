"use client";

import React from 'react';
import Link from 'next/link';
import { useParams } from "next/navigation";
import { motion } from "framer-motion";
import { Instagram, Youtube, Facebook, Mail } from "lucide-react";

const Footer = () => {
  const params = useParams();
  const locale = params?.locale || 'ua';

  const footerLinks = {
    company: [
      { name: "About Us", href: `/${locale}/about` },
      { name: "Brands", href: `/${locale}/brands` },
      { name: "Contact", href: `/${locale}/contact` },
    ],
    categories: [
      { name: "Automotive", href: `/${locale}/brands` },
      { name: "Motorcycle", href: `/${locale}/brands/moto` },
    ],
  };

  return (
    <footer className="bg-zinc-50 dark:bg-zinc-950 border-t border-zinc-200 dark:border-white/10">
      <div className="max-w-7xl mx-auto px-6 md:px-10 py-20">
        {/* Main Footer Content */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-12 lg:gap-16 mb-16">
          {/* Brand Column */}
          <div className="lg:col-span-1">
            <Link href={`/${locale}`} className="inline-block mb-6">
              <h2 className="text-2xl font-extralight tracking-tight text-zinc-900 dark:text-white">
                OneCompany
              </h2>
            </Link>
            <p className="text-sm font-light text-zinc-600 dark:text-white/50 leading-relaxed mb-6">
              Premium automotive performance solutions from over 200 trusted brands worldwide.
            </p>
            <div className="flex gap-4">
              <motion.a
                href="https://instagram.com/onecompany"
                target="_blank"
                rel="noopener noreferrer"
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.95 }}
                className="p-2 bg-zinc-200 dark:bg-zinc-900/50 text-zinc-900 dark:text-white hover:bg-zinc-300 dark:hover:bg-zinc-900 transition-colors"
                aria-label="Instagram"
              >
                <Instagram className="w-5 h-5" />
              </motion.a>
              <motion.a
                href="https://youtube.com/@onecompany"
                target="_blank"
                rel="noopener noreferrer"
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.95 }}
                className="p-2 bg-zinc-200 dark:bg-zinc-900/50 text-zinc-900 dark:text-white hover:bg-zinc-300 dark:hover:bg-zinc-900 transition-colors"
                aria-label="YouTube"
              >
                <Youtube className="w-5 h-5" />
              </motion.a>
              <motion.a
                href="https://facebook.com/onecompany"
                target="_blank"
                rel="noopener noreferrer"
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.95 }}
                className="p-2 bg-zinc-200 dark:bg-zinc-900/50 text-zinc-900 dark:text-white hover:bg-zinc-300 dark:hover:bg-zinc-900 transition-colors"
                aria-label="Facebook"
              >
                <Facebook className="w-5 h-5" />
              </motion.a>
            </div>
          </div>

          {/* Company Links */}
          <div>
            <h3 className="text-sm uppercase tracking-widest text-zinc-900 dark:text-white mb-6 font-light">
              Company
            </h3>
            <ul className="space-y-4">
              {footerLinks.company.map((link) => (
                <li key={link.name}>
                  <Link
                    href={link.href}
                    className="text-sm font-light text-zinc-600 dark:text-white/50 hover:text-zinc-900 dark:hover:text-white transition-colors"
                  >
                    {link.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Categories Links */}
          <div>
            <h3 className="text-sm uppercase tracking-widest text-zinc-900 dark:text-white mb-6 font-light">
              Categories
            </h3>
            <ul className="space-y-4">
              {footerLinks.categories.map((link) => (
                <li key={link.name}>
                  <Link
                    href={link.href}
                    className="text-sm font-light text-zinc-600 dark:text-white/50 hover:text-zinc-900 dark:hover:text-white transition-colors"
                  >
                    {link.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Contact Info */}
          <div>
            <h3 className="text-sm uppercase tracking-widest text-zinc-900 dark:text-white mb-6 font-light">
              Contact
            </h3>
            <div className="space-y-4 text-sm font-light text-zinc-600 dark:text-white/50">
              <p className="leading-relaxed">
                Khreshchatyk St, 1<br />
                Kyiv, 01001<br />
                Ukraine
              </p>
              <p>
                <a href="tel:+380442781234" className="hover:text-zinc-900 dark:hover:text-white transition-colors">
                  +380 (44) 278 12 34
                </a>
              </p>
              <p>
                <a href="mailto:info@onecompany.com" className="hover:text-zinc-900 dark:hover:text-white transition-colors">
                  info@onecompany.com
                </a>
              </p>
            </div>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="pt-8 border-t border-zinc-200 dark:border-white/10">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <p className="text-xs font-light text-zinc-500 dark:text-white/40">
              © {new Date().getFullYear()} OneCompany. All rights reserved.
            </p>
            <div className="flex gap-6">
              <Link
                href={`/${locale}/privacy`}
                className="text-xs font-light text-zinc-500 dark:text-white/40 hover:text-zinc-900 dark:hover:text-white transition-colors"
              >
                Privacy Policy
              </Link>
              <Link
                href={`/${locale}/terms`}
                className="text-xs font-light text-zinc-500 dark:text-white/40 hover:text-zinc-900 dark:hover:text-white transition-colors"
              >
                Terms of Service
              </Link>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
