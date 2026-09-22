"use client";

import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, LockKeyhole } from "lucide-react";
import type { ReactNode } from "react";
import ThemeToggle from "@/components/ui/ThemeToggle";
import type { SupportedLocale } from "@/lib/seo";
import styles from "./ShopCheckout.module.css";

export default function ShopCheckoutShell({
  locale,
  preview = false,
  children,
}: {
  locale: SupportedLocale;
  preview?: boolean;
  children: ReactNode;
}) {
  const isUa = locale === "ua";
  const suffix = preview ? "?preview=1" : "";
  return (
    <div className={styles.checkout}>
      {preview && (
        <div className={styles.previewNotice}>
          {isUa
            ? "Локальний перегляд · демонстраційне замовлення · оплата вимкнена"
            : "Local preview · sample order · payments disabled"}
        </div>
      )}
      <header className={styles.header}>
        <Link href={`/${locale}/shop`} aria-label="OneCompany" className={styles.logo}>
          <Image
            src="/branding/logo-dark.svg"
            alt="OneCompany"
            width={130}
            height={48}
            priority
            className="dark:hidden"
          />
          <Image
            src="/branding/logo-light.svg"
            alt=""
            width={130}
            height={48}
            priority
            className="hidden dark:block"
          />
        </Link>
        <div className={styles.headerActions}>
          <Link
            href={`/${locale}/shop/cart`}
            className={styles.backLink}
            aria-label={isUa ? "До кошика" : "Back to cart"}
          >
            <ArrowLeft size={16} aria-hidden="true" />
            <span>{isUa ? "До кошика" : "Back to cart"}</span>
          </Link>
          <nav aria-label={isUa ? "Мова" : "Language"} className={styles.languages}>
            <Link href={`/ua/shop/checkout${suffix}`} aria-current={isUa ? "page" : undefined}>
              UA
            </Link>
            <Link href={`/en/shop/checkout${suffix}`} aria-current={!isUa ? "page" : undefined}>
              EN
            </Link>
          </nav>
          <ThemeToggle />
        </div>
      </header>
      {children}
      <footer className={styles.footer}>
        <span>
          <LockKeyhole size={13} aria-hidden="true" />{" "}
          {isUa ? "Захищене оформлення" : "Secure checkout"}
        </span>
        <nav aria-label={isUa ? "Умови замовлення" : "Order policies"}>
          <Link href={`/${locale}/delivery`}>{isUa ? "Доставка" : "Delivery"}</Link>
          <Link href={`/${locale}/refund`}>{isUa ? "Повернення" : "Returns"}</Link>
          <Link href={`/${locale}/privacy`}>{isUa ? "Конфіденційність" : "Privacy"}</Link>
        </nav>
      </footer>
    </div>
  );
}
