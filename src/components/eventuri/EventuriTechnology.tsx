"use client";

export function EventuriTechnology() {
  return (
    <section className="relative py-24 px-6 bg-linear-to-b from-black via-cyan-950/10 to-black">
      <div className="max-w-7xl mx-auto text-center">
        <h2 className="text-5xl font-bold text-white mb-12">
          <span className="text-white/90 font-light">Технології</span>{" "}
          <span className="bg-linear-to-r from-blue-200 to-cyan-400 bg-clip-text text-transparent">
            Eventuri
          </span>
        </h2>
        <p className="text-xl text-white/60 mb-16">
          Патентовані рішення. CFD аналіз. Інженерна точність.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="p-8 bg-slate-800/30 rounded-2xl border border-white/10">
            <div className="text-5xl mb-4">🌪️</div>
            <h3 className="text-2xl font-bold text-white mb-4">Venturi Effect</h3>
            <p className="text-white/70">Патентована технологія для максимального потоку повітря</p>
          </div>
          <div className="p-8 bg-slate-800/30 rounded-2xl border border-white/10">
            <div className="text-5xl mb-4">🧪</div>
            <h3 className="text-2xl font-bold text-white mb-4">CFD Testing</h3>
            <p className="text-white/70">Комп&rsquo;ютерне моделювання кожного компонента</p>
          </div>
          <div className="p-8 bg-slate-800/30 rounded-2xl border border-white/10">
            <div className="text-5xl mb-4">⚫</div>
            <h3 className="text-2xl font-bold text-white mb-4">Carbon Fiber</h3>
            <p className="text-white/70">Преформований карбон для мінімальної ваги</p>
          </div>
        </div>
      </div>
    </section>
  );
}
