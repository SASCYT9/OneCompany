import type { Metadata } from "next";
import Script from "next/script";
import "./globals.css";
import { ThemeProvider } from "@/components/ui/ThemeProvider";
import AuthProvider from "@/components/AuthProvider";
import localFont from "next/font/local";
import { IBM_Plex_Mono } from "next/font/google";
// Root layout should be lean; navigation is rendered inside locale layout to access translations

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

import { cn } from "@/lib/utils";

const fontSans = localFont({
  variable: "--font-sans",
  display: "swap",
  src: [
    {
      path: "../assets/fonts/unison/unison-pro-light.otf",
      weight: "300",
      style: "normal",
    },
    {
      path: "../assets/fonts/unison/unison-pro-light-italic.otf",
      weight: "300",
      style: "italic",
    },
    {
      path: "../assets/fonts/unison/unison-pro-bold.otf",
      weight: "700",
      style: "normal",
    },
    {
      path: "../assets/fonts/unison/unison-pro-bold-italic.otf",
      weight: "700",
      style: "italic",
    },
  ],
});

const fontMono = IBM_Plex_Mono({
  subsets: ["latin", "latin-ext", "cyrillic"],
  weight: ["400", "500"],
  variable: "--font-mono",
});

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="uk" suppressHydrationWarning>
      <body
        className={cn(
          "min-h-screen bg-background text-foreground antialiased",
          fontSans.variable,
          fontMono.variable
        )}
        suppressHydrationWarning
      >
        {/* Optional: Plausible analytics if NEXT_PUBLIC_PLAUSIBLE_DOMAIN is configured */}
        {process.env.NEXT_PUBLIC_PLAUSIBLE_DOMAIN ? (
          <Script
            defer
            data-domain={process.env.NEXT_PUBLIC_PLAUSIBLE_DOMAIN}
            src="https://plausible.io/js/script.js"
          />
        ) : null}
        <AuthProvider>
          <ThemeProvider
            attribute="class"
            defaultTheme="dark"
            enableSystem
            disableTransitionOnChange
          >
            {children}
          </ThemeProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
