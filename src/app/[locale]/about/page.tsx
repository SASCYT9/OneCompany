'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { Globe, Wrench, Users, Search } from 'lucide-react';
import { useTranslations } from 'next-intl';

const AboutPage: React.FC = () => {
  const t = useTranslations('aboutPage');

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
            Delivering premium automotive performance solutions worldwide
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
              Our Story
            </h2>
            <div className="w-24 h-px bg-zinc-300 dark:bg-white/20 mb-12" />
            <div className="space-y-6 text-lg md:text-xl font-light text-zinc-600 dark:text-white/60 leading-relaxed">
              <p>
                Founded with a passion for automotive excellence, OneCompany has grown into a trusted partner 
                for enthusiasts and professionals seeking the finest performance upgrades and parts.
              </p>
              <p>
                We believe that every vehicle deserves the best. That&rsquo;s why we&rsquo;ve carefully curated relationships 
                with over 200 premium brands from around the world, bringing you unparalleled access to cutting-edge 
                automotive technology and craftsmanship.
              </p>
              <p>
                Our commitment goes beyond just selling parts. We&rsquo;re here to help you realize your automotive dreams, 
                whether that&rsquo;s improving performance, enhancing aesthetics, or achieving the perfect balance of both.
              </p>
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
              What We Offer
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
              Ready to elevate your ride?
            </h2>
            <p className="text-lg md:text-xl font-light text-zinc-600 dark:text-white/60 mb-12 max-w-2xl mx-auto">
              Get in touch with our team and let&rsquo;s discuss how we can help bring your automotive vision to life.
            </p>
            <motion.a
              href="/contact"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="inline-block px-12 py-4 bg-zinc-900 dark:bg-white text-white dark:text-black font-light tracking-wider uppercase text-sm hover:bg-zinc-800 dark:hover:bg-white/90 transition-colors duration-300"
            >
              {t('contact')}
            </motion.a>
          </motion.div>
        </div>
      </section>
    </div>
  );
};

export default AboutPage;
