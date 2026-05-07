'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  Truck, Save, RefreshCw, AlertCircle, Search, Earth, MapPin, Plus,
  Warehouse as WarehouseIcon, X, Trash2, ChevronRight, Globe, Package, Receipt
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { SHIPPING_ZONES, ShippingZone } from '@/lib/shippingCalc';
import { useConfirm } from '@/components/admin/AdminConfirmDialog';
import { useToast } from '@/components/admin/AdminToast';

// ─── Interfaces ───

interface WarehouseData {
  id: string;
  code: string;
  name: string;
  nameUa: string;
  country: string;
  city: string | null;
  isActive: boolean;
  sortOrder: number;
  _count?: { zones: number; brands: number };
}

interface BrandConfig {
  id?: string;
  brandName: string;
  warehouseId: string | null;
  originZone: string;
  ratePerKg: number;
  volumetricDivisor: number;
  volSurchargePerKg: number;
  baseFee: number;
  isActive: boolean;
  warehouse?: { id: string; code: string; name: string } | null;
}

interface ZoneConfig {
  id?: string;
  warehouseId: string | null;
  zoneCode: string;
  label: string;
  labelUa: string;
  ratePerKg: number;
  volSurchargePerKg: number;
  baseFee: number;
  etaMinDays: number;
  etaMaxDays: number;
  warehouse?: { code: string; name: string } | null;
}

// ─── Component ───

export default function LogisticsPage() {
  const confirm = useConfirm();
  const toast = useToast();
  const [activeTab, setActiveTab] = useState<'outbound' | 'inbound'>('outbound');
  const [selectedWarehouse, setSelectedWarehouse] = useState<string | null>(null); // warehouseId

  // Warehouse State
  const [warehouses, setWarehouses] = useState<WarehouseData[]>([]);
  const [showAddWarehouse, setShowAddWarehouse] = useState(false);
  const [newWarehouse, setNewWarehouse] = useState({ code: '', name: '', nameUa: '', country: '', city: '', address: '', address2: '', state: '', postalCode: '', phone: '', contactName: '' });

  // Inbound State
  const [configs, setConfigs] = useState<BrandConfig[]>([]);
  const [knownBrands, setKnownBrands] = useState<string[]>([]);
  const [brandWarehouses, setBrandWarehouses] = useState<{ id: string; code: string; name: string; nameUa: string }[]>([]);
  const [filter, setFilter] = useState('');
  const [savingKey, setSavingKey] = useState<string | null>(null);

  // Outbound State
  const [zones, setZones] = useState<ZoneConfig[]>([]);
  const [showAddZone, setShowAddZone] = useState(false);
  const [newZone, setNewZone] = useState({ zoneCode: '', label: '', labelUa: '', ratePerKg: 14, volSurchargePerKg: 2, baseFee: 0, etaMinDays: 7, etaMaxDays: 14 });

  // Shared
  const [loading, setLoading] = useState(true);

  const fetchWarehouses = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/shop/logistics/warehouses');
      const data = await res.json();
      setWarehouses(data.warehouses || []);
    } catch (e) { console.error(e); }
  }, []);

  const fetchTabData = useCallback(async () => {
    setLoading(true);
    try {
      if (activeTab === 'inbound') {
        const params = selectedWarehouse ? `?warehouseId=${selectedWarehouse}` : '';
        const res = await fetch(`/api/admin/shop/logistics/brands${params}`);
        const data = await res.json();

        const dbConfigs: BrandConfig[] = data.configs || [];
        const dbKnown: string[] = data.knownBrands || [];
        setBrandWarehouses(data.warehouses || []);

        const merged = [...dbConfigs];
        dbKnown.forEach(kb => {
          if (!merged.find(m => m.brandName === kb)) {
            merged.push({
              brandName: kb,
              warehouseId: selectedWarehouse,
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
        const params = selectedWarehouse ? `?warehouseId=${selectedWarehouse}` : '';
        const res = await fetch(`/api/admin/shop/logistics/zones${params}`);
        const data = await res.json();

        const dbZones: ZoneConfig[] = data.zones || [];

        // Only merge defaults if warehouse has no zones yet
        if (dbZones.length === 0) {
          const staticZoneCodes = Object.keys(SHIPPING_ZONES) as ShippingZone[];
          staticZoneCodes.forEach(zc => {
            const def = SHIPPING_ZONES[zc];
            dbZones.push({
              warehouseId: selectedWarehouse,
              zoneCode: zc,
              label: def.label,
              labelUa: def.labelUa,
              ratePerKg: def.ratePerKg,
              volSurchargePerKg: def.volSurchargePerKg,
              baseFee: def.baseFee,
              etaMinDays: 7,
              etaMaxDays: 14,
            });
          });
        }
        setZones(dbZones);
      }
    } catch (e) { console.error(e); }
    setLoading(false);
  }, [activeTab, selectedWarehouse]);

  useEffect(() => { fetchWarehouses(); }, [fetchWarehouses]);

  useEffect(() => {
    if (warehouses.length > 0 && !selectedWarehouse) {
      setSelectedWarehouse(warehouses[0].id);
    }
  }, [warehouses, selectedWarehouse]);

  useEffect(() => {
    if (selectedWarehouse) fetchTabData();
  }, [fetchTabData, selectedWarehouse]);

  async function saveWarehouse() {
    if (!newWarehouse.code || !newWarehouse.name) return;
    try {
      await fetch('/api/admin/shop/logistics/warehouses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newWarehouse),
      });
      setShowAddWarehouse(false);
      setNewWarehouse({ code: '', name: '', nameUa: '', country: '', city: '', address: '', address2: '', state: '', postalCode: '', phone: '', contactName: '' });
      await fetchWarehouses();
    } catch (e) { console.error(e); }
  }

  async function deleteWarehouse(id: string) {
    const ok = await confirm({
      tone: 'warning',
      title: 'Деактивувати цей склад?',
      description: 'Склад буде помічено як неактивний. Зони і бренди залишаться, але не використовуватимуться у розрахунку доставки.',
      confirmLabel: 'Деактивувати',
    });
    if (!ok) return;
    const response = await fetch(`/api/admin/shop/logistics/warehouses?id=${id}`, { method: 'DELETE' });
    if (!response.ok) {
      toast.error('Не вдалося деактивувати склад');
      return;
    }
    if (selectedWarehouse === id) setSelectedWarehouse(null);
    await fetchWarehouses();
    toast.success('Склад деактивовано');
  }

  async function saveBrandConfig(cfg: BrandConfig) {
    setSavingKey(cfg.brandName);
    try {
      await fetch('/api/admin/shop/logistics/brands', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...cfg, warehouseId: cfg.warehouseId || selectedWarehouse }),
      });
    } catch (e) { console.error(e); }
    setSavingKey(null);
  }

  async function saveZoneConfig(cfg: ZoneConfig) {
    setSavingKey(cfg.zoneCode);
    try {
      await fetch('/api/admin/shop/logistics/zones', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...cfg, warehouseId: cfg.warehouseId || selectedWarehouse }),
      });
      await fetchTabData();
    } catch (e) { console.error(e); }
    setSavingKey(null);
  }

  async function deleteZone(id: string) {
    const ok = await confirm({
      tone: 'danger',
      title: 'Видалити цю зону доставки?',
      description: 'Замовлення з цією зоною доставки потребуватимуть нового призначення.',
      confirmLabel: 'Видалити зону',
    });
    if (!ok) return;
    const response = await fetch(`/api/admin/shop/logistics/zones?id=${id}`, { method: 'DELETE' });
    if (!response.ok) {
      toast.error('Не вдалося видалити зону');
      return;
    }
    await fetchTabData();
    toast.success('Зону доставки видалено');
  }

  async function addNewZone() {
    if (!newZone.zoneCode) return;
    await saveZoneConfig({
      warehouseId: selectedWarehouse,
      zoneCode: newZone.zoneCode.toUpperCase(),
      label: newZone.label || newZone.zoneCode,
      labelUa: newZone.labelUa || newZone.label || newZone.zoneCode,
      ratePerKg: newZone.ratePerKg,
      volSurchargePerKg: newZone.volSurchargePerKg,
      baseFee: newZone.baseFee,
      etaMinDays: newZone.etaMinDays,
      etaMaxDays: newZone.etaMaxDays,
    });
    setShowAddZone(false);
    setNewZone({ zoneCode: '', label: '', labelUa: '', ratePerKg: 14, volSurchargePerKg: 2, baseFee: 0, etaMinDays: 7, etaMaxDays: 14 });
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

  const selectedWh = warehouses.find(w => w.id === selectedWarehouse);

  return (
    <div className="relative h-full w-full overflow-auto bg-black text-white">
      {/* Ambient glow */}
      <div className="pointer-events-none absolute left-1/2 top-0 -z-10 h-[500px] w-[800px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-blue-500/10 blur-[120px]" />

      <div className="w-full px-4 py-8 md:px-8 lg:px-12">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-light text-white tracking-tight flex items-center gap-3">
            <Truck className="w-8 h-8 text-zinc-400 drop-shadow-[0_0_15px_rgba(59,130,246,0.5)]" />
            Логістика & Склади
          </h1>
          <p className="mt-2 text-white/40 text-sm max-w-2xl">
            Управління складами, зонами доставки та логістичними тарифами. Кожен склад має власний набір зон з незалежними тарифами.
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Link href="/admin/shop/logistics/taxes"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-none border border-rose-500/20 bg-rose-500/5 text-rose-400 text-[11px] uppercase tracking-widest font-medium hover:bg-rose-500/10 transition-all">
              <Receipt className="w-3.5 h-3.5" /> Регіональні Податки
            </Link>
            <Link href="/admin/shop/logistics/brand-rules"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-none border border-blue-500/20 bg-blue-500/5 text-blue-300 text-[11px] uppercase tracking-widest font-medium hover:bg-blue-500/10 transition-all">
              <Package className="w-3.5 h-3.5" /> Правила доставки за брендом
            </Link>
          </div>
        </div>

        {/* ─── Warehouse Cards ─── */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-[10px] uppercase tracking-[0.2em] text-white/30 font-medium flex items-center gap-2">
              <WarehouseIcon className="w-3.5 h-3.5" /> Склади
            </h2>
            <button
              onClick={() => setShowAddWarehouse(true)}
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-none bg-zinc-800/40 border border-blue-500/20 text-zinc-400 text-[11px] uppercase tracking-wider font-medium hover:bg-zinc-800/40 transition-all"
            >
              <Plus className="w-3.5 h-3.5" /> Додати Склад
            </button>
          </div>

          {warehouses.length === 0 ? (
            <div className="text-center py-12 text-white/20 text-sm border border-dashed border-white/10 rounded-none">
              <WarehouseIcon className="w-10 h-10 mx-auto mb-3 text-white/10" />
              Ще немає складів. Додайте перший склад для налаштування логістики.
            </div>
          ) : (
            <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-thin">
              {warehouses.filter(w => w.isActive).map(w => (
                <motion.button
                  key={w.id}
                  onClick={() => setSelectedWarehouse(w.id)}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className={`
                    relative flex-shrink-0 min-w-[180px] p-4 rounded-none border transition-all duration-300 text-left group sm:min-w-[200px]
                    ${selectedWarehouse === w.id
                      ? 'bg-zinc-800/40 border-blue-500/40 shadow-[0_0_25px_rgba(59,130,246,0.15)]'
                      : 'bg-white/[0.02] border-white/[0.06] hover:border-white/[0.12] hover:bg-white/[0.04]'
                    }
                  `}
                >
                  {selectedWarehouse === w.id && (
                    <motion.div
                      layoutId="warehouse-indicator"
                      className="absolute inset-0 rounded-none border-2 border-blue-500/50"
                    />
                  )}
                  <div className="relative z-10">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[10px] font-mono uppercase tracking-wider text-white/30">{w.code}</span>
                      <button
                        onClick={(e) => { e.stopPropagation(); deleteWarehouse(w.id); }}
                        className="opacity-0 group-hover:opacity-100 p-1 rounded-none hover:bg-blue-950/40/10 text-white/20 hover:text-blue-400 transition-all"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                    <div className="font-medium text-white/90 text-sm mb-1">{w.nameUa || w.name}</div>
                    <div className="text-[11px] text-white/30">
                      {w.city ? `${w.city}, ` : ''}{w.country}
                    </div>
                    <div className="flex gap-3 mt-3">
                      <span className="text-[10px] text-zinc-400/80">
                        <Globe className="w-3 h-3 inline mr-1" />{w._count?.zones || 0} зон
                      </span>
                      <span className="text-[10px] text-amber-400/80">
                        <Package className="w-3 h-3 inline mr-1" />{w._count?.brands || 0} брендів
                      </span>
                    </div>
                  </div>
                </motion.button>
              ))}
            </div>
          )}
        </div>

        {/* ─── Tab Switcher ─── */}
        {selectedWarehouse && (
          <>
            <div className="flex items-center gap-4 mb-6 border-b border-white/[0.06] pb-4">
              <button
                onClick={() => setActiveTab('outbound')}
                className={`flex items-center gap-2 px-5 py-2.5 rounded-none text-sm font-medium transition-all ${
                  activeTab === 'outbound'
                    ? 'bg-blue-500/30 text-white shadow-[0_0_20px_rgba(59,130,246,0.35)]'
                    : 'bg-white/[0.03] text-white/40 hover:bg-white/[0.06] hover:text-white/60'
                }`}
              >
                <Earth className="w-4 h-4" />
                Вихідна: до Клієнта
              </button>
              <button
                onClick={() => setActiveTab('inbound')}
                className={`flex items-center gap-2 px-5 py-2.5 rounded-none text-sm font-medium transition-all ${
                  activeTab === 'inbound'
                    ? 'bg-blue-500/30 text-white shadow-[0_0_20px_rgba(59,130,246,0.35)]'
                    : 'bg-white/[0.03] text-white/40 hover:bg-white/[0.06] hover:text-white/60'
                }`}
              >
                <MapPin className="w-4 h-4" />
                Вхідна: до Складу
              </button>
              <div className="ml-auto flex items-center gap-2 text-[11px] text-white/30">
                <ChevronRight className="w-3 h-3" />
                <span className="font-mono">{selectedWh?.code}</span>
                <span className="text-white/15">·</span>
                <span>{selectedWh?.nameUa || selectedWh?.name}</span>
              </div>
            </div>

            {loading ? (
              <div className="py-20 flex justify-center"><RefreshCw className="w-6 h-6 motion-safe:animate-spin text-white/20" /></div>
            ) : activeTab === 'inbound' ? (
              /* ─── INBOUND LOGISTICS TAB ─── */
              <div className="space-y-6">
                <div className="flex justify-between items-center">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
                    <input
                      type="text"
                      placeholder="Пошук бренду..."
                      value={filter}
                      onChange={e => setFilter(e.target.value)}
                      className="w-full pl-10 pr-4 py-2.5 bg-white/[0.03] border border-white/[0.08] rounded-none text-sm text-white focus:outline-none focus:border-blue-500/50 placeholder-white/20 transition-colors md:min-w-[300px]"
                    />
                  </div>
                  <div className="text-sm text-white/30">
                    Завод <ChevronRight className="w-3 h-3 inline mx-1" /> {selectedWh?.nameUa || 'Склад'}
                  </div>
                </div>

                <div className="overflow-hidden rounded-none border border-white/[0.06] bg-black/60 backdrop-blur-2xl shadow-2xl">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-white/[0.06] bg-white/[0.02] text-[10px] uppercase tracking-[0.15em] text-white/40">
                        <th className="font-medium px-5 py-4 w-1/4">Бренд</th>
                        <th className="font-medium px-5 py-4">Склад</th>
                        <th className="font-medium px-5 py-4">Зона Заводу</th>
                        <th className="font-medium px-5 py-4" title="Тариф ($/кг)">Тариф ($/кг)</th>
                        <th className="font-medium px-5 py-4" title="Об'ємний Дільник">Дільник</th>
                        <th className="font-medium px-5 py-4" title="Штраф за кожен кг перевищення">Штраф (Vol/кг)</th>
                        <th className="font-medium px-5 py-4 text-center">Кастомний</th>
                        <th className="font-medium px-5 py-4">Дія</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/[0.04] text-sm">
                      {filteredBrands.map((c, i) => {
                        const realIdx = configs.findIndex(x => x.brandName === c.brandName);
                        return (
                          <tr key={c.brandName} className="hover:bg-white/[0.02] transition-colors">
                            <td className="px-5 py-3 font-medium text-white/90">
                              {c.brandName}
                              {!c.id && <span className="ml-2 text-[10px] text-yellow-500/70 uppercase">New</span>}
                            </td>
                            <td className="px-5 py-3">
                              <select
                                value={c.warehouseId || ''}
                                onChange={e => updateBrandField(realIdx, 'warehouseId', e.target.value || null)}
                                className="bg-black/40 border border-white/10 rounded-none px-2 py-1.5 outline-none focus:border-blue-500 text-xs text-white/70"
                              >
                                <option value="">Не вказано</option>
                                {brandWarehouses.map(w => (
                                  <option key={w.id} value={w.id}>{w.nameUa || w.name}</option>
                                ))}
                              </select>
                            </td>
                            <td className="px-5 py-3">
                              <select
                                value={c.originZone}
                                onChange={e => updateBrandField(realIdx, 'originZone', e.target.value)}
                                className="bg-black/40 border border-white/10 rounded-none px-2 py-1.5 outline-none focus:border-blue-500 text-xs text-white/70"
                              >
                                <option value="USA">США</option>
                                <option value="EU">Європа</option>
                                <option value="ASIA">Азія</option>
                              </select>
                            </td>
                            <td className="px-5 py-3">
                              <input type="number" step="0.1" value={c.ratePerKg} onChange={e => updateBrandField(realIdx, 'ratePerKg', parseFloat(e.target.value))} className="w-16 bg-black/40 border border-white/10 rounded-none px-2 py-1.5 outline-none text-right text-white/70 focus:border-blue-500" />
                            </td>
                            <td className="px-5 py-3">
                              <input type="number" value={c.volumetricDivisor} onChange={e => updateBrandField(realIdx, 'volumetricDivisor', parseFloat(e.target.value))} className="w-16 bg-black/40 border border-white/10 rounded-none px-2 py-1.5 outline-none text-right text-white/70 focus:border-blue-500" />
                            </td>
                            <td className="px-5 py-3">
                              <input type="number" step="0.1" value={c.volSurchargePerKg} onChange={e => updateBrandField(realIdx, 'volSurchargePerKg', parseFloat(e.target.value))} className="w-16 bg-black/40 border border-white/10 rounded-none px-2 py-1.5 outline-none text-right text-white/70 focus:border-blue-500" />
                            </td>
                            <td className="px-5 py-3 text-center">
                              <input type="checkbox" checked={c.isActive} onChange={e => updateBrandField(realIdx, 'isActive', e.target.checked)} className="w-4 h-4 cursor-pointer accent-blue-500" />
                            </td>
                            <td className="px-5 py-3">
                              <button
                                onClick={() => saveBrandConfig(c)}
                                disabled={savingKey === c.brandName}
                                className="flex items-center gap-2 px-3 py-1.5 bg-zinc-800/40 hover:bg-zinc-700/50 text-zinc-500 rounded-none text-[11px] uppercase tracking-wider font-semibold transition disabled:opacity-50"
                              >
                                {savingKey === c.brandName ? <RefreshCw className="w-3.5 h-3.5 motion-safe:animate-spin" /> : <Save className="w-3.5 h-3.5" />}
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
              /* ─── OUTBOUND LOGISTICS TAB ─── */
              <div className="space-y-6">
                <div className="flex justify-between items-center">
                  <button
                    onClick={() => setShowAddZone(true)}
                    className="inline-flex items-center gap-2 px-4 py-2.5 rounded-none bg-zinc-800/40 border border-blue-500/20 text-zinc-400 text-[11px] uppercase tracking-wider font-medium hover:bg-zinc-800/40 transition-all"
                  >
                    <Plus className="w-3.5 h-3.5" /> Додати Зону
                  </button>
                  <div className="text-sm text-white/30">
                    {selectedWh?.nameUa || 'Склад'} <ChevronRight className="w-3 h-3 inline mx-1" /> Клієнт
                  </div>
                </div>

                <div className="overflow-hidden rounded-none border border-white/[0.06] bg-black/60 backdrop-blur-2xl shadow-2xl">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-white/[0.06] bg-white/[0.02] text-[10px] uppercase tracking-[0.15em] text-white/40">
                        <th className="font-medium px-5 py-4 w-1/4">Країна / Регіон</th>
                        <th className="font-medium px-5 py-4" title="Базовий тариф за 1 фізичний кг">Факт. вага ($/кг)</th>
                        <th className="font-medium px-5 py-4" title={"Штраф за об'ємну перевагу"}>Штраф об&apos;єм ($/кг)</th>
                        <th className="font-medium px-5 py-4" title="Фіксована комісія за оформлення">Базова комісія ($)</th>
                        <th className="font-medium px-5 py-4" title="Орієнтовний час доставки">ETA (днів)</th>
                        <th className="font-medium px-5 py-4 text-right">Дії</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/[0.04] text-sm">
                      {zones.map((c, i) => (
                        <tr key={c.id || c.zoneCode} className="hover:bg-white/[0.02] transition-colors">
                          <td className="px-5 py-4">
                            <div className="font-medium text-white/90 flex flex-col">
                              <span>{c.labelUa}</span>
                              <span className="text-[10px] text-white/25 uppercase mt-0.5 font-mono">{c.zoneCode} · {c.label}</span>
                            </div>
                            {!c.id && <span className="text-[10px] text-yellow-500/70 uppercase">Defaults</span>}
                          </td>
                          <td className="px-5 py-3">
                            <div className="flex items-center gap-2">
                              <span className="text-white/25">$</span>
                              <input type="number" step="0.1" value={c.ratePerKg} onChange={e => updateZoneField(i, 'ratePerKg', parseFloat(e.target.value))} className="w-20 bg-black/40 border border-white/10 rounded-none px-2 py-1.5 outline-none focus:border-blue-500 text-white/70" />
                            </div>
                          </td>
                          <td className="px-5 py-3">
                            <div className="flex items-center gap-2">
                              <span className="text-white/25">$</span>
                              <input type="number" step="0.1" value={c.volSurchargePerKg} onChange={e => updateZoneField(i, 'volSurchargePerKg', parseFloat(e.target.value))} className="w-20 bg-black/40 border border-white/10 rounded-none px-2 py-1.5 outline-none focus:border-blue-500 text-white/70" />
                            </div>
                          </td>
                          <td className="px-5 py-3">
                            <div className="flex items-center gap-2">
                              <span className="text-white/25">$</span>
                              <input type="number" step="1" value={c.baseFee} onChange={e => updateZoneField(i, 'baseFee', parseFloat(e.target.value))} className="w-20 bg-black/40 border border-white/10 rounded-none px-2 py-1.5 outline-none focus:border-blue-500 text-white/70" />
                            </div>
                          </td>
                          <td className="px-5 py-3">
                            <div className="flex items-center gap-1">
                              <input type="number" min="1" max="90" value={c.etaMinDays} onChange={e => updateZoneField(i, 'etaMinDays', parseInt(e.target.value) || 1)} className="w-12 bg-black/40 border border-white/10 rounded-none px-1.5 py-1.5 outline-none text-center focus:border-blue-500 text-white/70 text-xs" />
                              <span className="text-white/20 text-[10px]">—</span>
                              <input type="number" min="1" max="90" value={c.etaMaxDays} onChange={e => updateZoneField(i, 'etaMaxDays', parseInt(e.target.value) || 1)} className="w-12 bg-black/40 border border-white/10 rounded-none px-1.5 py-1.5 outline-none text-center focus:border-blue-500 text-white/70 text-xs" />
                            </div>
                          </td>
                          <td className="px-5 py-3 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <button
                                onClick={() => saveZoneConfig(c)}
                                disabled={savingKey === c.zoneCode}
                                className="inline-flex items-center gap-2 px-3 py-1.5 bg-zinc-800/40 hover:bg-zinc-700/50 text-zinc-500 rounded-none text-[11px] uppercase tracking-wider font-semibold transition disabled:opacity-50"
                              >
                                {savingKey === c.zoneCode ? <RefreshCw className="w-3.5 h-3.5 motion-safe:animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                                Зберегти
                              </button>
                              {c.id && (
                                <button
                                  onClick={() => deleteZone(c.id!)}
                                  className="p-1.5 rounded-none hover:bg-blue-950/40/10 text-white/20 hover:text-blue-400 transition-colors"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="p-4 bg-blue-500/[0.04] border border-blue-500/10 rounded-none flex gap-3 text-sm text-red-200/80">
                  <AlertCircle className="shrink-0 w-5 h-5 text-zinc-400/60" />
                  <div>
                    <p className="font-semibold mb-1 text-red-200/90">Як працює формула Вихідної Зони?</p>
                    <p className="text-red-200/50">
                      Якщо клієнт купує деталь (Фактична вага = 10 кг, Об&apos;ємна = 15 кг). <br />
                      І Зона встановлена так: <code className="text-zinc-500/60">Тариф: $14/кг</code>, <code className="text-zinc-500/60">Штраф: $2/кг</code>, <code className="text-zinc-500/60">Комісія: $5</code>.<br />
                      Розрахунок: <code className="text-zinc-500/60">$5 + (10кг × $14) + ((15кг − 10кг) × $2)</code>.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* ─── Add Warehouse Modal ─── */}
      <AnimatePresence>
        {showAddWarehouse && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setShowAddWarehouse(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-[#0A0A0A] border border-white/[0.08] w-full max-w-lg p-6 rounded-none shadow-2xl"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-sm font-medium text-white flex items-center gap-2">
                  <WarehouseIcon className="w-4 h-4 text-zinc-400" /> Додати Склад
                </h3>
                <button onClick={() => setShowAddWarehouse(false)} className="p-1 rounded-none hover:bg-white/5 text-white/30">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[9px] uppercase tracking-widest text-white/30 mb-1.5">Код *</label>
                  <input value={newWarehouse.code} onChange={e => setNewWarehouse(p => ({ ...p, code: e.target.value.toUpperCase() }))}
                    placeholder="US_NY"
                    className="w-full bg-white/[0.03] border border-white/10 text-sm text-white px-3 py-2.5 rounded-none focus:outline-none focus:border-blue-500/40 placeholder-white/15 font-mono" />
                </div>
                <div>
                  <label className="block text-[9px] uppercase tracking-widest text-white/30 mb-1.5">Країна *</label>
                  <input value={newWarehouse.country} onChange={e => setNewWarehouse(p => ({ ...p, country: e.target.value }))}
                    placeholder="US"
                    className="w-full bg-white/[0.03] border border-white/10 text-sm text-white px-3 py-2.5 rounded-none focus:outline-none focus:border-blue-500/40 placeholder-white/15" />
                </div>
                <div className="col-span-2">
                  <label className="block text-[9px] uppercase tracking-widest text-white/30 mb-1.5">Назва (EN) *</label>
                  <input value={newWarehouse.name} onChange={e => setNewWarehouse(p => ({ ...p, name: e.target.value }))}
                    placeholder="USA Transit (New York)"
                    className="w-full bg-white/[0.03] border border-white/10 text-sm text-white px-3 py-2.5 rounded-none focus:outline-none focus:border-blue-500/40 placeholder-white/15" />
                </div>
                <div className="col-span-2">
                  <label className="block text-[9px] uppercase tracking-widest text-white/30 mb-1.5">Назва (UA)</label>
                  <input value={newWarehouse.nameUa} onChange={e => setNewWarehouse(p => ({ ...p, nameUa: e.target.value }))}
                    placeholder="Транзитний Склад США (Нью-Йорк)"
                    className="w-full bg-white/[0.03] border border-white/10 text-sm text-white px-3 py-2.5 rounded-none focus:outline-none focus:border-blue-500/40 placeholder-white/15" />
                </div>
                <div className="col-span-2">
                  <label className="block text-[9px] uppercase tracking-widest text-white/30 mb-1.5">Місто</label>
                  <input value={newWarehouse.city} onChange={e => setNewWarehouse(p => ({ ...p, city: e.target.value }))}
                    placeholder="New York"
                    className="w-full bg-white/[0.03] border border-white/10 text-sm text-white px-3 py-2.5 rounded-none focus:outline-none focus:border-blue-500/40 placeholder-white/15" />
                </div>
              </div>

              {/* Address Section */}
              <div className="mt-4 pt-4 border-t border-white/[0.06]">
                <p className="text-[9px] uppercase tracking-widest text-white/25 mb-3 font-semibold">Адреса складу (для розрахунку доставки)</p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="col-span-2">
                    <label className="block text-[9px] uppercase tracking-widest text-white/30 mb-1">Адреса</label>
                    <input value={newWarehouse.address} onChange={e => setNewWarehouse(p => ({ ...p, address: e.target.value }))}
                      placeholder="123 Main Street"
                      className="w-full bg-white/[0.03] border border-white/10 text-sm text-white px-3 py-2 rounded-none focus:outline-none focus:border-blue-500/40 placeholder-white/15" />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-[9px] uppercase tracking-widest text-white/30 mb-1">Адреса 2</label>
                    <input value={newWarehouse.address2} onChange={e => setNewWarehouse(p => ({ ...p, address2: e.target.value }))}
                      placeholder="Suite 100"
                      className="w-full bg-white/[0.03] border border-white/10 text-sm text-white px-3 py-2 rounded-none focus:outline-none focus:border-blue-500/40 placeholder-white/15" />
                  </div>
                  <div>
                    <label className="block text-[9px] uppercase tracking-widest text-white/30 mb-1">Штат/Область</label>
                    <input value={newWarehouse.state} onChange={e => setNewWarehouse(p => ({ ...p, state: e.target.value }))}
                      placeholder="NY"
                      className="w-full bg-white/[0.03] border border-white/10 text-sm text-white px-3 py-2 rounded-none focus:outline-none focus:border-blue-500/40 placeholder-white/15" />
                  </div>
                  <div>
                    <label className="block text-[9px] uppercase tracking-widest text-white/30 mb-1">Поштовий індекс</label>
                    <input value={newWarehouse.postalCode} onChange={e => setNewWarehouse(p => ({ ...p, postalCode: e.target.value }))}
                      placeholder="10001"
                      className="w-full bg-white/[0.03] border border-white/10 text-sm text-white px-3 py-2 rounded-none focus:outline-none focus:border-blue-500/40 placeholder-white/15" />
                  </div>
                  <div>
                    <label className="block text-[9px] uppercase tracking-widest text-white/30 mb-1">Телефон</label>
                    <input value={newWarehouse.phone} onChange={e => setNewWarehouse(p => ({ ...p, phone: e.target.value }))}
                      placeholder="+1-555-123-4567"
                      className="w-full bg-white/[0.03] border border-white/10 text-sm text-white px-3 py-2 rounded-none focus:outline-none focus:border-blue-500/40 placeholder-white/15" />
                  </div>
                  <div>
                    <label className="block text-[9px] uppercase tracking-widest text-white/30 mb-1">Контактна особа</label>
                    <input value={newWarehouse.contactName} onChange={e => setNewWarehouse(p => ({ ...p, contactName: e.target.value }))}
                      placeholder="John Doe"
                      className="w-full bg-white/[0.03] border border-white/10 text-sm text-white px-3 py-2 rounded-none focus:outline-none focus:border-blue-500/40 placeholder-white/15" />
                  </div>
                </div>
              </div>

              <div className="flex gap-3 mt-6">
                <button onClick={() => setShowAddWarehouse(false)}
                  className="flex-1 text-center py-2.5 text-xs uppercase tracking-widest text-white/40 border border-white/10 rounded-none hover:bg-white/5 transition-colors">
                  Скасувати
                </button>
                <button onClick={saveWarehouse} disabled={!newWarehouse.code || !newWarehouse.name}
                  className="flex-1 text-center py-2.5 text-xs uppercase tracking-widest font-bold bg-blue-500/15 text-zinc-100 rounded-none hover:bg-blue-400 disabled:opacity-30 transition-all">
                  Створити
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ─── Add Zone Modal ─── */}
      <AnimatePresence>
        {showAddZone && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setShowAddZone(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-[#0A0A0A] border border-white/[0.08] w-full max-w-lg p-6 rounded-none shadow-2xl"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-sm font-medium text-white flex items-center gap-2">
                  <Globe className="w-4 h-4 text-zinc-400" /> Додати Зону Доставки
                </h3>
                <button onClick={() => setShowAddZone(false)} className="p-1 rounded-none hover:bg-white/5 text-white/30">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[9px] uppercase tracking-widest text-white/30 mb-1.5">Код Зони *</label>
                    <input value={newZone.zoneCode} onChange={e => setNewZone(p => ({ ...p, zoneCode: e.target.value.toUpperCase() }))}
                      placeholder="AE"
                      className="w-full bg-white/[0.03] border border-white/10 text-sm text-white px-3 py-2.5 rounded-none focus:outline-none focus:border-blue-500/40 placeholder-white/15 font-mono" />
                  </div>
                  <div>
                    <label className="block text-[9px] uppercase tracking-widest text-white/30 mb-1.5">Базова Комісія ($)</label>
                    <input type="number" step="1" value={newZone.baseFee} onChange={e => setNewZone(p => ({ ...p, baseFee: Number(e.target.value) }))}
                      className="w-full bg-white/[0.03] border border-white/10 text-sm text-white px-3 py-2.5 rounded-none focus:outline-none focus:border-blue-500/40" />
                  </div>
                </div>
                <div>
                  <label className="block text-[9px] uppercase tracking-widest text-white/30 mb-1.5">Назва (EN) *</label>
                  <input value={newZone.label} onChange={e => setNewZone(p => ({ ...p, label: e.target.value }))}
                    placeholder="United Arab Emirates"
                    className="w-full bg-white/[0.03] border border-white/10 text-sm text-white px-3 py-2.5 rounded-none focus:outline-none focus:border-blue-500/40 placeholder-white/15" />
                </div>
                <div>
                  <label className="block text-[9px] uppercase tracking-widest text-white/30 mb-1.5">Назва (UA)</label>
                  <input value={newZone.labelUa} onChange={e => setNewZone(p => ({ ...p, labelUa: e.target.value }))}
                    placeholder="Об'єднані Арабські Емірати"
                    className="w-full bg-white/[0.03] border border-white/10 text-sm text-white px-3 py-2.5 rounded-none focus:outline-none focus:border-blue-500/40 placeholder-white/15" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[9px] uppercase tracking-widest text-white/30 mb-1.5">Тариф ($/кг)</label>
                    <input type="number" step="0.1" value={newZone.ratePerKg} onChange={e => setNewZone(p => ({ ...p, ratePerKg: Number(e.target.value) }))}
                      className="w-full bg-white/[0.03] border border-white/10 text-sm text-white px-3 py-2.5 rounded-none focus:outline-none focus:border-blue-500/40" />
                  </div>
                  <div>
                    <label className="block text-[9px] uppercase tracking-widest text-white/30 mb-1.5">Штраф Об&apos;єму ($/кг)</label>
                    <input type="number" step="0.1" value={newZone.volSurchargePerKg} onChange={e => setNewZone(p => ({ ...p, volSurchargePerKg: Number(e.target.value) }))}
                      className="w-full bg-white/[0.03] border border-white/10 text-sm text-white px-3 py-2.5 rounded-none focus:outline-none focus:border-blue-500/40" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[9px] uppercase tracking-widest text-white/30 mb-1.5">ETA мін. (днів)</label>
                    <input type="number" min="1" max="90" value={newZone.etaMinDays} onChange={e => setNewZone(p => ({ ...p, etaMinDays: Number(e.target.value) }))}
                      className="w-full bg-white/[0.03] border border-white/10 text-sm text-white px-3 py-2.5 rounded-none focus:outline-none focus:border-blue-500/40" />
                  </div>
                  <div>
                    <label className="block text-[9px] uppercase tracking-widest text-white/30 mb-1.5">ETA макс. (днів)</label>
                    <input type="number" min="1" max="90" value={newZone.etaMaxDays} onChange={e => setNewZone(p => ({ ...p, etaMaxDays: Number(e.target.value) }))}
                      className="w-full bg-white/[0.03] border border-white/10 text-sm text-white px-3 py-2.5 rounded-none focus:outline-none focus:border-blue-500/40" />
                  </div>
                </div>
              </div>

              <div className="flex gap-3 mt-6">
                <button onClick={() => setShowAddZone(false)}
                  className="flex-1 text-center py-2.5 text-xs uppercase tracking-widest text-white/40 border border-white/10 rounded-none hover:bg-white/5 transition-colors">
                  Скасувати
                </button>
                <button onClick={addNewZone} disabled={!newZone.zoneCode || !newZone.label}
                  className="flex-1 text-center py-2.5 text-xs uppercase tracking-widest font-bold bg-blue-500/15 text-zinc-100 rounded-none hover:bg-blue-400 disabled:opacity-30 transition-all">
                  Створити Зону
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
