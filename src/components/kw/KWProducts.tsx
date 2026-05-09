"use client";

import { useState } from "react";

interface Product {
  id: string;
  name: string;
  series: string;
  price: string;
  image: string;
  features: string[];
  compatibility: string;
  description: string;
}

export function KWProducts() {
  const [selectedCategory, setSelectedCategory] = useState("coilovers");

  const categories = [
    { id: "coilovers", name: "Койловери", icon: "🔧" },
    { id: "springs", name: "Пружини", icon: "🔩" },
    { id: "dampers", name: "Амортизатори", icon: "⚙️" },
    { id: "hls", name: "HLS системи", icon: "📐" },
  ];

  const products: Product[] = [
    {
      id: "v3",
      name: "KW V3",
      series: "Variant 3",
      price: "€1,899",
      image: "/images/kw/v3-coilover.jpg",
      features: [
        "Окрема регулювання компресії та відбою",
        "Регулювання висоти (30-65мм)",
        "TÜV сертифікація",
        "Нержавіюча сталь",
      ],
      compatibility: "BMW M3/M4 (F80/F82)",
      description: "Топова серія з повним контролем характеристик підвіски",
    },
    {
      id: "v2",
      name: "KW V2",
      series: "Variant 2",
      price: "€1,499",
      image: "/images/kw/v2-coilover.jpg",
      features: [
        "Регулювання відбою (16 кліків)",
        "Регулювання висоти (25-55мм)",
        "TÜV сертифікація",
        "Захист від корозії",
      ],
      compatibility: "Porsche 911 (992)",
      description: "Ідеальний баланс вартості та продуктивності",
    },
    {
      id: "v1",
      name: "KW V1",
      series: "Variant 1",
      price: "€999",
      image: "/images/kw/v1-coilover.jpg",
      features: [
        "Фіксовані налаштування демпфування",
        "Регулювання висоти (20-45мм)",
        "TÜV сертифікація",
        "Компактна конструкція",
      ],
      compatibility: "Volkswagen Golf GTI (Mk8)",
      description: "Ідеально для щоденного використання",
    },
    {
      id: "clubsport",
      name: "KW Clubsport",
      series: "3-Way",
      price: "€3,499",
      image: "/images/kw/clubsport.jpg",
      features: [
        "3-х позиційне регулювання",
        "Низьке та високе регулювання компресії",
        "Окреме регулювання відбою",
        "Motorsport сертифікація",
      ],
      compatibility: "Universal (Motorsport)",
      description: "Професійне гоночне обладнання",
    },
  ];

  return (
    <section
      id="products"
      className="relative py-24 px-6 bg-linear-to-b from-black via-slate-900/50 to-black"
    >
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="text-center mb-16">
          <h2 className="text-5xl md:text-6xl font-bold text-white mb-6">
            <span className="bg-linear-to-r from-amber-200 to-orange-400 bg-clip-text text-transparent">
              Каталог
            </span>{" "}
            <span className="text-white/90 font-light">продукції</span>
          </h2>
          <p className="text-xl text-white/60 max-w-2xl mx-auto">
            Оберіть ідеальне рішення для вашого автомобіля
          </p>
        </div>

        {/* Categories */}
        <div className="flex flex-wrap justify-center gap-4 mb-12">
          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id)}
              className={`px-6 py-3 rounded-lg font-medium transition-all duration-300 ${
                selectedCategory === cat.id
                  ? "bg-linear-to-r from-amber-500 to-orange-600 text-white shadow-lg shadow-amber-500/30"
                  : "bg-white/5 text-white/70 hover:bg-white/10 border border-white/10"
              }`}
            >
              <span className="mr-2">{cat.icon}</span>
              {cat.name}
            </button>
          ))}
        </div>

        {/* Products Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          {products.map((product) => (
            <div
              key={product.id}
              className="group relative bg-linear-to-b from-slate-800/50 to-slate-900/50 rounded-2xl overflow-hidden border border-white/10 hover:border-amber-500/50 transition-all duration-500 hover:shadow-2xl hover:shadow-amber-500/20"
            >
              {/* Image */}
              <div className="relative h-64 bg-slate-800 overflow-hidden">
                <div className="absolute inset-0 bg-linear-to-b from-transparent to-slate-900" />
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="text-6xl opacity-20">🔧</div>
                </div>
                {/* Badge */}
                <div className="absolute top-4 right-4">
                  <span className="px-3 py-1 bg-amber-500/90 text-white text-xs font-bold rounded-full">
                    {product.series}
                  </span>
                </div>
              </div>

              {/* Content */}
              <div className="p-6">
                <h3 className="text-2xl font-bold text-white mb-2">{product.name}</h3>
                <p className="text-white/60 text-sm mb-4">{product.description}</p>

                {/* Features */}
                <ul className="space-y-2 mb-6">
                  {product.features.map((feature, idx) => (
                    <li key={idx} className="flex items-start gap-2 text-sm text-white/70">
                      <svg
                        className="w-5 h-5 text-amber-400 shrink-0 mt-0.5"
                        fill="currentColor"
                        viewBox="0 0 20 20"
                      >
                        <path
                          fillRule="evenodd"
                          d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                          clipRule="evenodd"
                        />
                      </svg>
                      {feature}
                    </li>
                  ))}
                </ul>

                {/* Compatibility */}
                <div className="mb-4 p-3 bg-white/5 rounded-lg border border-white/10">
                  <div className="text-xs text-white/50 mb-1">Сумісність</div>
                  <div className="text-sm text-white/80 font-medium">{product.compatibility}</div>
                </div>

                {/* Price & CTA */}
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-xs text-white/50">Ціна від</div>
                    <div className="text-2xl font-bold text-amber-400">{product.price}</div>
                  </div>
                  <button className="px-4 py-2 bg-linear-to-r from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 text-white text-sm font-semibold rounded-lg transition-all duration-300 hover:shadow-lg hover:shadow-amber-500/30">
                    Замовити
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Bottom CTA */}
        <div className="mt-16 text-center">
          <p className="text-white/60 mb-6">Не знаєте що обрати?</p>
          <button className="px-8 py-4 bg-white/5 hover:bg-white/10 border-2 border-amber-400/50 hover:border-amber-400 text-white font-semibold rounded-lg transition-all duration-300">
            Отримати консультацію
          </button>
        </div>
      </div>
    </section>
  );
}
