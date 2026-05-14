// Next.js shows this fallback whenever the user navigates TO the racechip
// catalog (button click, direct URL, /shop/racechip "Знайти тюнінг", etc.)
// while the route's RSC payload is being fetched/streamed. Renders the same
// atmospheric chrome as the real page so the transition looks intentional
// instead of a frozen click.
export default function RacechipCatalogLoading() {
  return (
    <div className="relative min-h-screen bg-background text-foreground overflow-hidden font-sans">
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1000px] h-[800px] bg-[#ff4a00] opacity-[0.02] blur-[180px] pointer-events-none z-0 rounded-full hidden dark:block" />
      <div className="absolute inset-0 bg-[url('/noise.png')] opacity-20 mix-blend-overlay pointer-events-none z-0 hidden dark:block" />

      <div className="relative z-10 pt-[140px] max-w-[1700px] mx-auto px-6 md:px-12 lg:px-16 pb-20">
        {/* Spinner band centred where the filter row will appear */}
        <div className="flex items-center justify-center py-32">
          <div
            className="w-10 h-10 border-2 border-[#ff4a00]/30 border-t-[#ff4a00] rounded-full animate-spin"
            role="status"
            aria-label="Loading"
          />
        </div>

        {/* Card-grid skeleton — 6 placeholder tiles in the same 3-col layout */}
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-6 lg:gap-8">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="bg-card dark:bg-[#080808] border border-foreground/12 dark:border-white/5 shadow-xl animate-pulse"
              style={{ animationDelay: `${i * 75}ms` }}
            >
              <div className="aspect-square w-full bg-foreground/5 dark:bg-white/[0.03] border-b border-foreground/12 dark:border-white/5" />
              <div className="px-6 py-6 space-y-3">
                <div className="h-2 w-1/3 bg-foreground/10 dark:bg-white/10 rounded" />
                <div className="h-3 w-5/6 bg-foreground/10 dark:bg-white/10 rounded" />
                <div className="h-3 w-2/3 bg-foreground/10 dark:bg-white/10 rounded" />
                <div className="h-5 w-1/3 bg-foreground/15 dark:bg-white/15 rounded mt-4" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
