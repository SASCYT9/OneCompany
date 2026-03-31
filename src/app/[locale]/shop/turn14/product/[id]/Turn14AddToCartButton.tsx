'use client';

import { useState } from 'react';
import { ShoppingBag, Loader2, Check } from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function Turn14AddToCartButton({
  productId,
  sku,
  locale
}: {
  productId: string;
  sku: string;
  locale: string;
}) {
  const [loading, setLoading] = useState(false);
  const [added, setAdded] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();

  const handleAdd = async () => {
    setLoading(true);
    setError('');
    try {
      // Send the item to cart - cart API must intercept 'turn14-ID'
      const res = await fetch('/api/shop/cart/items', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug: `turn14-${productId}` }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setError(data.error || 'Failed to add to cart');
      } else {
        setAdded(true);
        // Dispatch custom event to update top header cart bubble
        window.dispatchEvent(new Event('shop-cart-updated'));
        setTimeout(() => setAdded(false), 3000);
      }
    } catch (err: any) {
      setError(err.message || 'Error adding to cart');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col gap-2 w-full max-w-sm">
      <button
        type="button"
        disabled={loading || added}
        onClick={handleAdd}
        className="relative flex w-full items-center justify-center gap-3 overflow-hidden rounded-full bg-white px-8 py-4 text-center font-medium tracking-wide text-black transition-all hover:bg-white/90 focus:outline-none focus:ring-2 focus:ring-white/50 focus:ring-offset-2 focus:ring-offset-black disabled:opacity-70 disabled:hover:bg-white"
      >
        <div className={`flex items-center gap-2 transition-transform duration-300 ${loading ? '-translate-y-12 opacity-0' : added ? 'translate-y-12 opacity-0' : 'translate-y-0 opacity-100'}`}>
          <ShoppingBag className="h-5 w-5" />
          {locale === 'ua' ? 'Додати у кошик' : 'Add to Cart'}
        </div>

        <div className={`absolute inset-0 flex items-center justify-center transition-all duration-300 ${loading ? 'translate-y-0 opacity-100' : 'translate-y-12 opacity-0'}`}>
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>

        <div className={`absolute inset-0 flex items-center justify-center gap-2 bg-emerald-500 text-white transition-all duration-300 ${added ? 'translate-y-0 opacity-100' : '-translate-y-12 opacity-0'}`}>
          <Check className="h-5 w-5" />
          {locale === 'ua' ? 'Додано' : 'Added'}
        </div>
      </button>

      {error && <span className="text-xs text-red-400 mt-2 px-2">{error}</span>}
    </div>
  );
}
