import type { Metadata, Viewport } from 'next';
import Script from 'next/script';

export const metadata: Metadata = {
  title: 'OneCompany | Telegram Mini App',
  description: 'Преміум автосервіс у Києві',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
};

export default function TelegramAppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <Script src="https://telegram.org/js/telegram-web-app.js" strategy="beforeInteractive" />
      <div className="bg-[#0a0a0a] text-white antialiased overflow-x-hidden min-h-screen">
        {children}
      </div>
    </>
  );
}
