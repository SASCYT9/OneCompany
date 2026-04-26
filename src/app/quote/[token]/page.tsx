'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Check, FileText, Loader2, X } from 'lucide-react';

type QuoteData = {
  orderNumber: string;
  customerName: string;
  email: string;
  currency: string;
  subtotal: number;
  shippingCost: number;
  taxAmount: number;
  total: number;
  validUntil: string | null;
  sentAt: string | null;
  acceptedAt: string | null;
  declinedAt: string | null;
  expired: boolean;
  items: Array<{ title: string; productSlug: string; quantity: number; price: number; total: number }>;
};

function formatMoney(value: number, currency: string) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency, maximumFractionDigits: 2 }).format(value);
}

export default function CustomerQuotePage() {
  const params = useParams<{ token: string }>();
  const router = useRouter();
  const token = params?.token;

  const [quote, setQuote] = useState<QuoteData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [acting, setActing] = useState(false);
  const [action, setAction] = useState<'accept' | 'decline' | null>(null);
  const [actionResult, setActionResult] = useState<'accepted' | 'declined' | null>(null);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError('');
      try {
        const response = await fetch(`/api/shop/quote/${token}`, { cache: 'no-store' });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.error || 'Could not load quote');
        if (cancelled) return;
        setQuote(data);
        if (data.acceptedAt) setActionResult('accepted');
        if (data.declinedAt) setActionResult('declined');
      } catch (e) {
        if (!cancelled) setError((e as Error).message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [token]);

  async function performAction(act: 'accept' | 'decline') {
    if (!token || !quote) return;
    setActing(true);
    setAction(act);
    try {
      const response = await fetch(`/api/shop/quote/${token}?action=${act}`, { method: 'POST' });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(data.error || 'Failed');
        return;
      }
      setActionResult(act === 'accept' ? 'accepted' : 'declined');
    } finally {
      setActing(false);
      setAction(null);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-950">
        <div className="flex items-center gap-2 text-zinc-400">
          <Loader2 className="h-4 w-4 motion-safe:animate-spin" />
          Loading quote…
        </div>
      </div>
    );
  }

  if (error || !quote) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-950 px-4">
        <div className="max-w-md rounded-xl border border-red-500/20 bg-red-500/[0.05] p-6 text-center">
          <X className="mx-auto h-8 w-8 text-red-400" />
          <h1 className="mt-3 text-lg font-bold text-zinc-100">Quote unavailable</h1>
          <p className="mt-2 text-sm text-zinc-400">{error || 'This quote link is invalid or has been removed.'}</p>
        </div>
      </div>
    );
  }

  if (actionResult === 'accepted') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-950 px-4">
        <div className="max-w-md rounded-xl border border-emerald-500/30 bg-emerald-500/[0.06] p-6 text-center">
          <Check className="mx-auto h-12 w-12 text-emerald-400" />
          <h1 className="mt-3 text-lg font-bold text-zinc-100">Quote accepted</h1>
          <p className="mt-2 text-sm text-zinc-400">
            Thank you! Your order <span className="font-mono text-emerald-300">{quote.orderNumber}</span> is now active.
            We&apos;ll be in touch with payment instructions shortly.
          </p>
        </div>
      </div>
    );
  }

  if (actionResult === 'declined') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-950 px-4">
        <div className="max-w-md rounded-xl border border-red-500/20 bg-red-500/[0.05] p-6 text-center">
          <X className="mx-auto h-8 w-8 text-red-400" />
          <h1 className="mt-3 text-lg font-bold text-zinc-100">Quote declined</h1>
          <p className="mt-2 text-sm text-zinc-400">
            We&apos;ve noted that you don&apos;t want to proceed with this quote. If you change your mind, contact us.
          </p>
        </div>
      </div>
    );
  }

  if (quote.expired) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-950 px-4">
        <div className="max-w-md rounded-xl border border-amber-500/25 bg-amber-500/[0.05] p-6 text-center">
          <FileText className="mx-auto h-8 w-8 text-amber-300" />
          <h1 className="mt-3 text-lg font-bold text-zinc-100">Quote expired</h1>
          <p className="mt-2 text-sm text-zinc-400">
            This quote was valid until {quote.validUntil ? new Date(quote.validUntil).toLocaleDateString() : '—'}. Contact us to request a new one.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 py-12 text-zinc-100">
      <div className="mx-auto max-w-3xl px-4">
        <div className="mb-8 flex items-center gap-3">
          <FileText className="h-8 w-8 text-blue-400" />
          <div>
            <h1 className="text-2xl font-bold">Quote {quote.orderNumber}</h1>
            <p className="text-sm text-zinc-500">For {quote.customerName} · {quote.email}</p>
          </div>
        </div>

        <div className="rounded-2xl border border-white/[0.08] bg-[#171717] p-6 shadow-2xl">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-500">Items</h2>

          <div className="mt-3 divide-y divide-white/[0.05]">
            {quote.items.map((it, idx) => (
              <div key={idx} className="flex items-center justify-between gap-4 py-3">
                <div className="min-w-0">
                  <div className="font-medium text-zinc-100">{it.title}</div>
                  <div className="mt-0.5 text-xs text-zinc-500">Quantity: {it.quantity} × {formatMoney(it.price, quote.currency)}</div>
                </div>
                <div className="font-medium text-zinc-100 tabular-nums">{formatMoney(it.total, quote.currency)}</div>
              </div>
            ))}
          </div>

          <div className="mt-6 space-y-2 border-t border-white/[0.08] pt-4 text-sm">
            <div className="flex justify-between">
              <span className="text-zinc-400">Subtotal</span>
              <span className="text-zinc-200 tabular-nums">{formatMoney(quote.subtotal, quote.currency)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-zinc-400">Shipping</span>
              <span className="text-zinc-200 tabular-nums">{formatMoney(quote.shippingCost, quote.currency)}</span>
            </div>
            {quote.taxAmount > 0 ? (
              <div className="flex justify-between">
                <span className="text-zinc-400">Tax</span>
                <span className="text-zinc-200 tabular-nums">{formatMoney(quote.taxAmount, quote.currency)}</span>
              </div>
            ) : null}
            <div className="flex items-center justify-between border-t border-white/[0.08] pt-3">
              <span className="text-base font-bold text-zinc-100">Total</span>
              <span className="text-2xl font-bold text-blue-300 tabular-nums">{formatMoney(quote.total, quote.currency)}</span>
            </div>
          </div>

          {quote.validUntil ? (
            <div className="mt-4 text-center text-xs text-zinc-500">
              This quote is valid until {new Date(quote.validUntil).toLocaleString()}
            </div>
          ) : null}

          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <button
              type="button"
              onClick={() => void performAction('accept')}
              disabled={acting}
              className="flex-1 rounded-full bg-gradient-to-b from-emerald-500 to-emerald-700 px-6 py-3 text-sm font-bold uppercase tracking-wider text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.18),0_2px_8px_rgba(16,185,129,0.4)] transition hover:from-emerald-400 hover:to-emerald-600 disabled:opacity-50"
            >
              {acting && action === 'accept' ? <Loader2 className="mx-auto h-4 w-4 motion-safe:animate-spin" /> : 'Accept quote'}
            </button>
            <button
              type="button"
              onClick={() => void performAction('decline')}
              disabled={acting}
              className="flex-1 rounded-full border border-white/10 bg-white/[0.03] px-6 py-3 text-sm font-medium text-zinc-300 transition hover:border-red-500/30 hover:bg-red-500/[0.06] hover:text-red-300 disabled:opacity-50"
            >
              {acting && action === 'decline' ? <Loader2 className="mx-auto h-4 w-4 motion-safe:animate-spin" /> : 'Decline'}
            </button>
          </div>
        </div>

        <p className="mt-4 text-center text-[11px] text-zinc-600">
          Powered by OneCompany · {quote.sentAt ? `Sent ${new Date(quote.sentAt).toLocaleDateString()}` : ''}
        </p>
      </div>
    </div>
  );
}
