'use client';

export function KWTechnology() {
  const technologies = [
    {
      title: 'TVD Technology',
      subtitle: 'Top Valve Design',
      description: 'Патентована технологія клапана верхнього монтажу для максимальної точності налаштувань',
      icon: '⚙️',
      features: ['16 позицій регулювання', 'Точність ±2%', 'Температурна стабільність'],
    },
    {
      title: 'Inox-Line',
      subtitle: 'Нержавіюча сталь',
      description: 'Корпуси з нержавіючої сталі для максимальної довговічності та захисту від корозії',
      icon: '🛡️',
      features: ['10 років гарантії', 'Стійкість до солі', 'Преміум якість'],
    },
    {
      title: 'HLS System',
      subtitle: 'Hydraulic Lift System',
      description: 'Гідравлічна система підйому для подолання лежачих поліцейських та підземних паркінгів',
      icon: '📐',
      features: ['Підйом до 45мм', 'Одна кнопка', 'Збереження налаштувань'],
    },
    {
      title: 'DDC ECU',
      subtitle: 'Dynamic Damping Control',
      description: 'Електронне керування демпфуванням з адаптацією до стилю водіння',
      icon: '🖥️',
      features: ['3 режими руху', 'Авто-адаптація', 'GPS трекінг'],
    },
  ];

  return (
    <section id="technology" className="relative py-24 px-6 bg-gradient-to-b from-black via-orange-950/10 to-black">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="text-center mb-16">
          <div className="inline-block px-6 py-2 bg-amber-500/20 border border-amber-400/40 rounded-full text-amber-300 text-sm font-medium tracking-widest backdrop-blur-sm mb-6">
            ІННОВАЦІЇ
          </div>
          <h2 className="text-5xl md:text-6xl font-bold text-white mb-6">
            <span className="text-white/90 font-light">Технології</span>{' '}
            <span className="bg-gradient-to-r from-amber-200 to-orange-400 bg-clip-text text-transparent">
              KW
            </span>
          </h2>
          <p className="text-xl text-white/60 max-w-2xl mx-auto">
            30+ років досліджень та розробок у кожному продукті
          </p>
        </div>

        {/* Technologies Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-16">
          {technologies.map((tech, idx) => (
            <div
              key={idx}
              className="group relative p-8 bg-gradient-to-br from-slate-800/50 to-slate-900/50 rounded-2xl border border-white/10 hover:border-amber-500/50 transition-all duration-500 hover:shadow-2xl hover:shadow-amber-500/20"
            >
              {/* Icon */}
              <div className="text-6xl mb-4 opacity-80 group-hover:scale-110 transition-transform duration-300">
                {tech.icon}
              </div>

              {/* Title */}
              <h3 className="text-3xl font-bold text-white mb-2">{tech.title}</h3>
              <div className="text-amber-400 text-sm font-medium mb-4">{tech.subtitle}</div>

              {/* Description */}
              <p className="text-white/70 mb-6 leading-relaxed">{tech.description}</p>

              {/* Features */}
              <div className="space-y-2">
                {tech.features.map((feature, fidx) => (
                  <div key={fidx} className="flex items-center gap-2 text-sm text-white/60">
                    <div className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                    {feature}
                  </div>
                ))}
              </div>

              {/* Hover effect */}
              <div className="absolute inset-0 bg-gradient-to-br from-amber-500/0 to-orange-500/0 group-hover:from-amber-500/5 group-hover:to-orange-500/5 rounded-2xl transition-all duration-500" />
            </div>
          ))}
        </div>

        {/* Video Section */}
        <div className="relative rounded-2xl overflow-hidden">
          <div className="aspect-video bg-slate-800">
            <iframe
              className="w-full h-full"
              src="https://www.youtube.com/embed/dQw4w9WgXcQ"
              title="KW Technology"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          </div>
          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 to-transparent p-8">
            <h3 className="text-2xl font-bold text-white mb-2">
              Як працює технологія KW Variant 3
            </h3>
            <p className="text-white/70">
              Детальний огляд системи окремого регулювання компресії та відбою
            </p>
          </div>
        </div>

        {/* Certifications */}
        <div className="mt-16 grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
          <div>
            <div className="text-4xl mb-2">🏆</div>
            <div className="text-white/80 font-medium">TÜV Certified</div>
            <div className="text-white/50 text-sm">Німецька сертифікація</div>
          </div>
          <div>
            <div className="text-4xl mb-2">🔬</div>
            <div className="text-white/80 font-medium">R&D Center</div>
            <div className="text-white/50 text-sm">Власна лабораторія</div>
          </div>
          <div>
            <div className="text-4xl mb-2">🏁</div>
            <div className="text-white/80 font-medium">Motorsport</div>
            <div className="text-white/50 text-sm">Гоночний досвід</div>
          </div>
          <div>
            <div className="text-4xl mb-2">🛡️</div>
            <div className="text-white/80 font-medium">10Y Warranty</div>
            <div className="text-white/50 text-sm">Гарантія якості</div>
          </div>
        </div>
      </div>
    </section>
  );
}
