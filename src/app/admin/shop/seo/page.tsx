'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Sparkles, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';

type MissingProduct = {
  id: string;
  slug: string;
  titleEn: string;
  titleUa: string;
  brand: string | null;
  scope: string;
};

export default function SEOAutoGeneratorPage() {
  const [products, setProducts] = useState<MissingProduct[]>([]);
  const [totalMissing, setTotalMissing] = useState(0);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [resultsTracker, setResultsTracker] = useState<Record<string, { status: 'loading' | 'success' | 'error', error?: string }>>({});
  const [error, setError] = useState('');
  
  useEffect(() => {
    loadMissing();
  }, []);

  async function loadMissing() {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/shop/seo-missing');
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setProducts(data.products || []);
      setTotalMissing(data.totalMissing || 0);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  async function generateSEO(productIds: string[]) {
    setProcessing(true);
    
    // Mark as loading
    const trackerUpdate: typeof resultsTracker = { ...resultsTracker };
    for (const id of productIds) {
      trackerUpdate[id] = { status: 'loading' };
    }
    setResultsTracker(trackerUpdate);

    try {
      const payload = { productIds };
      const res = await fetch('/api/admin/shop/seo-generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error);
      }

      setProducts(prev => prev.filter(p => !productIds.includes(p.id)));
      setTotalMissing(prev => Math.max(0, prev - productIds.length));

      // Mark success
      setResultsTracker(prev => {
        const next = { ...prev };
        for (const resItem of data.results) {
           next[resItem.id] = resItem.success ? { status: 'success' } : { status: 'error', error: resItem.error };
        }
        return next;
      });

    } catch (e: any) {
      alert(`Помилка генерації: ${e.message}`);
    } finally {
      setProcessing(false);
    }
  }

  return (
    <div className="h-full overflow-auto">
      <div className="mx-auto max-w-5xl px-4 py-8">
        <Link href="/admin/shop" className="mb-6 inline-flex items-center gap-2 text-sm text-white/50 hover:text-white">
          <ArrowLeft className="h-4 w-4" /> Назад до Каталогу
        </Link>
        
        <div className="mb-8 p-6 rounded-none border border-teal-500/30 bg-teal-500/10 backdrop-blur-md">
          <div className="flex items-center gap-3">
            <Sparkles className="h-8 w-8 text-teal-400" />
            <h1 className="text-2xl font-bold text-white">AI SEO Content Generator</h1>
          </div>
          <p className="mt-2 text-teal-100/70 text-sm">
            Цей модуль автоматично знаходить товари без пошукових мета-тегів та генерує ідеальні SEO-заголовки і описи на основі технічних даних товару використовуючи систему <b>Google Gemini AI</b>.
          </p>
        </div>

        {error && <div className="mb-4 rounded-none bg-red-950/30 border border-red-900/50 text-red-500/20 p-4 text-red-200">{error}</div>}

        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-medium text-white">Товари без SEO ({totalMissing})</h2>
          
          <button
             onClick={() => generateSEO(products.map(p => p.id))}
             disabled={processing || products.length === 0}
             className="inline-flex items-center gap-2 rounded-none bg-teal-500 hover:bg-teal-400 px-5 py-2.5 text-sm font-semibold text-black transition-all disabled:opacity-50"
          >
             {processing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
             Згенерувати SEO ({products.length})
          </button>
        </div>

        {loading ? (
          <div className="py-20 text-center text-white/50"><Loader2 className="h-6 w-6 animate-spin mx-auto mb-2" /> Сканування бази...</div>
        ) : products.length === 0 ? (
          <div className="rounded-none border border-white/5 bg-white/5 py-12 text-center text-white/40">
            Усі товари мають SEO мітки! Ви чудові.
            {Object.values(resultsTracker).some(t => t.status === 'success') && (
               <div className="mt-4 text-teal-400 flex items-center justify-center gap-2">
                 <CheckCircle2 className="h-4 w-4" /> SEO успішно оновлено!
               </div>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {products.map(product => {
              const tracker = resultsTracker[product.id];
              return (
                <div key={product.id} className="flex items-center justify-between rounded-none border border-white/10 bg-zinc-900/50 p-4">
                  <div>
                    <div className="text-sm font-medium text-white">{product.titleEn || product.titleUa}</div>
                    <div className="text-xs text-white/50">{product.brand} • {product.slug}</div>
                  </div>
                  <div>
                    {tracker?.status === 'loading' && <Loader2 className="h-4 w-4 text-teal-400 animate-spin" />}
                    {tracker?.status === 'success' && <CheckCircle2 className="h-5 w-5 text-teal-400" />}
                    {tracker?.status === 'error' && <span title={tracker.error}><AlertCircle className="h-5 w-5 text-red-400" /></span>}
                    {!tracker && (
                       <button
                         onClick={() => generateSEO([product.id])}
                         disabled={processing}
                         className="rounded-none border border-white/20 bg-white/5 px-3 py-1.5 text-xs text-white hover:bg-white/10 transition-colors disabled:opacity-50"
                       >
                         Генерувати
                       </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
