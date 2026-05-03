'use client';

import React from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { Globe, Wrench, Users, Search } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useParams } from 'next/navigation';
import { trackEvent } from '@/lib/analytics';
import { absoluteUrl, buildLocalizedPath, resolveLocale } from '@/lib/seo';

const AboutPage: React.FC = () => {
  const t = useTranslations('aboutPage');
  const params = useParams();
  const locale = resolveLocale((params?.locale as string) || undefined);
  const storyParagraphs = t.raw('storyParagraphs') as string[];
  const aboutUrl = absoluteUrl(buildLocalizedPath(locale, 'about'));
  const contactPath = buildLocalizedPath(locale, 'contact');
  const contactUrl = absoluteUrl(contactPath);
  const aboutSchema = {
    '@context': 'https://schema.org',
    '@type': 'AboutPage',
    name: t('title'),
    description: t('heroSubtitle'),
    url: aboutUrl,
    mainEntityOfPage: aboutUrl,
    primaryTopic: {
      '@type': 'Organization',
      name: 'onecompany',
      url: aboutUrl,
      email: 'info@onecompany.com',
      telephone: '+380123456789',
      sameAs: ['https://kwsuspension.shop/', 'https://fiexhaust.shop/', 'https://eventuri.shop/'],
      address: {
        '@type': 'PostalAddress',
        streetAddress: '21B Baseina St',
        addressLocality: 'Kyiv',
        addressCountry: 'UA',
      },
      areaServed: ['Europe', 'North America', 'Middle East', 'Asia'],
    },
    potentialAction: {
      '@type': 'CommunicateAction',
      target: contactUrl,
      name: t('ctaButton'),
    },
  };

  const values = [
    {
      icon: <Search className="w-8 h-8" />,
      title: t('info.selectionTitle'),
      description: t('info.selectionDesc'),
    },
    {
      icon: <Users className="w-8 h-8" />,
      title: t('info.expertHelpTitle'),
      description: t('info.expertHelpDesc'),
    },
    {
      icon: <Wrench className="w-8 h-8" />,
      title: t('info.partnerNetworkTitle'),
      description: t('info.partnerNetworkDesc'),
    },
    {
      icon: <Globe className="w-8 h-8" />,
      title: t('info.worldwideDeliveryTitle'),
      description: t('info.worldwideDeliveryDesc'),
    },
  ];

  return (
    <div className="min-h-screen bg-white dark:bg-black">
      <script
        type="application/ld+json"
        suppressHydrationWarning
        dangerouslySetInnerHTML={{ __html: JSON.stringify(aboutSchema) }}
      />
      {/* Hero Section */}
      <section className="relative h-screen flex items-center justify-center overflow-hidden">
        {/* Background Image */}
        <div className="absolute inset-0 bg-zinc-900">
          <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-black/40 to-black/60 z-10" />
          {/* Placeholder for hero image - you can replace this with an actual image */}
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.1)_1px,transparent_1px)] bg-[size:24px_24px]" />
        </div>

        {/* Content */}
        <div className="relative z-20 text-center px-6">
          <motion.h1
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
            className="text-6xl md:text-8xl lg:text-9xl font-extralight tracking-tight text-white mb-6 leading-tight"
          >
            {t('title')}
          </motion.h1>
          <motion.div
            initial={{ opacity: 0, scaleX: 0 }}
            animate={{ opacity: 1, scaleX: 1 }}
            transition={{ duration: 0.8, delay: 0.2 }}
            className="w-32 h-px bg-white/40 mx-auto mb-8"
          />
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.4 }}
            className="text-xl md:text-2xl font-light text-white/70 max-w-3xl mx-auto"
          >
            {t('heroSubtitle')}
          </motion.p>
        </div>

        {/* Scroll Indicator */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1, duration: 0.8 }}
          className="absolute bottom-12 left-1/2 -translate-x-1/2 z-20"
        >
          <div className="w-6 h-10 border-2 border-white/30 rounded-full flex items-start justify-center p-2">
            <motion.div
              animate={{ y: [0, 12, 0] }}
              transition={{ duration: 1.5, repeat: Infinity }}
              className="w-1.5 h-1.5 bg-white/60 rounded-full"
            />
          </div>
        </motion.div>
      </section>

      {/* Story Section */}
      <section className="px-6 md:px-10 py-32 md:py-40">
        <div className="max-w-5xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8 }}
            className="mb-20"
          >
            <h2 className="text-4xl md:text-6xl font-extralight tracking-tight text-zinc-900 dark:text-white mb-8">
              {t('storyTitle')}
            </h2>
            <div className="w-24 h-px bg-zinc-300 dark:bg-white/20 mb-12" />
            <div className="space-y-6 text-lg md:text-xl font-light text-zinc-600 dark:text-white/60 leading-relaxed">
              {storyParagraphs.map((paragraph) => (
                <p key={paragraph}>{paragraph}</p>
              ))}
            </div>
          </motion.div>
        </div>
      </section>

      {/* Values Grid */}
      <section className="px-6 md:px-10 py-24 bg-zinc-50 dark:bg-zinc-950">
        <div className="max-w-7xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8 }}
            className="text-center mb-20"
          >
            <h2 className="text-4xl md:text-6xl font-extralight tracking-tight text-zinc-900 dark:text-white mb-6">
              {t('valuesTitle')}
            </h2>
            <div className="w-24 h-px bg-zinc-300 dark:bg-white/20 mx-auto" />
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-12 md:gap-16">
            {values.map((value, index) => (
              <motion.div
                key={value.title}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6, delay: index * 0.1 }}
                className="group"
              >
                <div className="flex flex-col items-start">
                  <div className="mb-6 p-4 bg-white dark:bg-zinc-900/50 text-zinc-900 dark:text-white group-hover:scale-110 transition-transform duration-300">
                    {value.icon}
                  </div>
                  <h3 className="text-2xl md:text-3xl font-light text-zinc-900 dark:text-white mb-4 tracking-wide">
                    {value.title}
                  </h3>
                  <p className="text-base md:text-lg font-light text-zinc-600 dark:text-white/60 leading-relaxed">
                    {value.description}
                  </p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="px-6 md:px-10 py-32 md:py-40">
        <div className="max-w-4xl mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8 }}
          >
            <h2 className="text-4xl md:text-6xl font-extralight tracking-tight text-zinc-900 dark:text-white mb-8">
              {t('ctaTitle')}
            </h2>
            <p className="text-lg md:text-xl font-light text-zinc-600 dark:text-white/60 mb-12 max-w-2xl mx-auto">
              {t('ctaDescription')}
            </p>
            <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} className="inline-flex">
              <Link
                href={contactPath}
                className="inline-block px-12 py-4 bg-zinc-900 dark:bg-white text-white dark:text-black font-light tracking-wider uppercase text-sm hover:bg-zinc-800 dark:hover:bg-white/90 transition-colors duration-300"
                onClick={() => trackEvent('cta_about_contact', { locale })}
              >
                {t('ctaButton')}
              </Link>
            </motion.div>
          </motion.div>
        </div>
      </section>
    </div>
  );
};

export default AboutPage;
