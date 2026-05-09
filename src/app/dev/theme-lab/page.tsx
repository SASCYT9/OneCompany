import { notFound } from "next/navigation";
import ThemeLabClient from "./ThemeLabClient";

export const metadata = {
  title: "Theme Lab — OneCompany",
  robots: { index: false, follow: false },
};

export default function ThemeLabPage() {
  // Hide on real production. Allow on Vercel preview deployments and local dev
  // so the team can share a preview URL while we iterate on the palette.
  if (process.env.VERCEL_ENV === "production" && process.env.ALLOW_THEME_LAB !== "1") {
    notFound();
  }
  return <ThemeLabClient />;
}
