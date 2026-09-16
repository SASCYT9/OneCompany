import { NextResponse } from "next/server";

import { catalogBrochureContentDisposition } from "@/lib/admin/catalogBrochure";
import { snapshotToPdfInput } from "@/lib/admin/catalogBrochureSnapshot";
import {
  catalogShareSnapshot,
  findCatalogPresentationShare,
} from "@/lib/admin/catalogPresentationShare";

export async function GET(_request: Request, context: { params: Promise<{ token: string }> }) {
  const { token } = await context.params;
  const share = await findCatalogPresentationShare(token);
  if (!share) return NextResponse.json({ error: "Presentation not found" }, { status: 404 });
  const snapshot = catalogShareSnapshot(share);
  const { renderCatalogBrochurePdf } = await import("@/lib/admin/catalogBrochurePdf");
  const pdf = await renderCatalogBrochurePdf(snapshotToPdfInput(snapshot));
  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": catalogBrochureContentDisposition(snapshot.title),
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
