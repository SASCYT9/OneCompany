import type { Metadata } from "next";
import Script from "next/script";
import "./globals.css";
import { ThemeProvider } from "@/components/ui/ThemeProvider";
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

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="uk" suppressHydrationWarning>
      <body
        className="antialiased bg-white text-black dark:bg-black dark:text-white"
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
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          enableSystem
          disableTransitionOnChange
        >
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
