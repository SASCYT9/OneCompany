import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { assertAdminRequest } from "@/lib/adminAuth";
import { ADMIN_PERMISSIONS } from "@/lib/adminRbac";
import { prisma } from "@/lib/prisma";
import { SHOP_LANDED_COST_MODES, type ShopLandedCostMode } from "@/lib/shopLandedCost";

export const dynamic = "force-dynamic";

function percentage(value: unknown) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? Math.min(100, Math.max(0, parsed)) : 0;
}

function fee(value: unknown) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
}

function normalizeIncoterm(value: unknown): ShopLandedCostMode {
  const candidate = String(value ?? "DAP")
    .trim()
    .toUpperCase();
  return SHOP_LANDED_COST_MODES.includes(candidate as ShopLandedCostMode)
    ? (candidate as ShopLandedCostMode)
    : "DAP";
}

export async function GET(req: Request) {
  const cookieStore = await cookies();
  await assertAdminRequest(cookieStore, ADMIN_PERMISSIONS.SHOP_SETTINGS_READ);

  try {
    const rules = await prisma.shopTaxRegionRule.findMany({
      orderBy: [{ sortOrder: "asc" }, { regionCode: "asc" }],
    });

    return NextResponse.json({ rules });
  } catch (error: any) {
    console.error("[TaxRegionAPI GET]", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const cookieStore = await cookies();
  await assertAdminRequest(cookieStore, ADMIN_PERMISSIONS.SHOP_SETTINGS_WRITE);

  try {
    const data = await req.json();
    const {
      regionCode,
      regionName,
      regionNameUa,
      taxType,
      taxRate,
      taxLabel,
      taxLabelUa,
      customsDutyPct,
      landedCostEnabled,
      appliesToShipping,
      incoterm,
      brokerageFee,
      handlingFee,
      insurancePct,
      riskReservePct,
      importerOfRecord,
      ddpGuarantee,
      isInclusive,
      isActive,
      notes,
      sortOrder,
    } = data;

    if (!regionCode || !regionName) {
      return NextResponse.json({ error: "Region code and name are required" }, { status: 400 });
    }

    const upserted = await prisma.shopTaxRegionRule.upsert({
      where: { regionCode: String(regionCode).toUpperCase() },
      update: {
        regionName: String(regionName),
        regionNameUa: String(regionNameUa || regionName),
        taxType: String(taxType || "VAT"),
        taxRate: percentage(taxRate),
        taxLabel: taxLabel ? String(taxLabel) : null,
        taxLabelUa: taxLabelUa ? String(taxLabelUa) : null,
        customsDutyPct: customsDutyPct === undefined ? undefined : percentage(customsDutyPct),
        landedCostEnabled: landedCostEnabled === undefined ? undefined : Boolean(landedCostEnabled),
        appliesToShipping:
          appliesToShipping === undefined ? undefined : appliesToShipping !== false,
        incoterm: incoterm === undefined ? undefined : normalizeIncoterm(incoterm),
        brokerageFee: brokerageFee === undefined ? undefined : fee(brokerageFee),
        handlingFee: handlingFee === undefined ? undefined : fee(handlingFee),
        insurancePct: insurancePct === undefined ? undefined : percentage(insurancePct),
        riskReservePct: riskReservePct === undefined ? undefined : percentage(riskReservePct),
        importerOfRecord:
          importerOfRecord === undefined
            ? undefined
            : importerOfRecord
              ? String(importerOfRecord).trim()
              : null,
        ddpGuarantee: ddpGuarantee === undefined ? undefined : Boolean(ddpGuarantee),
        isInclusive: Boolean(isInclusive ?? false),
        isActive: isActive !== undefined ? Boolean(isActive) : true,
        notes: notes ? String(notes) : null,
        sortOrder: sortOrder !== undefined ? Number(sortOrder) : 0,
      },
      create: {
        regionCode: String(regionCode).toUpperCase(),
        regionName: String(regionName),
        regionNameUa: String(regionNameUa || regionName),
        taxType: String(taxType || "VAT"),
        taxRate: percentage(taxRate),
        taxLabel: taxLabel ? String(taxLabel) : null,
        taxLabelUa: taxLabelUa ? String(taxLabelUa) : null,
        customsDutyPct: percentage(customsDutyPct),
        landedCostEnabled: Boolean(landedCostEnabled),
        appliesToShipping: appliesToShipping !== false,
        incoterm: normalizeIncoterm(incoterm),
        brokerageFee: fee(brokerageFee),
        handlingFee: fee(handlingFee),
        insurancePct: percentage(insurancePct),
        riskReservePct: percentage(riskReservePct),
        importerOfRecord: importerOfRecord ? String(importerOfRecord).trim() : null,
        ddpGuarantee: Boolean(ddpGuarantee),
        isInclusive: Boolean(isInclusive ?? false),
        isActive: isActive !== undefined ? Boolean(isActive) : true,
        notes: notes ? String(notes) : null,
        sortOrder: sortOrder !== undefined ? Number(sortOrder) : 0,
      },
    });

    return NextResponse.json({ success: true, rule: upserted });
  } catch (error: any) {
    console.error("[TaxRegionAPI POST]", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  const cookieStore = await cookies();
  await assertAdminRequest(cookieStore, ADMIN_PERMISSIONS.SHOP_SETTINGS_WRITE);

  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    if (!id) return NextResponse.json({ error: "ID is required" }, { status: 400 });

    await prisma.shopTaxRegionRule.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("[TaxRegionAPI DELETE]", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
