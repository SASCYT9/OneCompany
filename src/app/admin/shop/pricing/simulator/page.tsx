'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { 
  ArrowLeft, Calculator, Truck, Globe, Info, 
  DollarSign, Percent, Weight, ChevronRight,
  TrendingUp, Scale, Package, Plus
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  calcShipping, 
  SHIPPING_ZONES, 
  ShippingZone, 
  lbsToKg,
  volumetricWeightKg
} from '@/lib/shippingCalc';

export default function PriceSimulatorPage() {
  const [basePrice, setBasePrice] = useState<number>(100);
  const [currency, setCurrency] = useState<'USD' | 'EUR'>('USD');
  const [brand, setBrand] = useState<string>('Standard');
  const [weightLbs, setWeightLbs] = useState<number>(5);
  const [length, setLength] = useState<number>(30);
  const [width, setWidth] = useState<number>(20);
  const [height, setHeight] = useState<number>(10);
  const [markup, setMarkup] = useState<number>(25);
  const [zone, setZone] = useState<ShippingZone>('UA');

  const weightKg = useMemo(() => lbsToKg(weightLbs), [weightLbs]);
  
  const shipping = useMemo(() => {
    return calcShipping({
      actualWeightKg: weightKg,
      lengthCm: length,
      widthCm: width,
      heightCm: height,
      zone: zone
    });
  }, [weightKg, length, width, height, zone]);

  const landedCost = basePrice + shipping.totalShipping;
  const retailPrice = landedCost * (1 + markup / 100);
  const profit = retailPrice - landedCost;
  const margin = (profit / retailPrice) * 100;

  return (
    <div className="relative h-full w-full overflow-auto bg-black text-white p-6 md:p-10">
      {/* Background Glow */}
      <div className="pointer-events-none absolute left-1/2 top-0 -z-10 h-[600px] w-[1000px] -translate-x-1/2 -translate-y-1/2 rounded-none-full bg-zinc-100 text-black/10 blur-[150px]" />

      <div className="max-w-6xl mx-auto">
        <Link href="/admin/shop/pricing" className="group mb-10 inline-flex items-center gap-2 text-[13px] font-medium tracking-wide text-white/40 hover:text-white transition-all">
          <ArrowLeft className="h-4 w-4 transform transition-transform group-hover:-translate-x-1" /> До Ціноутворення
        </Link>

        <div className="flex flex-col lg:flex-row gap-10">
          
          {/* Inputs Section */}
          <div className="flex-1 space-y-8">
            <div>
              <h1 className="text-4xl font-light tracking-tight text-white mb-2 flex items-center gap-4">
                <Calculator className="w-10 h-10 text-zinc-400" /> Симулятор Ціни
              </h1>
              <p className="text-zinc-500 text-sm max-w-md leading-relaxed">
                Розрахунок фінальної вартості товару з урахуванням логістики, ваги та цільової маржі.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Price & Currency */}
              <div className="space-y-4 p-6 rounded-none bg-white/[0.02] border border-white/[0.05] backdrop-blur-xl">
                <label className="block text-[10px] uppercase tracking-widest text-zinc-500 font-bold">Вхідна ціна (Dealer Cost)</label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500">{currency === 'USD' ? '$' : '€'}</span>
                    <input 
                      type="number" 
                      value={basePrice} 
                      onChange={e => setBasePrice(Number(e.target.value))}
                      className="w-full pl-10 pr-4 py-3 bg-black/40 border border-white/10 rounded-none text-xl font-light focus:outline-none focus:border-indigo-500/50 transition-all"
                    />
                  </div>
                  <select 
                    value={currency} 
                    onChange={e => setCurrency(e.target.value as any)}
                    className="px-4 py-3 bg-black/40 border border-white/10 rounded-none text-sm font-bold focus:outline-none focus:border-indigo-500/50"
                  >
                    <option value="USD">USD</option>
                    <option value="EUR">EUR</option>
                  </select>
                </div>
              </div>

              {/* Destination */}
              <div className="space-y-4 p-6 rounded-none bg-white/[0.02] border border-white/[0.05] backdrop-blur-xl">
                <label className="block text-[10px] uppercase tracking-widest text-zinc-500 font-bold">Зона доставки (Target Zone)</label>
                <select 
                  value={zone} 
                  onChange={e => setZone(e.target.value as ShippingZone)}
                  className="w-full px-4 py-3 bg-black/40 border border-white/10 rounded-none text-sm font-bold focus:outline-none focus:border-indigo-500/50"
                >
                  {Object.entries(SHIPPING_ZONES).map(([k, v]) => (
                    <option key={k} value={k}>{v.labelUa} ({k})</option>
                  ))}
                </select>
              </div>

              {/* Weight */}
              <div className="space-y-4 p-6 rounded-none bg-white/[0.02] border border-white/[0.05] backdrop-blur-xl">
                <label className="block text-[10px] uppercase tracking-widest text-zinc-500 font-bold flex justify-between">
                  Вага (Actual Weight)
                  <span className="text-zinc-400 font-mono text-[11px] normal-case tracking-tight">≈ {weightKg.toFixed(2)} kg</span>
                </label>
                <div className="relative">
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-500 text-xs">LBS</span>
                  <input 
                    type="number" 
                    value={weightLbs} 
                    onChange={e => setWeightLbs(Number(e.target.value))}
                    className="w-full pl-4 pr-12 py-3 bg-black/40 border border-white/10 rounded-none text-xl font-light focus:outline-none focus:border-indigo-500/50"
                  />
                </div>
              </div>

              {/* Dimensions */}
              <div className="space-y-4 p-6 rounded-none bg-white/[0.02] border border-white/[0.05] backdrop-blur-xl">
                <label className="block text-[10px] uppercase tracking-widest text-zinc-500 font-bold flex justify-between">
                  Габарити (Dimensions)
                  <span className="text-amber-400 font-mono text-[11px] normal-case tracking-tight">Vol: {shipping.volWeightKg.toFixed(2)} kg</span>
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <div className="relative">
                    <input type="number" value={length} onChange={e => setLength(Number(e.target.value))} placeholder="L" className="w-full px-3 py-2 bg-black/40 border border-white/10 rounded-none text-center text-sm focus:outline-none focus:border-amber-500/50" />
                    <span className="absolute -top-1.5 left-2 bg-black px-1 text-[8px] text-zinc-600 font-bold">L</span>
                  </div>
                  <div className="relative">
                    <input type="number" value={width} onChange={e => setWidth(Number(e.target.value))} placeholder="W" className="w-full px-3 py-2 bg-black/40 border border-white/10 rounded-none text-center text-sm focus:outline-none focus:border-amber-500/50" />
                    <span className="absolute -top-1.5 left-2 bg-black px-1 text-[8px] text-zinc-600 font-bold">W</span>
                  </div>
                  <div className="relative">
                    <input type="number" value={height} onChange={e => setHeight(Number(e.target.value))} placeholder="H" className="w-full px-3 py-2 bg-black/40 border border-white/10 rounded-none text-center text-sm focus:outline-none focus:border-amber-500/50" />
                    <span className="absolute -top-1.5 left-2 bg-black px-1 text-[8px] text-zinc-600 font-bold">H</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Markup Slider */}
            <div className="p-8 rounded-none-[40px] bg-gradient-to-br from-indigo-500/10 to-transparent border border-indigo-500/20">
              <div className="flex justify-between items-end mb-6">
                <div>
                  <label className="block text-[10px] uppercase tracking-[0.2em] text-zinc-400 font-bold mb-2">Цільова Націнка</label>
                  <div className="text-5xl font-light text-white">{markup}<span className="text-2xl text-zinc-400/50 ml-1">%</span></div>
                </div>
                <div className="text-right">
                  <div className="text-[10px] uppercase tracking-widest text-zinc-500 mb-1">Множник</div>
                  <div className="text-xl font-mono text-zinc-500">×{(1 + markup / 100).toFixed(2)}</div>
                </div>
              </div>
              <input 
                type="range" 
                min="0" max="200" step="1" 
                value={markup} 
                onChange={e => setMarkup(Number(e.target.value))}
                className="w-full h-1.5 appearance-none bg-white/10 rounded-none-full [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:h-6 [&::-webkit-slider-thumb]:w-6 [&::-webkit-slider-thumb]:rounded-none-full [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:shadow-[0_0_15px_rgba(255,255,255,0.5)] [&::-webkit-slider-thumb]:cursor-pointer"
              />
            </div>
          </div>

          {/* Results Section */}
          <div className="w-full lg:w-[400px] space-y-6">
            <div className="sticky top-10">
              <motion.div 
                layout
                className="rounded-none-[40px] border border-white/10 bg-zinc-900/50 backdrop-blur-3xl overflow-hidden shadow-2xl"
              >
                <div className="p-8 border-b border-white/5 bg-white/[0.02]">
                  <div className="text-[10px] uppercase tracking-[0.2em] text-zinc-500 font-bold mb-6">Фінальна Ціна (RRP)</div>
                  <div className="flex items-baseline gap-2">
                    <span className="text-6xl font-light text-white">{currency === 'USD' ? '$' : '€'}{Math.round(retailPrice)}</span>
                    <span className="text-xl text-zinc-600 font-mono">.{(retailPrice % 1).toFixed(2).split('.')[1]}</span>
                  </div>
                </div>

                <div className="p-8 space-y-6">
                  {/* Landed Cost Item */}
                  <div className="flex justify-between items-center group">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-none-full bg-zinc-800 flex items-center justify-center text-zinc-500 group-hover:text-white transition-colors">
                        <Package className="w-4 h-4" />
                      </div>
                      <span className="text-sm text-zinc-400">Собівартість</span>
                    </div>
                    <span className="text-sm font-mono text-zinc-200">{currency === 'USD' ? '$' : '€'}{landedCost.toFixed(2)}</span>
                  </div>

                  {/* Shipping Item */}
                  <div className="flex justify-between items-center group">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-none-full bg-zinc-100 text-black/10 flex items-center justify-center text-zinc-400">
                        <Truck className="w-4 h-4" />
                      </div>
                      <span className="text-sm text-zinc-400">Доставка ({zone})</span>
                    </div>
                    <span className="text-sm font-mono text-zinc-400">+{currency === 'USD' ? '$' : '€'}{shipping.totalShipping.toFixed(2)}</span>
                  </div>

                  <div className="h-px bg-white/5 w-full" />

                  {/* Profit Row */}
                  <div className="bg-emerald-500/5 rounded-none p-5 border border-emerald-500/10">
                    <div className="flex justify-between items-end mb-2">
                      <div className="text-[10px] uppercase tracking-widest text-emerald-500/70 font-bold">Очікуваний Прибуток</div>
                      <div className="text-xs font-mono text-emerald-400">{margin.toFixed(1)}% Маржа</div>
                    </div>
                    <div className="text-3xl font-light text-emerald-400">{currency === 'USD' ? '$' : '€'}{profit.toFixed(0)}</div>
                  </div>

                  {/* Weight Warning */}
                  {shipping.volWeightKg > shipping.actualWeightKg && (
                    <div className="p-4 rounded-none bg-amber-500/5 border border-amber-500/10 flex gap-3 items-start">
                      <Info className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                      <p className="text-[10px] text-amber-500/80 leading-relaxed uppercase font-medium">
                        Увага: Об&apos;ємна вага ({shipping.volWeightKg.toFixed(1)}kg) перевищує фактичну ({shipping.actualWeightKg.toFixed(1)}kg). Вартість доставки збільшена.
                      </p>
                    </div>
                  )}
                </div>
                
                <div className="p-8 pt-0">
                   <button className="w-full py-4 rounded-none bg-white text-black font-bold uppercase tracking-widest text-xs hover:bg-zinc-200 transition-all flex items-center justify-center gap-2">
                      <Plus className="w-4 h-4" /> Додати як товар
                   </button>
                </div>
              </motion.div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
