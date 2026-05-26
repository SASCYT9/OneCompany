"use client";

import { useEffect, useState } from "react";
import { Check } from "lucide-react";
import type { CompatibleVehicle } from "../do88/do88FitmentData";

type Props = {
  vehicles: CompatibleVehicle[];
  isUa: boolean;
};

export function Do88VehicleCompatibilityAlert({ vehicles, isUa }: Props) {
  const [matchedVehicle, setMatchedVehicle] = useState<CompatibleVehicle | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = window.sessionStorage.getItem("do88VehiclePreference");
      if (!raw) return;
      const preference = JSON.parse(raw);
      if (preference) {
        const match = vehicles.find(
          (v) =>
            (!preference.brand || v.make.toLowerCase() === preference.brand.toLowerCase()) &&
            (!preference.model || v.model.toLowerCase() === preference.model.toLowerCase()) &&
            (!preference.chassis || v.chassis.toLowerCase() === preference.chassis.toLowerCase())
        );
        if (match) {
          setMatchedVehicle(match);
        }
      }
    } catch {
      // ignore
    }
  }, [vehicles]);

  if (!matchedVehicle) return null;

  const vehicleLabel = matchedVehicle.model
    .toLowerCase()
    .includes(matchedVehicle.chassis.toLowerCase())
    ? `${matchedVehicle.make} ${matchedVehicle.model}`
    : `${matchedVehicle.make} ${matchedVehicle.model} (${matchedVehicle.chassis})`;

  return (
    <div className="flex items-center gap-2.5 rounded-2xl border border-emerald-500/20 bg-emerald-500/5 px-4 py-3 text-xs text-emerald-500 dark:text-emerald-400">
      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-500/10">
        <Check className="h-3.5 w-3.5 text-emerald-500 dark:text-emerald-400" />
      </span>
      <span className="font-medium tracking-wide">
        {isUa ? `Підходить для вашого авто: ${vehicleLabel}` : `Fits your vehicle: ${vehicleLabel}`}
      </span>
    </div>
  );
}
