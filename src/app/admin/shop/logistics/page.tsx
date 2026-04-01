'use client';

import { useState, useEffect } from 'react';
import { Truck, Save, RefreshCw, AlertCircle, Search, Earth, MapPin } from 'lucide-react';
import { motion } from 'framer-motion';
import { SHIPPING_ZONES, ShippingZone } from '@/lib/shippingCalc';

// ─── Interfaces ───

interface BrandConfig {
  id?: string;
  brandName: string;
  originZone: string;
  ratePerKg: number;
  volumetricDivisor: number;
  volSurchargePerKg: number;
  baseFee: number;
  isActive: boolean;
}

interface ZoneConfig {
  id?: string;
  zoneCode: string;
  label: string;
  labelUa: string;
  ratePerKg: number;
  volSurchargePerKg: number;
  baseFee: number;
}

// ─── Component ───

export default function LogisticsPage() {
  const [activeTab, setActiveTab] = useState<'inbound' | 'outbound'>('outbound');
  
  // Inbound State
  const [configs, setConfigs] = useState<BrandConfig[]>([]);
  const [knownBrands, setKnownBrands] = useState<string[]>([]);
  const [filter, setFilter] = useState('');
  const [savingKey, setSavingKey] = useState<string | null>(null);

  // Outbound State
  const [zones, setZones] = useState<ZoneConfig[]>([]);

  // Shared
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, [activeTab]);

  async function fetchData() {
    setLoading(true);
    try {
      if (activeTab === 'inbound') {
        const res = await fetch('/api/admin/shop/logistics/brands');
        const data = await res.json();
        
        const dbConfigs: BrandConfig[] = data.configs || [];
        const dbKnown: string[] = data.knownBrands || [];
        
        const merged = [...dbConfigs];
        dbKnown.forEach(kb => {
          if (!merged.find(m => m.brandName === kb)) {
            merged.push({
              brandName: kb,
              originZone: 'USA',
              ratePerKg: 14,
              volumetricDivisor: 5000,
              volSurchargePerKg: 2,
              baseFee: 0,
              isActive: false,
            });
          }
        });
        
        merged.sort((a, b) => a.brandName.localeCompare(b.brandName));
        setConfigs(merged);
        setKnownBrands(dbKnown);
      } else {
        const res = await fetch('/api/admin/shop/logistics/zones');
        const data = await res.json();
        
        const dbZones: ZoneConfig[] = data.zones || [];
        const staticZoneCodes = Object.keys(SHIPPING_ZONES) as ShippingZone[];
        
        const merged = [...dbZones];
        staticZoneCodes.forEach(zc => {
           if (!merged.find(m => m.zoneCode === zc)) {
             const def = SHIPPING_ZONES[zc];
             merged.push({
               zoneCode: zc,
               label: def.label,
               labelUa: def.labelUa,
               ratePerKg: def.ratePerKg,
               volSurchargePerKg: def.volSurchargePerKg,
               baseFee: def.baseFee,
             });
           }
        });
        setZones(merged);
      }
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  }

  async function saveBrandConfig(cfg: BrandConfig) {
    setSavingKey(cfg.brandName);
    try {
      await fetch('/api/admin/shop/logistics/brands', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(cfg)
      });
    } catch(e) { console.error(e); }
    setSavingKey(null);
  }

  async function saveZoneConfig(cfg: ZoneConfig) {
    setSavingKey(cfg.zoneCode);
    try {
      await fetch('/api/admin/shop/logistics/zones', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(cfg)
      });
    } catch(e) { console.error(e); }
    setSavingKey(null);
  }

  const updateBrandField = (idx: number, field: keyof BrandConfig, val: any) => {
    const newArr = [...configs];
    newArr[idx] = { ...newArr[idx], [field]: val };
    setConfigs(newArr);
  };

  const updateZoneField = (idx: number, field: keyof ZoneConfig, val: any) => {
    const newArr = [...zones];
    newArr[idx] = { ...newArr[idx], [field]: val };
    setZones(newArr);
  };

  const filteredBrands = configs.filter(c => c.brandName.toLowerCase().includes(filter.toLowerCase()));

  return (
    <div className="p-8 max-w-7xl mx-auto h-full overflow-y-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-light text-white tracking-tight flex items-center gap-3">
          <Truck className="w-8 h-8 text-indigo-400" />
          Налаштування Логістики 
        </h1>
        <p className="mt-2 text-white/50 text-sm">
          Управління тарифами на двох етапах: від заводів до нашого транзитного складу, та зі складу до кінцевих клієнтів.
        </p>
      </div>

      <div className="flex items-center gap-4 mb-8 border-b border-white/10 pb-4">
        <button
          onClick={() => setActiveTab('outbound')}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-medium transition-all ${activeTab === 'outbound' ? 'bg-indigo-500 text-white shadow-[0_0_20px_rgba(99,102,241,0.4)]' : 'bg-zinc-900 text-white/50 hover:bg-zinc-800'}`}
        >
          <Earth className="w-4 h-4" />
          Вихідна: до Клієнта (Наші Зони)
        </button>
        <button
          onClick={() => setActiveTab('inbound')}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-medium transition-all ${activeTab === 'inbound' ? 'bg-indigo-500 text-white shadow-[0_0_20px_rgba(99,102,241,0.4)]' : 'bg-zinc-900 text-white/50 hover:bg-zinc-800'}`}
        >
          <MapPin className="w-4 h-4" />
          Вхідна: до Складу (По Брендах)
        </button>
      </div>

      {loading ? (
        <div className="py-20 flex justify-center"><RefreshCw className="w-6 h-6 animate-spin text-white/20" /></div>
      ) : activeTab === 'inbound' ? (
        // INBOUND LOGISTICS TAB
        <div className="space-y-6">
          <div className="flex justify-between items-center">
             <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
              <input 
                type="text" 
                placeholder="Пошук бренду..." 
                value={filter}
                onChange={e => setFilter(e.target.value)}
                className="w-full min-w-[300px] pl-10 pr-4 py-2.5 bg-zinc-900 border border-white/10 rounded-xl text-sm text-white focus:outline-none focus:border-indigo-500/50"
              />
            </div>
            <div className="text-sm text-white/40">Логістика етапу "Завод ➡️ Мій Транзитний Склад NY"</div>
          </div>
          
          <div className="bg-zinc-900/50 border border-white/5 rounded-2xl overflow-hidden">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-white/5 bg-black/20 text-[10px] uppercase tracking-widest text-white/40">
                  <th className="font-medium px-4 py-4 w-1/4">Бренд</th>
                  <th className="font-medium px-4 py-4">Зона Заводу</th>
                  <th className="font-medium px-4 py-4" title="Тариф ($/кг)">Тариф ($/кг)</th>
                  <th className="font-medium px-4 py-4" title="Об'ємний Дільник">Дільник (Vol)</th>
                  <th className="font-medium px-4 py-4" title="Штраф за кожен кг перевищення об'єму над фактичною вагою">Штраф (Vol/кг)</th>
                  <th className="font-medium px-4 py-4 text-center">Кастомний</th>
                  <th className="font-medium px-4 py-4">Дія</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 text-sm">
                {filteredBrands.map((c, i) => {
                   const realIdx = configs.findIndex(x => x.brandName === c.brandName);
                   return (
                    <tr key={c.brandName} className="hover:bg-white/[0.02] transition">
                      <td className="px-4 py-3 font-medium text-white/90">
                        {c.brandName}
                        {!c.id && <span className="ml-2 text-[10px] text-yellow-500/70 uppercase">New</span>}
                      </td>
                      <td className="px-4 py-3">
                        <select 
                          value={c.originZone} 
                          onChange={e => updateBrandField(realIdx, 'originZone', e.target.value)}
                          className="bg-black/40 border border-white/10 rounded items-center px-2 py-1 outline-none focus:border-indigo-500 text-xs"
                        >
                          <option value="USA">США</option>
                          <option value="EU">Європа</option>
                          <option value="ASIA">Азія</option>
                        </select>
                      </td>
                      <td className="px-4 py-3">
                        <input type="number" step="0.1" value={c.ratePerKg} onChange={e => updateBrandField(realIdx, 'ratePerKg', parseFloat(e.target.value))} className="w-16 bg-black/40 border border-white/10 rounded px-2 py-1 outline-none text-right" />
                      </td>
                      <td className="px-4 py-3">
                        <input type="number" value={c.volumetricDivisor} onChange={e => updateBrandField(realIdx, 'volumetricDivisor', parseFloat(e.target.value))} className="w-16 bg-black/40 border border-white/10 rounded px-2 py-1 outline-none text-right" />
                      </td>
                      <td className="px-4 py-3">
                        <input type="number" step="0.1" value={c.volSurchargePerKg} onChange={e => updateBrandField(realIdx, 'volSurchargePerKg', parseFloat(e.target.value))} className="w-16 bg-black/40 border border-white/10 rounded px-2 py-1 outline-none text-right" />
                      </td>
                      <td className="px-4 py-3 text-center">
                        <input type="checkbox" checked={c.isActive} onChange={e => updateBrandField(realIdx, 'isActive', e.target.checked)} className="w-4 h-4 cursor-pointer accent-indigo-500" />
                      </td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => saveBrandConfig(c)}
                          disabled={savingKey === c.brandName}
                          className="flex items-center gap-2 px-3 py-1.5 bg-indigo-500/20 hover:bg-indigo-500/40 text-indigo-300 rounded-lg text-[11px] uppercase tracking-wider font-semibold transition disabled:opacity-50"
                        >
                          {savingKey === c.brandName ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                          Зберегти
                        </button>
                      </td>
                    </tr>
                   );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        // OUTBOUND LOGISTICS TAB
        <div className="space-y-6">
          <div className="flex justify-end items-center">
            <div className="text-sm text-white/40">Логістика етапу "Мій Транзитний Склад NY ➡️ Клієнт"</div>
          </div>
          <div className="bg-zinc-900/50 border border-white/5 rounded-2xl overflow-hidden">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-white/5 bg-black/20 text-[10px] uppercase tracking-widest text-white/40">
                  <th className="font-medium px-4 py-4 w-1/4">Країна / Регіон</th>
                  <th className="font-medium px-4 py-4" title="Базовий тариф за 1 фізичний кг">Фактична Вага ($/кг)</th>
                  <th className="font-medium px-4 py-4" title="Податок/Коефіцієнт об'ємної ваги. Формула: (Об'єм - Фактична) * Штраф">Штраф за Об'єм ($/кг)</th>
                  <th className="font-medium px-4 py-4" title="Фіксована ціна просто за оформлення замовлення (відправки)">Базова Комісія ($)</th>
                  <th className="font-medium px-4 py-4 text-right">Дія</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 text-sm">
                {zones.map((c, i) => (
                  <tr key={c.zoneCode} className="hover:bg-white/[0.02] transition">
                    <td className="px-4 py-4">
                      <div className="font-medium text-white/90 flex flex-col">
                        <span>{c.labelUa}</span>
                        <span className="text-[10px] text-white/30 uppercase mt-0.5">{c.zoneCode} · {c.label}</span>
                      </div>
                      {!c.id && <span className="mt-1 text-[10px] text-yellow-500/70 uppercase">Defaults</span>}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className="text-white/30">$</span>
                        <input type="number" step="0.1" value={c.ratePerKg} onChange={e => updateZoneField(i, 'ratePerKg', parseFloat(e.target.value))} className="w-20 bg-black/40 border border-white/10 rounded px-2 py-1 outline-none focus:border-indigo-500" />
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className="text-white/30">$</span>
                        <input type="number" step="0.1" value={c.volSurchargePerKg} onChange={e => updateZoneField(i, 'volSurchargePerKg', parseFloat(e.target.value))} className="w-20 bg-black/40 border border-white/10 rounded px-2 py-1 outline-none focus:border-indigo-500" />
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className="text-white/30">$</span>
                        <input type="number" step="1" value={c.baseFee} onChange={e => updateZoneField(i, 'baseFee', parseFloat(e.target.value))} className="w-20 bg-black/40 border border-white/10 rounded px-2 py-1 outline-none focus:border-indigo-500" />
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => saveZoneConfig(c)}
                        disabled={savingKey === c.zoneCode}
                        className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-500/20 hover:bg-indigo-500/40 text-indigo-300 rounded-lg text-[11px] uppercase tracking-wider font-semibold transition disabled:opacity-50"
                      >
                        {savingKey === c.zoneCode ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                        Зберегти Зону
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          
          <div className="p-4 bg-indigo-500/5 border border-indigo-500/10 rounded-2xl flex gap-3 text-sm text-indigo-200 mt-4">
             <AlertCircle className="shrink-0 w-5 h-5 text-indigo-400" />
             <div>
               <p className="font-semibold mb-1">Як працює формула Вихідної Зони?</p>
               <p className="text-indigo-200/70">
                 Якщо клієнт купує деталь (Фактична вага = 10 кг, Об'ємна = 15 кг). <br/>
                 І Зона встановлена так: `Тариф: $14/кг`, `Штраф за об'єм: $2/кг`, `Комісія: $5`.<br/>
                 Розрахунок: `$5 + (10кг * $14) + ((15кг - 10кг) * $2)`.<br/>
                 Окремо до цієї суми завжди додається Базова Вхідна Логістика бренду.
               </p>
             </div>
          </div>
        </div>
      )}
    </div>
  );
}
