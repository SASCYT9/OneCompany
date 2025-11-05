'use client';

export function FiTechnology() {
  return (
    <section className="relative py-24 px-6 bg-gradient-to-b from-black via-rose-950/10 to-black">
      <div className="max-w-7xl mx-auto text-center">
        <h2 className="text-5xl font-bold text-white mb-12">
          <span className="text-white/90 font-light">Технології</span>{' '}
          <span className="bg-gradient-to-r from-red-200 to-rose-400 bg-clip-text text-transparent">Fi</span>
        </h2>
        <p className="text-xl text-white/60 mb-16">Японська якість. Титанові інновації.</p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="p-8 bg-slate-800/30 rounded-2xl border border-white/10">
            <div className="text-5xl mb-4">⚙️</div>
            <h3 className="text-2xl font-bold text-white mb-4">Valvetronic</h3>
            <p className="text-white/70">Електронне управління клапанами для контролю звуку</p>
          </div>
          <div className="p-8 bg-slate-800/30 rounded-2xl border border-white/10">
            <div className="text-5xl mb-4">🔬</div>
            <h3 className="text-2xl font-bold text-white mb-4">Titanium Grade 2</h3>
            <p className="text-white/70">Авіаційний титан для максимальної довговічності</p>
          </div>
          <div className="p-8 bg-slate-800/30 rounded-2xl border border-white/10">
            <div className="text-5xl mb-4">🎵</div>
            <h3 className="text-2xl font-bold text-white mb-4">Sound Engineering</h3>
            <p className="text-white/70">Унікальне звучання розроблене інженерами Fi</p>
          </div>
        </div>
      </div>
    </section>
  );
}
