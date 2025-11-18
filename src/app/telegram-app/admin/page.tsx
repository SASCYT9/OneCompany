"use client";

import { useEffect, useState } from "react";
import Script from "next/script";
import MessagesPanel from "@/components/admin/MessagesPanel";
import { Loader, Lock } from "lucide-react";

export default function TelegramAdminPage() {
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [isLoading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    // Check if running in Telegram Web App
    if (typeof window !== "undefined") {
      const tg = (window as any).Telegram?.WebApp;
      if (tg) {
        tg.ready();
        tg.expand();
        
        // Simple client-side check (INSECURE - for demo only, move to server in prod)
        // In production, send tg.initData to backend to verify signature and user ID
        const initData = tg.initDataUnsafe;
        if (initData?.user) {
           // For now, we allow access if opened from Telegram. 
           // TODO: Add server-side validation of initData and check against admin IDs
           setIsAuthorized(true);
        } else {
           // Fallback for testing outside Telegram (remove in prod)
           // setIsAuthorized(true); 
           setError("Please open from Telegram");
        }
        setLoading(false);
      } else {
        setLoading(false);
        setError("Telegram Web App not detected");
      }
    }
  }, []);

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-black text-white">
        <Loader className="h-8 w-8 animate-spin text-white/50" />
      </div>
    );
  }

  if (!isAuthorized) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-black p-6 text-center text-white">
        <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-white/10">
          <Lock className="h-8 w-8 text-white/50" />
        </div>
        <h1 className="mb-2 text-2xl font-semibold">Access Denied</h1>
        <p className="text-white/50">{error || "This area is restricted to administrators."}</p>
        <Script src="https://telegram.org/js/telegram-web-app.js" strategy="beforeInteractive" />
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-black text-white font-ua">
      <Script src="https://telegram.org/js/telegram-web-app.js" strategy="beforeInteractive" />
      <div className="border-b border-white/10 bg-black/50 backdrop-blur-xl sticky top-0 z-40">
        <div className="px-4 py-4 flex items-center justify-between">
          <h1 className="text-lg font-semibold tracking-tight">Admin Panel</h1>
          <div className="text-[10px] uppercase tracking-widest text-white/40">
            Telegram Mode
          </div>
        </div>
      </div>
      <div className="p-4">
        <MessagesPanel />
      </div>
    </main>
  );
}
