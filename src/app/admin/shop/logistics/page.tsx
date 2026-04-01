'use client';

import { useState, useEffect } from 'react';
import { Truck, Save, RefreshCw, AlertCircle, Search } from 'lucide-react';
import { motion } from 'framer-motion';

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

export default function BrandLogisticsPage() {
  const [configs, setConfigs] = useState<BrandConfig[]>([]);
  const [knownBrands, setKnownBrands] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [filter, setFilter] = useState('');

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/shop/logistics/brands');
      const data = await res.json();
      
      const dbConfigs: BrandConfig[] = data.configs || [];
      const dbKnown: string[] = data.knownBrands || [];
      
      // Merge known brands that don't have a config yet
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
            isActive: false, // Inactive by default so it falls back to standard
          });
        }
      });
      
      merged.sort((a, b) => a.brandName.localeCompare(b.brandName));
      setConfigs(merged);
      setKnownBrands(dbKnown);
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  }

  async function saveConfig(cfg: BrandConfig) {
    setSavingKey(cfg.brandName);
    try {
      const res = await fetch('/api/admin/shop/logistics/brands', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(cfg)
      });
      if (res.ok) {
         // updated
      }
    } catch(e) {
      console.error(e);
    }
    setSavingKey(null);
  }

  const updateField = (idx: number, field: keyof BrandConfig, val: any) => {
    const newArr = [...configs];
    newArr[idx] = { ...newArr[idx], [field]: val };
    setConfigs(newArr);
  };

  const filtered = configs.filter(c => c.brandName.toLowerCase().includes(filter.toLowerCase()));

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-light text-white tracking-tight flex items-center gap-3">
          <Truck className="w-8 h-8 text-indigo-400" />
          Тарифи доставки 
          <span className="text-white/30 font-normal">до складу</span>
        </h1>
        <p className="mt-2 text-white/50 text-sm">
          Налаштуйте вартість вхідної логістики індивідуально для кожного бренду. Якщо бренд не має активного тарифу, система використовуватиме стандартні глобальні тарифи ($14/США).
        </p>
      </div>

      <div className="mb-6 relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
        <input 
          type="text" 
          placeholder="Пошук бренду..." 
          value={filter}
          onChange={e => setFilter(e.target.value)}
          className="w-full max-w-sm pl-10 pr-4 py-2.5 bg-zinc-900 border border-white/10 rounded-xl text-sm text-white focus:outline-none focus:border-indigo-500/50"
        />
      </div>

      {loading ? (
        <div className="py-20 flex justify-center"><RefreshCw className="w-6 h-6 animate-spin text-white/20" /></div>
      ) : (
        <div className="bg-zinc-900/50 border border-white/5 rounded-2xl overflow-hidden">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-white/5 bg-black/20 text-[10px] uppercase tracking-widest text-white/40">
                <th className="font-medium px-4 py-4 w-1/4">Бренд</th>
                <th className="font-medium px-4 py-4">Зона</th>
                <th className="font-medium px-4 py-4">Тариф ($/кг)</th>
                <th className="font-medium px-4 py-4">Дільник (Vol)</th>
                <th className="font-medium px-4 py-4">Штраф (Vol/кг)</th>
                <th className="font-medium px-4 py-4 text-center">Активний</th>
                <th className="font-medium px-4 py-4">Дія</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 text-sm">
              {filtered.map((c, i) => {
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
                        onChange={e => updateField(realIdx, 'originZone', e.target.value)}
                        className="bg-black/40 border border-white/10 rounded items-center px-2 py-1 outline-none focus:border-indigo-500"
                      >
                        <option value="USA">США (США-&gt;УКР)</option>
                        <option value="EU">Європа (ЄС-&gt;УКР)</option>
                        <option value="ASIA">Азія</option>
                      </select>
                    </td>
                    <td className="px-4 py-3">
                      <input 
                        type="number" 
                        step="0.1"
                        value={c.ratePerKg} 
                        onChange={e => updateField(realIdx, 'ratePerKg', parseFloat(e.target.value))}
                        className="w-20 bg-black/40 border border-white/10 rounded px-2 py-1 outline-none text-right"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <input 
                        type="number" 
                        value={c.volumetricDivisor} 
                        onChange={e => updateField(realIdx, 'volumetricDivisor', parseFloat(e.target.value))}
                        className="w-20 bg-black/40 border border-white/10 rounded px-2 py-1 outline-none text-right"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <input 
                        type="number"
                        step="0.1"
                        value={c.volSurchargePerKg} 
                        onChange={e => updateField(realIdx, 'volSurchargePerKg', parseFloat(e.target.value))}
                        className="w-20 bg-black/40 border border-white/10 rounded px-2 py-1 outline-none text-right"
                      />
                    </td>
                    <td className="px-4 py-3 text-center">
                      <input 
                        type="checkbox" 
                        checked={c.isActive} 
                        onChange={e => updateField(realIdx, 'isActive', e.target.checked)}
                        className="w-4 h-4 cursor-pointer accent-indigo-500"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => saveConfig(c)}
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
              {filtered.length === 0 && (
                 <tr>
                   <td colSpan={7} className="py-8 text-center text-white/30 text-xs">Жодного бренду не знайдено</td>
                 </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
