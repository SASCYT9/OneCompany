'use client';

import { useState, useCallback } from 'react';
import { Upload, RefreshCcw, Trash2, FileSpreadsheet, CheckCircle2, AlertTriangle, Eye, EyeOff } from 'lucide-react';
import Link from 'next/link';
import { useConfirm } from '@/components/admin/AdminConfirmDialog';
import { useToast } from '@/components/admin/AdminToast';

type DistributorStat = { name: string; count: number };

/**
 * Shopify CSV columns we care about:
 * Handle, Title, Body (HTML), Vendor, Type, Tags, Published,
 * Variant SKU, Variant Price, Variant Compare At Price,
 * Image Src, Image Position, Status
 * 
 * Multi-variant products: same Handle appears on multiple rows.
 * We group by Handle and take the first image / first variant price.
 */

function parseShopifyCSV(text: string): Record<string, string>[] {
  const lines = text.split('\n');
  if (lines.length < 2) return [];
  
  // Parse header
  const headerLine = lines[0];
  const headers: string[] = [];
  let current = '';
  let inQuotes = false;
  
  for (const char of headerLine) {
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      headers.push(current.trim().replace(/\r$/, ''));
      current = '';
    } else {
      current += char;
    }
  }
  headers.push(current.trim().replace(/\r$/, ''));

  // Parse rows
  const rows: Record<string, string>[] = [];
  
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    
    const values: string[] = [];
    let val = '';
    let inQ = false;
    
    for (let j = 0; j < line.length; j++) {
      const ch = line[j];
      if (ch === '"') {
        if (inQ && j + 1 < line.length && line[j + 1] === '"') {
          val += '"';
          j++;
        } else {
          inQ = !inQ;
        }
      } else if (ch === ',' && !inQ) {
        values.push(val.trim());
        val = '';
      } else {
        val += ch;
      }
    }
    values.push(val.trim().replace(/\r$/, ''));
    
    const row: Record<string, string> = {};
    headers.forEach((h, idx) => { row[h] = values[idx] || ''; });
    rows.push(row);
  }
  
  return rows;
}

function groupShopifyProducts(rows: Record<string, string>[]) {
  // Group by Handle — multi-row Shopify format (variants as separate rows)
  const map = new Map<string, any>();
  
  for (const row of rows) {
    const handle = row['Handle'] || '';
    if (!handle) continue;
    
    if (!map.has(handle)) {
      map.set(handle, {
        partNumber: row['Variant SKU'] || handle,
        name: row['Title'] || handle,
        brand: row['Vendor'] || '',
        category: row['Type'] || row['Product Type'] || '',
        description: (row['Body (HTML)'] || '')
          .replace(/<[^>]*>/g, ' ')
          .replace(/\s+/g, ' ')
          .trim()
          .slice(0, 500),
        price: parseFloat(row['Variant Price'] || '0') || null,
        retailPrice: parseFloat(row['Variant Compare At Price'] || row['Variant Price'] || '0') || null,
        inStock: (row['Status'] || 'active').toLowerCase() === 'active',
        thumbnail: row['Image Src'] || '',
        tags: row['Tags'] || '',
      });
    } else {
      // Additional variant row — update image if this row has one and the first didn't
      const existing = map.get(handle)!;
      if (!existing.thumbnail && row['Image Src']) {
        existing.thumbnail = row['Image Src'];
      }
      if (!existing.partNumber && row['Variant SKU']) {
        existing.partNumber = row['Variant SKU'];
      }
    }
  }
  
  return Array.from(map.values());
}

export default function AdminStockPage() {
  const confirm = useConfirm();
  const toast = useToast();
  const [stats, setStats] = useState<{ total: number; distributors: DistributorStat[] } | null>(null);
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<any>(null);
  const [distributor, setDistributor] = useState('IND');
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [error, setError] = useState('');
  const [preview, setPreview] = useState<any[] | null>(null);
  const [showPreview, setShowPreview] = useState(false);

  const loadStats = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/stock/import');
      const data = await res.json();
      setStats(data);
    } catch {
      setError('Failed to load stats');
    } finally {
      setLoading(false);
    }
  }, []);

  // Load stats on mount
  useState(() => { loadStats(); });

  const handleFileSelect = async (file: File | null) => {
    setCsvFile(file);
    setPreview(null);
    setShowPreview(false);
    
    if (file) {
      try {
        const text = await file.text();
        const rows = parseShopifyCSV(text);
        const products = groupShopifyProducts(rows);
        setPreview(products.slice(0, 5));
      } catch {
        setPreview(null);
      }
    }
  };

  const handleImport = async () => {
    if (!csvFile) return;
    
    setImporting(true);
    setImportResult(null);
    setError('');
    
    try {
      const text = await csvFile.text();
      const rows = parseShopifyCSV(text);
      const products = groupShopifyProducts(rows);

      if (products.length === 0) {
        setError('CSV не містить валідних товарів. Перевірте формат (Shopify CSV).');
        setImporting(false);
        return;
      }

      const res = await fetch('/api/admin/stock/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ distributor, data: products }),
      });
      
      const result = await res.json();
      if (!res.ok) throw new Error(result.error);
      
      setImportResult(result);
      setCsvFile(null);
      setPreview(null);
      loadStats();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setImporting(false);
    }
  };

  const handleDelete = async (dist: string) => {
    const ok = await confirm({
      tone: 'danger',
      title: `Видалити всі товари від ${dist}?`,
      description: 'Усі імпортовані товари цього дистриб\'ютора будуть видалені з каталогу. Дію не можна скасувати.',
      confirmLabel: 'Видалити все',
      typedConfirmation: dist,
    });
    if (!ok) return;
    
    try {
      const res = await fetch('/api/admin/stock/import', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ distributor: dist }),
      });
      if (res.ok) loadStats();
    } catch {}
  };

  return (
    <div className="w-full h-full overflow-auto text-white">
      <div className="w-full px-4 py-8 md:px-8 lg:px-12 max-w-[1920px]">
        <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="text-2xl font-semibold text-white">Управління каталогом Stock</h2>
            <p className="mt-2 text-sm text-white/45">
              Імпорт Shopify CSV від дистриб&apos;юторів (IND та інших). Дані з&apos;являються на сторінці Stock.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={loadStats}
              className="inline-flex items-center gap-2 rounded-none border border-white/[0.08] bg-transparent hover:bg-white/5 transition-all px-4 py-2 text-sm font-medium text-white/80"
            >
              <RefreshCcw className="h-4 w-4 text-white/50" />
              Оновити
            </button>
            <Link href="/admin/shop/orders" className="text-sm text-white/40 hover:text-white transition-colors">
              ← Замовлення
            </Link>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="mb-8 grid gap-4 md:grid-cols-4">
          <div className="rounded-none border border-white/[0.08] bg-black/40 p-5 backdrop-blur-sm">
            <p className="text-[10px] tracking-[0.15em] uppercase text-white/40 font-medium">Усього товарів</p>
            <p className="mt-2 text-2xl font-light text-white">{loading ? '...' : stats?.total || 0}</p>
          </div>
          {stats?.distributors?.map(d => (
            <div key={d.name} className="rounded-none border border-white/[0.08] bg-black/40 p-5 backdrop-blur-sm">
              <div className="flex items-center justify-between">
                <p className="text-[10px] tracking-[0.15em] uppercase text-white/40 font-medium">{d.name}</p>
                <button onClick={() => handleDelete(d.name)} className="text-white/20 hover:text-blue-400 transition-colors">
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
              <p className="mt-2 text-2xl font-light text-white">{d.count}</p>
            </div>
          ))}
        </div>

        {/* Import Section */}
        <div className="rounded-none border border-white/[0.08] bg-black/40 p-6 backdrop-blur-sm">
          <h3 className="text-lg font-medium text-white mb-4 flex items-center gap-2">
            <Upload className="h-5 w-5 text-white/40" />
            Імпорт Shopify CSV
          </h3>
          
          <div className="grid gap-4 md:grid-cols-[200px_1fr_auto]">
            <div>
              <label className="block text-[10px] uppercase tracking-widest text-white/40 mb-2">Дистриб&apos;ютор</label>
              <select
                value={distributor}
                onChange={e => setDistributor(e.target.value)}
                className="w-full bg-white/[0.03] border border-white/10 text-sm text-white px-3 py-2.5 rounded-none focus:outline-none focus:border-white/30"
              >
                <option value="IND" className="bg-[#121216]">IND</option>
                <option value="OTHER" className="bg-[#121216]">Інший</option>
              </select>
            </div>
            
            <div>
              <label className="block text-[10px] uppercase tracking-widest text-white/40 mb-2">CSV файл</label>
              <label className="flex items-center gap-3 cursor-pointer bg-white/[0.03] border border-white/10 border-dashed rounded-none px-4 py-2.5 hover:bg-white/[0.05] transition-colors">
                <FileSpreadsheet className="h-4 w-4 text-white/40 shrink-0" />
                <span className="text-sm text-white/60 truncate">
                  {csvFile ? csvFile.name : 'Оберіть Shopify .csv файл'}
                </span>
                <input
                  type="file"
                  accept=".csv,.txt"
                  className="hidden"
                  onChange={e => handleFileSelect(e.target.files?.[0] || null)}
                />
              </label>
            </div>
            
            <div className="flex items-end gap-2">
              {preview && preview.length > 0 && (
                <button
                  onClick={() => setShowPreview(!showPreview)}
                  className="inline-flex items-center gap-1.5 rounded-none border border-white/10 px-3 py-2.5 text-xs text-white/50 hover:bg-white/5 transition-all"
                  title="Попередній перегляд"
                >
                  {showPreview ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              )}
              <button
                onClick={handleImport}
                disabled={!csvFile || importing}
                className="inline-flex items-center gap-2 rounded-none bg-white px-5 py-2.5 text-sm font-semibold text-black hover:bg-zinc-700/50 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {importing ? (
                  <><RefreshCcw className="h-4 w-4 motion-safe:animate-spin" /> Імпорт...</>
                ) : (
                  <><Upload className="h-4 w-4" /> Імпортувати</>
                )}
              </button>
            </div>
          </div>

          {/* Shopify CSV format hint */}
          <div className="mt-4 rounded-none bg-blue-500/15 text-zinc-100/5 border border-blue-500/10 p-3">
            <p className="text-[10px] uppercase tracking-widest text-zinc-500/70 mb-1.5 font-medium">Shopify CSV формат</p>
            <p className="text-xs text-white/40 leading-relaxed">
              Стандартний експорт із Shopify Admin → Products → Export.
              Колонки: <code className="text-white/60">Handle</code>, <code className="text-white/60">Title</code>, <code className="text-white/60">Vendor</code>, <code className="text-white/60">Type</code>, <code className="text-white/60">Variant SKU</code>, <code className="text-white/60">Variant Price</code>, <code className="text-white/60">Image Src</code>.
              Мульти-варіантні товари автоматично групуються по Handle.
            </p>
          </div>

          {/* Preview */}
          {showPreview && preview && preview.length > 0 && (
            <div className="mt-4 rounded-none border border-white/10 overflow-hidden">
              <div className="bg-white/[0.03] px-4 py-2 text-[10px] uppercase tracking-widest text-white/40 font-medium border-b border-white/10">
                Попередній перегляд ({preview.length} з {csvFile ? '...' : 0})
              </div>
              <div className="divide-y divide-white/5">
                {preview.map((p, i) => (
                  <div key={i} className="px-4 py-3 flex items-center gap-4 text-xs">
                    {p.thumbnail ? (
                      <img src={p.thumbnail} alt="" className="w-10 h-10 object-contain rounded-none bg-white/5 shrink-0" />
                    ) : (
                      <div className="w-10 h-10 bg-white/5 rounded-none shrink-0" />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-white truncate">{p.name}</p>
                      <p className="text-white/30 truncate">{p.brand} · {p.partNumber}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-white/60">{p.price ? `$${p.price}` : '—'}</p>
                      <p className="text-white/30 text-[10px]">{p.category}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Results */}
        {error && (
          <div className="mt-4 rounded-none bg-red-900/20 border border-blue-500/20 p-4 flex items-center gap-3">
            <AlertTriangle className="h-5 w-5 text-blue-400 shrink-0" />
            <p className="text-sm text-blue-300">{error}</p>
          </div>
        )}
        
        {importResult && (
          <div className="mt-4 rounded-none bg-emerald-900/20 border border-emerald-500/20 p-4 flex items-center gap-3">
            <CheckCircle2 className="h-5 w-5 text-emerald-400 shrink-0" />
            <div className="text-sm text-emerald-300">
              <span className="font-medium">{importResult.distributor}</span>: 
              {' '}{importResult.imported} нових, {importResult.updated} оновлено
              {importResult.errors > 0 && <span className="text-blue-300">, {importResult.errors} помилок</span>}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
