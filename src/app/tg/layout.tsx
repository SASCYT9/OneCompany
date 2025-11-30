import type { Metadata, Viewport } from 'next';
import '../globals.css';

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
    <html lang="uk">
      <head>
        <script src="https://telegram.org/js/telegram-web-app.js" />
      </head>
      <body className="bg-[#0a0a0a] text-white antialiased overflow-x-hidden">
        {children}
      </body>
    </html>
  );
}
