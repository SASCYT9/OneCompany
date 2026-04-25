'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  Search,
  Plus,
  Trash2,
  RefreshCw,
  Save,
  CheckCircle2,
  AlertCircle,
  Edit3,
} from 'lucide-react';
import { calcItemPrice, lbsToKg, SHIPPING_ZONES, type ShippingZone } from '@/lib/shippingCalc';
import {
  AdminActionBar,
  AdminEditorSection,
  AdminEditorShell,
  AdminInlineAlert,
  AdminInspectorCard,
  AdminKeyValueGrid,
  AdminStatusBadge,
} from '@/components/admin/AdminPrimitives';

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
  entryMode: 'search' | 'manual';
  sourceType: 'empty' | 'local' | 'turn14' | 'manual';
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
  isAILoading: boolean;
  aiReasoning?: string;
}

// ─── Helpers ──────────────────────────────────────────────────

const r2 = (n: number) => Math.round(n * 100) / 100;
function fmtUsd(v: number) { return v.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 }); }
function compactText(value: unknown, fallback = '—') {
  const text = String(value ?? '').trim();
  return text || fallback;
}

function newItem(): OrderItem {
  return {
    key: crypto.randomUUID(),
    entryMode: 'search',
    sourceType: 'empty',
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
    isAILoading: false,
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
  const [brandConfigs, setBrandConfigs] = useState<any[]>([]);
  const [zoneConfigs, setZoneConfigs] = useState<any[]>([]);

  useEffect(() => {
    // Fetch Inbound (Brands)
    fetch('/api/admin/shop/logistics/brands')
      .then(r => r.json())
      .then(d => {
        if (d.configs) setBrandConfigs(d.configs.filter((c: any) => c.isActive));
      })
      .catch();
      
    // Fetch Outbound (Zones)
    fetch('/api/admin/shop/logistics/zones')
      .then(r => r.json())
      .then(d => {
        if (d.zones) setZoneConfigs(d.zones);
      })
      .catch();
  }, []);

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
    // Find custom override in DB
    const customZone = zoneConfigs.find(z => z.zoneCode === zone);
    
    // Fallback to coded default if missing
    const profile = customZone || SHIPPING_ZONES[zone] || SHIPPING_ZONES.OTHER;
    setRatePerKg(profile.ratePerKg);
    setVolSurchargePerKg(profile.volSurchargePerKg);
    setBaseFee(profile.baseFee);
  }, [zone, zoneConfigs]);

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

  function setItemMode(index: number, entryMode: OrderItem['entryMode']) {
    updateItem(index, {
      entryMode,
      sourceType: entryMode === 'manual' ? 'manual' : 'empty',
      turn14Id: entryMode === 'manual' ? '' : items[index]?.turn14Id || '',
    });
    if (entryMode === 'manual') {
      setAddingToItemIdx(null);
      setTurn14Results([]);
    }
  }

  function createManualItemFromQuery(index: number) {
    const title = turn14Query.trim() || items[index]?.title || '';
    updateItem(index, {
      entryMode: 'manual',
      sourceType: 'manual',
      title,
      turn14Id: '',
    });
    setAddingToItemIdx(null);
    setTurn14Results([]);
  }

  // ─── Turn14 search ─────────────────────────────────────────

  async function searchTurn14(nextQuery = turn14Query) {
    if (!nextQuery.trim()) return;
    setTurn14Loading(true);
    try {
      const res = await fetch(`/api/admin/shop/orders/search-items?q=${encodeURIComponent(nextQuery.trim())}`);
      const data = await res.json();
      setTurn14Results(data.items || data.data || []);
    } catch { setTurn14Results([]); }
    setTurn14Loading(false);
  }

  // ─── AI Dimensional Estimation ─────────────────────────────

  async function triggerAIEstimation(idx: number, title: string, brand: string, sku: string) {
    updateItem(idx, { isAILoading: true });
    try {
      const res = await fetch('/api/admin/shop/ai/estimate-dimensions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, brand, sku })
      });
      const data = await res.json();
      if (res.ok && data.estimate) {
        const est = data.estimate;
        // Proceed safely: only patch if AI guessed it
        const aiPatch: Partial<OrderItem> = {};
        if (est.weight && est.weight > 0) {
           aiPatch.weightKg = est.weight;
           aiPatch.weightLbs = est.weight * 2.20462;
        }
        if (est.length && est.length > 0) aiPatch.lengthCm = est.length;
        if (est.width && est.width > 0) aiPatch.widthCm = est.width;
        if (est.height && est.height > 0) aiPatch.heightCm = est.height;
        if (est.reasoning) aiPatch.aiReasoning = est.reasoning;
        
        if (Object.keys(aiPatch).length > 0) {
           updateItem(idx, aiPatch);
        }
      }
    } catch {
      // Ignored silently, user can still manually set it
    } finally {
      updateItem(idx, { isAILoading: false });
    }
  }

  function addTurn14Item(t14Item: any, targetIdx: number) {
    // Our enriched API returns flattened fields at top level + raw attributes backup
    const a = t14Item.attributes || {};
    const isLocal = t14Item.source === 'local';
    const patch: Partial<OrderItem> = {
      title: t14Item.product_name || a.product_name || a.item_name || '',
      entryMode: 'search',
      sourceType: isLocal ? 'local' : 'turn14',
      partNumber: t14Item.internal_part_number || a.internal_part_number || t14Item.part_number || a.part_number || '',
      brand: t14Item.brand || a.brand_short_description || a.brand || '',
      baseCostUsd: t14Item.dealer_price || t14Item.jobber_price || a.dealer_price || 0,
      weightLbs: t14Item.weight || a.weight || 0,
      weightKg: lbsToKg(t14Item.weight || a.weight || 0),
      thumbnail: t14Item.primary_image || a.primary_image || '',
      turn14Id: isLocal ? '' : String(t14Item.id || ''),
      discountPct: selectedCustomer?.b2bDiscountPercent ?? 0,
    };
    
    // For local items that already have a retail price in baseCostUsd, 
    // we want to lock the markup to 0% so it sells at exactly that retail price.
    if (isLocal) {
      patch.markupPct = 0;
    }
    
    updateItem(targetIdx, patch);
    setTurn14Results([]);
    setTurn14Query(patch.title || '');
    setAddingToItemIdx(null);

    // After setting the basic item details, if this item lacks dimensions, prompt the AI.
    const hasDimensions = a.length && a.width && a.height;
    if (!hasDimensions && patch.title) {
       triggerAIEstimation(targetIdx, patch.title, patch.brand || '', patch.partNumber || '');
    }
  }

  // ─── Shipping calculations ─────────────────────────────────

  let autoShippingBase = 0;
  let autoShippingVol = 0;
  let totalWeightKg = 0;
  let totalVolWeightKg = 0;
  let volSurchargeKgAgg = 0;

  items.forEach(item => {
     const w = item.weightKg * item.quantity;
     totalWeightKg += w;

     // ─── 1. INBOUND LEG (Brand to Factory) ───
     let inRate = 0;       // By default, inbound is $0 (USA domestic assumption)
     let inDivisor = 5000;
     let inVolSurcharge = 0;
     
     if (item.brand) {
         const cfg = brandConfigs.find(c => c.brandName.toLowerCase() === item.brand.toLowerCase());
         if (cfg) {
             inRate = cfg.ratePerKg;
             inDivisor = cfg.volumetricDivisor || 5000;
             inVolSurcharge = cfg.volSurchargePerKg;
         }
     }

     let inVw = 0;
     if (item.lengthCm > 0 && item.widthCm > 0 && item.heightCm > 0) {
        inVw = (item.lengthCm * item.widthCm * item.heightCm / inDivisor) * item.quantity;
     }
     const inSurchargeKg = Math.max(0, inVw - w);
     const inboundCostBase = w * inRate;
     const inboundCostVol = inSurchargeKg * inVolSurcharge;

     // ─── 2. OUTBOUND LEG (Factory to Client Zone) ───
     // Uses baseline zone metrics configured for this order: ratePerKg, volSurchargePerKg
     let outVw = 0;
     if (item.lengthCm > 0 && item.widthCm > 0 && item.heightCm > 0) {
        outVw = (item.lengthCm * item.widthCm * item.heightCm / 5000) * item.quantity; // Standard 5000 divisor for Air Freight out of NY
     }
     totalVolWeightKg += outVw;

     const outSurchargeKg = Math.max(0, outVw - w);
     volSurchargeKgAgg += outSurchargeKg;
     
     const outboundCostBase = w * ratePerKg;
     const outboundCostVol = outSurchargeKg * volSurchargePerKg;

     // ─── AGGREGATE ───
     autoShippingBase += inboundCostBase + outboundCostBase;
     autoShippingVol += inboundCostVol + outboundCostVol;
  });
  
  autoShippingBase = r2(autoShippingBase);
  autoShippingVol = r2(autoShippingVol);
  const volSurchargeKg = r2(volSurchargeKgAgg);
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
            entryMode: item.entryMode,
            sourceType: item.sourceType,
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

  const sections = [
    { id: 'customer', label: 'Customer', description: 'Вибір клієнта та знижки B2B/B2C.' },
    { id: 'items', label: 'Items & sourcing', description: 'Позиції замовлення та пошук у Local + Turn14.' },
    { id: 'shipping', label: 'Shipping', description: 'Розрахунок логістики по зоні та override.' },
    { id: 'summary', label: 'Totals & submit', description: 'Підсумок, нотатки та створення замовлення.' },
  ];

  return (
    <AdminEditorShell
      backHref="/admin/shop/orders"
      backLabel="Назад до замовлень"
      title="Нове замовлення"
      description="Створити B2B/B2C замовлення з підбором позицій, логістичним розрахунком і контрольованою фінальною сумою."
      sections={sections}
      summary={
        <div className="space-y-4">
          {items.some((item) => item.sourceType === 'manual' && item.title) ? (
            <AdminInlineAlert tone="warning">
              Manual items are not linked to catalog products. Keep SKU, brand, price and dimensions filled before submit.
            </AdminInlineAlert>
          ) : null}

          <AdminInspectorCard
            title="Замовлення"
            description="Операційний зріз поточного draft. Менеджер бачить клієнта, обсяг позицій і фінальний total до відправки."
          >
            <AdminKeyValueGrid
              rows={[
                {
                  label: 'Клієнт',
                  value: selectedCustomer ? `${selectedCustomer.fullName} · ${selectedCustomer.group}` : 'Не обрано',
                },
                { label: 'Позицій', value: String(items.filter((item) => item.title).length || items.length) },
                { label: 'Manual', value: String(items.filter((item) => item.sourceType === 'manual' && item.title).length) },
                { label: 'Subtotal', value: fmtUsd(subtotal) },
                { label: 'Shipping', value: fmtUsd(finalShipping) },
                { label: 'Grand total', value: fmtUsd(grandTotal) },
              ]}
            />
          </AdminInspectorCard>

          <AdminInspectorCard title="Статус submit" description="Фінальний крок створює order draft через існуючий API flow.">
            <div className="space-y-3">
              <div className="flex flex-wrap gap-2">
                {selectedCustomer ? (
                  <AdminStatusBadge tone="success">{selectedCustomer.group}</AdminStatusBadge>
                ) : (
                  <AdminStatusBadge tone="warning">Клієнта не вибрано</AdminStatusBadge>
                )}
                <AdminStatusBadge tone={shippingOverride !== '' ? 'warning' : 'default'}>
                  {shippingOverride !== '' ? 'Shipping override active' : 'Auto shipping'}
                </AdminStatusBadge>
              </div>

              {submitResult ? (
                <AdminInlineAlert tone={submitResult.success ? 'success' : 'error'}>
                  {submitResult.message}
                </AdminInlineAlert>
              ) : null}

              <button
                type="button"
                onClick={submitOrder}
                disabled={submitting}
                className="flex w-full items-center justify-center gap-2 rounded-full bg-gradient-to-b from-blue-500 to-blue-700 px-4 py-3 text-sm font-bold uppercase tracking-wider text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.18),0_2px_8px_rgba(59,130,246,0.4)] transition hover:from-blue-400 hover:to-blue-600 disabled:opacity-50"
              >
                <Save className="h-4 w-4" />
                {submitting ? 'Створення...' : 'Створити замовлення'}
              </button>
            </div>
          </AdminInspectorCard>
        </div>
      }
    >
      <AdminActionBar>
        <div className="space-y-1">
          <div className="text-[11px] font-medium uppercase tracking-[0.2em] text-zinc-500">Order workbench</div>
          <div className="text-sm text-zinc-300">
            {selectedCustomer ? `${selectedCustomer.fullName} · ${selectedCustomer.email}` : 'Оберіть клієнта для order draft'}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <AdminStatusBadge tone={items.some((item) => item.title) ? 'success' : 'warning'}>
            {items.filter((item) => item.title).length || items.length} line items
          </AdminStatusBadge>
          <AdminStatusBadge tone={shippingOverride !== '' ? 'warning' : 'default'}>
            {shippingOverride !== '' ? 'Manual shipping' : 'Auto shipping'}
          </AdminStatusBadge>
          <AdminStatusBadge tone="default">{fmtUsd(grandTotal)}</AdminStatusBadge>
        </div>
      </AdminActionBar>

      <AdminEditorSection
        id="customer"
        title="Клієнт"
        description="Вибір account owner визначає discount, region-based shipping zone і подальший контекст замовлення."
      >
              {selectedCustomer ? (
                <div className="flex items-center justify-between rounded-none border border-emerald-500/20 bg-emerald-500/5 p-4">
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
                    className="w-full rounded-none border border-white/10 bg-zinc-950 px-3 py-2 text-sm text-white placeholder:text-white/25"
                  />
                  {loadingCustomers ? (
                    <div className="mt-2 text-xs text-white/30">Завантаження...</div>
                  ) : filteredCustomers.length > 0 ? (
                    <div className="mt-2 max-h-48 space-y-1 overflow-y-auto">
                      {filteredCustomers.map(c => (
                        <button key={c.id} type="button" onClick={() => { setSelectedCustomer(c); setCustomerSearch(''); }}
                          className="w-full rounded-none border border-white/10 bg-black/30 p-3 text-left transition hover:border-white/20">
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
      </AdminEditorSection>

      <AdminEditorSection
        id="items"
        title="Позиції та sourcing"
        description="Додавайте локальні або Turn14 позиції, розраховуйте markup/discount і формуйте логістичні параметри прямо в draft."
      >
              {items.map((item, idx) => (
                <div key={item.key} className="mb-4 rounded-[6px] border border-white/10 bg-black/20 p-4">
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <span className="text-xs text-white/30 uppercase tracking-wider">#{idx + 1}</span>
                    <div className="flex items-center gap-3">
                      {items.length > 1 && (
                        <button type="button" onClick={() => removeItem(idx)} className="text-white/20 hover:text-blue-400 transition-colors"><Trash2 className="h-4 w-4" /></button>
                      )}
                    </div>
                  </div>

                  <div className="mb-4 space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="inline-flex overflow-hidden rounded-full border border-white/10 bg-white/[0.03]">
                        <button
                          type="button"
                          onClick={() => setItemMode(idx, 'search')}
                          className={`inline-flex items-center gap-2 px-3 py-2 text-xs font-medium transition ${item.entryMode === 'search' ? 'bg-zinc-100 text-black' : 'text-zinc-300 hover:bg-white/[0.06]'}`}
                        >
                          <Search className="h-3.5 w-3.5" />
                          Search catalog
                        </button>
                        <button
                          type="button"
                          onClick={() => setItemMode(idx, 'manual')}
                          className={`inline-flex items-center gap-2 px-3 py-2 text-xs font-medium transition ${item.entryMode === 'manual' ? 'bg-zinc-100 text-black' : 'text-zinc-300 hover:bg-white/[0.06]'}`}
                        >
                          <Edit3 className="h-3.5 w-3.5" />
                          Manual item
                        </button>
                      </div>

                      <SourceBadge source={item.sourceType} />
                    </div>

                    {item.entryMode === 'search' ? (
                      <div className="relative" ref={addingToItemIdx === idx ? dropdownRef : undefined}>
                        <label className="block">
                          <span className="mb-1 flex items-center gap-1 text-[10px] text-blue-400 uppercase tracking-wider">
                            <Search className="h-3 w-3" /> Local + Turn14 search
                          </span>
                          <input
                            value={addingToItemIdx === idx ? turn14Query : item.title}
                            onChange={e => {
                              const v = e.target.value;
                              if (addingToItemIdx !== idx) setAddingToItemIdx(idx);
                              setTurn14Query(v);
                              updateItem(idx, { title: v, sourceType: 'empty' });
                              clearTimeout((window as any).__t14Timer);
                              (window as any).__t14Timer = setTimeout(() => {
                                if (v.trim().length >= 2) searchTurn14(v);
                                else setTurn14Results([]);
                              }, 350);
                            }}
                            onFocus={() => {
                              if (addingToItemIdx !== idx) {
                                setAddingToItemIdx(idx);
                                setTurn14Query(item.title);
                                setTurn14Results([]);
                              }
                            }}
                            placeholder="SKU, part number, brand, product name..."
                            className="h-11 w-full rounded-[6px] border border-blue-500/25 bg-zinc-950 px-3 text-sm text-white placeholder:text-white/25 focus:border-blue-500/40 focus:outline-none"
                          />
                        </label>

                        {addingToItemIdx === idx && (turn14Results.length > 0 || turn14Loading || turn14Query.trim().length >= 2) ? (
                          <div className="absolute left-0 right-0 top-full z-20 mt-2 max-h-[420px] overflow-y-auto rounded-[6px] border border-blue-500/25 bg-zinc-950 p-2 shadow-2xl shadow-black/60">
                            {turn14Loading ? (
                              <div className="px-3 py-2 text-center text-xs text-zinc-400/70">Searching catalogs...</div>
                            ) : null}

                            {turn14Results.slice(0, 12).map((t14, i) => (
                              <SearchItemResult key={`${t14.source || 'item'}-${t14.id || i}`} item={t14} onSelect={() => addTurn14Item(t14, idx)} />
                            ))}

                            {!turn14Loading && turn14Results.length === 0 ? (
                              <div className="rounded-[6px] border border-dashed border-white/10 bg-black/30 p-3">
                                <div className="text-sm font-medium text-zinc-100">No catalog match</div>
                                <div className="mt-1 text-xs leading-5 text-zinc-500">
                                  Keep this text and create a manual line item. You can still fill SKU, brand, price and dimensions.
                                </div>
                                <button
                                  type="button"
                                  onClick={() => createManualItemFromQuery(idx)}
                                  className="mt-3 inline-flex items-center gap-2 rounded-full border border-blue-500/25 bg-blue-500/[0.08] px-3 py-2 text-xs font-medium uppercase tracking-[0.14em] text-blue-300 transition hover:bg-blue-500/[0.12]"
                                >
                                  <Edit3 className="h-3.5 w-3.5" />
                                  Create manual item
                                </button>
                              </div>
                            ) : null}
                          </div>
                        ) : null}
                      </div>
                    ) : (
                      <div className="rounded-[6px] border border-blue-500/25 bg-blue-500/[0.06] p-3">
                        <div className="mb-3 flex items-start justify-between gap-3">
                          <div>
                            <div className="text-sm font-medium text-zinc-100">Manual line item</div>
                            <div className="mt-1 text-xs text-zinc-500">Use this when the product is not in local catalog or Turn14 mirror.</div>
                          </div>
                          <AdminStatusBadge tone="warning">not linked</AdminStatusBadge>
                        </div>
                        <Field
                          label="Назва товару"
                          value={item.title}
                          onChange={v => updateItem(idx, { title: v, sourceType: 'manual' })}
                          placeholder="Наприклад: Custom carbon front lip for BMW M3 G80"
                        />
                      </div>
                    )}
                  </div>

                  {item.title && (
                    <>
                      <div className="flex gap-3">
                        {item.thumbnail && (
                          <div className="shrink-0 w-12 h-12 rounded-none border border-white/10 bg-black/40 overflow-hidden">
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

                      <div className="mt-4 flex items-center justify-between border-t border-white/5 pt-3 mb-2">
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-white/50">Логістичні габарити</span>
                          {item.title && !item.isAILoading && (
                            <button
                              type="button"
                              onClick={() => triggerAIEstimation(idx, item.title, item.brand, item.partNumber)}
                              className="text-[9px] uppercase tracking-wider text-amber-500/50 hover:text-amber-400 font-mono transition-colors flex items-center gap-1"
                              title="Вгадати габарити за допомогою ШІ"
                            >
                              <RefreshCw className="h-2.5 w-2.5" /> Авто-ШІ
                            </button>
                          )}
                        </div>
                        {item.isAILoading && (
                          <span className="flex items-center gap-1 text-[10px] text-amber-400 shadow-amber-400 drop-border border-white/5 motion-safe:animate-pulse font-mono tracking-wider">
                            <RefreshCw className="h-3 w-3 motion-safe:animate-spin"/> ШІ ФОРМУЄ ГАБАРИТИ...
                          </span>
                        )}
                      </div>

                      <div className="relative grid gap-3 md:grid-cols-4">
                        {item.isAILoading && (
                          <div className="absolute inset-0 z-10 rounded-none bg-black/40 backdrop-blur-[1px] rounded-none pointer-events-none" />
                        )}
                        <NumField label="Вага (LBS)" value={item.weightLbs} onChange={v => updateItem(idx, { weightLbs: v })} />
                        <div className={`rounded-none border px-3 py-2 transition-colors ${item.isAILoading ? 'border-amber-500/20' : 'border-white/10 bg-zinc-950'}`}>
                          <div className="text-[10px] text-white/40 uppercase tracking-wider mb-1">Вага (KG)</div>
                          <div className={`text-sm ${item.isAILoading ? 'text-amber-400' : 'text-white'}`}>{item.weightKg.toFixed(2)}</div>
                        </div>
                        <NumField label="Д × В × Г (см)" value={item.lengthCm}
                          onChange={v => updateItem(idx, { lengthCm: v })} placeholder="Довжина" />
                        <div className="grid grid-cols-2 gap-2">
                          <NumField label="Ширина" value={item.widthCm} onChange={v => updateItem(idx, { widthCm: v })} />
                          <NumField label="Глибина" value={item.heightCm} onChange={v => updateItem(idx, { heightCm: v })} />
                        </div>
                      </div>

                      <div className="mt-3 flex items-center justify-between rounded-none border border-white/10 bg-white/[0.03] px-4 py-2">
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
                className="flex w-full items-center justify-center gap-2 rounded-none border border-dashed border-white/15 py-3 text-xs uppercase tracking-wider text-white/40 hover:border-white/30 hover:text-white/60">
                <Plus className="h-4 w-4" /> Додати позицію
              </button>
      </AdminEditorSection>

      <AdminEditorSection
        id="shipping"
        title="Доставка"
        description="Outbound zone, volumetric surcharge і manual override живуть окремим операційним блоком, щоб total був прозорий до submit."
      >
              <label className="block mb-3">
                <span className="mb-1 block text-xs text-white/50">Зона доставки</span>
                <select value={zone} onChange={e => setZone(e.target.value as ShippingZone)}
                  className="w-full rounded-none border border-white/10 bg-zinc-950 px-3 py-2 text-sm text-white">
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

              <div className="space-y-1.5 rounded-none border border-white/10 bg-black/20 p-3 text-xs">
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
      </AdminEditorSection>

      <AdminEditorSection
        id="summary"
        title="Підсумок і submit"
        description="Остаточна перевірка сум, приміток і статусу перед створенням order detail record."
      >
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
                    className="w-full rounded-none border border-white/10 bg-zinc-950 px-3 py-2 text-sm text-white placeholder:text-white/25"
                    placeholder="Внутрішні нотатки..." />
                </label>
              </div>

              {submitResult && (
                <AdminInlineAlert tone={submitResult.success ? 'success' : 'error'} className="mt-3">
                  <div className="flex items-start gap-2">
                    {submitResult.success ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" /> : <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />}
                    {submitResult.message}
                  </div>
                </AdminInlineAlert>
              )}

              <button type="button" onClick={submitOrder} disabled={submitting}
                className="mt-4 flex w-full items-center justify-center gap-2 rounded-[4px] bg-gradient-to-b from-blue-500 to-blue-700 px-4 py-3 text-sm font-bold uppercase tracking-wider text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.18),0_2px_8px_rgba(59,130,246,0.4)] hover:from-blue-400 hover:to-blue-600 disabled:opacity-50">
                <Save className="h-4 w-4" />
                {submitting ? 'Створення...' : 'Створити замовлення'}
              </button>
      </AdminEditorSection>
    </AdminEditorShell>
  );
}

// ─── Sub-components ──────────────────────────────────────────

function SourceBadge({ source }: { source: OrderItem['sourceType'] }) {
  if (source === 'local') return <AdminStatusBadge tone="success">LOCAL</AdminStatusBadge>;
  if (source === 'turn14') return <AdminStatusBadge tone="default">TURN14</AdminStatusBadge>;
  if (source === 'manual') return <AdminStatusBadge tone="warning">MANUAL</AdminStatusBadge>;
  return <AdminStatusBadge tone="default">UNSELECTED</AdminStatusBadge>;
}

function SearchItemResult({ item, onSelect }: { item: any; onSelect: () => void }) {
  const attrs = item.attributes || {};
  const source = item.source === 'local' ? 'local' : 'turn14';
  const name = compactText(item.product_name || attrs.product_name || attrs.item_name, 'Unnamed item');
  const partNumber = compactText(item.internal_part_number || attrs.internal_part_number || item.part_number || attrs.part_number);
  const brand = compactText(item.brand || attrs.brand_short_description || attrs.brand);
  const price = item.dealer_price || item.jobber_price || attrs.dealer_price || 0;
  const weight = item.weight || attrs.weight;
  const image = item.primary_image || attrs.primary_image || attrs.thumbnail || '';

  return (
    <button
      type="button"
      onClick={onSelect}
      className="mb-1 grid w-full grid-cols-[52px_minmax(0,1fr)_112px] items-center gap-3 rounded-[6px] border border-white/8 bg-white/[0.03] p-2.5 text-left transition last:mb-0 hover:border-blue-500/25 hover:bg-white/[0.06]"
    >
      <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-xl border border-white/10 bg-black/40">
        {image ? (
          <img src={image} alt="" className="h-full w-full object-contain" />
        ) : (
          <PackageIconFallback label={source === 'local' ? 'L' : 'T'} />
        )}
      </div>

      <div className="min-w-0">
        <div className="flex min-w-0 items-center gap-2">
          <span className={`shrink-0 rounded-[3px] border px-2 py-0.5 font-mono text-[9px] font-bold uppercase ${source === 'local' ? 'border-green-500/30 bg-green-500/10 text-green-300' : 'border-zinc-500/30 bg-stone-500/10 text-zinc-300'}`}>
            {source === 'local' ? 'LOCAL' : 'TURN14'}
          </span>
          <span className="truncate text-sm font-medium text-zinc-100">{name}</span>
        </div>
        <div className="mt-1 grid min-w-0 grid-cols-[minmax(92px,140px)_minmax(80px,1fr)_minmax(60px,90px)] gap-2 text-[11px] text-zinc-500">
          <span className="truncate font-mono text-zinc-400">{partNumber}</span>
          <span className="truncate">{brand}</span>
          <span className="truncate text-right">{weight ? `${weight} ${source === 'local' ? 'kg' : 'lb'}` : 'no weight'}</span>
        </div>
      </div>

      <div className="text-right">
        <div className="font-mono text-sm font-medium text-emerald-300">{fmtUsd(price)}</div>
        <div className="mt-1 text-[10px] uppercase tracking-[0.14em] text-zinc-600">select</div>
      </div>
    </button>
  );
}

function PackageIconFallback({ label }: { label: string }) {
  return (
    <div className="flex h-full w-full items-center justify-center text-xs font-semibold text-zinc-600">
      {label}
    </div>
  );
}

function Field({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[10px] text-white/40 uppercase tracking-wider">{label}</span>
      <input value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
        className="h-10 w-full min-w-0 rounded-[6px] border border-white/10 bg-zinc-950 px-3 text-sm text-white placeholder:text-white/20 focus:border-white/30 focus:outline-none" />
    </label>
  );
}

function NumField({ label, value, onChange, step, placeholder }: { label: string; value: number; onChange: (v: number) => void; step?: number; placeholder?: string }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[10px] text-white/40 uppercase tracking-wider">{label}</span>
      <input type="number" step={step ?? 0.01} value={value || ''} onChange={e => onChange(Number(e.target.value) || 0)}
        placeholder={placeholder}
        className="h-10 w-full min-w-0 rounded-[6px] border border-white/10 bg-zinc-950 px-3 text-sm text-white placeholder:text-white/20 focus:border-white/30 focus:outline-none" />
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
