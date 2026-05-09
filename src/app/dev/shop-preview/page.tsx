import { notFound } from "next/navigation";
import ShopPreviewClient from "./ShopPreviewClient";

export const metadata = {
  title: "Shop Preview · Light Theme — OneCompany",
  description: "Realistic shop layout for previewing the upcoming light theme palettes.",
  robots: { index: false, follow: false },
};

export default function ShopPreviewPage() {
  // Hide on real production. Allow on Vercel preview deployments and local dev
  // so the team can share a preview URL while we iterate on the palette.
  if (process.env.VERCEL_ENV === "production" && process.env.ALLOW_THEME_LAB !== "1") {
    notFound();
  }
  return <ShopPreviewClient />;
}
