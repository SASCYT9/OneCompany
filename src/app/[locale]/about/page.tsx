'use client';

import React from 'react';
import { motion } from 'framer-motion';
import {
  ArrowUpRight,
  Layers,
  Network,
  PackageCheck,
  Sparkles,
  Wrench,
  Workflow
} from 'lucide-react';
import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';

const AboutPage: React.FC = () => {
  const t = useTranslations('aboutPage');
  const locale = useLocale();

  const stats = [
    {
      value: t('stats.items.years.value'),
      label: t('stats.items.years.label'),
    },
    {
      value: t('stats.items.brands.value'),
      label: t('stats.items.brands.label'),
    },
    {
      value: t('stats.items.projects.value'),
      label: t('stats.items.projects.label'),
    },
    {
      value: t('stats.items.countries.value'),
      label: t('stats.items.countries.label'),
    },
  ];

  const pillars = [
    {
      icon: <Sparkles className="h-8 w-8" />,
      title: t('pillars.items.curation.title'),
      description: t('pillars.items.curation.description'),
    },
    {
      icon: <Layers className="h-8 w-8" />,
      title: t('pillars.items.integration.title'),
      description: t('pillars.items.integration.description'),
    },
    {
      icon: <Network className="h-8 w-8" />,
      title: t('pillars.items.partnerNetwork.title'),
      description: t('pillars.items.partnerNetwork.description'),
    },
  ];

  const capabilities = [
    {
      icon: <Sparkles className="h-6 w-6" />,
      title: t('capabilities.items.consulting.title'),
      description: t('capabilities.items.consulting.description'),
    },
    {
      icon: <PackageCheck className="h-6 w-6" />,
      title: t('capabilities.items.procurement.title'),
      description: t('capabilities.items.procurement.description'),
    },
    {
      icon: <Wrench className="h-6 w-6" />,
      title: t('capabilities.items.installation.title'),
      description: t('capabilities.items.installation.description'),
    },
    {
      icon: <Workflow className="h-6 w-6" />,
      title: t('capabilities.items.aftercare.title'),
      description: t('capabilities.items.aftercare.description'),
    },
  ];

  const timeline = [
    {
      year: '2007',
      title: t('timeline.events.2007.title'),
      description: t('timeline.events.2007.description'),
    },
    {
      year: '2012',
      title: t('timeline.events.2012.title'),
      description: t('timeline.events.2012.description'),
    },
    {
      year: '2016',
      title: t('timeline.events.2016.title'),
      description: t('timeline.events.2016.description'),
    },
    {
      year: '2020',
      title: t('timeline.events.2020.title'),
      description: t('timeline.events.2020.description'),
    },
    {
      year: '2024',
      title: t('timeline.events.2024.title'),
      description: t('timeline.events.2024.description'),
    },
  ];

  return (
    <div className="relative overflow-hidden bg-[#050505] text-zinc-100">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(245,230,200,0.18)_0%,_transparent_55%)]" />
      <div className="pointer-events-none absolute inset-y-0 right-[-200px] w-[480px] bg-[radial-gradient(circle,_rgba(251,191,36,0.12)_0%,_transparent_70%)] blur-3xl" />

      {/* Hero */}
      <section className="relative flex min-h-[90vh] flex-col justify-center px-6 py-24 md:px-10">
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-[#1a1a1a] to-[#050505]" />
        <div className="relative z-10 mx-auto w-full max-w-6xl">
          <motion.p
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="mb-6 text-sm uppercase tracking-[0.4em] text-amber-200/70"
          >
            {t('hero.eyebrow')}
          </motion.p>
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.1 }}
            className="text-4xl font-extralight leading-tight text-white sm:text-6xl md:text-7xl"
          >
            {t('hero.title')}
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.2 }}
            className="mt-8 max-w-3xl text-lg font-light text-white/70 md:text-xl"
          >
            {t('hero.subtitle')}
          </motion.p>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.8, delay: 0.35 }}
            className="mt-12 flex flex-wrap gap-4"
          >
            <Link
              href={`/${locale}/contact`}
              className="inline-flex items-center justify-center border border-transparent bg-gradient-to-r from-amber-200 to-amber-400 px-8 py-3 text-sm uppercase tracking-wide text-black transition hover:opacity-90"
            >
              {t('hero.primaryCta')}
            </Link>
            <Link
              href={`/${locale}/categories`}
              className="inline-flex items-center justify-center border border-white/30 px-8 py-3 text-sm uppercase tracking-wide text-white transition hover:border-white"
            >
              {t('hero.secondaryCta')}
              <ArrowUpRight className="ml-3 h-4 w-4" />
            </Link>
          </motion.div>
        </div>
      </section>

      {/* Stats */}
      <section className="relative px-6 py-16 md:px-10">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 rounded-3xl border border-white/10 bg-white/5 p-8 backdrop-blur lg:p-12 md:flex-row md:items-center">
          <h2 className="text-2xl font-light text-white md:w-1/3">{t('stats.title')}</h2>
          <div className="grid flex-1 grid-cols-2 gap-8 md:grid-cols-4">
            {stats.map((stat) => (
              <div key={stat.label} className="flex flex-col">
                <span className="text-4xl font-extralight text-white">
                  {stat.value}
                </span>
                <span className="mt-3 text-sm uppercase tracking-[0.25em] text-white/60">
                  {stat.label}
                </span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Narrative */}
      <section className="px-6 py-24 md:px-10">
        <div className="mx-auto grid max-w-6xl gap-12 md:grid-cols-[1.1fr_0.9fr]">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.7 }}
            className="space-y-6"
          >
            <p className="text-sm uppercase tracking-[0.35em] text-amber-200/70">
              {t('narrative.title')}
            </p>
            <p className="text-lg font-light text-white/70">
              {t('narrative.paragraph1')}
            </p>
            <p className="text-lg font-light text-white/70">
              {t('narrative.paragraph2')}
            </p>
            <p className="text-lg font-light text-white/70">
              {t('narrative.paragraph3')}
            </p>
            <p className="pt-6 text-sm uppercase tracking-[0.4em] text-amber-200/70">
              {t('narrative.signature')}
            </p>
          </motion.div>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.7, delay: 0.1 }}
            className="rounded-3xl border border-white/10 bg-white/5 p-10 shadow-2xl shadow-amber-100/5"
          >
            <div className="grid gap-8">
              {pillars.map((pillar) => (
                <div key={pillar.title} className="flex gap-5">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full border border-amber-200/50 bg-amber-100/10 text-amber-100">
                    {pillar.icon}
                  </div>
                  <div>
                    <p className="text-lg font-light text-white">{pillar.title}</p>
                    <p className="mt-2 text-sm text-white/60">
                      {pillar.description}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        </div>
      </section>

      {/* Capabilities */}
      <section className="bg-gradient-to-b from-[#050505] via-[#0b0b0b] to-[#070707] text-white">
        <div className="mx-auto max-w-6xl px-6 py-24 md:px-10">
          <div className="mb-16 space-y-4">
            <p className="text-sm uppercase tracking-[0.35em] text-amber-200/70">{t('capabilities.title')}</p>
            <h3 className="text-4xl font-extralight leading-tight text-white md:text-5xl">
              {t('hero.eyebrow')}
            </h3>
          </div>
          <div className="grid gap-8 md:grid-cols-2">
            {capabilities.map((capability) => (
              <motion.div
                key={capability.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6 }}
                className="rounded-3xl border border-white/10 bg-white/5 p-8 backdrop-blur"
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-full border border-white/20 bg-white/10">
                  {capability.icon}
                </div>
                <p className="mt-6 text-2xl font-light">{capability.title}</p>
                <p className="mt-3 text-sm text-white/70">{capability.description}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Timeline */}
      <section className="px-6 py-24 md:px-10">
        <div className="mx-auto max-w-5xl">
          <h3 className="text-sm uppercase tracking-[0.35em] text-amber-200/70">
            {t('timeline.title')}
          </h3>
          <div className="mt-12 space-y-10 border-l border-white/15 pl-10">
            {timeline.map((event, index) => (
              <motion.div
                key={event.year}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: index * 0.05 }}
                className="relative"
              >
                <div className="absolute -left-6 top-2 h-3 w-3 rounded-full bg-amber-200" />
                <p className="text-sm uppercase tracking-[0.25em] text-white/60">
                  {event.year}
                </p>
                <p className="mt-3 text-2xl font-light text-white">{event.title}</p>
                <p className="mt-2 text-base text-white/70">{event.description}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="px-6 pb-24 md:px-10">
        <div className="mx-auto max-w-5xl rounded-3xl border border-white/10 bg-gradient-to-br from-[#0a0a0a] via-[#111] to-[#050505] p-12 text-center shadow-[0_0_120px_rgba(251,191,36,0.15)]">
          <motion.h3
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="text-4xl font-extralight text-white"
          >
            {t('cta.title')}
          </motion.h3>
          <motion.p
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="mx-auto mt-6 max-w-3xl text-lg font-light text-white/70"
          >
            {t('cta.subtitle')}
          </motion.p>
          <div className="mt-10 flex flex-wrap justify-center gap-4">
            <Link
              href={`/${locale}/contact`}
              className="inline-flex items-center justify-center border border-transparent bg-gradient-to-r from-amber-200 to-amber-400 px-8 py-3 text-sm uppercase tracking-wide text-black transition hover:opacity-90"
            >
              {t('cta.primaryCta')}
            </Link>
            <Link
              href={`/${locale}/brands`}
              className="inline-flex items-center justify-center border border-white/30 px-8 py-3 text-sm uppercase tracking-wide text-white transition hover:border-white"
            >
              {t('cta.secondaryCta')}
              <ArrowUpRight className="ml-3 h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
};

export default AboutPage;
