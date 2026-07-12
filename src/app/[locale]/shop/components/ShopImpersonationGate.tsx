"use client";

import { useEffect, useState } from "react";
import ShopImpersonationBanner from "./ShopImpersonationBanner";

const IMPERSONATION_MARKER_COOKIE = "oc-shop-impersonation-active";

type BannerData = {
  customerEmail: string;
  customerName: string;
  adminEmail: string;
};

export default function ShopImpersonationGate() {
  const [data, setData] = useState<BannerData | null>(null);

  useEffect(() => {
    const hasMarker = document.cookie
      .split(";")
      .some((entry) => entry.trim() === `${IMPERSONATION_MARKER_COOKIE}=1`);
    if (!hasMarker) return;

    const controller = new AbortController();
    fetch("/api/shop/account/impersonation", {
      cache: "no-store",
      credentials: "same-origin",
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) return null;
        return (await response.json()) as BannerData & { active: boolean };
      })
      .then((payload) => {
        if (payload?.active) setData(payload);
      })
      .catch(() => {});

    return () => controller.abort();
  }, []);

  return data ? <ShopImpersonationBanner {...data} /> : null;
}
