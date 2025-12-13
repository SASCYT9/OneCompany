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
  Tailwind,
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
    <Tailwind>
      <Body className="bg-[#050505] my-auto mx-auto font-sans text-white">
        <Container className="border border-solid border-white/10 rounded-2xl my-[40px] mx-auto p-[32px] w-[600px] bg-[#0c0c12] shadow-2xl">
          <Section className="text-center mb-8">
            <Img
              src={`${baseUrl}/branding/one-company-logo.png`}
              width="160"
              alt="OneCompany"
              className="my-0 mx-auto"
            />
          </Section>
          <Heading className="text-white text-[24px] font-semibold text-center p-0 mb-6 tracking-tight">
            Re: Your inquiry
          </Heading>
          <Text className="text-gray-300 text-[15px] leading-[26px] mb-4">
            Hello {userName},
          </Text>
          <Text className="text-gray-300 text-[15px] leading-[26px] mb-6">
            Thank you for contacting us. Here is our reply regarding your message:
          </Text>
          <Section className="bg-white/5 rounded-lg p-6 mb-8 border border-white/5">
            <Text className="text-white text-[15px] leading-[26px] whitespace-pre-wrap m-0">{replyText}</Text>
          </Section>
          <Hr className="border border-solid border-white/10 my-6 w-full" />
          <Text className="text-gray-500 text-[12px] uppercase tracking-widest font-semibold mb-2">
            Original Message
          </Text>
          <Text className="text-gray-400 text-[13px] leading-[24px] italic border-l-2 border-solid border-white/20 pl-4">
            &ldquo;{originalMessage}&rdquo;
          </Text>
          <Section className="text-center mt-8">
             <Text className="text-gray-600 text-[12px]">
                © 2025 OneCompany. All rights reserved.
             </Text>
          </Section>
        </Container>
      </Body>
    </Tailwind>
  </Html>
);

export default ReplyEmail;
