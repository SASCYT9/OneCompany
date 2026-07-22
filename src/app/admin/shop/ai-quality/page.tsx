import type { Metadata } from "next";

import OneAiQualityDashboard from "./OneAiQualityDashboard";

export const metadata: Metadata = {
  title: "One AI Quality | OneCompany Admin",
  robots: {
    index: false,
    follow: false,
  },
};

export default function OneAiQualityPage() {
  return <OneAiQualityDashboard />;
}
