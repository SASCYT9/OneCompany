"use client";

import { useEffect } from 'react';

export default function Snackbar({ message, open, onClose, duration = 3000 }: { message: string; open: boolean; onClose: () => void; duration?: number; }) {
  useEffect(() => {
    if (!open) return;
    const timer = setTimeout(() => onClose(), duration);
    return () => clearTimeout(timer);
  }, [open, duration, onClose]);

  if (!open) return null;

  return (
    <div className="fixed bottom-6 right-6 z-50">
      <div className="rounded-md bg-zinc-900/90 px-4 py-2 text-white text-sm shadow-lg">
        {message}
      </div>
    </div>
  );
}
