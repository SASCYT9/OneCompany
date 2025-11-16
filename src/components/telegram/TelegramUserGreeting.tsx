"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

type TelegramUserGreetingProps = {
  className?: string;
};

interface TelegramUser {
  first_name?: string;
  last_name?: string;
}

interface TelegramWebApp {
  ready?: () => void;
  expand?: () => void;
  platform?: string;
  initDataUnsafe?: {
    user?: TelegramUser;
  };
  setBackgroundColor?: (color: string) => void;
  setHeaderColor?: (color: string) => void;
  enableClosingConfirmation?: () => void;
}

declare global {
  interface Window {
    Telegram?: {
      WebApp?: TelegramWebApp;
    };
  }
}

export default function TelegramUserGreeting({ className }: TelegramUserGreetingProps) {
  const [userName, setUserName] = useState<string | null>(null);
  const [platform, setPlatform] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const webApp = window.Telegram?.WebApp;

    if (!webApp) {
      return;
    }

    try {
      webApp.ready?.();
      webApp.expand?.();
      webApp.setBackgroundColor?.("#05060a");
      webApp.setHeaderColor?.("#05060a");
      webApp.enableClosingConfirmation?.();
    } catch (error) {
      console.warn("Telegram WebApp API is unavailable", error);
    }

    const user = webApp.initDataUnsafe?.user;

    if (user?.first_name) {
      const fullName = user.last_name
        ? `${user.first_name} ${user.last_name}`
        : user.first_name;
      setUserName(fullName);
    }

    if (webApp.platform) {
      setPlatform(webApp.platform);
    }
  }, []);

  if (!userName && !platform) {
    return null;
  }

  return (
    <div className={cn("flex flex-wrap items-center gap-2 text-sm text-white/70", className)}>
      {userName ? <span>Привіт, {userName}</span> : null}
      {platform ? (
        <span className="rounded-full border border-white/15 px-3 py-1 text-[11px] uppercase tracking-[0.35em] text-white/50">
          {platform}
        </span>
      ) : null}
    </div>
  );
}

export {};
