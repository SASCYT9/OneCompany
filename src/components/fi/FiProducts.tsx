'use client';

export function FiProducts() {
  const products = [
    { id: '1', name: 'Valvetronic System', price: '€3,499', series: 'Premium', features: ['Електронне управління', 'Титан Grade 2', '3 режими звуку', 'Приріст +25л.с.'] },
    { id: '2', name: 'Frequency Valve', price: '€2,999', series: 'Sport', features: ['Регулювання звуку', 'Титан + карбон', 'Вага -12кг', 'Plug & Play'] },
    { id: '3', name: 'Full System', price: '€4,999', series: 'Race', features: ['Повна система', 'Титан Grade 5', 'Максимальна потужність', '+30л.с.'] },
    { id: '4', name: 'Cat-Back', price: '€2,499', series: 'Street', features: ['Від каталізатора', 'Сертифікація ECE', 'Вага -8кг', 'OEM підключення'] },
  ];

  return (
    <section id="products" className="relative py-24 px-6 bg-gradient-to-b from-black via-red-950/10 to-black">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-16">
          <h2 className="text-5xl md:text-6xl font-bold text-white mb-6">
            <span className="bg-gradient-to-r from-red-200 to-rose-400 bg-clip-text text-transparent">Каталог</span>
            {' '}<span className="text-white/90 font-light">Fi Exhaust</span>
          </h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          {products.map((product) => (
            <div key={product.id} className="group bg-gradient-to-b from-slate-800/50 to-slate-900/50 rounded-2xl overflow-hidden border border-white/10 hover:border-red-500/50 transition-all duration-500 p-6">
              <div className="text-6xl mb-4 text-center">🔥</div>
              <h3 className="text-2xl font-bold text-white mb-2">{product.name}</h3>
              <span className="inline-block px-3 py-1 bg-red-500/90 text-white text-xs font-bold rounded-full mb-4">{product.series}</span>
              <ul className="space-y-2 mb-6">
                {product.features.map((feature, idx) => (
                  <li key={idx} className="flex items-start gap-2 text-sm text-white/70">
                    <svg className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                    {feature}
                  </li>
                ))}
              </ul>
              <div className="text-2xl font-bold text-red-400">{product.price}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
