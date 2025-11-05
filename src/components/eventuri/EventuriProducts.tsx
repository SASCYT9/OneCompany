'use client';

export function EventuriProducts() {
  const products = [
    { id: '1', name: 'Carbon Intake BMW M3/M4', price: '€1,299', series: 'S55', features: ['100% карбон', 'Патент Venturi', '+22л.с.', 'CFD оптимізація'] },
    { id: '2', name: 'Carbon Intake Porsche 992', price: '€1,499', series: '992 GT3', features: ['Преформований карбон', 'Підвищений потік', '+18л.с.', 'Track tested'] },
    { id: '3', name: 'Carbon Intake Audi RS6', price: '€1,399', series: 'C8', features: ['Twin впуск', 'Максимальний потік', '+25л.с.', 'Plug & Play'] },
    { id: '4', name: 'Universal Inlet', price: '€899', series: 'Universal', features: ['Адаптивний дизайн', 'Карбон вставки', 'Легка установка', 'Premium якість'] },
  ];

  return (
    <section id="products" className="relative py-24 px-6 bg-gradient-to-b from-black via-blue-950/10 to-black">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-16">
          <h2 className="text-5xl md:text-6xl font-bold text-white mb-6">
            <span className="bg-gradient-to-r from-blue-200 to-cyan-400 bg-clip-text text-transparent">Каталог</span>
            {' '}<span className="text-white/90 font-light">Eventuri</span>
          </h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          {products.map((product) => (
            <div key={product.id} className="group bg-gradient-to-b from-slate-800/50 to-slate-900/50 rounded-2xl overflow-hidden border border-white/10 hover:border-blue-500/50 transition-all duration-500 p-6">
              <div className="text-6xl mb-4 text-center">💨</div>
              <h3 className="text-2xl font-bold text-white mb-2">{product.name}</h3>
              <span className="inline-block px-3 py-1 bg-blue-500/90 text-white text-xs font-bold rounded-full mb-4">{product.series}</span>
              <ul className="space-y-2 mb-6">
                {product.features.map((feature, idx) => (
                  <li key={idx} className="flex items-start gap-2 text-sm text-white/70">
                    <svg className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                    {feature}
                  </li>
                ))}
              </ul>
              <div className="text-2xl font-bold text-blue-400">{product.price}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
