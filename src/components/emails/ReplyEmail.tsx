import {
  Body,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Img,
  Preview,
  Section,
  Text,
  Link,
} from '@react-email/components';
import * as React from 'react';

interface ReplyEmailProps {
  userName: string;
  replyText: string;
  originalMessage: string;
}

const baseUrl = process.env.NEXT_PUBLIC_SITE_URL
  ? `${process.env.NEXT_PUBLIC_SITE_URL}`
  : process.env.VERCEL_URL
  ? `https://${process.env.VERCEL_URL}`
  : 'https://onecompany.global';

export const ReplyEmail = ({
  userName,
  replyText,
  originalMessage,
}: ReplyEmailProps) => (
  <Html>
    <Head />
    <Preview>Re: Your inquiry to OneCompany</Preview>
    <Body style={main}>
      <Container style={container}>
        <Section style={logoContainer}>
          <Img
            src={`${baseUrl}/branding/email-logo.png`}
            width="150"
            height="55"
            alt="OneCompany"
            style={logo}
          />
        </Section>
        
        <Section style={contentContainer}>
          <Heading style={heading}>Re: Your inquiry</Heading>
          
          <Text style={paragraph}>
            Hello <span style={highlight}>{userName}</span>,
          </Text>
          <Text style={paragraph}>
            Thank you for contacting us. Here is our reply regarding your message:
          </Text>
          
          <Section style={replyBox}>
            <Text style={boxLabel}>OUR RESPONSE</Text>
            <Text style={replyTextContent}>{replyText}</Text>
            <Text style={signature}>
              Best regards,<br />
              OneCompany Team
            </Text>
            <Link href="https://onecompany.global" style={signatureLink}>
              onecompany.global
            </Link>
          </Section>
          
          <Hr style={hr} />
          
          <Section style={originalBox}>
            <Text style={boxLabelSecondary}>ORIGINAL MESSAGE</Text>
            <Text style={originalMessageText}>
              {originalMessage}
            </Text>
          </Section>
        </Section>

        <Section style={footer}>
          <Text style={footerText}>
            © {new Date().getFullYear()} OneCompany. All rights reserved.
          </Text>
          <Text style={footerText}>
            <Link href="https://onecompany.global" style={footerLink}>onecompany.global</Link>
          </Text>
        </Section>
      </Container>
    </Body>
  </Html>
);

export default ReplyEmail;

const main = {
  backgroundColor: '#000000',
  fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
  color: '#ffffff',
};

const container = {
  margin: '0 auto',
  padding: '40px 20px',
  maxWidth: '600px',
};

const logoContainer = {
  textAlign: 'center' as const,
  marginBottom: '40px',
};

const logo = {
  margin: '0 auto',
  display: 'block',
  maxWidth: '100%',
};

const contentContainer = {
  backgroundColor: '#111111',
  borderRadius: '16px',
  border: '1px solid #333333',
  padding: '40px',
};

const heading = {
  fontSize: '24px',
  fontWeight: '600',
  textAlign: 'center' as const,
  color: '#ffffff',
  margin: '0 0 32px',
  letterSpacing: '-0.02em',
};

const paragraph = {
  fontSize: '16px',
  lineHeight: '26px',
  color: '#cccccc',
  marginBottom: '16px',
};

const highlight = {
  color: '#ffffff',
  fontWeight: '500',
};

const replyBox = {
  backgroundColor: '#1a1a1a',
  borderRadius: '12px',
  padding: '32px',
  marginBottom: '32px',
  border: '1px solid #333333',
  marginTop: '24px',
};

const boxLabel = {
  color: '#ffffff',
  fontSize: '11px',
  textTransform: 'uppercase' as const,
  letterSpacing: '0.1em',
  marginBottom: '16px',
  fontWeight: '700',
  opacity: 0.5,
};

const replyTextContent = {
  fontSize: '16px',
  lineHeight: '28px',
  color: '#ffffff',
  margin: '0',
  whiteSpace: 'pre-wrap' as const,
};

const hr = {
  borderColor: '#222222',
  margin: '32px 0',
};

const originalBox = {
  backgroundColor: '#0a0a0a',
  borderRadius: '12px',
  padding: '24px',
  border: '1px solid #222222',
};

const boxLabelSecondary = {
  color: '#666666',
  fontSize: '11px',
  textTransform: 'uppercase' as const,
  letterSpacing: '0.1em',
  marginBottom: '12px',
  fontWeight: '700',
};

const originalMessageText = {
  fontSize: '14px',
  lineHeight: '24px',
  color: '#888888',
  margin: '0',
  whiteSpace: 'pre-wrap' as const,
};

const footer = {
  textAlign: 'center' as const,
  marginTop: '40px',
};

const footerText = {
  fontSize: '12px',
  color: '#444444',
  margin: '8px 0',
};

const footerLink = {
  color: '#888888',
  textDecoration: 'none',
};

const signature = {
  fontSize: '16px',
  lineHeight: '26px',
  color: '#ffffff',
  marginTop: '24px',
  marginBottom: '4px',
};

const signatureLink = {
  color: '#3b82f6',
  textDecoration: 'none',
  fontSize: '16px',
};
