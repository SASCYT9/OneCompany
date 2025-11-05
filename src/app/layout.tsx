import type { Metadata } from "next";
import Script from "next/script";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Navigation } from "@/components/ui/Navigation";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "onecompany — Premium Auto Performance Hub",
  description: "Три спеціалізовані магазини преміум автотюнінгу: KW Suspension, Fi Exhaust, Eventuri. Від німецької точності до японської майстерності.",
  keywords: ["auto tuning", "KW suspensions", "Fi Exhaust", "Eventuri", "performance parts", "premium automotive"],
  openGraph: {
    title: "onecompany — Premium Auto Performance Hub",
    description: "Три спеціалізовані магазини преміум автотюнінгу",
    type: "website",
    siteName: "onecompany",
    locale: "uk_UA",
  },
  twitter: {
    card: "summary_large_image",
    title: "onecompany — Premium Auto Performance Hub",
    description: "Три спеціалізовані магазини преміум автотюнінгу",
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="uk">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {/* Optional: Plausible analytics if NEXT_PUBLIC_PLAUSIBLE_DOMAIN is configured */}
        {process.env.NEXT_PUBLIC_PLAUSIBLE_DOMAIN ? (
          <Script
            defer
            data-domain={process.env.NEXT_PUBLIC_PLAUSIBLE_DOMAIN}
            src="https://plausible.io/js/script.js"
          />
        ) : null}
        <Navigation />
        {children}
      </body>
    </html>
  );
}
