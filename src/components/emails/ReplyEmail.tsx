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

const baseUrl = process.env.VERCEL_URL
  ? `https://${process.env.VERCEL_URL}`
  : 'http://localhost:3000';

export const ReplyEmail = ({
  userName,
  replyText,
  originalMessage,
}: ReplyEmailProps) => (
  <Html>
    <Head />
    <Preview>Re: Your inquiry to OneCompany</Preview>
    <Tailwind>
      <Body className="bg-white my-auto mx-auto font-sans">
        <Container className="border border-solid border-[#eaeaea] rounded my-[40px] mx-auto p-[20px] w-[465px]">
          <Section className="mt-[32px] text-center">
            <Img
              src={`${baseUrl}/logos/one-company-logo.png`}
              width="150"
              alt="OneCompany"
              className="my-0 mx-auto"
            />
          </Section>
          <Heading className="text-black text-[24px] font-normal text-center p-0 my-[30px] mx-0">
            Re: Your inquiry
          </Heading>
          <Text className="text-black text-[14px] leading-[24px]">
            Hello {userName},
          </Text>
          <Text className="text-black text-[14px] leading-[24px]">
            Thank you for contacting us. Here is our reply regarding your message:
          </Text>
          <Section className="bg-gray-100 rounded-md p-4 my-4">
            <Text className="text-black text-[14px] leading-[24px] whitespace-pre-wrap">{replyText}</Text>
          </Section>
          <Hr className="border border-solid border-[#eaeaea] my-[26px] mx-0 w-full" />
          <Text className="text-[#666666] text-[12px] leading-[24px]">
            This is a reply to your message:
          </Text>
          <Text className="text-[#666666] text-[12px] leading-[24px] italic border-l-2 border-solid border-gray-300 pl-4">
            &ldquo;{originalMessage}&rdquo;
          </Text>
          <Section className="text-center mt-[32px] mb-[32px]">
             <Text className="text-[#666666] text-[12px] leading-[24px]">
                © 2025 OneCompany. All rights reserved.
             </Text>
          </Section>
        </Container>
      </Body>
    </Tailwind>
  </Html>
);

export default ReplyEmail;
