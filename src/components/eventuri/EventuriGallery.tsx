'use client';

export function EventuriGallery() {
  return (
    <section className="relative py-24 px-6 bg-black">
      <div className="max-w-7xl mx-auto text-center">
        <h2 className="text-5xl font-bold text-white mb-12">
          <span className="bg-gradient-to-r from-blue-200 to-cyan-400 bg-clip-text text-transparent">Галерея</span>
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="aspect-[4/3] bg-gradient-to-br from-slate-700 to-slate-900 rounded-2xl flex items-center justify-center text-6xl opacity-20">
              🏁
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
