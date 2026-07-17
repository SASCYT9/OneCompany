"use client";

import { motion, useReducedMotion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import Image from "next/image";
import Link from "next/link";

type HomeShopShowcaseProps = {
  locale: string;
  eyebrow: string;
  meta: string;
  primaryLabel: string;
  selectionLabel: string;
  ariaLabel: string;
};

const revealEase = [0.22, 1, 0.36, 1] as const;

export function HomeShopShowcase({
  locale,
  eyebrow,
  meta,
  primaryLabel,
  selectionLabel,
  ariaLabel,
}: HomeShopShowcaseProps) {
  const reduceMotion = useReducedMotion();

  return (
    <motion.nav
      aria-label={ariaLabel}
      data-testid="home-shop-actions"
      initial={reduceMotion ? false : { opacity: 0, y: 18 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.35 }}
      transition={{ duration: reduceMotion ? 0 : 0.78, ease: revealEase }}
      className="relative z-10 mx-auto w-full max-w-[1400px] px-4 pt-4 sm:px-6 md:px-8"
    >
      <div className="group relative isolate min-h-[258px] overflow-hidden rounded-[24px] border border-foreground/16 bg-background/78 text-foreground shadow-[0_16px_44px_rgba(0,0,0,0.07)] backdrop-blur-xl transition-[border-color,box-shadow] duration-700 hover:border-foreground/22 hover:shadow-[0_20px_52px_rgba(0,0,0,0.10)] sm:min-h-[224px] sm:rounded-[28px] dark:border-white/12 dark:bg-background/72 dark:shadow-[0_22px_58px_rgba(0,0,0,0.24)] dark:hover:border-white/18 dark:hover:shadow-[0_26px_68px_rgba(0,0,0,0.30)] lg:min-h-[210px]">
        <motion.div
          aria-hidden="true"
          initial={reduceMotion ? false : { opacity: 0, x: 34, scale: 1.035 }}
          whileInView={{ opacity: 1, x: 0, scale: 1 }}
          viewport={{ once: true, amount: 0.35 }}
          transition={{
            duration: reduceMotion ? 0 : 1.05,
            delay: reduceMotion ? 0 : 0.1,
            ease: revealEase,
          }}
          className="absolute inset-0 sm:left-[46%] sm:[-webkit-mask-image:linear-gradient(to_right,transparent_0%,black_28%,black_100%)] sm:[mask-image:linear-gradient(to_right,transparent_0%,black_28%,black_100%)]"
        >
          <Image
            src="/images/one-company-forged-wheel-banner-light-v1.webp"
            alt=""
            fill
            priority
            sizes="(max-width: 640px) 100vw, 48vw"
            className="object-cover object-right opacity-24 transition-transform duration-[1400ms] ease-out group-hover:scale-[1.018] motion-reduce:transform-none motion-reduce:transition-none sm:opacity-100 dark:hidden"
          />
          <Image
            src="/images/one-company-forged-wheel-banner-v1.webp"
            alt=""
            fill
            priority
            sizes="(max-width: 640px) 100vw, 48vw"
            className="hidden object-cover object-right opacity-30 transition-transform duration-[1400ms] ease-out group-hover:scale-[1.018] motion-reduce:transform-none motion-reduce:transition-none dark:block sm:dark:opacity-100"
          />
        </motion.div>

        <motion.div
          initial={reduceMotion ? false : { opacity: 0, y: 14 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.35 }}
          transition={{
            duration: reduceMotion ? 0 : 0.68,
            delay: reduceMotion ? 0 : 0.18,
            ease: revealEase,
          }}
          className="relative z-10 flex min-h-[258px] w-full flex-col justify-center px-5 py-7 sm:min-h-[224px] sm:w-[56%] sm:px-8 sm:py-8 lg:min-h-[210px] lg:px-10 xl:px-12"
        >
          <p className="font-display text-[10px] font-medium uppercase tracking-[0.28em] text-[#d5001c] sm:text-[11px] sm:tracking-[0.32em]">
            {eyebrow}
          </p>

          <p className="mt-3 text-[14px] leading-relaxed text-foreground/88 sm:mt-4 sm:text-[16px] lg:text-[17px]">
            {meta}
          </p>

          <div className="mt-5 flex flex-col items-start gap-4 min-[460px]:flex-row min-[460px]:items-center sm:mt-6 sm:gap-5 lg:gap-7">
            <Link
              href={`/${locale}/shop/catalog`}
              prefetch={false}
              className="group/button flex min-h-[52px] w-full max-w-[270px] items-center justify-between gap-4 rounded-[16px] border border-[#d5001c] bg-[#d5001c] px-5 py-3 text-white shadow-[0_12px_26px_rgba(213,0,28,0.18)] transition duration-300 hover:-translate-y-0.5 hover:bg-[#c00019] hover:shadow-[0_16px_34px_rgba(213,0,28,0.23)] focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-[#d5001c] focus-visible:ring-offset-2 focus-visible:ring-offset-background motion-reduce:transform-none motion-reduce:transition-none sm:max-w-[290px] sm:px-6"
            >
              <span className="font-display text-[11px] font-medium uppercase tracking-[0.16em] sm:text-[12px] sm:tracking-[0.18em]">
                {primaryLabel}
              </span>
              <ArrowRight
                aria-hidden="true"
                className="h-5 w-5 shrink-0 transition-transform duration-300 group-hover/button:translate-x-1 motion-reduce:transform-none motion-reduce:transition-none"
                strokeWidth={1.7}
              />
            </Link>

            <Link
              href={`/${locale}/contact#selection-form`}
              prefetch={false}
              className="group/selection inline-flex items-center gap-3 border-b border-foreground/50 pb-2 text-[14px] text-foreground/92 transition-colors hover:border-[#d5001c] hover:text-foreground focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-4 focus-visible:ring-offset-background sm:text-[15px]"
            >
              <span>{selectionLabel}</span>
              <ArrowRight
                aria-hidden="true"
                className="h-[17px] w-[17px] text-[#e50020] transition-transform duration-300 group-hover/selection:translate-x-1 motion-reduce:transform-none motion-reduce:transition-none"
                strokeWidth={1.7}
              />
            </Link>
          </div>
        </motion.div>
      </div>
    </motion.nav>
  );
}
