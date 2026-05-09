"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Save,
  RefreshCw,
  Plus,
  Trash2,
  X,
  Receipt,
  ToggleLeft,
  ToggleRight,
  Search,
  AlertCircle,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useConfirm } from "@/components/admin/AdminConfirmDialog";
import { useToast } from "@/components/admin/AdminToast";

// ─── Interfaces ───

interface TaxRule {
  id?: string;
  regionCode: string;
  regionName: string;
  regionNameUa: string;
  taxType: string;
  taxRate: number;
  taxLabel: string | null;
  taxLabelUa: string | null;
  customsDutyPct: number;
  isInclusive: boolean;
  isActive: boolean;
  notes: string | null;
  sortOrder: number;
}

const TAX_TYPES = [
  { value: "VAT", label: "ПДВ (VAT)", color: "text-zinc-400" },
  { value: "GST", label: "GST", color: "text-teal-400" },
  { value: "SALES_TAX", label: "Sales Tax", color: "text-amber-400" },
  { value: "CUSTOMS_DUTY", label: "Мито", color: "text-blue-400" },
  { value: "NONE", label: "Без податку", color: "text-white/30" },
];

// ─── Component ───

export default function TaxRegionPage() {
  const confirm = useConfirm();
  const toast = useToast();
  const [rules, setRules] = useState<TaxRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [newRule, setNewRule] = useState<TaxRule>({
    regionCode: "",
    regionName: "",
    regionNameUa: "",
    taxType: "VAT",
    taxRate: 20,
    taxLabel: null,
    taxLabelUa: null,
    customsDutyPct: 0,
    isInclusive: false,
    isActive: true,
    notes: null,
    sortOrder: 0,
  });

  const fetchRules = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/shop/logistics/taxes");
      const data = await res.json();
      setRules(data.rules || []);
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchRules();
  }, [fetchRules]);

  async function saveRule(rule: TaxRule) {
    setSavingKey(rule.regionCode);
    try {
      await fetch("/api/admin/shop/logistics/taxes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(rule),
      });
      await fetchRules();
    } catch (e) {
      console.error(e);
    }
    setSavingKey(null);
  }

  async function deleteRule(id: string) {
    const ok = await confirm({
      tone: "danger",
      title: "Видалити це податкове правило?",
      description:
        "Замовлення для відповідного регіону потребуватимуть нового податкового правила.",
      confirmLabel: "Видалити",
    });
    if (!ok) return;
    const response = await fetch(`/api/admin/shop/logistics/taxes?id=${id}`, { method: "DELETE" });
    if (!response.ok) {
      toast.error("Не вдалося видалити правило");
      return;
    }
    await fetchRules();
    toast.success("Податкове правило видалено");
  }

  async function addNewRule() {
    if (!newRule.regionCode || !newRule.regionName) return;
    await saveRule(newRule);
    setShowAdd(false);
    setNewRule({
      regionCode: "",
      regionName: "",
      regionNameUa: "",
      taxType: "VAT",
      taxRate: 20,
      taxLabel: null,
      taxLabelUa: null,
      customsDutyPct: 0,
      isInclusive: false,
      isActive: true,
      notes: null,
      sortOrder: 0,
    });
  }

  const updateField = (idx: number, field: keyof TaxRule, val: any) => {
    const arr = [...rules];
    arr[idx] = { ...arr[idx], [field]: val };
    setRules(arr);
  };

  const filtered = rules.filter(
    (r) =>
      r.regionCode.toLowerCase().includes(search.toLowerCase()) ||
      r.regionName.toLowerCase().includes(search.toLowerCase()) ||
      r.regionNameUa.toLowerCase().includes(search.toLowerCase())
  );

  const totalActive = rules.filter((r) => r.isActive).length;
  const avgRate =
    rules.length > 0 ? (rules.reduce((s, r) => s + r.taxRate, 0) / rules.length).toFixed(1) : "0";

  return (
    <div className="relative h-full w-full overflow-auto bg-black text-white">
      {/* Ambient glow */}
      <div className="pointer-events-none absolute left-1/2 top-0 -z-10 h-[500px] w-[800px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-rose-600/8 blur-[120px]" />

      <div className="w-full px-4 py-8 md:px-8 lg:px-12">
        <Link
          href="/admin/shop/logistics"
          className="group mb-8 inline-flex items-center gap-2 text-[13px] font-medium tracking-wide text-white/40 hover:text-white transition-all duration-300"
        >
          <ArrowLeft className="h-4 w-4 transform transition-transform group-hover:-translate-x-1" />{" "}
          Логістика
        </Link>

        {/* Header */}
        <div className="flex items-end justify-between mb-8 gap-4 flex-wrap">
          <div>
            <h1 className="text-3xl font-light tracking-tight text-white flex items-center gap-3">
              <Receipt className="h-8 w-8 text-rose-400 drop-shadow-[0_0_15px_rgba(244,63,94,0.5)]" />
              Регіональні Податки
            </h1>
            <p className="mt-2 text-sm text-white/40 max-w-xl">
              VAT, мито та інші податки по регіонах. Застосовуються автоматично під час checkout на
              основі адреси клієнта.
            </p>
          </div>
          <button
            onClick={() => setShowAdd(true)}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-none bg-rose-500/10 border border-rose-500/20 text-rose-400 text-[11px] uppercase tracking-wider font-medium hover:bg-rose-500/20 transition-all"
          >
            <Plus className="w-3.5 h-3.5" /> Додати Регіон
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4 mb-8">
          <div className="rounded-none border border-white/6 bg-black/60 p-5">
            <div className="text-[10px] uppercase tracking-widest text-white/25 mb-2">Регіонів</div>
            <div className="text-2xl font-light text-white">{rules.length}</div>
          </div>
          <div className="rounded-none border border-white/6 bg-black/60 p-5">
            <div className="text-[10px] uppercase tracking-widest text-white/25 mb-2">Активних</div>
            <div className="text-2xl font-light text-rose-400">{totalActive}</div>
          </div>
          <div className="rounded-none border border-white/6 bg-black/60 p-5">
            <div className="text-[10px] uppercase tracking-widest text-white/25 mb-2">
              Середня ставка
            </div>
            <div className="text-2xl font-light text-white">{avgRate}%</div>
          </div>
        </div>

        {/* Search */}
        <div className="mb-6 flex items-center gap-3 rounded-none border border-white/6 bg-black/40 px-4 py-3">
          <Search className="w-4 h-4 text-white/25" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Пошук по регіону..."
            className="flex-1 bg-transparent text-sm text-white placeholder-white/15 focus:outline-hidden"
          />
          <span className="text-[10px] text-white/15">
            {filtered.length} / {rules.length}
          </span>
        </div>

        {/* Table */}
        {loading ? (
          <div className="py-20 flex justify-center">
            <RefreshCw className="w-6 h-6 motion-safe:animate-spin text-white/20" />
          </div>
        ) : filtered.length === 0 && rules.length === 0 ? (
          <div className="text-center py-20 text-white/20 text-sm border border-dashed border-white/10 rounded-none">
            <Receipt className="w-12 h-12 mx-auto mb-4 text-white/10" />
            Ще немає податкових правил. Додайте перший регіон.
          </div>
        ) : (
          <div className="overflow-hidden rounded-none border border-white/6 bg-black/60 backdrop-blur-2xl shadow-2xl">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-white/6 bg-white/2">
                  <th className="px-5 py-4 font-medium text-[10px] tracking-[0.15em] uppercase text-white/35">
                    Регіон
                  </th>
                  <th className="px-5 py-4 font-medium text-[10px] tracking-[0.15em] uppercase text-white/35">
                    Тип
                  </th>
                  <th className="px-5 py-4 font-medium text-[10px] tracking-[0.15em] uppercase text-white/35 w-28">
                    Ставка %
                  </th>
                  <th className="px-5 py-4 font-medium text-[10px] tracking-[0.15em] uppercase text-white/35 w-28">
                    Мито %
                  </th>
                  <th className="px-5 py-4 font-medium text-[10px] tracking-[0.15em] uppercase text-white/35">
                    Мітка
                  </th>
                  <th className="px-5 py-4 font-medium text-[10px] tracking-[0.15em] uppercase text-white/35 text-center">
                    Inclusive
                  </th>
                  <th className="px-5 py-4 font-medium text-[10px] tracking-[0.15em] uppercase text-white/35 text-center">
                    Активно
                  </th>
                  <th className="px-5 py-4 font-medium text-[10px] tracking-[0.15em] uppercase text-white/35">
                    Нотатки
                  </th>
                  <th className="px-5 py-4 font-medium text-[10px] tracking-[0.15em] uppercase text-white/35 w-32">
                    Дії
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/4">
                {filtered.map((r, i) => {
                  const realIdx = rules.findIndex((x) => x.regionCode === r.regionCode);
                  const typeInfo = TAX_TYPES.find((t) => t.value === r.taxType) || TAX_TYPES[0];

                  return (
                    <tr key={r.id || r.regionCode} className="hover:bg-white/2 transition-colors">
                      <td className="px-5 py-4">
                        <div className="font-medium text-white/90">
                          {r.regionNameUa || r.regionName}
                        </div>
                        <div className="text-[10px] text-white/25 font-mono mt-0.5">
                          {r.regionCode}
                        </div>
                      </td>
                      <td className="px-5 py-3">
                        <select
                          value={r.taxType}
                          onChange={(e) => updateField(realIdx, "taxType", e.target.value)}
                          className="bg-black/40 border border-white/10 rounded-none px-2 py-1.5 outline-hidden focus:border-rose-500/40 text-xs text-white/70"
                        >
                          {TAX_TYPES.map((t) => (
                            <option
                              key={t.value}
                              value={t.value}
                              className="bg-zinc-900 text-white"
                            >
                              {t.label}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-1">
                          <input
                            type="number"
                            step="0.1"
                            min="0"
                            max="100"
                            value={r.taxRate}
                            onChange={(e) =>
                              updateField(realIdx, "taxRate", parseFloat(e.target.value) || 0)
                            }
                            className="w-16 bg-black/40 border border-white/10 rounded-none px-2 py-1.5 outline-hidden text-right text-white/70 focus:border-rose-500/40"
                          />
                          <span className="text-white/20 text-xs">%</span>
                        </div>
                      </td>
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-1">
                          <input
                            type="number"
                            step="0.1"
                            min="0"
                            max="100"
                            value={r.customsDutyPct}
                            onChange={(e) =>
                              updateField(
                                realIdx,
                                "customsDutyPct",
                                parseFloat(e.target.value) || 0
                              )
                            }
                            className="w-16 bg-black/40 border border-white/10 rounded-none px-2 py-1.5 outline-hidden text-right text-white/70 focus:border-rose-500/40"
                          />
                          <span className="text-white/20 text-xs">%</span>
                        </div>
                      </td>
                      <td className="px-5 py-3">
                        <input
                          value={r.taxLabelUa || r.taxLabel || ""}
                          placeholder="ПДВ 20%"
                          onChange={(e) =>
                            updateField(realIdx, "taxLabelUa", e.target.value || null)
                          }
                          className="w-full bg-transparent border-b border-white/5 text-sm text-white/60 placeholder-white/15 px-0 py-1 focus:outline-hidden focus:border-white/20"
                        />
                      </td>
                      <td className="px-5 py-3 text-center">
                        <button
                          onClick={() => updateField(realIdx, "isInclusive", !r.isInclusive)}
                          className="text-white/40 hover:text-white/80 transition-colors"
                        >
                          {r.isInclusive ? (
                            <ToggleRight className="w-6 h-6 text-rose-400" />
                          ) : (
                            <ToggleLeft className="w-6 h-6" />
                          )}
                        </button>
                      </td>
                      <td className="px-5 py-3 text-center">
                        <input
                          type="checkbox"
                          checked={r.isActive}
                          onChange={(e) => updateField(realIdx, "isActive", e.target.checked)}
                          className="w-4 h-4 cursor-pointer accent-rose-500"
                        />
                      </td>
                      <td className="px-5 py-3">
                        <input
                          value={r.notes || ""}
                          placeholder="B2B exempt..."
                          onChange={(e) => updateField(realIdx, "notes", e.target.value || null)}
                          className="w-full bg-transparent border-b border-white/5 text-xs text-white/40 placeholder-white/10 px-0 py-1 focus:outline-hidden focus:border-white/20"
                        />
                      </td>
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={() => saveRule(r)}
                            disabled={savingKey === r.regionCode}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-rose-500/15 hover:bg-rose-500/30 text-rose-300 rounded-none text-[10px] uppercase tracking-wider font-semibold transition disabled:opacity-50"
                          >
                            {savingKey === r.regionCode ? (
                              <RefreshCw className="w-3 h-3 motion-safe:animate-spin" />
                            ) : (
                              <Save className="w-3 h-3" />
                            )}
                            Save
                          </button>
                          {r.id && (
                            <button
                              onClick={() => deleteRule(r.id!)}
                              className="p-1.5 rounded-none hover:bg-blue-950/40/10 text-white/15 hover:text-blue-400 transition-colors"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Info banner */}
        <div className="p-4 bg-rose-500/4 border border-rose-500/10 rounded-none flex gap-3 text-sm text-rose-200/80 mt-6">
          <AlertCircle className="shrink-0 w-5 h-5 text-rose-400/60" />
          <div>
            <p className="font-semibold mb-1 text-rose-200/90">Як працюють податки?</p>
            <p className="text-rose-200/50 text-xs leading-relaxed">
              <strong>Inclusive</strong> — податок вже включений у ціну (стиль EU: &quot;ціна вже з
              ПДВ&quot;).
              <br />
              <strong>Exclusive</strong> — податок додається зверху при checkout (стиль US: &quot;+
              Sales Tax&quot;).
              <br />
              <strong>Мито</strong> — окремий імпортний збір, завжди додається зверху.
              <br />
              При B2B з валідним VAT ID податок може бути exempted (нотатки для менеджера).
            </p>
          </div>
        </div>
      </div>

      {/* ─── Add Region Modal ─── */}
      <AnimatePresence>
        {showAdd && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 backdrop-blur-xs z-50 flex items-center justify-center p-4"
            onClick={() => setShowAdd(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-[#0A0A0A] border border-white/8 w-full max-w-lg p-6 rounded-none shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-sm font-medium text-white flex items-center gap-2">
                  <Receipt className="w-4 h-4 text-rose-400" /> Додати Податковий Регіон
                </h3>
                <button
                  onClick={() => setShowAdd(false)}
                  className="p-1 rounded-none hover:bg-white/5 text-white/30"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[9px] uppercase tracking-widest text-white/30 mb-1.5">
                      Код Регіону *
                    </label>
                    <input
                      value={newRule.regionCode}
                      onChange={(e) =>
                        setNewRule((p) => ({ ...p, regionCode: e.target.value.toUpperCase() }))
                      }
                      placeholder="UA"
                      className="w-full bg-white/3 border border-white/10 text-sm text-white px-3 py-2.5 rounded-none focus:outline-hidden focus:border-rose-500/40 placeholder-white/15 font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-[9px] uppercase tracking-widest text-white/30 mb-1.5">
                      Тип Податку
                    </label>
                    <select
                      value={newRule.taxType}
                      onChange={(e) => setNewRule((p) => ({ ...p, taxType: e.target.value }))}
                      className="w-full bg-white/3 border border-white/10 text-sm text-white px-3 py-2.5 rounded-none focus:outline-hidden focus:border-rose-500/40"
                    >
                      {TAX_TYPES.map((t) => (
                        <option key={t.value} value={t.value} className="bg-zinc-900 text-white">
                          {t.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-[9px] uppercase tracking-widest text-white/30 mb-1.5">
                    Назва (EN) *
                  </label>
                  <input
                    value={newRule.regionName}
                    onChange={(e) => setNewRule((p) => ({ ...p, regionName: e.target.value }))}
                    placeholder="Ukraine"
                    className="w-full bg-white/3 border border-white/10 text-sm text-white px-3 py-2.5 rounded-none focus:outline-hidden focus:border-rose-500/40 placeholder-white/15"
                  />
                </div>

                <div>
                  <label className="block text-[9px] uppercase tracking-widest text-white/30 mb-1.5">
                    Назва (UA)
                  </label>
                  <input
                    value={newRule.regionNameUa}
                    onChange={(e) => setNewRule((p) => ({ ...p, regionNameUa: e.target.value }))}
                    placeholder="Україна"
                    className="w-full bg-white/3 border border-white/10 text-sm text-white px-3 py-2.5 rounded-none focus:outline-hidden focus:border-rose-500/40 placeholder-white/15"
                  />
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="block text-[9px] uppercase tracking-widest text-white/30 mb-1.5">
                      Ставка %
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      min="0"
                      max="100"
                      value={newRule.taxRate}
                      onChange={(e) =>
                        setNewRule((p) => ({ ...p, taxRate: Number(e.target.value) }))
                      }
                      className="w-full bg-white/3 border border-white/10 text-sm text-white px-3 py-2.5 rounded-none focus:outline-hidden focus:border-rose-500/40"
                    />
                  </div>
                  <div>
                    <label className="block text-[9px] uppercase tracking-widest text-white/30 mb-1.5">
                      Мито %
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      min="0"
                      max="100"
                      value={newRule.customsDutyPct}
                      onChange={(e) =>
                        setNewRule((p) => ({ ...p, customsDutyPct: Number(e.target.value) }))
                      }
                      className="w-full bg-white/3 border border-white/10 text-sm text-white px-3 py-2.5 rounded-none focus:outline-hidden focus:border-rose-500/40"
                    />
                  </div>
                  <div>
                    <label className="block text-[9px] uppercase tracking-widest text-white/30 mb-1.5">
                      Мітка
                    </label>
                    <input
                      value={newRule.taxLabelUa || ""}
                      onChange={(e) =>
                        setNewRule((p) => ({ ...p, taxLabelUa: e.target.value || null }))
                      }
                      placeholder="ПДВ 20%"
                      className="w-full bg-white/3 border border-white/10 text-sm text-white px-3 py-2.5 rounded-none focus:outline-hidden focus:border-rose-500/40 placeholder-white/15"
                    />
                  </div>
                </div>

                <div className="flex items-center gap-4 pt-1">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={newRule.isInclusive}
                      onChange={(e) => setNewRule((p) => ({ ...p, isInclusive: e.target.checked }))}
                      className="w-4 h-4 accent-rose-500"
                    />
                    <span className="text-xs text-white/50">Inclusive (вже в ціні)</span>
                  </label>
                </div>
              </div>

              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => setShowAdd(false)}
                  className="flex-1 text-center py-2.5 text-xs uppercase tracking-widest text-white/40 border border-white/10 rounded-none hover:bg-white/5 transition-colors"
                >
                  Скасувати
                </button>
                <button
                  onClick={addNewRule}
                  disabled={!newRule.regionCode || !newRule.regionName}
                  className="flex-1 text-center py-2.5 text-xs uppercase tracking-widest font-bold bg-rose-500 text-white rounded-none hover:bg-rose-400 disabled:opacity-30 transition-all"
                >
                  Створити
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
