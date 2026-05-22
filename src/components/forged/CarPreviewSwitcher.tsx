"use client";

import type { SupportedLocale } from "@/lib/seo";
import { useForgedConfig } from "./store";
import CarLibraryPicker from "./CarLibraryPicker";
import CarPhotoUploader from "./CarPhotoUploader";

type Props = { locale: SupportedLocale };

export default function CarPreviewSwitcher({ locale }: Props) {
  const isUa = locale === "ua";
  const previewMode = useForgedConfig((s) => s.config.carPreviewMode);
  const setConfig = useForgedConfig((s) => s.setConfig);

  return (
    <div className="space-y-4">
      <div>
        <p className="mb-2 text-xs uppercase tracking-[0.18em] text-white/40">
          {isUa ? "Як примірити на авто" : "Preview on a car"}
        </p>
        <div className="-m-1 flex flex-wrap">
          {(
            [
              ["library", isUa ? "З бібліотеки" : "From library"],
              ["upload", isUa ? "Моє фото" : "Upload my photo"],
              ["none", isUa ? "Без авто" : "Wheel only"],
            ] as const
          ).map(([mode, label]) => {
            const isActive = previewMode === mode;
            return (
              <button
                key={mode}
                type="button"
                onClick={() => setConfig({ carPreviewMode: mode })}
                className={`m-1 border px-3 py-1.5 text-xs transition ${
                  isActive
                    ? "border-[#c48e4c] bg-[#c48e4c]/15 text-[#c48e4c]"
                    : "border-white/10 text-white/70 hover:border-white/30 hover:text-white"
                }`}
              >
                {label}
              </button>
            );
          })}
        </div>
      </div>

      {previewMode === "library" && <CarLibraryPicker locale={locale} />}
      {previewMode === "upload" && <CarPhotoUploader locale={locale} />}
    </div>
  );
}
