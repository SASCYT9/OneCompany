import { prisma } from "@/lib/prisma";

/** Per-customer markups managed in the admin pricing and customer screens. */
export async function getAllCustomerMarkups() {
  return prisma.customerMarkup.findMany({
    orderBy: { customerName: "asc" },
  });
}

export async function upsertCustomerMarkup(data: {
  customerId: string;
  customerName: string;
  markupPct: number;
  notes?: string;
}) {
  return prisma.customerMarkup.upsert({
    where: { customerId: data.customerId },
    update: {
      customerName: data.customerName,
      markupPct: data.markupPct,
      notes: data.notes || null,
      isActive: true,
    },
    create: {
      customerId: data.customerId,
      customerName: data.customerName,
      markupPct: data.markupPct,
      notes: data.notes || null,
    },
  });
}

export async function deleteCustomerMarkup(customerId: string) {
  return prisma.customerMarkup
    .delete({
      where: { customerId },
    })
    .catch(() => null);
}
