import { getCanonicalFitmentOptions } from "@/lib/shopCanonicalFitmentOptions.server";
import { NextRequest, NextResponse } from "next/server";
import { getShopProductsWithFitments } from "../search/route";
import { shopVehicleMakesMatch, shopVehicleModelsMatch } from "@/lib/shopVehicleConstraints";
import {
  filterShopStockItemsByVehicleScope,
  isVehicleMakeCompatibleWithScope,
  parseShopStockVehicleScope,
} from "@/lib/shopStockVehicleScope";
import {
  canonicalizeVehicleMakes,
  canonicalizeVehicleChassisCodes,
  canonicalizeVehicleModels,
} from "@/lib/shopVehicleTaxonomy";

const cachedJson = (body: unknown) =>
  NextResponse.json(body, {
    headers: {
      // Keep selector data fast while bounding stale fitment exposure after a
      // controlled Knowledge V2 reindex.
      // Selector responses are public and keyed entirely by the request URL.
      // Give mobile back/forward and repeated filter opens a short browser hit
      // as well as the CDN hit; this avoids re-running a slow fallback scan
      // while preserving the existing bounded staleness window.
      "Cache-Control": "public, max-age=30, s-maxage=60, stale-while-revalidate=60",
    },
  });

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const make = searchParams.get("make");
    const model = searchParams.get("model");
    const chassis = searchParams.get("chassis");
    const rawYear = searchParams.get("year")?.trim() ?? "";
    const yearNumber = /^\d{4}$/.test(rawYear) ? Number(rawYear) : null;
    const year =
      yearNumber != null && yearNumber >= 1886 && yearNumber <= new Date().getFullYear() + 2
        ? yearNumber
        : null;
    if (rawYear && year == null) {
      return NextResponse.json({ error: "Invalid vehicle year" }, { status: 400 });
    }
    const brand = searchParams.get("brand")?.trim() || null;
    const details = searchParams.get("details") === "1";
    const vehicleScope = parseShopStockVehicleScope(searchParams.get("scope"));

    const canonical = await getCanonicalFitmentOptions({
      make,
      model,
      chassis,
      year,
      brand,
      scope: vehicleScope,
      details,
    });
    if (canonical) return cachedJson(canonical);

    // Transitional fallback until a category has completed its Knowledge V2
    // backfill. It remains deterministic and never relaxes selected values.
    const allProductsWithFitments = await getShopProductsWithFitments();
    const brandScopedProducts = brand
      ? allProductsWithFitments.filter((item) =>
          [item.product.brand, item.product.vendor].some(
            (value) => value?.trim().toLocaleLowerCase() === brand.toLocaleLowerCase()
          )
        )
      : allProductsWithFitments;
    const productsWithFitments = filterShopStockItemsByVehicleScope(
      brandScopedProducts,
      vehicleScope
    );

    if (details && make && model) {
      const matchingFitments = productsWithFitments.flatMap((item) =>
        item.fitments.filter(
          (fitment) =>
            shopVehicleMakesMatch(fitment.make, make) &&
            fitment.models.some((candidate: string) =>
              shopVehicleModelsMatch(candidate, model, fitment.make)
            ) &&
            (!chassis ||
              fitment.chassisCodes.some(
                (candidate: string) => candidate.toLocaleLowerCase() === chassis.toLocaleLowerCase()
              ))
        )
      );
      const maxYear = new Date().getFullYear() + 2;
      const years = new Set<number>();
      for (const fitment of matchingFitments) {
        for (const range of fitment.yearRanges) {
          const from = Math.max(1886, range.from ?? 1886);
          const to = Math.min(maxYear, range.to ?? maxYear);
          for (let year = from; year <= to; year += 1) years.add(year);
        }
      }
      return cachedJson({
        type: "details",
        make,
        model,
        chassis,
        data: { years: [...years].sort((left, right) => right - left), engines: [] },
      });
    }

    // Legacy fitment does not have a dependable engine field. Keep the
    // selector precise rather than reusing the chassis response at this level.
    if (make && model && chassis) {
      return cachedJson({ type: "engines", make, model, chassis, data: [] });
    }

    // Level 0: Return unique makes
    if (!make) {
      const makesSet = new Set<string>();
      for (const item of productsWithFitments) {
        for (const fitment of item.fitments) {
          if (fitment.make && isVehicleMakeCompatibleWithScope(fitment.make, vehicleScope)) {
            makesSet.add(fitment.make);
          }
        }
      }
      const makes = canonicalizeVehicleMakes(Array.from(makesSet));
      return cachedJson({ type: "makes", data: makes });
    }

    // Level 1: Make → Models
    if (make && !model) {
      if (!isVehicleMakeCompatibleWithScope(make, vehicleScope)) {
        return cachedJson({ type: "models", make, data: [] });
      }
      const modelsSet = new Set<string>();
      for (const item of productsWithFitments) {
        for (const fitment of item.fitments) {
          if (shopVehicleMakesMatch(fitment.make, make)) {
            for (const modelVal of fitment.models) {
              modelsSet.add(modelVal);
            }
          }
        }
      }
      const models = canonicalizeVehicleModels(make, Array.from(modelsSet));
      return cachedJson({ type: "models", make, data: models });
    }

    // Level 2: Make + Model → Chassis
    if (make && model) {
      if (!isVehicleMakeCompatibleWithScope(make, vehicleScope)) {
        return cachedJson({ type: "chassis", make, model, data: [] });
      }
      const chassisSet = new Set<string>();
      for (const item of productsWithFitments) {
        for (const fitment of item.fitments) {
          if (
            shopVehicleMakesMatch(fitment.make, make) &&
            fitment.models.some((candidate: string) =>
              shopVehicleModelsMatch(candidate, model, fitment.make)
            )
          ) {
            for (const code of fitment.chassisCodes) {
              chassisSet.add(code);
            }
          }
        }
      }
      const chassis = canonicalizeVehicleChassisCodes(Array.from(chassisSet), make, model);
      return cachedJson({ type: "chassis", make, model, data: chassis });
    }

    return cachedJson({ data: [] });
  } catch (error: any) {
    console.error("[Fitment API Error]", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export const runtime = "nodejs";
