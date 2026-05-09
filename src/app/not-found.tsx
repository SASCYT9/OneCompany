import Link from "next/link";
import type { Metadata } from "next";

// Global 404 page for routes without locale
// This renders within the root layout, so no html/body tags needed

export const metadata: Metadata = {
  title: "404 — Page Not Found",
  robots: { index: false, follow: true },
};

export default function NotFound() {
  return (
    <div className="min-h-[70vh] flex items-center justify-center px-4 bg-background text-foreground">
      <div className="text-center max-w-lg">
        {/* Large 404 */}
        <div className="mb-6">
          <h1 className="text-[150px] sm:text-[200px] font-bold leading-none text-transparent bg-clip-text bg-linear-to-b from-foreground/40 to-foreground select-none">
            404
          </h1>
        </div>

        {/* Text */}
        <h2 className="text-2xl sm:text-3xl font-semibold mb-3">Page not found</h2>
        <p className="text-foreground/65 mb-8 leading-relaxed">
          The page you are looking for does not exist or has been moved.
        </p>

        {/* Buttons */}
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            href="/ua"
            className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold rounded-xl transition-all duration-200"
          >
            Go Home
          </Link>
        </div>
      </div>
    </div>
  );
}
