import type { CSSProperties } from "react";
import type { Metadata } from "next";
import { Download, Mail, Phone } from "lucide-react";
import { notFound } from "next/navigation";

import {
  catalogShareSnapshot,
  findCatalogPresentationShare,
} from "@/lib/admin/catalogPresentationShare";
import styles from "./presentation.module.css";

export const metadata: Metadata = {
  title: "Презентаційний каталог",
  robots: { index: false, follow: false, nocache: true },
};

function money(value: number | null, currency: string, language: string) {
  if (value == null) {
    return language === "en"
      ? "Price on request"
      : language === "ru"
        ? "Цена по запросу"
        : "Ціна за запитом";
  }
  return new Intl.NumberFormat(
    language === "en" ? "en-GB" : language === "ru" ? "ru-RU" : "uk-UA",
    {
      style: "currency",
      currency,
      maximumFractionDigits: Number.isInteger(value) ? 0 : 2,
    }
  ).format(value);
}

function presentationCopy(language: string) {
  if (language === "en") {
    return {
      kicker: "PRESENTATION CATALOGUE",
      preparedFor: "Prepared for",
      manager: "YOUR PERSONAL MANAGER",
      validUntil: "Offer valid until",
      sku: "SKU",
    };
  }
  if (language === "ru") {
    return {
      kicker: "ПРЕЗЕНТАЦИОННЫЙ КАТАЛОГ",
      preparedFor: "Подготовлено для",
      manager: "ВАШ ПЕРСОНАЛЬНЫЙ МЕНЕДЖЕР",
      validUntil: "Предложение действительно до",
      sku: "АРТИКУЛ",
    };
  }
  return {
    kicker: "ПРЕЗЕНТАЦІЙНИЙ КАТАЛОГ",
    preparedFor: "Підготовлено для",
    manager: "ВАШ ПЕРСОНАЛЬНИЙ МЕНЕДЖЕР",
    validUntil: "Пропозиція дійсна до",
    sku: "АРТИКУЛ",
  };
}

function formattedDate(value: string, language: string) {
  return new Intl.DateTimeFormat(
    language === "en" ? "en-GB" : language === "ru" ? "ru-RU" : "uk-UA",
    { day: "2-digit", month: "long", year: "numeric", timeZone: "UTC" }
  ).format(new Date(`${value}T00:00:00.000Z`));
}

function logo(snapshot: ReturnType<typeof catalogShareSnapshot>) {
  if (snapshot.branding === "none") return null;
  return snapshot.branding === "onecompany" ? "/branding/logo-light.svg" : snapshot.brandLogoSrc;
}

export default async function PublicCatalogPresentationPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const share = await findCatalogPresentationShare(token, true);
  if (!share) notFound();
  const snapshot = catalogShareSnapshot(share);
  const logoSrc = logo(snapshot);
  const client = snapshot.clientCompany || snapshot.clientName;
  const copy = presentationCopy(snapshot.language);

  return (
    <main className={styles.page}>
      <header className={styles.hero}>
        <nav className={styles.nav}>
          {logoSrc ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={logoSrc}
              alt=""
              className={`${styles.logo} ${snapshot.branding === "brand" ? styles.brandLogo : ""}`}
            />
          ) : (
            <span className={styles.wordmark}>PRESENTATION</span>
          )}
          <a className={styles.download} href={`/api/catalog/p/${token}/pdf`}>
            <Download size={17} /> PDF
          </a>
        </nav>
        <div className={styles.heroCopy}>
          <span>{copy.kicker}</span>
          <h1>{snapshot.title}</h1>
          <p>{snapshot.subtitle}</p>
          {client ? (
            <small>
              {copy.preparedFor} {client}
            </small>
          ) : null}
        </div>
        {snapshot.items[0]?.imageSources[0] ? (
          <div className={styles.heroImage}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={snapshot.items[0].imageSources[0]} alt="" />
          </div>
        ) : null}
      </header>

      <section className={styles.products}>
        {snapshot.items.map((item, index) => {
          const images =
            snapshot.photoMode === "hero" ? item.imageSources.slice(0, 1) : item.imageSources;
          const itemDescriptionMode =
            item.descriptionMode === "inherit" || !item.descriptionMode
              ? snapshot.descriptionMode
              : item.descriptionMode;
          return (
            <article className={styles.product} key={`${item.sku ?? item.title}-${index}`}>
              <div className={styles.productHeading}>
                <span>{String(index + 1).padStart(2, "0")}</span>
                <div>
                  {item.showBrand === false ? null : <small>{item.brand}</small>}
                  <h2>{item.title}</h2>
                </div>
                {snapshot.showPrice && item.showPrice !== false ? (
                  <strong>{money(item.price, snapshot.currency, snapshot.language)}</strong>
                ) : null}
              </div>
              <div
                className={`${styles.gallery} ${
                  images.length === 1
                    ? styles.single
                    : item.galleryLayout === "feature" ||
                        (item.galleryLayout === "auto" && images.length === 3)
                      ? styles.feature
                      : ""
                }`}
              >
                {images.map((source, imageIndex) => {
                  const edit = item.imageEdits?.find((candidate) => candidate.source === source);
                  const imageStyle = {
                    objectFit: edit?.fit ?? "cover",
                    objectPosition: `${edit?.focusX ?? 50}% ${edit?.focusY ?? 50}%`,
                    transform: `scale(${edit?.zoom ?? 1})`,
                    transformOrigin: `${edit?.focusX ?? 50}% ${edit?.focusY ?? 50}%`,
                  } as CSSProperties;
                  return (
                    <div className={styles.imageFrame} key={`${source}-${imageIndex}`}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={source}
                        alt={`${item.title} — ${imageIndex + 1}`}
                        style={imageStyle}
                      />
                    </div>
                  );
                })}
              </div>
              <div className={styles.productDetails}>
                {itemDescriptionMode === "none" ? null : <p>{item.description}</p>}
                {item.showSku === false ? null : (
                  <span>
                    {copy.sku}: {item.sku || "—"}
                  </span>
                )}
              </div>
            </article>
          );
        })}
      </section>

      {snapshot.showContactPage &&
      (snapshot.managerName ||
        snapshot.managerPhone ||
        snapshot.managerEmail ||
        snapshot.personalNote) ? (
        <footer className={styles.contact}>
          <span>{copy.manager}</span>
          <h2>{snapshot.managerName || "OneCompany"}</h2>
          {snapshot.personalNote ? <p>{snapshot.personalNote}</p> : null}
          <div className={styles.contactLinks}>
            {snapshot.managerPhone ? (
              <a href={`tel:${snapshot.managerPhone}`}>
                <Phone size={16} /> {snapshot.managerPhone}
              </a>
            ) : null}
            {snapshot.managerEmail ? (
              <a href={`mailto:${snapshot.managerEmail}`}>
                <Mail size={16} /> {snapshot.managerEmail}
              </a>
            ) : null}
          </div>
          {snapshot.validUntil ? (
            <small>
              {copy.validUntil} {formattedDate(snapshot.validUntil, snapshot.language)}
            </small>
          ) : null}
        </footer>
      ) : null}
    </main>
  );
}
