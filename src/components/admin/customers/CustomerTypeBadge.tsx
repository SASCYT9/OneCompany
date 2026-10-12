import { AdminStatusBadge } from "@/components/admin/AdminPrimitives";

export type CustomerGroupCode = "B2C" | "B2B_PENDING" | "B2B_APPROVED";

/** «B2B-партнер · −10%», «Заявка B2B» or «Роздріб» instead of raw group codes. */
export function CustomerTypeBadge({
  group,
  discount,
}: {
  group: CustomerGroupCode;
  discount?: number | null;
}) {
  if (group === "B2B_APPROVED")
    return (
      <AdminStatusBadge tone="success">
        B2B-партнер{discount ? ` · −${discount}%` : ""}
      </AdminStatusBadge>
    );
  if (group === "B2B_PENDING") return <AdminStatusBadge tone="warning">Заявка B2B</AdminStatusBadge>;
  return <AdminStatusBadge>Роздріб</AdminStatusBadge>;
}
