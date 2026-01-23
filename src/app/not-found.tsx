import Link from 'next/link';

// Global 404 page for routes without locale
// This renders within the root layout, so no html/body tags needed

export default function NotFound() {
  return (
    <div className="min-h-[70vh] flex items-center justify-center px-4 bg-black text-white">
      <div className="text-center max-w-lg">
        {/* Large 404 */}
        <div className="mb-6">
          <h1 className="text-[150px] sm:text-[200px] font-bold leading-none text-transparent bg-clip-text bg-gradient-to-b from-zinc-600 to-zinc-900 select-none">
            404
          </h1>
        </div>

        {/* Text */}
        <h2 className="text-2xl sm:text-3xl font-semibold mb-3">
          Page not found
        </h2>
        <p className="text-zinc-400 mb-8 leading-relaxed">
          The page you are looking for does not exist or has been moved.
        </p>

        {/* Buttons */}
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            href="/ua"
            className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-white hover:bg-zinc-200 text-black font-semibold rounded-xl transition-all duration-200"
          >
            Go Home
          </Link>
        </div>
      </div>
    </div>
  );
}
