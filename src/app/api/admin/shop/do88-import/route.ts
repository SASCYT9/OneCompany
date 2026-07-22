// DO88 Bulk Import Route - v1
import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import {
  buildAdminProductCreateData,
  buildAdminProductUpdateData,
  normalizeAdminProductPayload,
} from "@/lib/shopAdminCatalog";
import { assertAdminRequest } from "@/lib/adminAuth";
import { ADMIN_PERMISSIONS } from "@/lib/admin/adminPermissions";
import { prisma } from "@/lib/prisma";
import {
  isSupplierFitmentMetafield,
  parseSupplierFitmentContract,
  validateSupplierFitmentParentReference,
} from "@/lib/shopImportFitment";

/**
 * Temporary bulk import endpoint for DO88 products.
 * Accepts a batch of products and upserts them into the database.
 *
 * POST /api/admin/shop/do88-import
 * Body: { products: ProductPayload[] }
 *
 * DELETE after import is complete.
 */
export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    await assertAdminRequest(cookieStore, ADMIN_PERMISSIONS.SHOP_IMPORTS_MANAGE);
    const body = await request.json();
    const products = body.products;

    if (!Array.isArray(products) || products.length === 0) {
      return NextResponse.json({ error: "products array is required" }, { status: 400 });
    }

    const results = {
      created: 0,
      updated: 0,
      errors: [] as { slug: string; error: string }[],
    };

    const normalizedProducts = products.map((productInput) => ({
      productInput,
      normalized: normalizeAdminProductPayload(productInput),
    }));
    const batchSkus = normalizedProducts
      .flatMap(({ normalized }) => [
        normalized.data.sku,
        ...normalized.data.variants.map((variant) => variant.sku),
      ])
      .filter((sku): sku is string => Boolean(sku));
    const contracts = normalizedProducts.map((item) => ({
      ...item,
      contract: parseSupplierFitmentContract(
        item.normalized.data.metafields.find(isSupplierFitmentMetafield)?.value
      ),
    }));
    const parentSkus = contracts
      .map((item) => item.contract?.parentSku)
      .filter((sku): sku is string => Boolean(sku));
    const parentProducts = parentSkus.length
      ? await prisma.shopProduct.findMany({
          where: {
            OR: [
              { sku: { in: parentSkus, mode: "insensitive" } },
              { variants: { some: { sku: { in: parentSkus, mode: "insensitive" } } } },
            ],
          },
          select: { sku: true, variants: { select: { sku: true } } },
        })
      : [];
    const knownSkus = new Set([
      ...batchSkus,
      ...parentProducts
        .flatMap((product) => [product.sku, ...product.variants.map((variant) => variant.sku)])
        .filter((sku): sku is string => Boolean(sku)),
    ]);

    for (const { productInput, normalized, contract } of contracts) {
      try {
        const { data, errors } = normalized;
        if (contract) {
          errors.push(
            ...validateSupplierFitmentParentReference(contract, knownSkus).map(
              (error) => `fitment.${error.path} [${error.code}]: ${error.message}`
            )
          );
        }
        if (errors.length) {
          results.errors.push({ slug: productInput.slug || "unknown", error: errors.join(", ") });
          continue;
        }

        const existing = await prisma.shopProduct.findUnique({ where: { slug: data.slug } });

        if (existing) {
          await prisma.shopProduct.update({
            where: { slug: data.slug },
            data: buildAdminProductUpdateData(data),
          });
          results.updated++;
        } else {
          await prisma.shopProduct.create({
            data: buildAdminProductCreateData(data),
          });
          results.created++;
        }
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        results.errors.push({
          slug: productInput.slug || "unknown",
          error: message.substring(0, 200),
        });
      }
    }

    return NextResponse.json(results);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    if (message === "UNAUTHORIZED")
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (message === "FORBIDDEN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    console.error("DO88 bulk import error", error);
    return NextResponse.json({ error: "Import failed" }, { status: 500 });
  }
}
