import {
  Body,
  Button,
  Column,
  Container,
  Head,
  Hr,
  Html,
  Img,
  Link,
  Preview,
  Row,
  Section,
  Text,
} from "@react-email/components";
import * as React from "react";

/**
 * Shared frame for every customer email: logo, a sharp dark card, the support
 * block and the footer. Only email-safe markup and inline styles.
 */

export type EmailLocale = "ua" | "en";

export const emailBaseUrl =
  process.env.NEXT_PUBLIC_SITE_URL ||
  (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "https://onecompany.global");

const palettes = {
  dark: {
    page: "#000000",
    header: "#000000",
    card: "#0c0c0c",
    panel: "#141414",
    line: "#262626",
    text: "#f4f4f4",
    muted: "#a3a3a3",
    faint: "#6b6b6b",
    buttonBg: "#f4f4f4",
    buttonText: "#000000",
    scheme: "dark",
  },
  // Black brand header over a light body: readable in every client and printable.
  light: {
    page: "#f2f2f2",
    header: "#000000",
    card: "#ffffff",
    panel: "#f5f5f5",
    line: "#e3e3e3",
    text: "#111111",
    muted: "#555555",
    faint: "#8a8a8a",
    buttonBg: "#111111",
    buttonText: "#ffffff",
    scheme: "light",
  },
} as const;

export const emailColors = palettes.light;

const fontStack =
  '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';

/** "360 905,16 грн", "6 935,50 €" or "€6,935.50": kopecks/cents only when present. */
export function formatEmailMoney(amount: number, currency: string, locale: EmailLocale) {
  const value = Number(amount) || 0;
  const digits = Math.round(Math.abs(value) * 100) % 100 === 0 ? 0 : 2;
  if (locale === "ua") {
    const number = new Intl.NumberFormat("uk-UA", {
      minimumFractionDigits: digits,
      maximumFractionDigits: digits,
    }).format(value);
    const symbol = currency === "UAH" ? "грн" : currency === "EUR" ? "€" : currency === "USD" ? "$" : currency;
    return `${number} ${symbol}`;
  }
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(value);
}

/** Absolute URL for an image path the shop stores relative to the site. */
export function emailImageUrl(src: string | null | undefined) {
  if (!src) return null;
  if (/^https:\/\//i.test(src)) return src;
  if (src.startsWith("//")) return `https:${src}`;
  return src.startsWith("/") ? `${emailBaseUrl}${src}` : null;
}

const shellCopy = {
  ua: {
    questions: "Потрібна допомога?",
    hours: "Ми на зв’язку щодня з 10:00 до 21:00 (Київ).",
    address: "One Company · вул. Басейна, 21Б, Київ",
    privacy: "Політика конфіденційності",
    unsubscribe: "Відписатися",
  },
  en: {
    questions: "Need a hand?",
    hours: "We answer every day, 10:00–21:00 Kyiv time.",
    address: "One Company · 21B Baseina St, Kyiv, Ukraine",
    privacy: "Privacy policy",
    unsubscribe: "Unsubscribe",
  },
} as const;

export function EmailShell({
  locale,
  preview,
  children,
  unsubscribe,
}: {
  locale: EmailLocale;
  preview: string;
  children: React.ReactNode;
  /** Optional emails (reminders): why the buyer gets them and a one-click way out. */
  unsubscribe?: { reason: string; url: string };
}) {
  const t = shellCopy[locale];
  return (
    <Html lang={locale === "ua" ? "uk" : "en"}>
      <Head>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="color-scheme" content={emailColors.scheme} />
        <meta name="supported-color-schemes" content={emailColors.scheme} />
      </Head>
      <Preview>{preview}</Preview>
      <Body style={styles.body}>
        <Container style={styles.container}>
          <Section style={styles.header}>
            <Link href={emailBaseUrl}>
              <Img
                src={`${emailBaseUrl}/branding/email-logo.jpg`}
                width="140"
                height="51"
                alt="One Company"
                style={styles.logo}
              />
            </Link>
          </Section>
          <Section style={styles.card}>{children}</Section>
          <Section style={styles.support}>
            <Text style={styles.supportTitle}>{t.questions}</Text>
            <Text style={styles.supportText}>{t.hours}</Text>
            <Text style={styles.supportLinks}>
              <Link href="tel:+380660771700" style={styles.supportLink}>
                +380 66 077 17 00
              </Link>
              {"  ·  "}
              <Link href="https://t.me/onecompany_global" style={styles.supportLink}>
                Telegram
              </Link>
              {"  ·  "}
              <Link href="https://wa.me/380660771700" style={styles.supportLink}>
                WhatsApp
              </Link>
              {"  ·  "}
              <Link href="mailto:info@onecompany.global" style={styles.supportLink}>
                info@onecompany.global
              </Link>
            </Text>
          </Section>
          <Section style={styles.footer}>
            {unsubscribe ? (
              <Text style={styles.footerText}>
                {unsubscribe.reason}{" "}
                <Link href={unsubscribe.url} style={styles.unsubscribeLink}>
                  {t.unsubscribe}
                </Link>
              </Text>
            ) : null}
            <Text style={styles.footerText}>{t.address}</Text>
            <Text style={styles.footerText}>
              <Link href={emailBaseUrl} style={styles.footerLink}>
                onecompany.global
              </Link>
              {"  ·  "}
              <Link href="https://www.instagram.com/onecompany.global" style={styles.footerLink}>
                Instagram
              </Link>
              {"  ·  "}
              <Link href={`${emailBaseUrl}/${locale}/privacy`} style={styles.footerLink}>
                {t.privacy}
              </Link>
            </Text>
            <Text style={styles.footerText}>© {new Date().getFullYear()} One Company</Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}

export function EmailEyebrow({ children }: { children: React.ReactNode }) {
  return <Text style={styles.eyebrow}>{children}</Text>;
}

export function EmailHeading({ children }: { children: React.ReactNode }) {
  return <Text style={styles.heading}>{children}</Text>;
}

export function EmailText({ children, muted = false }: { children: React.ReactNode; muted?: boolean }) {
  return <Text style={muted ? { ...styles.text, color: emailColors.muted } : styles.text}>{children}</Text>;
}

export function EmailCallout({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Section style={styles.callout}>
      <Text style={styles.calloutTitle}>{title}</Text>
      <Text style={styles.calloutText}>{children}</Text>
    </Section>
  );
}

export function EmailButton({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Section style={styles.buttonRow}>
      <Button href={href} style={styles.button}>
        {children}
      </Button>
    </Section>
  );
}

export function EmailDivider() {
  return <Hr style={styles.divider} />;
}

/** Label/value lines (order number, date, payment...): readable on a phone too. */
export function EmailFacts({ facts }: { facts: Array<{ label: string; value: React.ReactNode }> }) {
  return (
    <Section style={styles.facts}>
      {facts.map((fact) => (
        <Row key={fact.label}>
          <Column style={styles.factLabelCell} valign="top">
            <Text style={styles.factLabel}>{fact.label}</Text>
          </Column>
          <Column valign="top">
            <Text style={styles.factValue}>{fact.value}</Text>
          </Column>
        </Row>
      ))}
    </Section>
  );
}

export function EmailLabel({ children }: { children: React.ReactNode }) {
  return <Text style={styles.label}>{children}</Text>;
}

const styles = {
  body: {
    backgroundColor: emailColors.page,
    color: emailColors.text,
    fontFamily: fontStack,
    margin: "0",
    padding: "0",
  },
  container: { margin: "0 auto", padding: "32px 16px 40px", maxWidth: "600px" },
  header: { backgroundColor: emailColors.header, padding: "26px 0", textAlign: "center" as const },
  logo: { display: "block", margin: "0 auto" },
  card: {
    backgroundColor: emailColors.card,
    border: `1px solid ${emailColors.line}`,
    padding: "32px 24px",
  },
  eyebrow: {
    color: emailColors.muted,
    fontSize: "11px",
    fontWeight: "600",
    letterSpacing: "0.22em",
    textTransform: "uppercase" as const,
    margin: "0 0 12px",
  },
  heading: {
    color: emailColors.text,
    fontSize: "26px",
    fontWeight: "300",
    letterSpacing: "-0.01em",
    lineHeight: "32px",
    margin: "0 0 16px",
  },
  text: { color: emailColors.text, fontSize: "15px", lineHeight: "24px", margin: "0 0 16px" },
  callout: {
    backgroundColor: emailColors.panel,
    borderLeft: `2px solid ${emailColors.text}`,
    margin: "8px 0 28px",
    padding: "16px 20px",
  },
  calloutTitle: {
    color: emailColors.text,
    fontSize: "11px",
    fontWeight: "600",
    letterSpacing: "0.2em",
    textTransform: "uppercase" as const,
    margin: "0 0 6px",
  },
  calloutText: { color: emailColors.muted, fontSize: "14px", lineHeight: "22px", margin: "0" },
  facts: { margin: "0 0 4px" },
  factLabelCell: { width: "38%", paddingRight: "12px" },
  factLabel: {
    color: emailColors.faint,
    fontSize: "10px",
    fontWeight: "600",
    letterSpacing: "0.2em",
    lineHeight: "22px",
    textTransform: "uppercase" as const,
    margin: "0 0 8px",
  },
  label: {
    color: emailColors.faint,
    fontSize: "10px",
    fontWeight: "600",
    letterSpacing: "0.2em",
    textTransform: "uppercase" as const,
    margin: "0 0 6px",
  },
  factValue: { color: emailColors.text, fontSize: "14px", lineHeight: "22px", margin: "0 0 8px" },
  divider: { borderColor: emailColors.line, borderTopWidth: "1px", margin: "24px 0" },
  buttonRow: { padding: "28px 0 0", textAlign: "center" as const },
  button: {
    backgroundColor: emailColors.buttonBg,
    color: emailColors.buttonText,
    display: "inline-block",
    fontSize: "12px",
    fontWeight: "700",
    letterSpacing: "0.18em",
    padding: "16px 36px",
    textDecoration: "none",
    textTransform: "uppercase" as const,
  },
  support: { padding: "28px 8px 4px", textAlign: "center" as const },
  supportTitle: { color: emailColors.text, fontSize: "14px", fontWeight: "600", margin: "0 0 4px" },
  supportText: { color: emailColors.muted, fontSize: "13px", lineHeight: "20px", margin: "0 0 10px" },
  supportLinks: { color: emailColors.faint, fontSize: "13px", lineHeight: "22px", margin: "0" },
  supportLink: { color: emailColors.text, textDecoration: "none" },
  footer: { padding: "20px 8px 0", textAlign: "center" as const },
  footerText: { color: emailColors.faint, fontSize: "11px", lineHeight: "18px", margin: "0 0 4px" },
  footerLink: { color: emailColors.muted, textDecoration: "none" },
  unsubscribeLink: { color: emailColors.muted, textDecoration: "underline" },
};
