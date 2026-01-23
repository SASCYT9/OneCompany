'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log error to analytics/monitoring
    console.error('Page error:', error);
  }, [error]);

  return (
    <div className="min-h-[80vh] flex items-center justify-center px-4">
      <div className="text-center max-w-md">
        {/* Icon */}
        <div className="mb-8 flex justify-center">
          <div className="relative">
            <div className="w-24 h-24 rounded-full bg-red-500/10 flex items-center justify-center">
              <AlertTriangle className="w-12 h-12 text-red-500" />
            </div>
            <div className="absolute -bottom-1 -right-1 w-8 h-8 rounded-full bg-zinc-900 border-2 border-red-500/30 flex items-center justify-center">
              <span className="text-xs font-bold text-red-500">!</span>
            </div>
          </div>
        </div>

        {/* Text */}
        <h1 className="text-3xl font-bold text-white mb-4">
          Щось пішло не так
        </h1>
        <p className="text-zinc-400 mb-8 leading-relaxed">
          Виникла непередбачена помилка. Спробуйте оновити сторінку або поверніться на головну.
        </p>

        {/* Buttons */}
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <button
            onClick={reset}
            className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-white hover:bg-zinc-200 text-black font-semibold rounded-xl transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]"
          >
            <RefreshCw className="w-4 h-4" />
            Спробувати знову
          </button>
          
          <Link
            href="/"
            className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-zinc-800 hover:bg-zinc-700 text-white font-medium rounded-xl border border-zinc-700 transition-all duration-200"
          >
            <Home className="w-4 h-4" />
            На головну
          </Link>
        </div>

        {/* Error details (dev only) */}
        {process.env.NODE_ENV === 'development' && error.message && (
          <div className="mt-8 p-4 bg-zinc-900 border border-zinc-800 rounded-lg text-left">
            <p className="text-xs text-zinc-500 mb-1">Error details:</p>
            <code className="text-xs text-red-400 break-all">{error.message}</code>
          </div>
        )}
      </div>
    </div>
  );
}
