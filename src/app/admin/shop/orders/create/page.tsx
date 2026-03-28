'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  ArrowLeft,
  Search,
  Package,
  Calculator,
  Truck,
  DollarSign,
  Plus,
  Trash2,
  RefreshCw,
  Save,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';
import { calcItemPrice, calcShipping, lbsToKg, SHIPPING_ZONES, type ShippingZone } from '@/lib/shippingCalc';

// ─── Types ────────────────────────────────────────────────────


interface CustomerOption {
  id: string;
  email: string;
  fullName: string;
  group: string;
  b2bDiscountPercent: number | null;
  region?: string | null;
}

interface OrderItem {
  key: string;
  title: string;
  partNumber: string;
  brand: string;
  baseCostUsd: number;
  markupPct: number;
  discountPct: number;
  quantity: number;
  weightLbs: number;
  weightKg: number;
  lengthCm: number;
  widthCm: number;
  heightCm: number;
  unitPrice: number;
  lineTotal: number;
  thumbnail: string;
  turn14Id: string;
}

// ─── Helpers ──────────────────────────────────────────────────

const r2 = (n: number) => Math.round(n * 100) / 100;
function fmtUsd(v: number) { return v.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 }); }

function newItem(): OrderItem {
  return {
    key: crypto.randomUUID(),
    title: '',
    partNumber: '',
    brand: '',
    baseCostUsd: 0,
    markupPct: 30,
    discountPct: 0,
    quantity: 1,
    weightLbs: 0,
    weightKg: 0,
    lengthCm: 0,
    widthCm: 0,
    heightCm: 0,
    unitPrice: 0,
    lineTotal: 0,
    thumbnail: '',
    turn14Id: '',
  };
}

// ─── Component ────────────────────────────────────────────────

export default function AdminCreateOrderPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Customer
  const [customers, setCustomers] = useState<CustomerOption[]>([]);
  const [customerSearch, setCustomerSearch] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerOption | null>(null);
  const [loadingCustomers, setLoadingCustomers] = useState(false);

  // Items
  const [items, setItems] = useState<OrderItem[]>([newItem()]);

  // Turn14 search
  const [turn14Query, setTurn14Query] = useState('');
  const [turn14Results, setTurn14Results] = useState<any[]>([]);
  const [turn14Loading, setTurn14Loading] = useState(false);
  const [addingToItemIdx, setAddingToItemIdx] = useState<number | null>(null);

  // Shipping
  const [zone, setZone] = useState<ShippingZone>('KZ');
  const [ratePerKg, setRatePerKg] = useState(14);
  const [volSurchargePerKg, setVolSurchargePerKg] = useState(2);
  const [baseFee, setBaseFee] = useState(0);
  const [shippingOverride, setShippingOverride] = useState<string>('');

  // Order
  const [orderNotes, setOrderNotes] = useState('');
  const [currency] = useState('USD');
  const [submitting, setSubmitting] = useState(false);
  const [submitResult, setSubmitResult] = useState<{ success: boolean; message: string; orderId?: string } | null>(null);

  // ─── Load customers ────────────────────────────────────────

  const loadCustomers = useCallback(async (q = '') => {
    setLoadingCustomers(true);
    try {
      const res = await fetch(`/api/admin/shop/customers?q=${encodeURIComponent(q)}`);
      const data = await res.json();
      setCustomers(Array.isArray(data) ? data : []);
    } catch { /* ignore */ }
    setLoadingCustomers(false);
  }, []);

  useEffect(() => { void loadCustomers(); }, [loadCustomers]);

  // ─── Auto-select customer from URL param ───────────────────

  useEffect(() => {
    const cid = searchParams.get('customerId');
    if (!cid || selectedCustomer) return;
    const match = customers.find(c => c.id === cid);
    if (match) setSelectedCustomer(match);
  }, [searchParams, customers, selectedCustomer]);

  // ─── Close dropdown on Escape / click outside ──────────────

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape' && addingToItemIdx !== null) {
        setAddingToItemIdx(null);
        setTurn14Results([]);
      }
    }
    function onClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setAddingToItemIdx(null);
        setTurn14Results([]);
      }
    }
    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('mousedown', onClick);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('mousedown', onClick);
    };
  }, [addingToItemIdx]);

  // ─── When zone changes, update rates ───────────────────────

  useEffect(() => {
    const profile = SHIPPING_ZONES[zone];
    setRatePerKg(profile.ratePerKg);
    setVolSurchargePerKg(profile.volSurchargePerKg);
    setBaseFee(profile.baseFee);
  }, [zone]);

  // ─── When customer changes, apply discount + auto-zone ─────

  useEffect(() => {
    if (!selectedCustomer) return;
    setItems(prev => prev.map(item => ({
      ...item,
      discountPct: selectedCustomer.b2bDiscountPercent ?? 0,
    })));
    // Auto-detect zone from customer region
    const region = (selectedCustomer.region || '').toUpperCase();
    if (region === 'KZ' || region.includes('КАЗАХСТАН') || region.includes('KAZAKH')) setZone('KZ');
    else if (region === 'UA' || region.includes('УКРАЇН') || region.includes('UKRAIN')) setZone('UA');
    else if (region === 'US' || region.includes('USA') || region.includes('AMERICA')) setZone('US');
    else if (['DE','FR','IT','ES','PL','CZ','NL','BE','AT','CH'].includes(region) || region.includes('EUROP')) setZone('EU');
  }, [selectedCustomer]);

  // ─── Recalculate item prices ───────────────────────────────

  function updateItem(index: number, patch: Partial<OrderItem>) {
    setItems(prev => {
      const next = [...prev];
      const item = { ...next[index]!, ...patch };

      // Auto-recalculate kg from lbs if lbs changed
      if ('weightLbs' in patch && patch.weightLbs != null) {
        item.weightKg = lbsToKg(patch.weightLbs);
      }
      // Recalculate price
      const priceParams = calcItemPrice({
        baseCostUsd: item.baseCostUsd,
        markupPct: item.markupPct,
        discountPct: item.discountPct,
        quantity: item.quantity,
      });
      item.unitPrice = priceParams.unitPrice;
      item.lineTotal = priceParams.lineTotal;
      next[index] = item;
      return next;
    });
  }

  function removeItem(index: number) {
    setItems(prev => prev.filter((_, i) => i !== index));
  }

  function addBlankItem() {
    const item = newItem();
    item.discountPct = selectedCustomer?.b2bDiscountPercent ?? 0;
    setItems(prev => [...prev, item]);
  }

  // ─── Turn14 search ─────────────────────────────────────────

  async function searchTurn14() {
    if (!turn14Query.trim()) return;
    setTurn14Loading(true);
    try {
      const res = await fetch(`/api/admin/shop/turn14?q=${encodeURIComponent(turn14Query.trim())}`);
      const data = await res.json();
      setTurn14Results(data.items || data.data || []);
    } catch { setTurn14Results([]); }
    setTurn14Loading(false);
  }

  function addTurn14Item(t14Item: any, targetIdx: number) {
    // Our enriched API returns flattened fields at top level + raw attributes backup
    const a = t14Item.attributes || {};
    const patch: Partial<OrderItem> = {
      title: t14Item.product_name || a.product_name || a.item_name || '',
      partNumber: t14Item.internal_part_number || a.internal_part_number || t14Item.part_number || a.part_number || '',
      brand: t14Item.brand || a.brand_short_description || a.brand || '',
      baseCostUsd: t14Item.dealer_price || t14Item.jobber_price || a.dealer_price || 0,
      weightLbs: t14Item.weight || a.weight || 0,
      weightKg: lbsToKg(t14Item.weight || a.weight || 0),
      thumbnail: t14Item.primary_image || a.primary_image || '',
      turn14Id: String(t14Item.id || ''),
    };
    updateItem(targetIdx, patch);
    setTurn14Results([]);
    setTurn14Query(patch.title || '');
    setAddingToItemIdx(null);
  }

  // ─── Shipping calculations ─────────────────────────────────

  const totalWeightKg = items.reduce((sum, item) => sum + item.weightKg * item.quantity, 0);
  const totalVolWeightKg = items.reduce((sum, item) => {
    if (item.lengthCm > 0 && item.widthCm > 0 && item.heightCm > 0) {
      return sum + (item.lengthCm * item.widthCm * item.heightCm / 5000) * item.quantity;
    }
    return sum;
  }, 0);
  const volSurchargeKg = Math.max(0, totalVolWeightKg - totalWeightKg);

  const autoShippingRes = calcShipping({
    actualWeightKg: totalWeightKg,
    lengthCm: 0, // Volumetric is aggregated
    widthCm: 0,
    heightCm: 0,
    zone,
    ratePerKg,
    volSurchargePerKg,
    baseFee,
  });
  
  // Since we aggregate totalVolWeightKg above across multiple items manually 
  // without sending individual dimensions to calcShipping, we inject the pre-calculated diff
  const autoShippingBase = autoShippingRes.baseCost;
  const autoShippingVol = r2(volSurchargeKg * volSurchargePerKg);
  const autoShippingTotal = r2(baseFee + autoShippingBase + autoShippingVol);
  const finalShipping = shippingOverride !== '' ? Number(shippingOverride) : autoShippingTotal;

  // ─── Order totals ──────────────────────────────────────────

  const subtotal = r2(items.reduce((sum, item) => sum + item.lineTotal, 0));
  const grandTotal = r2(subtotal + finalShipping);

  // ─── Submit order ──────────────────────────────────────────

  async function submitOrder() {
    if (!selectedCustomer) { setSubmitResult({ success: false, message: 'Оберіть клієнта' }); return; }
    if (items.length === 0 || items.every(i => !i.title)) { setSubmitResult({ success: false, message: 'Додайте хоча б одну позицію' }); return; }

    setSubmitting(true);
    setSubmitResult(null);
    try {
      const res = await fetch('/api/admin/shop/orders/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerId: selectedCustomer.id,
          currency,
          zone,
          shippingCost: finalShipping,
          subtotal,
          total: grandTotal,
          notes: orderNotes,
          shippingCalc: {
            totalWeightKg,
            totalVolWeightKg,
            volSurchargeKg,
            ratePerKg,
            volSurchargePerKg,
            baseFee,
            autoShippingTotal,
            overridden: shippingOverride !== '',
          },
          items: items.filter(i => i.title).map(item => ({
            title: item.title,
            partNumber: item.partNumber,
            brand: item.brand,
            baseCostUsd: item.baseCostUsd,
            markupPct: item.markupPct,
            discountPct: item.discountPct,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            lineTotal: item.lineTotal,
            weightKg: item.weightKg,
            thumbnail: item.thumbnail,
            turn14Id: item.turn14Id,
          })),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setSubmitResult({ success: false, message: data.error || 'Не вдалося створити' });
      } else {
        setSubmitResult({ success: true, message: `Замовлення ${data.orderNumber} створено! Перенаправлення...`, orderId: data.orderId });
        // Redirect to order detail after 1.5s
        setTimeout(() => router.push(`/admin/shop/orders/${data.orderId}`), 1500);
      }
    } catch (e: any) {
      setSubmitResult({ success: false, message: e.message });
    }
    setSubmitting(false);
  }

  // ─── Render ────────────────────────────────────────────────

  const filteredCustomers = customerSearch
    ? customers.filter(c =>
        c.fullName.toLowerCase().includes(customerSearch.toLowerCase()) ||
        c.email.toLowerCase().includes(customerSearch.toLowerCase())
      )
    : customers;

  return (
    <div className="h-full overflow-auto">
      <div className="mx-auto max-w-[1920px] p-6">
        <Link href="/admin/shop/orders" className="mb-6 inline-flex items-center gap-2 text-sm text-white/60 hover:text-white">
          <ArrowLeft className="h-4 w-4" /> Назад до замовлень
        </Link>

        <h1 className="mb-2 text-2xl font-semibold text-white">Нове замовлення</h1>
        <p className="mb-8 text-sm text-white/45">Створити B2B замовлення з розрахунком доставки</p>

        <div className="grid gap-6 xl:grid-cols-[1fr_380px]">
          {/* ─── LEFT COLUMN (main) ────────────────────────── */}
          <div className="space-y-6">

            {/* ── Section: Customer ──────────────────────── */}
            <Section icon={<Search className="h-4 w-4 text-blue-400" />} title="Клієнт">
              {selectedCustomer ? (
                <div className="flex items-center justify-between rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4">
                  <div>
                    <div className="font-medium text-white">{selectedCustomer.fullName}</div>
                    <div className="mt-1 text-xs text-white/45">{selectedCustomer.email} · {selectedCustomer.group}</div>
                    {selectedCustomer.b2bDiscountPercent ? (
                      <div className="mt-1 text-xs text-emerald-400">Знижка: {selectedCustomer.b2bDiscountPercent}%</div>
                    ) : null}
                  </div>
                  <button type="button" onClick={() => setSelectedCustomer(null)} className="text-xs text-white/40 hover:text-white">Змінити</button>
                </div>
              ) : (
                <div>
                  <input
                    value={customerSearch}
                    onChange={e => { setCustomerSearch(e.target.value); void loadCustomers(e.target.value); }}
                    placeholder="Пошук (ім'я, email)..."
                    className="w-full rounded-lg border border-white/10 bg-zinc-950 px-3 py-2 text-sm text-white placeholder:text-white/25"
                  />
                  {loadingCustomers ? (
                    <div className="mt-2 text-xs text-white/30">Завантаження...</div>
                  ) : filteredCustomers.length > 0 ? (
                    <div className="mt-2 max-h-48 space-y-1 overflow-y-auto">
                      {filteredCustomers.map(c => (
                        <button key={c.id} type="button" onClick={() => { setSelectedCustomer(c); setCustomerSearch(''); }}
                          className="w-full rounded-lg border border-white/10 bg-black/30 p-3 text-left transition hover:border-white/20">
                          <div className="text-sm text-white">{c.fullName}</div>
                          <div className="text-xs text-white/40">{c.email} · {c.group}{c.b2bDiscountPercent ? ` · −${c.b2bDiscountPercent}%` : ''}</div>
                        </button>
                      ))}
                    </div>
                  ) : (
                    <div className="mt-2 text-xs text-white/30">Немає результатів</div>
                  )}
                </div>
              )}
            </Section>

            {/* ── Section: Items ─────────────────────────── */}
            <Section icon={<Package className="h-4 w-4 text-amber-400" />} title="Позиції">
              {items.map((item, idx) => (
                <div key={item.key} className="rounded-xl border border-white/10 bg-black/20 p-4 mb-4">
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <span className="text-xs text-white/30 uppercase tracking-wider">#{idx + 1}</span>
                    {items.length > 1 && (
                      <button type="button" onClick={() => removeItem(idx)} className="text-white/20 hover:text-red-400"><Trash2 className="h-3.5 w-3.5" /></button>
                    )}
                  </div>

                  {/* Inline Turn14 search / autocomplete */}
                  <div className="mb-3 relative">
                    <label className="block">
                      <span className="mb-1 block text-[10px] text-blue-400/60 uppercase tracking-wider flex items-center gap-1">
                        <Search className="h-3 w-3" /> SKU / Назва (пошук Turn14)
                      </span>
                      <input
                        value={addingToItemIdx === idx ? turn14Query : item.title}
                        onChange={e => {
                          const v = e.target.value;
                          if (addingToItemIdx !== idx) setAddingToItemIdx(idx);
                          setTurn14Query(v);
                          updateItem(idx, { title: v });
                          // Debounced search
                          clearTimeout((window as any).__t14Timer);
                          (window as any).__t14Timer = setTimeout(() => {
                            if (v.trim().length >= 2) searchTurn14();
                          }, 500);
                        }}
                        onFocus={() => {
                          if (addingToItemIdx !== idx) {
                            setAddingToItemIdx(idx);
                            setTurn14Query(item.title);
                            setTurn14Results([]);
                          }
                        }}
                        placeholder="Введіть SKU, артикул або назву деталі..."
                        className="w-full rounded-lg border border-blue-500/20 bg-zinc-950 px-3 py-2 text-sm text-white placeholder:text-white/25 focus:border-blue-500/40 focus:outline-none"
                      />
                    </label>
                    {/* Results dropdown */}
                    {addingToItemIdx === idx && turn14Results.length > 0 && (
                      <div className="absolute top-full left-0 right-0 z-20 mt-1 max-h-64 overflow-y-auto rounded-xl border border-blue-500/20 bg-zinc-900 shadow-2xl">
                        {turn14Loading && (
                          <div className="p-2 text-xs text-blue-400/70 text-center">Пошук...</div>
                        )}
                        {turn14Results.slice(0, 12).map((t14, i) => {
                          const a = t14.attributes || {};
                          const name = t14.product_name || a.product_name || a.item_name || 'Невідомо';
                          const pn = t14.internal_part_number || a.internal_part_number || t14.part_number || a.part_number || '';
                          const brand = t14.brand || a.brand_short_description || a.brand || '';
                          const price = t14.dealer_price || t14.jobber_price || a.dealer_price || 0;
                          const weight = t14.weight || a.weight;
                          return (
                          <button key={i} type="button" onClick={() => addTurn14Item(t14, idx)}
                            className="w-full border-b border-white/5 p-3 text-left transition hover:bg-blue-500/10 last:border-b-0">
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0 flex-1">
                                <div className="text-sm text-white truncate">{name}</div>
                                <div className="mt-0.5 flex flex-wrap gap-2 text-[10px] text-white/40">
                                  {pn && <span className="rounded bg-white/10 px-1 py-0.5 font-mono">{pn}</span>}
                                  {brand && <span>{brand}</span>}
                                  {weight ? <span>{weight} lbs</span> : null}
                                </div>
                              </div>
                              <div className="text-right shrink-0">
                                <div className="text-sm font-mono text-emerald-400">{fmtUsd(price)}</div>
                              </div>
                            </div>
                          </button>
                          );
                        })}
                      </div>
                    )}
                    {addingToItemIdx === idx && turn14Loading && turn14Results.length === 0 && (
                      <div className="absolute top-full left-0 right-0 z-20 mt-1 rounded-xl border border-blue-500/20 bg-zinc-900 p-3 text-xs text-center text-blue-400/70">
                        Пошук в Turn14 каталозі...
                      </div>
                    )}
                  </div>

                  {item.title && (
                    <>
                      <div className="flex gap-3">
                        {item.thumbnail && (
                          <div className="shrink-0 w-12 h-12 rounded-lg border border-white/10 bg-black/40 overflow-hidden">
                            <img src={item.thumbnail} alt="" className="w-full h-full object-contain" />
                          </div>
                        )}
                        <div className="flex-1 grid gap-3 md:grid-cols-2">
                          <Field label="Артикул (PN)" value={item.partNumber} onChange={v => updateItem(idx, { partNumber: v })} />
                          <Field label="Бренд" value={item.brand} onChange={v => updateItem(idx, { brand: v })} />
                        </div>
                      </div>

                      <div className="mt-3 grid gap-3 md:grid-cols-4">
                        <NumField label="Закупка ($)" value={item.baseCostUsd} onChange={v => updateItem(idx, { baseCostUsd: v })} />
                        <NumField label="Націнка (%)" value={item.markupPct} onChange={v => updateItem(idx, { markupPct: v })} />
                        <NumField label="Знижка (%)" value={item.discountPct} onChange={v => updateItem(idx, { discountPct: v })} />
                        <NumField label="Кількість" value={item.quantity} onChange={v => updateItem(idx, { quantity: Math.max(1, Math.round(v)) })} step={1} />
                      </div>

                      <div className="mt-3 grid gap-3 md:grid-cols-4">
                        <NumField label="Вага (LBS)" value={item.weightLbs} onChange={v => updateItem(idx, { weightLbs: v })} />
                        <div className="rounded-lg border border-white/10 bg-zinc-950 px-3 py-2">
                          <div className="text-[10px] text-white/40 uppercase tracking-wider mb-1">Вага (KG)</div>
                          <div className="text-sm text-white">{item.weightKg.toFixed(2)}</div>
                        </div>
                        <NumField label="Д × В × Г (см)" value={item.lengthCm}
                          onChange={v => updateItem(idx, { lengthCm: v })} placeholder="Довжина" />
                        <div className="grid grid-cols-2 gap-2">
                          <NumField label="Ширина" value={item.widthCm} onChange={v => updateItem(idx, { widthCm: v })} />
                          <NumField label="Глибина" value={item.heightCm} onChange={v => updateItem(idx, { heightCm: v })} />
                        </div>
                      </div>

                      <div className="mt-3 flex items-center justify-between rounded-lg border border-white/10 bg-white/[0.03] px-4 py-2">
                        <span className="text-xs text-white/40">Ціна за одиницю</span>
                        <span className="font-mono text-sm text-white">{fmtUsd(item.unitPrice)}</span>
                        <span className="text-xs text-white/40">Разом</span>
                        <span className="font-mono text-base font-medium text-white">{fmtUsd(item.lineTotal)}</span>
                      </div>
                    </>
                  )}
                </div>
              ))}

              <button type="button" onClick={addBlankItem}
                className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-white/15 py-3 text-xs uppercase tracking-wider text-white/40 hover:border-white/30 hover:text-white/60">
                <Plus className="h-4 w-4" /> Додати позицію
              </button>
            </Section>
          </div>

          {/* ─── RIGHT COLUMN (summary) ────────────────────── */}
          <div className="space-y-6">

            {/* ── Section: Shipping ──────────────────────── */}
            <Section icon={<Truck className="h-4 w-4 text-cyan-400" />} title="Доставка">
              <label className="block mb-3">
                <span className="mb-1 block text-xs text-white/50">Зона доставки</span>
                <select value={zone} onChange={e => setZone(e.target.value as ShippingZone)}
                  className="w-full rounded-lg border border-white/10 bg-zinc-950 px-3 py-2 text-sm text-white">
                  {(Object.keys(SHIPPING_ZONES) as ShippingZone[]).map(z => (
                    <option key={z} value={z}>{SHIPPING_ZONES[z].label} ({z})</option>
                  ))}
                </select>
              </label>

              <div className="grid grid-cols-3 gap-2 mb-3">
                <NumField label="$/кг" value={ratePerKg} onChange={setRatePerKg} />
                <NumField label="Об'єм $/кг" value={volSurchargePerKg} onChange={setVolSurchargePerKg} />
                <NumField label="Базова %" value={baseFee} onChange={setBaseFee} />
              </div>

              <div className="space-y-1.5 rounded-xl border border-white/10 bg-black/20 p-3 text-xs">
                <Row label="Факт. вага" value={`${totalWeightKg.toFixed(2)} kg`} />
                <Row label="Об'ємна вага" value={`${totalVolWeightKg.toFixed(2)} kg`} />
                <Row label="Об'ємна доплата" value={`${volSurchargeKg.toFixed(2)} kg`} />
                <hr className="border-white/10" />
                <Row label={`Базова: ${totalWeightKg.toFixed(1)}кг × $${ratePerKg}`} value={fmtUsd(autoShippingBase)} />
                {volSurchargeKg > 0 && (
                  <Row label={`Об'ємна: ${volSurchargeKg.toFixed(1)}кг × $${volSurchargePerKg}`} value={fmtUsd(autoShippingVol)} />
                )}
                {baseFee > 0 && <Row label="Базова плата" value={fmtUsd(baseFee)} />}
                <hr className="border-white/10" />
                <Row label="Авто-розрахунок" value={fmtUsd(autoShippingTotal)} bold />
              </div>

              <div className="mt-3">
                <NumField
                  label="Override доставки ($) — залиште 0 для авто"
                  value={shippingOverride !== '' ? Number(shippingOverride) : 0}
                  onChange={v => setShippingOverride(v > 0 ? String(v) : '')}
                />
                {shippingOverride !== '' && (
                  <button type="button" onClick={() => setShippingOverride('')}
                    className="mt-1 flex items-center gap-1 text-[10px] text-amber-400/70 hover:text-amber-400">
                    <RefreshCw className="h-3 w-3" /> Скинути до авто
                  </button>
                )}
              </div>
            </Section>

            {/* ── Section: Order Summary ─────────────────── */}
            <Section icon={<DollarSign className="h-4 w-4 text-emerald-400" />} title="Підсумок">
              <div className="space-y-2 text-sm">
                <Row label="Товари" value={fmtUsd(subtotal)} />
                <Row label="Доставка" value={fmtUsd(finalShipping)} highlight={shippingOverride !== ''} />
                <hr className="border-white/10" />
                <div className="flex items-center justify-between pt-1">
                  <span className="text-base font-medium text-white">Разом</span>
                  <span className="text-xl font-semibold text-white">{fmtUsd(grandTotal)}</span>
                </div>
              </div>

              <div className="mt-4">
                <label className="block">
                  <span className="mb-1 block text-xs text-white/50">Примітки</span>
                  <textarea value={orderNotes} onChange={e => setOrderNotes(e.target.value)} rows={3}
                    className="w-full rounded-lg border border-white/10 bg-zinc-950 px-3 py-2 text-sm text-white placeholder:text-white/25"
                    placeholder="Внутрішні нотатки..." />
                </label>
              </div>

              {submitResult && (
                <div className={`mt-3 flex items-start gap-2 rounded-lg border p-3 text-sm ${
                  submitResult.success
                    ? 'border-emerald-500/20 bg-emerald-500/5 text-emerald-200'
                    : 'border-red-500/20 bg-red-500/5 text-red-200'
                }`}>
                  {submitResult.success ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" /> : <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />}
                  {submitResult.message}
                </div>
              )}

              <button type="button" onClick={submitOrder} disabled={submitting}
                className="mt-4 flex w-full items-center justify-center gap-2 rounded-lg bg-white px-4 py-3 text-sm font-semibold text-black hover:bg-white/90 disabled:opacity-50">
                <Save className="h-4 w-4" />
                {submitting ? 'Створення...' : 'Створити замовлення'}
              </button>
            </Section>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Sub-components ──────────────────────────────────────────

function Section({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 shadow-[0_24px_80px_rgba(0,0,0,0.2)]">
      <h3 className="mb-4 flex items-center gap-2 text-lg font-medium text-white">{icon}{title}</h3>
      {children}
    </div>
  );
}

function Field({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[10px] text-white/40 uppercase tracking-wider">{label}</span>
      <input value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
        className="w-full rounded-lg border border-white/10 bg-zinc-950 px-3 py-1.5 text-sm text-white placeholder:text-white/20 focus:border-white/30 focus:outline-none" />
    </label>
  );
}

function NumField({ label, value, onChange, step, placeholder }: { label: string; value: number; onChange: (v: number) => void; step?: number; placeholder?: string }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[10px] text-white/40 uppercase tracking-wider">{label}</span>
      <input type="number" step={step ?? 0.01} value={value || ''} onChange={e => onChange(Number(e.target.value) || 0)}
        placeholder={placeholder}
        className="w-full rounded-lg border border-white/10 bg-zinc-950 px-3 py-1.5 text-sm text-white placeholder:text-white/20 focus:border-white/30 focus:outline-none" />
    </label>
  );
}

function Row({ label, value, bold, highlight }: { label: string; value: string; bold?: boolean; highlight?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span className={`text-white/${bold ? '70' : '40'} ${bold ? 'font-medium' : ''}`}>{label}</span>
      <span className={`font-mono ${bold ? 'text-white text-sm font-medium' : 'text-white/70'} ${highlight ? 'text-amber-400' : ''}`}>{value}</span>
    </div>
  );
}
