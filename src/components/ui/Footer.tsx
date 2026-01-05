'use client';

import Link from 'next/link';
import { useLanguage } from '@/lib/LanguageContext';

export function Footer() {
  const currentYear = new Date().getFullYear();
  const { t } = useLanguage();

  return (
    <footer className="bg-black border-t border-white/10 text-white font-display">
      <div className="container mx-auto px-6 py-16">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-12 mb-12">
          
          {/* About Section */}
          <div>
            <h3 className="text-xs tracking-[0.3em] uppercase text-white/40 font-light mb-6">
              {t.footer.about}
            </h3>
            <p className="text-sm text-white/60 font-light leading-relaxed">
              {t.footer.aboutText}
            </p>
            
            {/* Social Links */}
            <div className="flex gap-4 mt-6">
              <a 
                href="https://instagram.com" 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-white/40 hover:text-white transition-colors"
              >
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
                </svg>
              </a>
              <a 
                href="https://tiktok.com" 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-white/40 hover:text-white transition-colors"
              >
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5 20.1a6.34 6.34 0 0 0 10.86-4.43v-7a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1-.1z"/>
                </svg>
              </a>
            </div>
          </div>

          {/* Navigate Section */}
          <div>
            <h3 className="text-xs tracking-[0.3em] uppercase text-white/40 font-light mb-6">
              {t.footer.navigate}
            </h3>
            <ul className="space-y-3">
              <li>
                <Link href="/" className="text-sm text-white/60 hover:text-white transition-colors font-light">
                  {t.footer.home}
                </Link>
              </li>
              <li>
                <Link href="/auto" className="text-sm text-white/60 hover:text-white transition-colors font-light">
                  {t.footer.automotive}
                </Link>
              </li>
              <li>
                <Link href="/moto" className="text-sm text-white/60 hover:text-white transition-colors font-light">
                  {t.footer.motorcycles}
                </Link>
              </li>
              <li>
                <Link href="/about" className="text-sm text-white/60 hover:text-white transition-colors font-light">
                  {t.footer.aboutUs}
                </Link>
              </li>
            </ul>
          </div>

          {/* Contact Automotive */}
          <div>
            <h3 className="text-xs tracking-[0.3em] uppercase text-white/40 font-light mb-6">
              {t.footer.contactAuto}
            </h3>
            <div className="space-y-3 text-sm text-white/60 font-light">
              <p>{t.footer.premiumAutoParts}</p>
              <p>{t.footer.worldwideShipping}</p>
              <a href="tel:+380660771700" className="block hover:text-white transition-colors">
                +380 66 077 17 00
              </a>
              <Link href="/contact" className="block hover:text-white transition-colors">
                {t.footer.contactUs} →
              </Link>
            </div>
          </div>

          {/* Contact Motorcycles */}
          <div>
            <h3 className="text-xs tracking-[0.3em] uppercase text-white/40 font-light mb-6">
              {t.footer.contactMoto}
            </h3>
            <div className="space-y-3 text-sm text-white/60 font-light">
              <p>{t.footer.premiumMotoParts}</p>
              <p>{t.footer.worldwideShipping}</p>
              <a href="tel:+380660771700" className="block hover:text-white transition-colors">
                +380 66 077 17 00
              </a>
              <Link href="/contact" className="block hover:text-white transition-colors">
                {t.footer.contactUs} →
              </Link>
            </div>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="pt-8 border-t border-white/10">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <p className="text-xs text-white/40 font-light">
              © onecompany - {currentYear} | {t.footer.allRights}
            </p>
            
            <div className="flex gap-6 text-xs text-white/40 font-light">
              <Link href="/privacy" className="hover:text-white transition-colors">
                {t.footer.privacy}
              </Link>
              <Link href="/terms" className="hover:text-white transition-colors">
                {t.footer.terms}
              </Link>
              <Link href="/cookies" className="hover:text-white transition-colors">
                {t.footer.cookies}
              </Link>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
