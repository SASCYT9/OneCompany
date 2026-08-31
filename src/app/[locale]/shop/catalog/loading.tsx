export default function CatalogLoading() {
  return (
    <main
      aria-busy="true"
      aria-label="Loading catalog"
      className="min-h-screen bg-white px-4 pb-20 pt-28 dark:bg-zinc-950"
    >
      <div className="mx-auto max-w-7xl animate-pulse">
        <div className="h-3 w-40 bg-zinc-200 dark:bg-zinc-800" />
        <div className="mt-5 h-12 w-72 max-w-full bg-zinc-200 dark:bg-zinc-800" />
        <div className="mt-10 grid gap-4 border-y border-zinc-200 py-6 md:grid-cols-2 xl:grid-cols-4 dark:border-white/10">
          {Array.from({ length: 8 }, (_, index) => (
            <div key={index} className="h-16 bg-zinc-100 dark:bg-zinc-900" />
          ))}
        </div>
        <div className="mt-10 grid grid-cols-1 gap-px bg-zinc-200 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 dark:bg-white/10">
          {Array.from({ length: 8 }, (_, index) => (
            <div key={index} className="bg-white p-5 dark:bg-zinc-950">
              <div className="aspect-square bg-zinc-100 dark:bg-zinc-900" />
              <div className="mt-5 h-3 w-20 bg-zinc-200 dark:bg-zinc-800" />
              <div className="mt-3 h-5 w-4/5 bg-zinc-200 dark:bg-zinc-800" />
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
