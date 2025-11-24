import type { Metadata } from "next";
import Script from "next/script";
import "./globals.css";
import { ThemeProvider } from "@/components/ui/ThemeProvider";
import AuthProvider from "@/components/AuthProvider";
import localFont from "next/font/local";
import { IBM_Plex_Mono } from "next/font/google";
// Root layout should be lean; navigation is rendered inside locale layout to access translations

export const metadata: Metadata = {
  title: "onecompany — Premium Auto & Moto Performance Hub",
  description: "Провідний B2B дистриб'ютор та експертна підтримка преміум тюнінгу. 200+ брендів для авто та мото, логістика та технічна підтримка.",
  keywords: ["auto tuning", "moto tuning", "performance parts", "premium automotive", "b2b distribution", "expert support"],
  openGraph: {
    title: "onecompany — Premium Auto & Moto Performance Hub",
    description: "Провідний B2B дистриб'ютор та експертна підтримка преміум тюнінгу",
    type: "website",
    siteName: "onecompany",
    locale: "uk_UA",
  },
  twitter: {
    card: "summary_large_image",
    title: "onecompany — Premium Auto & Moto Performance Hub",
    description: "Провідний B2B дистриб'ютор та експертна підтримка преміум тюнінгу",
  },
  robots: {
    index: true,
    follow: true,
  },
  icons: {
    icon: "/branding/one-company-logo.svg",
    shortcut: "/branding/one-company-logo.svg",
    apple: "/branding/one-company-logo.svg",
  },
};

import { cn } from "@/lib/utils";

const fontSans = localFont({
  src: [
    {
      path: "../assets/fonts/unison/unison-pro-light.otf",
      weight: "300",
      style: "normal",
    },
    {
      path: "../assets/fonts/unison/unison-pro-light.otf",
      weight: "400", // Mapping regular to light as per design preference for thin look
      style: "normal",
    },
    {
      path: "../assets/fonts/unison/unison-pro-light.otf",
      weight: "500",
      style: "normal",
    },
    {
      path: "../assets/fonts/unison/unison-pro-bold.otf",
      weight: "600",
      style: "normal",
    },
    {
      path: "../assets/fonts/unison/unison-pro-bold.otf",
      weight: "700",
      style: "normal",
    },
    {
      path: "../assets/fonts/unison/unison-pro-light-italic.otf",
      weight: "300",
      style: "italic",
    },
    {
      path: "../assets/fonts/unison/unison-pro-bold-italic.otf",
      weight: "700",
      style: "italic",
    },
  ],
  variable: "--font-sans",
  display: "swap",
});

const fontDisplay = localFont({
  src: [
    {
      path: "../assets/fonts/unison/unison-pro-light.otf",
      weight: "300",
      style: "normal",
    },
    {
      path: "../assets/fonts/unison/unison-pro-bold.otf",
      weight: "700",
      style: "normal",
    },
  ],
  variable: "--font-display",
  display: "swap",
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
  <html lang="en" suppressHydrationWarning>
      <body
        className={cn(
          "min-h-screen bg-background text-foreground antialiased",
          fontSans.variable,
          fontDisplay.variable,
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
