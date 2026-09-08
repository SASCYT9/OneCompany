"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { createCatalogOverlayHistory } from "@/lib/shopCatalogOverlayHistory";

export function useCatalogOverlay(id: string) {
  const [open, setOpen] = useState(false);
  const history = useRef<ReturnType<typeof createCatalogOverlayHistory> | null>(null);
  useEffect(() => {
    const controller = createCatalogOverlayHistory(window, id, () => setOpen(false));
    history.current = controller;
    return () => {
      controller.dispose();
      history.current = null;
    };
  }, [id]);
  const changeOpen = useCallback((next: boolean) => {
    if (next) history.current?.open();
    else history.current?.close();
    setOpen(next);
  }, []);
  const rememberUrl = useCallback((href: string) => history.current?.remember(href), []);
  return [open, changeOpen, rememberUrl] as const;
}
