'use client';

import { useState } from 'react';

import { ChevronLeft, ChevronRight } from 'lucide-react';

import { cn } from '@/lib/utils';

function getPageNumbers(currentPage: number, totalPages: number): Array<number | 'gap'> {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  }

  const pages: Array<number | 'gap'> = [1];

  if (currentPage > 4) pages.push('gap');

  const windowStart = Math.max(2, currentPage - 1);
  const windowEnd = Math.min(totalPages - 1, currentPage + 1);
  for (let i = windowStart; i <= windowEnd; i += 1) pages.push(i);

  if (currentPage < totalPages - 3) pages.push('gap');

  pages.push(totalPages);
  return pages;
}

export function AdminPagination({
  currentPage,
  totalPages,
  totalCount,
  pageSize,
  onPageChange,
  className,
}: {
  currentPage: number;
  totalPages: number;
  totalCount: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  className?: string;
}) {
  const [jumpValue, setJumpValue] = useState('');

  if (totalPages <= 1) return null;

  const startIndex = (currentPage - 1) * pageSize + 1;
  const endIndex = Math.min(currentPage * pageSize, totalCount);
  const pages = getPageNumbers(currentPage, totalPages);

  const handleJump = (value: string) => {
    const parsed = parseInt(value, 10);
    if (Number.isFinite(parsed) && parsed >= 1 && parsed <= totalPages) {
      onPageChange(parsed);
      setJumpValue('');
    }
  };

  return (
    <nav
      role="navigation"
      aria-label="Сторінкова навігація"
      className={cn(
        'flex flex-col gap-3 rounded-none border border-white/[0.05] bg-[#171717] px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between',
        className
      )}
    >
      <div className="text-zinc-400 tabular-nums">
        Показано <span className="font-medium text-zinc-200">{startIndex}–{endIndex}</span> з{' '}
        <span className="font-medium text-zinc-200">{totalCount}</span>
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        <button
          type="button"
          disabled={currentPage <= 1}
          onClick={() => onPageChange(currentPage - 1)}
          className="inline-flex h-8 items-center gap-1 rounded-none border border-white/[0.08] bg-white/[0.03] px-2.5 text-xs font-medium text-zinc-200 transition hover:border-white/20 hover:bg-white/[0.06] disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-white/[0.03]"
          aria-label="Попередня сторінка"
        >
          <ChevronLeft className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Попередня</span>
        </button>

        <div className="flex items-center gap-1" role="group" aria-label="Номери сторінок">
          {pages.map((page, index) =>
            page === 'gap' ? (
              <span
                key={`gap-${index}`}
                className="px-1 text-zinc-600 select-none"
                aria-hidden="true"
              >
                …
              </span>
            ) : (
              <button
                key={page}
                type="button"
                onClick={() => onPageChange(page)}
                aria-current={page === currentPage ? 'page' : undefined}
                className={cn(
                  'inline-flex h-8 min-w-[32px] items-center justify-center rounded-none px-2 text-xs font-semibold tabular-nums transition',
                  page === currentPage
                    ? 'bg-blue-600 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.18)]'
                    : 'border border-white/[0.08] bg-white/[0.03] text-zinc-300 hover:border-white/20 hover:bg-white/[0.06] hover:text-zinc-50'
                )}
              >
                {page}
              </button>
            )
          )}
        </div>

        <button
          type="button"
          disabled={currentPage >= totalPages}
          onClick={() => onPageChange(currentPage + 1)}
          className="inline-flex h-8 items-center gap-1 rounded-none border border-white/[0.08] bg-white/[0.03] px-2.5 text-xs font-medium text-zinc-200 transition hover:border-white/20 hover:bg-white/[0.06] disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-white/[0.03]"
          aria-label="Наступна сторінка"
        >
          <span className="hidden sm:inline">Наступна</span>
          <ChevronRight className="h-3.5 w-3.5" />
        </button>

        {totalPages > 7 ? (
          <form
            onSubmit={(event) => {
              event.preventDefault();
              handleJump(jumpValue);
            }}
            className="ml-2 hidden items-center gap-1.5 lg:inline-flex"
          >
            <label className="text-[11px] font-medium uppercase tracking-wider text-zinc-500">
              Перейти
            </label>
            <input
              type="number"
              min={1}
              max={totalPages}
              value={jumpValue}
              onChange={(event) => setJumpValue(event.target.value)}
              placeholder={String(currentPage)}
              className="h-8 w-14 rounded-none border border-white/[0.08] bg-black/30 px-2 text-center text-xs text-zinc-100 tabular-nums focus:border-blue-500/40 focus:outline-none"
              aria-label="Номер сторінки для переходу"
            />
          </form>
        ) : null}
      </div>
    </nav>
  );
}
