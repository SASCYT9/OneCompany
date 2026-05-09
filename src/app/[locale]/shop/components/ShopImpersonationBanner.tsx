'use client';

import { useState } from 'react';
import { Eye, X } from 'lucide-react';

type Props = {
  customerEmail: string;
  customerName: string;
  adminEmail: string;
};

export default function ShopImpersonationBanner({
  customerEmail,
  customerName,
  adminEmail,
}: Props) {
  const [exiting, setExiting] = useState(false);

  async function exit() {
    setExiting(true);
    try {
      await fetch('/api/shop/account/exit-impersonation', { method: 'POST' });
    } finally {
      // Reload so server components re-evaluate session without the cookie.
      window.location.reload();
    }
  }

  return (
    <div className="sticky top-0 z-100 w-full bg-amber-500/95 text-black shadow-[0_4px_12px_rgba(0,0,0,0.25)]">
      <div className="mx-auto flex w-full max-w-7xl flex-wrap items-center gap-3 px-4 py-2 text-sm">
        <Eye className="h-4 w-4 shrink-0" />
        <div className="min-w-0 flex-1">
          <span className="font-semibold uppercase tracking-[0.18em] text-[11px]">
            Перегляд від імені клієнта
          </span>
          <span className="ml-3 text-black/85">
            <span className="font-medium">{customerName || customerEmail}</span>
            <span className="text-black/55"> · {customerEmail}</span>
          </span>
          <span className="ml-3 text-[11px] uppercase tracking-[0.14em] text-black/50">
            адмін: {adminEmail}
          </span>
        </div>
        <button
          type="button"
          onClick={() => void exit()}
          disabled={exiting}
          className="inline-flex items-center gap-1.5 rounded-full bg-black/85 px-4 py-1.5 text-xs uppercase tracking-[0.18em] text-amber-100 transition hover:bg-black disabled:opacity-50"
        >
          <X className="h-3.5 w-3.5" />
          {exiting ? 'Вихід…' : 'Вийти з ролі'}
        </button>
      </div>
    </div>
  );
}
