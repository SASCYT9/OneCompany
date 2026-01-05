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
            src={`${baseUrl}/branding/one-company-logo.png`}
            width="120"
            height="120"
            alt="OneCompany"
            style={logo}
          />
        </Section>
        
        <Section style={contentContainer}>
          <Heading style={heading}>Re: Your inquiry</Heading>
          
          <Text style={paragraph}>
            Hello {userName},
          </Text>
          <Text style={paragraph}>
            Thank you for contacting us. Here is our reply regarding your message:
          </Text>
          
          <Section style={replyBox}>
            <Text style={replyTextContent}>{replyText}</Text>
          </Section>
          
          <Hr style={hr} />
          
          <Text style={label}>Original Message</Text>
          <Text style={originalMessageText}>
            "{originalMessage}"
          </Text>
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
  marginBottom: '32px',
};

const logo = {
  margin: '0 auto',
  display: 'block',
};

const contentContainer = {
  backgroundColor: '#111111',
  borderRadius: '12px',
  border: '1px solid #333333',
  padding: '40px',
};

const heading = {
  fontSize: '24px',
  fontWeight: '600',
  textAlign: 'center' as const,
  color: '#ffffff',
  margin: '0 0 24px',
  letterSpacing: '-0.02em',
};

const paragraph = {
  fontSize: '16px',
  lineHeight: '26px',
  color: '#cccccc',
  marginBottom: '16px',
};

const replyBox = {
  backgroundColor: '#1a1a1a',
  borderRadius: '8px',
  padding: '24px',
  marginBottom: '32px',
  borderLeft: '4px solid #ffffff',
};

const replyTextContent = {
  fontSize: '16px',
  lineHeight: '26px',
  color: '#ffffff',
  margin: '0',
  whiteSpace: 'pre-wrap' as const,
};

const hr = {
  borderColor: '#333333',
  margin: '32px 0',
};

const label = {
  color: '#888888',
  fontSize: '12px',
  textTransform: 'uppercase' as const,
  letterSpacing: '0.1em',
  marginBottom: '12px',
  fontWeight: '600',
};

const originalMessageText = {
  fontSize: '14px',
  lineHeight: '24px',
  color: '#888888',
  fontStyle: 'italic',
  margin: '0',
};

const footer = {
  textAlign: 'center' as const,
  marginTop: '32px',
};

const footerText = {
  fontSize: '12px',
  color: '#666666',
  margin: '8px 0',
};

const footerLink = {
  color: '#888888',
  textDecoration: 'none',
};

