// Shared brand/model taxonomy for the Brabus filter UI.
// Used by BrabusVehicleFilter (catalog) and BrabusQuickSelector (homepage hero)
// so the two stay in sync.

import type { SupportedLocale } from "@/lib/seo";

export const BRABUS_BRAND_ORDER = [
  "Mercedes",
  "Porsche",
  "Rolls-Royce",
  "Bentley",
  "Lamborghini",
  "Range Rover",
  "smart",
] as const;

export const BRABUS_BRAND_LABELS: Record<string, Record<SupportedLocale, string>> = {
  Mercedes: { en: "Mercedes-Benz", ua: "Mercedes-Benz" },
  Porsche: { en: "Porsche", ua: "Porsche" },
  "Rolls-Royce": { en: "Rolls-Royce", ua: "Rolls-Royce" },
  Bentley: { en: "Bentley", ua: "Bentley" },
  Lamborghini: { en: "Lamborghini", ua: "Lamborghini" },
  "Range Rover": { en: "Range Rover", ua: "Range Rover" },
  smart: { en: "smart", ua: "smart" },
};

export const BRABUS_MODEL_LABELS: Record<string, Record<SupportedLocale, string>> = {
  "G-Klasse": { en: "G-Class", ua: "G-Клас" },
  "A-Klasse": { en: "A-Class", ua: "A-Клас" },
  "C-Klasse": { en: "C-Class", ua: "C-Клас" },
  "CLS-Klasse": { en: "CLS-Class", ua: "CLS-Клас" },
  "E-Klasse": { en: "E-Class", ua: "E-Клас" },
  "EQC-Klasse": { en: "EQC", ua: "EQC" },
  EQC: { en: "EQC", ua: "EQC" },
  "EQS-Klasse": { en: "EQS", ua: "EQS" },
  "EQS SUV": { en: "EQS SUV", ua: "EQS SUV" },
  "GLB-Klasse": { en: "GLB-Class", ua: "GLB-Клас" },
  "GLC-Klasse": { en: "GLC-Class", ua: "GLC-Клас" },
  "GLE-Klasse": { en: "GLE-Class", ua: "GLE-Клас" },
  "GLS-Klasse": { en: "GLS-Class", ua: "GLS-Клас" },
  "GT-Klasse": { en: "AMG GT", ua: "AMG GT" },
  "S-Klasse": { en: "S-Class", ua: "S-Клас" },
  "SL-Klasse": { en: "SL-Class", ua: "SL-Клас" },
  "V-Klasse": { en: "V-Class", ua: "V-Клас" },
  "X-Klasse": { en: "X-Class", ua: "X-Клас" },
  "Porsche 911 Turbo": { en: "911 Turbo", ua: "911 Turbo" },
  "Porsche Taycan": { en: "Taycan", ua: "Taycan" },
  "Rolls-Royce Ghost": { en: "Ghost", ua: "Ghost" },
  "Rolls-Royce Cullinan": { en: "Cullinan", ua: "Cullinan" },
  "Bentley Continental GT Speed": { en: "Continental GT", ua: "Continental GT" },
  "Bentley Continental GTC Speed": { en: "Continental GTC", ua: "Continental GTC" },
  "Lamborghini Urus SE": { en: "Urus", ua: "Urus" },
  P530: { en: "P530", ua: "P530" },
  "smart #1": { en: "#1", ua: "#1" },
  "smart #3": { en: "#3", ua: "#3" },
};

// Which model keys belong to which brand. Mirrors the tagging used in the DB
// so the homepage hero offers exactly the same models that BrabusVehicleFilter
// surfaces after a brand pick.
export const BRABUS_MODELS_BY_BRAND: Record<string, string[]> = {
  Mercedes: [
    "G-Klasse",
    "A-Klasse",
    "C-Klasse",
    "CLS-Klasse",
    "E-Klasse",
    "EQC",
    "EQS-Klasse",
    "EQS SUV",
    "GLB-Klasse",
    "GLC-Klasse",
    "GLE-Klasse",
    "GLS-Klasse",
    "GT-Klasse",
    "S-Klasse",
    "SL-Klasse",
    "V-Klasse",
    "X-Klasse",
  ],
  Porsche: ["Porsche 911 Turbo", "Porsche Taycan"],
  "Rolls-Royce": ["Rolls-Royce Ghost", "Rolls-Royce Cullinan"],
  Bentley: ["Bentley Continental GT Speed", "Bentley Continental GTC Speed"],
  Lamborghini: ["Lamborghini Urus SE"],
  "Range Rover": ["P530"],
  smart: ["smart #1", "smart #3"],
};
