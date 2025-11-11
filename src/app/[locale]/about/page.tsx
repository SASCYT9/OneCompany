import { useTranslations } from 'next-intl';

export default function AboutPage() {
  const t = useTranslations('about');
  return (
    <div className="min-h-screen bg-black text-white flex items-center justify-center px-6">
      <div className="max-w-2xl text-center">
        <h1 className="text-5xl font-light mb-6">onecompany</h1>
        <p className="text-white/60 leading-relaxed font-light">
          {t('intro')}
        </p>
      </div>
    </div>
  );
}
