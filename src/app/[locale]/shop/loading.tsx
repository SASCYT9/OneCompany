/**
 * Generic shop skeleton — auto-shown by Next.js the moment a user clicks
 * any <Link> into /shop/**. Renders BEFORE the RSC request even reaches
 * the server, so a click never looks frozen even when the destination
 * is slow (cold Lambda, heavy ISR regen, distant region).
 *
 * Reuses the same atmospheric chrome pattern from the racechip catalog
 * loading.tsx (animate-pulse tiles + spinner). Generic enough to make
 * sense as a fallback for any shop sub-route, including PDPs.
 */
export default function ShopLoading() {
  return (
    <div className="relative min-h-screen bg-background text-foreground overflow-hidden font-sans">
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1000px] h-[800px] bg-[#ff4a00] opacity-[0.015] blur-[180px] pointer-events-none z-0 rounded-full hidden dark:block" />

      <div className="relative z-10 pt-[120px] max-w-[1700px] mx-auto px-6 md:px-12 lg:px-16 pb-20">
        {/* Back-link strip */}
        <div className="mb-8 h-3 w-40 bg-foreground/10 dark:bg-white/10 rounded animate-pulse" />

        {/* PDP-shaped hero: gallery + spec column.
            Falls back gracefully to grid view on routes that aren't PDP. */}
        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)] gap-10 mb-16">
          <div className="aspect-square w-full max-w-[720px] bg-foreground/5 dark:bg-white/[0.03] border border-foreground/10 dark:border-white/5 animate-pulse" />
          <div className="space-y-4 pt-2">
            <div className="h-3 w-24 bg-foreground/10 dark:bg-white/10 rounded animate-pulse" />
            <div className="h-7 w-4/5 bg-foreground/15 dark:bg-white/15 rounded animate-pulse" />
            <div className="h-4 w-2/3 bg-foreground/10 dark:bg-white/10 rounded animate-pulse" />
            <div className="h-px w-full bg-foreground/10 dark:bg-white/5 my-6" />
            <div className="h-10 w-1/2 bg-foreground/15 dark:bg-white/15 rounded animate-pulse" />
            <div className="h-12 w-full bg-foreground/20 dark:bg-white/20 rounded animate-pulse" />
          </div>
        </div>

        {/* Centred spinner — primary visual indicator that something IS
            happening, regardless of skeleton positioning. */}
        <div className="flex items-center justify-center py-8">
          <div
            className="w-10 h-10 border-2 border-foreground/15 border-t-foreground/40 dark:border-white/15 dark:border-t-white/40 rounded-full animate-spin"
            role="status"
            aria-label="Loading"
          />
        </div>

        {/* Generic grid skeleton — works for catalog routes too. */}
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
