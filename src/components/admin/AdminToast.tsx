'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';

import { AnimatePresence, motion } from 'framer-motion';
import { AlertCircle, CheckCircle2, Info, X, AlertTriangle } from 'lucide-react';

import { cn } from '@/lib/utils';

type ToastTone = 'success' | 'error' | 'warning' | 'info';

type Toast = {
  id: string;
  tone: ToastTone;
  title: string;
  description?: string;
  duration?: number; // ms; default 4000, 0 = sticky
  action?: { label: string; onClick: () => void };
};

type ToastContextValue = {
  toast: (t: Omit<Toast, 'id'>) => string;
  dismiss: (id: string) => void;
  success: (title: string, description?: string) => string;
  error: (title: string, description?: string) => string;
  warning: (title: string, description?: string) => string;
  info: (title: string, description?: string) => string;
};

const ToastContext = createContext<ToastContextValue | null>(null);

export function AdminToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const dismiss = useCallback((id: string) => {
    setToasts((current) => current.filter((t) => t.id !== id));
  }, []);

  const toast = useCallback(
    (t: Omit<Toast, 'id'>) => {
      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const duration = t.duration ?? 4000;
      setToasts((current) => [...current, { ...t, id }]);
      if (duration > 0) {
        setTimeout(() => dismiss(id), duration);
      }
      return id;
    },
    [dismiss]
  );

  const helpers = {
    toast,
    dismiss,
    success: (title: string, description?: string) => toast({ tone: 'success', title, description }),
    error: (title: string, description?: string) => toast({ tone: 'error', title, description, duration: 6000 }),
    warning: (title: string, description?: string) => toast({ tone: 'warning', title, description }),
    info: (title: string, description?: string) => toast({ tone: 'info', title, description }),
  };

  return (
    <ToastContext.Provider value={helpers}>
      {children}
      <ToastViewport toasts={toasts} onDismiss={dismiss} />
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    // Safe no-op fallback so hook can be called outside provider during SSR
    return {
      toast: () => '',
      dismiss: () => undefined,
      success: () => '',
      error: () => '',
      warning: () => '',
      info: () => '',
    };
  }
  return ctx;
}

function ToastViewport({ toasts, onDismiss }: { toasts: Toast[]; onDismiss: (id: string) => void }) {
  return (
    <div
      aria-live="polite"
      aria-atomic="false"
      className="pointer-events-none fixed bottom-4 right-4 z-[100] flex w-full max-w-sm flex-col gap-2"
    >
      <AnimatePresence initial={false}>
        {toasts.map((t) => (
          <ToastCard key={t.id} toast={t} onDismiss={() => onDismiss(t.id)} />
        ))}
      </AnimatePresence>
    </div>
  );
}

function ToastCard({ toast, onDismiss }: { toast: Toast; onDismiss: () => void }) {
  const Icon =
    toast.tone === 'success'
      ? CheckCircle2
      : toast.tone === 'error'
        ? AlertCircle
        : toast.tone === 'warning'
          ? AlertTriangle
          : Info;

  const accentClass =
    toast.tone === 'success'
      ? 'border-green-500/30 bg-green-500/[0.05] [&_.toast-icon]:text-green-400 [&_.toast-stripe]:bg-green-500'
      : toast.tone === 'error'
        ? 'border-red-500/30 bg-red-500/[0.05] [&_.toast-icon]:text-red-400 [&_.toast-stripe]:bg-red-500'
        : toast.tone === 'warning'
          ? 'border-amber-500/30 bg-amber-500/[0.05] [&_.toast-icon]:text-amber-400 [&_.toast-stripe]:bg-amber-500'
          : 'border-blue-500/30 bg-blue-500/[0.05] [&_.toast-icon]:text-blue-400 [&_.toast-stripe]:bg-blue-500';

  const role = toast.tone === 'error' ? 'alert' : 'status';
  const ariaLive = toast.tone === 'error' ? 'assertive' : 'polite';

  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: 40, scale: 0.95 }}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      exit={{ opacity: 0, x: 20, scale: 0.95, transition: { duration: 0.15 } }}
      transition={{ type: 'spring', stiffness: 300, damping: 26 }}
      role={role}
      aria-live={ariaLive}
      className={cn(
        'pointer-events-auto relative overflow-hidden rounded-xl border bg-[#171717] shadow-[0_20px_50px_rgba(0,0,0,0.5)] backdrop-blur-xl',
        accentClass
      )}
    >
      <span className="toast-stripe pointer-events-none absolute left-0 top-0 h-full w-[3px]" aria-hidden="true" />
      <div className="flex items-start gap-3 px-4 py-3.5 pl-5">
        <Icon className="toast-icon mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold text-zinc-50">{toast.title}</div>
          {toast.description ? <div className="mt-0.5 text-xs leading-5 text-zinc-400">{toast.description}</div> : null}
          {toast.action ? (
            <button
              type="button"
              onClick={() => {
                toast.action!.onClick();
                onDismiss();
              }}
              className="mt-2 text-xs font-semibold text-blue-400 transition hover:text-blue-300"
            >
              {toast.action.label}
            </button>
          ) : null}
        </div>
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss notification"
          className="-mr-1 -mt-1 rounded p-1 text-zinc-500 transition hover:bg-white/[0.05] hover:text-zinc-200"
        >
          <X className="h-3.5 w-3.5" aria-hidden="true" />
        </button>
      </div>
    </motion.div>
  );
}

/**
 * Convenience hook that listens for global `admin-toast` window events.
 * Useful for plain JS / non-React fetch wrappers to push toasts.
 *
 * Usage anywhere:
 *   window.dispatchEvent(new CustomEvent('admin-toast', { detail: { tone: 'success', title: 'Saved' } }));
 */
export function useAdminToastBridge() {
  const { toast } = useToast();
  useEffect(() => {
    function handler(e: Event) {
      const detail = (e as CustomEvent).detail as Omit<Toast, 'id'> | undefined;
      if (!detail) return;
      toast(detail);
    }
    window.addEventListener('admin-toast', handler);
    return () => window.removeEventListener('admin-toast', handler);
  }, [toast]);
}
