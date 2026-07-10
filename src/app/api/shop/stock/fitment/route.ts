import { NextRequest, NextResponse } from "next/server";
import { getShopProductsWithFitments } from "../search/route";
import { isExpectedChassisForMakeModel } from "@/lib/crossShopFitment";

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

    const productsWithFitments = await getShopProductsWithFitments();

    // Level 0: Return unique makes
    if (!make) {
      const makesSet = new Set<string>();
      for (const item of productsWithFitments) {
        if (item.fitment.make) {
          makesSet.add(item.fitment.make);
        }
      }
      const makes = Array.from(makesSet).sort((a, b) => a.localeCompare(b));
      return cachedJson({ type: "makes", data: makes });
    }

    // Level 1: Make → Models
    if (make && !model) {
      const modelsSet = new Set<string>();
      const makeLower = make.toLowerCase();
      for (const item of productsWithFitments) {
        if (item.fitment.make && item.fitment.make.toLowerCase() === makeLower) {
          for (const modelVal of item.fitment.models) {
            modelsSet.add(modelVal);
          }
        }
      }
      const models = Array.from(modelsSet).sort((a, b) => a.localeCompare(b));
      return cachedJson({ type: "models", make, data: models });
    }

    // Level 2: Make + Model → Chassis
    if (make && model) {
      const chassisSet = new Set<string>();
      const makeLower = make.toLowerCase();
      const modelLower = model.toLowerCase();
      for (const item of productsWithFitments) {
        if (
          item.fitment.make &&
          item.fitment.make.toLowerCase() === makeLower &&
          item.fitment.models.some((m: string) => m.toLowerCase() === modelLower)
        ) {
          for (const code of item.fitment.chassisCodes) {
            if (isExpectedChassisForMakeModel(make, model, code)) {
              chassisSet.add(code);
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
