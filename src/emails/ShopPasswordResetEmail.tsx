import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Link,
  Preview,
  Section,
  Text,
} from '@react-email/components';
import * as React from 'react';

interface ShopPasswordResetEmailProps {
  resetUrl: string;
  firstName?: string | null;
  storeName?: string;
  publicDomain?: string;
  locale?: 'ua' | 'en';
}

const translations = {
  ua: {
    preview: 'Скидання пароля для One Company shop account',
    heading: 'СКИДАННЯ ПАРОЛЯ',
    greeting: (name: string) => (name ? `Привіт, ${name}!` : 'Привіт!'),
    intro: 'Ви або хтось від вашого імені запросив скидання пароля. Натисніть кнопку нижче, щоб встановити новий пароль:',
    button: 'ВСТАНОВИТИ НОВИЙ ПАРОЛЬ',
    expiry: 'Це посилання дійсне 3 дні. Після успішного встановлення пароля попередній пароль буде анульовано.',
    ignore: 'Якщо ви не запитували скидання пароля — просто проігноруйте цей лист, ваш акаунт у безпеці.',
    footer: 'У разі питань — просто дайте відповідь на цей лист.',
  },
  en: {
    preview: 'Reset your One Company shop password',
    heading: 'PASSWORD RESET',
    greeting: (name: string) => (name ? `Hi ${name},` : 'Hi,'),
    intro: 'You (or someone using your email) requested a password reset. Click the button below to set a new password:',
    button: 'SET A NEW PASSWORD',
    expiry: 'This link is valid for 3 days. Once a new password is set, the previous one is invalidated.',
    ignore: "If you didn't request a reset — just ignore this email, your account is safe.",
    footer: 'Questions? Just reply to this email.',
  },
} as const;

const ACCENT = '#c29d59';

export default function ShopPasswordResetEmail({
  resetUrl,
  firstName,
  storeName = 'One Company',
  publicDomain = 'onecompany.global',
  locale = 'ua',
}: ShopPasswordResetEmailProps) {
  const t = translations[locale];
  const safeName = (firstName ?? '').trim();

  return (
    <Html>
      <Head />
      <Preview>{t.preview}</Preview>
      <Body style={body}>
        <Container style={container}>
          <Section style={header}>
            <Heading style={h1}>{t.heading}</Heading>
            <Text style={domain}>{publicDomain}</Text>
          </Section>

          <Section style={content}>
            <Text style={greeting}>{t.greeting(safeName)}</Text>
            <Text style={paragraph}>{t.intro}</Text>

            <Section style={buttonWrap}>
              <Button href={resetUrl} style={button}>
                {t.button}
              </Button>
            </Section>

            <Text style={paragraphMuted}>{t.expiry}</Text>
            <Text style={paragraphMuted}>{t.ignore}</Text>

            <Hr style={hr} />

            <Text style={footer}>
              {t.footer}
              <br />
              — {storeName}
            </Text>

            <Text style={fallbackUrlLabel}>{locale === 'ua' ? 'Якщо кнопка не працює:' : 'If the button does not work:'}</Text>
            <Link href={resetUrl} style={fallbackUrl}>
              {resetUrl}
            </Link>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}

const body = {
  backgroundColor: '#0a0a0a',
  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  margin: 0,
  padding: '40px 0',
};
const container = {
  backgroundColor: '#111',
  border: '1px solid #1f1f1f',
  borderRadius: '4px',
  margin: '0 auto',
  maxWidth: '560px',
  padding: '40px',
};
const header = { paddingBottom: '24px', borderBottom: '1px solid #222' };
const h1 = {
  color: '#ffffff',
  fontSize: '20px',
  letterSpacing: '4px',
  margin: 0,
  fontWeight: 300,
};
const domain = {
  color: ACCENT,
  fontSize: '12px',
  letterSpacing: '3px',
  margin: '8px 0 0',
  textTransform: 'uppercase' as const,
};
const content = { paddingTop: '24px' };
const greeting = { color: '#fff', fontSize: '15px', margin: '0 0 16px' };
const paragraph = { color: '#cfcfcf', fontSize: '14px', lineHeight: '22px', margin: '0 0 18px' };
const paragraphMuted = { color: '#888', fontSize: '12px', lineHeight: '20px', margin: '0 0 12px' };
const buttonWrap = { textAlign: 'center' as const, margin: '32px 0' };
const button = {
  backgroundColor: ACCENT,
  color: '#0a0a0a',
  fontSize: '12px',
  fontWeight: 700,
  letterSpacing: '2px',
  padding: '14px 28px',
  borderRadius: '0',
  textDecoration: 'none',
  textTransform: 'uppercase' as const,
};
const hr = { border: 'none', borderTop: '1px solid #222', margin: '32px 0 24px' };
const footer = { color: '#666', fontSize: '12px', lineHeight: '20px', margin: 0 };
const fallbackUrlLabel = {
  color: '#555',
  fontSize: '11px',
  marginTop: '24px',
  textTransform: 'uppercase' as const,
  letterSpacing: '2px',
};
const fallbackUrl = {
  color: ACCENT,
  fontSize: '11px',
  wordBreak: 'break-all' as const,
};
