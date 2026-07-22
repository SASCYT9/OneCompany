"use client";

import { useEffect } from "react";

/**
 * Keeps PWA installation user-initiated.
 *
 * Browsers may otherwise show their own install promotion as soon as the app
 * becomes installable. We intentionally discard the event: there is no custom
 * banner and no later automatic call to prompt().
 */
export default function SuppressAutomaticInstallPrompt() {
  useEffect(() => {
    const suppressPrompt = (event: Event) => {
      event.preventDefault();
    };

    window.addEventListener("beforeinstallprompt", suppressPrompt);

    return () => {
      window.removeEventListener("beforeinstallprompt", suppressPrompt);
    };
  }, []);

  return null;
}
