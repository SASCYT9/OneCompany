import { NextRequest, NextResponse } from "next/server";
import { getShopProductsWithFitments } from "../search/route";
import { isExpectedChassisForMakeModel } from "@/lib/crossShopFitment";
import {
  filterShopStockItemsByVehicleScope,
  isVehicleMakeCompatibleWithScope,
  parseShopStockVehicleScope,
} from "@/lib/shopStockVehicleScope";

const cachedJson = (body: unknown) =>
  NextResponse.json(body, {
    headers: {
      "Cache-Control": "public, s-maxage=300, stale-while-revalidate=900",
    },
  });

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const make = searchParams.get("make");
    const model = searchParams.get("model");
    const vehicleScope = parseShopStockVehicleScope(searchParams.get("scope"));

    const allProductsWithFitments = await getShopProductsWithFitments();
    const productsWithFitments = filterShopStockItemsByVehicleScope(
      allProductsWithFitments,
      vehicleScope
    );

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
      const makes = Array.from(makesSet).sort((a, b) => a.localeCompare(b));
      return cachedJson({ type: "makes", data: makes });
    }

    // Level 1: Make → Models
    if (make && !model) {
      if (!isVehicleMakeCompatibleWithScope(make, vehicleScope)) {
        return cachedJson({ type: "models", make, data: [] });
      }
      const modelsSet = new Set<string>();
      const makeLower = make.toLowerCase();
      for (const item of productsWithFitments) {
        for (const fitment of item.fitments) {
          if (fitment.make && fitment.make.toLowerCase() === makeLower) {
            for (const modelVal of fitment.models) {
              modelsSet.add(modelVal);
            }
          }
        }
      }
      const models = Array.from(modelsSet).sort((a, b) => a.localeCompare(b));
      return cachedJson({ type: "models", make, data: models });
    }

    // Level 2: Make + Model → Chassis
    if (make && model) {
      if (!isVehicleMakeCompatibleWithScope(make, vehicleScope)) {
        return cachedJson({ type: "chassis", make, model, data: [] });
      }
      const chassisSet = new Set<string>();
      const makeLower = make.toLowerCase();
      const modelLower = model.toLowerCase();
      for (const item of productsWithFitments) {
        for (const fitment of item.fitments) {
          if (
            fitment.make &&
            fitment.make.toLowerCase() === makeLower &&
            fitment.models.some((m: string) => m.toLowerCase() === modelLower)
          ) {
            for (const code of fitment.chassisCodes) {
              if (isExpectedChassisForMakeModel(make, model, code)) {
                chassisSet.add(code);
              }
            }
          }
        }
      }
      const chassis = Array.from(chassisSet).sort((a, b) => a.localeCompare(b));
      return cachedJson({ type: "chassis", make, model, data: chassis });
    }

    return cachedJson({ data: [] });
  } catch (error: any) {
    console.error("[Fitment API Error]", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export const runtime = "nodejs";
