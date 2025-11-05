'use client';

import Link from 'next/link';

interface FooterProps {
  brand?: 'kw' | 'fi' | 'eventuri';
}

export function Footer({ brand }: FooterProps) {
  const getBrandGradient = () => {
    switch (brand) {
      case 'kw': return 'from-orange-500 to-amber-600';
      case 'fi': return 'from-red-500 to-rose-600';
      case 'eventuri': return 'from-blue-500 to-cyan-600';
      default: return 'from-amber-400 to-amber-600';
    }
  };

  const currentYear = new Date().getFullYear();

  return (
    <footer className="relative bg-black border-t border-white/10">
      {/* Gradient line */}
      <div className={`h-1 bg-gradient-to-r ${getBrandGradient()}`} />

      <div className="max-w-7xl mx-auto px-6 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-8">
          {/* OneCompany */}
          <div>
            <h3 className="text-xl font-light mb-4">
              <span className="bg-gradient-to-r from-amber-200 to-amber-400 bg-clip-text text-transparent">
                one
              </span>
              <span className="text-white">company</span>
            </h3>
            <p className="text-white/60 text-sm leading-relaxed">
              Три бренди. Одна філософія. Преміум автотюнінг світового рівня.
            </p>
          </div>

          {/* Brands */}
          <div>
            <h4 className="text-white font-medium mb-4">Наші бренди</h4>
            <ul className="space-y-2">
              <li>
                <Link href="/kw" className="text-white/60 hover:text-amber-400 transition-colors text-sm">
                  KW Suspension
                </Link>
              </li>
              <li>
                <Link href="/fi" className="text-white/60 hover:text-red-400 transition-colors text-sm">
                  Fi Exhaust
                </Link>
              </li>
              <li>
                <Link href="/eventuri" className="text-white/60 hover:text-blue-400 transition-colors text-sm">
                  Eventuri
                </Link>
              </li>
            </ul>
          </div>

          {/* Info */}
          <div>
            <h4 className="text-white font-medium mb-4">Інформація</h4>
            <ul className="space-y-2">
              <li>
                <Link href="/about" className="text-white/60 hover:text-white transition-colors text-sm">
                  Про нас
                </Link>
              </li>
              <li>
                <Link href="/delivery" className="text-white/60 hover:text-white transition-colors text-sm">
                  Доставка
                </Link>
              </li>
              <li>
                <Link href="/warranty" className="text-white/60 hover:text-white transition-colors text-sm">
                  Гарантія
                </Link>
              </li>
              <li>
                <Link href="/contacts" className="text-white/60 hover:text-white transition-colors text-sm">
                  Контакти
                </Link>
              </li>
            </ul>
          </div>

          {/* Contacts */}
          <div>
            <h4 className="text-white font-medium mb-4">Контакти</h4>
            <ul className="space-y-2 text-sm text-white/60">
              <li>
                <a href="tel:+380000000000" className="hover:text-white transition-colors">
                  +380 (00) 000-00-00
                </a>
              </li>
              <li>
                <a href="mailto:info@onecompany.ua" className="hover:text-white transition-colors">
                  info@onecompany.ua
                </a>
              </li>
              <li className="pt-2">
                <div className="flex gap-4">
                  <a href="#" className="hover:text-white transition-colors">Instagram</a>
                  <a href="#" className="hover:text-white transition-colors">Facebook</a>
                  <a href="#" className="hover:text-white transition-colors">YouTube</a>
                </div>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom */}
        <div className="pt-8 border-t border-white/10 flex flex-col md:flex-row justify-between items-center gap-4">
          <p className="text-white/40 text-sm">
            © {currentYear} OneCompany. Усі права захищено.
          </p>
          <div className="flex gap-6 text-sm text-white/40">
            <Link href="/privacy" className="hover:text-white transition-colors">
              Політика конфіденційності
            </Link>
            <Link href="/terms" className="hover:text-white transition-colors">
              Умови використання
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
