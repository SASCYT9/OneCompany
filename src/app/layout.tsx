import type { Metadata } from "next";
import Script from "next/script";
import "./globals.css";
import { ThemeProvider } from "@/components/ui/ThemeProvider";
import AuthProvider from "@/components/AuthProvider";
import { Onest, IBM_Plex_Mono } from "next/font/google";
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

const fontSans = Onest({
  subsets: ["latin", "latin-ext", "cyrillic"],
  weight: ["300", "400", "500", "600", "700"],
  variable: "--font-sans",
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
