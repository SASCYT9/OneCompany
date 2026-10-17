import { Section, Text } from '@react-email/components';
import * as React from 'react';
import {
  EmailEyebrow,
  EmailHeading,
  EmailLabel,
  EmailShell,
  EmailText,
  emailColors,
  type EmailLocale,
} from './EmailLayout';

interface ReplyEmailProps {
  userName: string;
  replyText: string;
  originalMessage: string;
  locale?: EmailLocale;
}

const copy = {
  ua: {
    preview: 'Відповідь на ваше звернення до One Company',
    eyebrow: 'Відповідь менеджера',
    heading: 'Дякуємо за звернення',
    intro: (name: string) => `${name}, ось наша відповідь на ваше повідомлення.`,
    reply: 'Наша відповідь',
    signature: 'З повагою, команда One Company',
    original: 'Ваше повідомлення',
  },
  en: {
    preview: 'Our reply to your inquiry — One Company',
    eyebrow: 'Reply from our team',
    heading: 'Thank you for contacting us',
    intro: (name: string) => `${name}, here is our reply to your message.`,
    reply: 'Our reply',
    signature: 'Best regards, the One Company team',
    original: 'Your message',
  },
} as const;

/** The language of the customer's own message: Cyrillic means Ukrainian. */
export function replyEmailLocale(originalMessage: string | null | undefined): EmailLocale {
  return /[Ѐ-ӿ]/.test(originalMessage ?? '') ? 'ua' : 'en';
}

export const ReplyEmail = ({ userName, replyText, originalMessage, locale }: ReplyEmailProps) => {
  const language = locale ?? replyEmailLocale(originalMessage);
  const t = copy[language];
  return (
    <EmailShell locale={language} preview={t.preview}>
      <EmailEyebrow>{t.eyebrow}</EmailEyebrow>
      <EmailHeading>{t.heading}</EmailHeading>
      <EmailText muted>{t.intro(userName)}</EmailText>
      <Section style={replyBox}>
        <EmailLabel>{t.reply}</EmailLabel>
        <Text style={replyTextStyle}>{replyText}</Text>
        <Text style={signature}>{t.signature}</Text>
      </Section>
      <EmailLabel>{t.original}</EmailLabel>
      <Text style={originalText}>{originalMessage}</Text>
    </EmailShell>
  );
};

export default ReplyEmail;

const replyBox = {
  backgroundColor: emailColors.panel,
  borderLeft: `2px solid ${emailColors.text}`,
  margin: '8px 0 24px',
  padding: '16px 20px',
};
const replyTextStyle = {
  color: emailColors.text,
  fontSize: '15px',
  lineHeight: '24px',
  margin: '0 0 12px',
  whiteSpace: 'pre-line' as const,
};
const signature = { color: emailColors.muted, fontSize: '13px', lineHeight: '20px', margin: '0' };
const originalText = {
  color: emailColors.muted,
  fontSize: '13px',
  lineHeight: '20px',
  margin: '0',
  whiteSpace: 'pre-line' as const,
};
