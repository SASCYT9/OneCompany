import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

import { assertAdminRequest } from "@/lib/adminAuth";
import { ADMIN_PERMISSIONS } from "@/lib/adminRbac";
import { getFitmentReviewReport } from "@/lib/admin/shopFitmentReview";
import type { NormalizedFitmentStatus } from "@/lib/shopFitmentQuality";
import { prisma } from "@/lib/prisma";

const STATUSES: NormalizedFitmentStatus[] = ["needs_review", "inferred", "verified", "universal"];

export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    await assertAdminRequest(cookieStore, ADMIN_PERMISSIONS.SHOP_PRODUCTS_READ);

    const params = request.nextUrl.searchParams;
    const statusValue = params.get("status") || "needs_review";
    const status = STATUSES.includes(statusValue as NormalizedFitmentStatus)
      ? (statusValue as NormalizedFitmentStatus)
      : "needs_review";
    const brand = params.get("brand")?.trim() || "ALL";
    const query = params.get("q")?.trim().toLowerCase() || "";
    const page = Math.max(1, Number.parseInt(params.get("page") || "1", 10) || 1);
    const limit = Math.max(
      1,
      Math.min(100, Number.parseInt(params.get("limit") || "50", 10) || 50)
    );

    const report = await getFitmentReviewReport(prisma);
    const filtered = report.products.filter((product) => {
      if (product.fitment.status !== status) return false;
      if (brand !== "ALL" && product.brand !== brand) return false;
      if (!query) return true;
      return [product.title, product.slug, product.sku, product.brand, product.fitment.make]
        .join(" ")
        .toLowerCase()
        .includes(query);
    });
    const totalPages = Math.max(1, Math.ceil(filtered.length / limit));
    const currentPage = Math.min(page, totalPages);
    const start = (currentPage - 1) * limit;

    return NextResponse.json({
      products: filtered.slice(start, start + limit),
      counts: report.counts,
      brands: report.brands,
      metadata: {
        totalCount: filtered.length,
        currentPage,
        totalPages,
        limit,
      },
    });
  } catch (error) {
    if ((error as Error).message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if ((error as Error).message === "FORBIDDEN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    console.error("Admin fitment review failed", error);
    return NextResponse.json({ error: "Failed to load fitment review" }, { status: 500 });
  }
}
