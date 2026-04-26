'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';

import { AnimatePresence, motion } from 'framer-motion';
import { AlertTriangle, Info, Trash2 } from 'lucide-react';

import { cn } from '@/lib/utils';

type ConfirmTone = 'default' | 'danger' | 'warning';

type ConfirmOptions = {
  title: ReactNode;
  description?: ReactNode;
  /** Replaces the default OK label */
  confirmLabel?: string;
  /** Replaces the default Cancel label */
  cancelLabel?: string;
  /** Visual tone — danger turns confirm button red */
  tone?: ConfirmTone;
  /** Optional input the user must type to confirm (e.g. "DELETE") */
  typedConfirmation?: string;
};

type ConfirmContextValue = (options: ConfirmOptions) => Promise<boolean>;

const ConfirmContext = createContext<ConfirmContextValue | null>(null);

type DialogState = {
  options: ConfirmOptions;
  resolve: (value: boolean) => void;
} | null;

export function AdminConfirmProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<DialogState>(null);
  const [typedValue, setTypedValue] = useState('');

  const confirm = useCallback<ConfirmContextValue>((options) => {
    setTypedValue('');
    return new Promise<boolean>((resolve) => {
      setState({ options, resolve });
    });
  }, []);

  const close = useCallback(
    (result: boolean) => {
      if (state) state.resolve(result);
      setState(null);
      setTypedValue('');
    },
    [state]
  );

  const typedOk =
    !state?.options.typedConfirmation || typedValue.trim() === state.options.typedConfirmation;

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      <AnimatePresence>
        {state ? (
          <ConfirmDialog
            options={state.options}
            typedValue={typedValue}
            setTypedValue={setTypedValue}
            typedOk={typedOk}
            onCancel={() => close(false)}
            onConfirm={() => close(true)}
          />
        ) : null}
      </AnimatePresence>
    </ConfirmContext.Provider>
  );
}

export function useConfirm(): ConfirmContextValue {
  const ctx = useContext(ConfirmContext);
  if (!ctx) {
    // SSR-safe fallback: degrade to native confirm
    return (options) => {
      if (typeof window === 'undefined') return Promise.resolve(false);
      const text = `${typeof options.title === 'string' ? options.title : 'Підтвердити'}\n\n${typeof options.description === 'string' ? options.description : ''}`;
      return Promise.resolve(window.confirm(text));
    };
  }
  return ctx;
}

function ConfirmDialog({
  options,
  typedValue,
  setTypedValue,
  typedOk,
  onCancel,
  onConfirm,
}: {
  options: ConfirmOptions;
  typedValue: string;
  setTypedValue: (v: string) => void;
  typedOk: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const tone: ConfirmTone = options.tone ?? 'default';
  const confirmLabel = options.confirmLabel ?? (tone === 'danger' ? 'Видалити' : 'Підтвердити');
  const cancelLabel = options.cancelLabel ?? 'Скасувати';

  const Icon = tone === 'danger' ? Trash2 : tone === 'warning' ? AlertTriangle : Info;
  const iconCls =
    tone === 'danger'
      ? 'border-red-500/30 bg-red-500/[0.1] text-red-400'
      : tone === 'warning'
        ? 'border-amber-500/30 bg-amber-500/[0.1] text-amber-400'
        : 'border-blue-500/30 bg-blue-500/[0.1] text-blue-400';

  const confirmBtnCls =
    tone === 'danger'
      ? 'bg-red-600 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.18),0_2px_8px_rgba(220,38,38,0.4)] hover:bg-red-500'
      : tone === 'warning'
        ? 'bg-amber-600 text-white hover:bg-amber-500'
        : 'bg-blue-600 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.18),0_2px_8px_rgba(59,130,246,0.4)] hover:bg-blue-500';

  // Escape and Enter handlers
  useEffect(() => {
    function handler(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.preventDefault();
        onCancel();
      } else if (e.key === 'Enter' && typedOk) {
        e.preventDefault();
        onConfirm();
      }
    }
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onCancel, onConfirm, typedOk]);

  // Focus first interactive (typed input or confirm button)
  const inputRef = useRef<HTMLInputElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    setTimeout(() => {
      if (options.typedConfirmation && inputRef.current) {
        inputRef.current.focus();
      } else if (buttonRef.current) {
        buttonRef.current.focus();
      }
    }, 80);
  }, [options.typedConfirmation]);

  return (
    <div
      className="fixed inset-0 z-[110] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="oc-confirm-title"
    >
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.15 }}
        onClick={onCancel}
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
      />
      <motion.div
        initial={{ opacity: 0, y: 16, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 8, scale: 0.97, transition: { duration: 0.12 } }}
        transition={{ type: 'spring', stiffness: 320, damping: 28 }}
        className="relative w-full max-w-md overflow-hidden rounded-xl border border-white/[0.08] bg-[#171717] shadow-[0_30px_80px_rgba(0,0,0,0.7)]"
      >
        <div className="flex items-start gap-4 p-5">
          <div className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-full border', iconCls)}>
            <Icon className="h-5 w-5" aria-hidden="true" />
          </div>
          <div className="min-w-0 flex-1 space-y-1.5">
            <h2 id="oc-confirm-title" className="text-base font-semibold text-zinc-50">
              {options.title}
            </h2>
            {options.description ? (
              <div className="text-sm leading-6 text-zinc-400">{options.description}</div>
            ) : null}
            {options.typedConfirmation ? (
              <div className="pt-2">
                <label className="block text-xs text-zinc-500">
                  Введіть{' '}
                  <code className="rounded bg-white/[0.06] px-1.5 py-0.5 font-mono text-[11px] text-zinc-200">
                    {options.typedConfirmation}
                  </code>{' '}
                  для підтвердження
                </label>
                <input
                  ref={inputRef}
                  type="text"
                  value={typedValue}
                  onChange={(e) => setTypedValue(e.target.value)}
                  className="mt-1.5 w-full rounded-lg border border-white/[0.08] bg-[#0F0F0F] px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-red-500/50 focus:outline-none focus:ring-2 focus:ring-red-500/15"
                  placeholder={options.typedConfirmation}
                  autoComplete="off"
                  spellCheck={false}
                />
              </div>
            ) : null}
          </div>
        </div>
        <div className="flex items-center justify-end gap-2 border-t border-white/[0.05] bg-black/20 px-5 py-3">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg border border-white/[0.1] bg-white/[0.03] px-3.5 py-2 text-sm font-medium text-zinc-200 transition hover:border-white/20 hover:bg-white/[0.06] focus:outline-none focus:ring-2 focus:ring-blue-500/40"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            ref={buttonRef}
            onClick={onConfirm}
            disabled={!typedOk}
            className={cn(
              'rounded-lg px-3.5 py-2 text-sm font-semibold transition',
              'focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-[#171717]',
              tone === 'danger' && 'focus:ring-red-500/50',
              tone === 'warning' && 'focus:ring-amber-500/50',
              tone === 'default' && 'focus:ring-blue-500/50',
              'disabled:cursor-not-allowed disabled:opacity-50',
              confirmBtnCls
            )}
          >
            {confirmLabel}
          </button>
        </div>
      </motion.div>
    </div>
  );
}
