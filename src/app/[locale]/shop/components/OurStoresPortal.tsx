"use client";

import Image from "next/image";
import Link from "next/link";
import type { SupportedLocale } from "@/lib/seo";
import { OUR_STORES } from "../data/ourStores";
import styles from "./OurStoresPortal.module.css";

type OurStoresPortalProps = {
  locale: SupportedLocale;
};

function localize(isUa: boolean, en: string, ua: string) {
  return isUa ? ua : en;
}

export default function OurStoresPortal({ locale }: OurStoresPortalProps) {
  const isUa = locale === "ua";

  return (
    <section
      id="our-stores"
      className={styles.portal}
      aria-labelledby="our-stores-heading"
    >
      <div className={styles.shell}>
        <div className={styles.topbar}>
          <Link href={`/${locale}`} className={styles.backLink}>
            {isUa ? "← На головну" : "← Back home"}
          </Link>
        </div>

        <div className={styles.header}>
          <div className={styles.rule} />
          <p className={styles.label}>{isUa ? "Магазин" : "Shop"}</p>
          <h2 id="our-stores-heading" className={styles.title}>
            {isUa ? "Наші магазини" : "Our stores"}
          </h2>
          <p className={styles.description}>
            {isUa
              ? "Офіційні магазини One Company — простір преміальних авто брендів."
              : "Official One Company stores — the space of premium automotive brands."}
          </p>
        </div>

        <div className={styles.grid}>
          {OUR_STORES.map((store) => {
            const href =
              store.id === "urban"
                ? `/${locale}/shop/urban`
                : store.href || "#";
            const isExternal = store.external === true;
            const isLogoAsset = store.imageUrl?.startsWith("/logos/") ?? false;
            const content = (
              <>
                <div className={styles.cardInner}>
                  {store.imageUrl ? (
                    <div
                      className={
                        isLogoAsset
                          ? styles.cardMediaLogo
                          : styles.cardMediaPhoto
                      }
                    >
                      <Image
                        src={store.imageUrl}
                        alt={localize(isUa, store.name, store.nameUk)}
                        fill
                        sizes="(max-width: 600px) 100vw, (max-width: 960px) 50vw, 33vw"
                        className={
                          isLogoAsset
                            ? styles.cardLogoImage
                            : styles.cardPhotoImage
                        }
                        unoptimized
                      />
                      <div className={styles.cardGradient} aria-hidden />
                    </div>
                  ) : (
                    <div className={styles.cardMediaPlaceholder}>
                      <span className={styles.cardPlaceholderText}>
                        {localize(isUa, store.name, store.nameUk)}
                      </span>
                    </div>
                  )}
                  <div className={styles.cardContent}>
                    <h3 className={styles.cardTitle}>
                      {localize(isUa, store.name, store.nameUk)}
                    </h3>
                    <p className={styles.cardSubtitle}>
                      {localize(isUa, store.description, store.descriptionUk)}
                    </p>
                  </div>
                  <div className={styles.cardArrow} aria-hidden>
                    <svg viewBox="0 0 24 24">
                      <line x1="5" y1="12" x2="19" y2="12" />
                      <polyline points="12 5 19 12 12 19" />
                    </svg>
                  </div>
                </div>
              </>
            );

            if (isExternal) {
              return (
                <a
                  key={store.id}
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={styles.card}
                >
                  {content}
                </a>
              );
            }
            return (
              <Link key={store.id} href={href} className={styles.card}>
                {content}
              </Link>
            );
          })}
        </div>
      </div>
    </section>
  );
}
