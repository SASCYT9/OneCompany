const pulse = "animate-pulse bg-foreground/[0.08] motion-reduce:animate-none";

function ProductCardSkeleton() {
  return (
    <div className="overflow-hidden rounded-[12px] border border-foreground/10 bg-card">
      <div className={`aspect-[4/3] w-full ${pulse}`} />
      <div className="space-y-3 p-4">
        <div className={`h-2.5 w-1/3 rounded-full ${pulse}`} />
        <div className={`h-4 w-full rounded-full ${pulse}`} />
        <div className={`h-4 w-4/5 rounded-full ${pulse}`} />
        <div className="flex items-center justify-between pt-2">
          <div className={`h-5 w-24 rounded-full ${pulse}`} />
          <div className={`h-9 w-24 rounded-[8px] ${pulse}`} />
        </div>
      </div>
    </div>
  );
}

export default function CatalogLoadingShell() {
  return (
    <main
      className="min-h-screen bg-background text-foreground"
      aria-busy="true"
      aria-label="Loading catalog"
    >
      <span className="sr-only" role="status">
        Loading catalog…
      </span>
      <div className="w-full px-3 pb-32 pt-8 sm:px-5 lg:px-6 2xl:px-8">
        <section className="rounded-[16px] border border-foreground/10 bg-card p-3 shadow-[0_24px_70px_rgba(0,0,0,0.08)] sm:p-4 lg:rounded-[12px] lg:px-5 lg:py-5">
          <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_260px] lg:grid-cols-[minmax(0,1fr)_380px]">
            <div className={`h-12 rounded-[8px] ${pulse}`} />
            <div className={`hidden h-12 rounded-[8px] sm:block ${pulse}`} />
          </div>
          <div className="mt-3 hidden grid-cols-[repeat(3,minmax(0,1fr))_132px] gap-2 lg:grid">
            {Array.from({ length: 4 }, (_, index) => (
              <div key={index} className={`h-11 rounded-[8px] ${pulse}`} />
            ))}
          </div>
        </section>

        <div className="mb-4 sm:mb-5" />
        <div className="grid gap-3 sm:gap-4 lg:grid-cols-[292px_minmax(0,1fr)] xl:grid-cols-[308px_minmax(0,1fr)] 2xl:grid-cols-[320px_minmax(0,1fr)]">
          <aside className="hidden lg:block">
            <div className="h-[calc(100dvh-7rem)] max-h-[760px] rounded-[14px] border border-foreground/10 bg-card p-4 shadow-[0_16px_42px_rgba(0,0,0,0.06)]">
              <div className="flex items-center justify-between border-b border-foreground/10 pb-4">
                <div className="space-y-2">
                  <div className={`h-3 w-20 rounded-full ${pulse}`} />
                  <div className={`h-2.5 w-32 rounded-full ${pulse}`} />
                </div>
                <div className={`h-3 w-14 rounded-full ${pulse}`} />
              </div>
              <div className="space-y-7 pt-5">
                {Array.from({ length: 5 }, (_, group) => (
                  <div key={group} className="space-y-3">
                    <div className={`h-2.5 w-20 rounded-full ${pulse}`} />
                    {Array.from({ length: group === 1 ? 5 : 3 }, (_, row) => (
                      <div key={row} className="flex items-center gap-3">
                        <div className={`h-4 w-4 rounded-[3px] ${pulse}`} />
                        <div className={`h-3 ${row % 2 ? "w-32" : "w-40"} rounded-full ${pulse}`} />
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          </aside>

          <section className="min-w-0">
            <div className="mb-4 rounded-[14px] border border-foreground/10 bg-card p-4 shadow-[0_16px_42px_rgba(0,0,0,0.06)]">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="space-y-2">
                  <div className={`h-5 w-44 rounded-full ${pulse}`} />
                  <div className={`h-3 w-28 rounded-full ${pulse}`} />
                </div>
                <div className="flex gap-2">
                  <div className={`h-10 w-32 rounded-[8px] ${pulse}`} />
                  <div className={`h-10 w-32 rounded-[8px] ${pulse}`} />
                </div>
              </div>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {Array.from({ length: 9 }, (_, index) => (
                <ProductCardSkeleton key={index} />
              ))}
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
