'use client';

import { useLanguage } from '@/lib/LanguageContext';

export default function AboutPage() {
  const { t } = useLanguage();
  return (
    <div className="min-h-screen bg-black text-white flex items-center justify-center px-6">
      <div className="max-w-2xl text-center">
        <h1 className="text-5xl font-light mb-6">onecompany</h1>
        <p className="text-white/60 leading-relaxed font-light">
          Premium performance ecosystem. This placeholder About page will be expanded with mission, brand partnerships, and service philosophy.
        </p>
      </div>
    </div>
  );
}
