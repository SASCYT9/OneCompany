import { Link, Text } from '@react-email/components';
import * as React from 'react';
import {
  EmailButton,
  EmailEyebrow,
  EmailHeading,
  EmailShell,
  EmailText,
  emailColors,
} from '@/components/emails/EmailLayout';

interface ShopPasswordResetEmailProps {
  resetUrl: string;
  firstName?: string | null;
  storeName?: string;
  publicDomain?: string;
  locale?: 'ua' | 'en';
}

const translations = {
  ua: {
    preview: 'Скидання пароля до акаунта One Company',
    eyebrow: 'Акаунт One Company',
    heading: 'Скидання пароля',
    greeting: (name: string) => (name ? `${name}, ви` : 'Ви') + ' або хтось від вашого імені запросив скидання пароля.',
    intro: 'Натисніть кнопку нижче, щоб встановити новий пароль.',
    button: 'Встановити новий пароль',
    expiry: 'Посилання дійсне 3 дні. Після встановлення нового пароля попередній перестане діяти.',
    ignore: 'Якщо ви не запитували скидання — просто проігноруйте цей лист, ваш акаунт у безпеці.',
    fallback: 'Якщо кнопка не відкривається, скопіюйте посилання:',
  },
  en: {
    preview: 'Reset your One Company account password',
    eyebrow: 'One Company account',
    heading: 'Password reset',
    greeting: (name: string) => (name ? `${name}, you` : 'You') + ' (or someone using your email) requested a password reset.',
    intro: 'Use the button below to set a new password.',
    button: 'Set a new password',
    expiry: 'The link is valid for 3 days. Once a new password is set, the previous one stops working.',
    ignore: "If you didn't request a reset, just ignore this email — your account is safe.",
    fallback: 'If the button does not open, copy this link:',
  },
} as const;

export default function ShopPasswordResetEmail({ resetUrl, firstName, locale = 'ua' }: ShopPasswordResetEmailProps) {
  const t = translations[locale];
  const name = (firstName ?? '').trim();
  return (
    <EmailShell locale={locale} preview={t.preview}>
      <EmailEyebrow>{t.eyebrow}</EmailEyebrow>
      <EmailHeading>{t.heading}</EmailHeading>
      <EmailText>{t.greeting(name)}</EmailText>
      <EmailText muted>{t.intro}</EmailText>
      <EmailButton href={resetUrl}>{t.button}</EmailButton>
      <Text style={note}>{t.expiry}</Text>
      <Text style={note}>{t.ignore}</Text>
      <Text style={note}>{t.fallback}</Text>
      <Link href={resetUrl} style={fallbackLink}>
        {resetUrl}
      </Link>
    </EmailShell>
  );
}

const note = { color: emailColors.muted, fontSize: '13px', lineHeight: '20px', margin: '16px 0 0' };
const fallbackLink = { color: emailColors.text, fontSize: '12px', wordBreak: 'break-all' as const };
