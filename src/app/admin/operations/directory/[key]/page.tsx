import { notFound } from "next/navigation";

import { requireOpsPageAccess } from "@/app/admin/operations/requireOpsPageAccess";
import { OpsBrandDirectoryDetail } from "@/components/admin/operations/OpsBrandDirectoryDetail";
import { OPS_SHIPPING_REFERENCE_SLUG } from "@/data/operations/shipping-guides";
import { ADMIN_PERMISSIONS } from "@/lib/admin/adminPermissions";
import { currentAdminHasPermission } from "@/lib/admin/adminAccess";
import {
  getBrandGuideByKey,
  hydrateBrandGuideFromArticle,
  parseShippingEstimatesFromMarkdown,
} from "@/lib/operations/brandGuides";
import { prisma } from "@/lib/prisma";

export default async function OperationsDirectoryDetailPage({
  params,
}: {
  params: Promise<{ key: string }>;
}) {
  const access = await requireOpsPageAccess(ADMIN_PERMISSIONS.OPS_KNOWLEDGE_READ);
  const { key } = await params;
  const fallbackEntry = getBrandGuideByKey(key);
  if (!fallbackEntry) notFound();
  const [brandArticle, shippingArticle] = await Promise.all([
    prisma.opsKnowledgeArticle.findFirst({
      where: {
        brandKey: key,
        archivedAt: null,
        tags: { has: "brand-guide" },
      },
      select: { id: true, title: true, contentMarkdown: true },
    }),
    prisma.opsKnowledgeArticle.findUnique({
      where: { slug: OPS_SHIPPING_REFERENCE_SLUG },
      select: { id: true, contentMarkdown: true, archivedAt: true },
    }),
  ]);
  const canWrite = currentAdminHasPermission(access, ADMIN_PERMISSIONS.OPS_KNOWLEDGE_WRITE);
  return (
    <OpsBrandDirectoryDetail
      entry={hydrateBrandGuideFromArticle(fallbackEntry, brandArticle)}
      permissions={access.permissions}
      canWrite={canWrite}
      brandArticleId={brandArticle?.id ?? null}
      shippingArticleId={shippingArticle && !shippingArticle.archivedAt ? shippingArticle.id : null}
      shippingEstimates={parseShippingEstimatesFromMarkdown(shippingArticle?.contentMarkdown)}
    />
  );
}
