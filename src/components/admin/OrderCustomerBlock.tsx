import Link from "next/link";

export function OrderCustomerBlock({
  order,
}: {
  order: {
    customerName: string;
    email: string;
    phone?: string | null;
    customerId?: string | null;
    companyName?: string | null;
    customerGroupSnapshot?: string;
  };
}) {
  return (
    <div className="min-w-0 space-y-1.5 whitespace-normal break-words">
      <div className="text-sm font-semibold text-zinc-100">
        {order.customerName || "Ім’я не вказано"}
      </div>
      {order.companyName && <div className="text-xs text-zinc-300">{order.companyName}</div>}
      {order.phone ? (
        <a
          href={`tel:${order.phone.replace(/[^+\d]/g, "")}`}
          className="block text-sm text-blue-200 hover:underline"
        >
          {order.phone}
        </a>
      ) : (
        <div className="text-xs text-zinc-500">Телефон не вказано</div>
      )}
      {order.email && (
        <a
          href={`mailto:${order.email}`}
          className="block break-all text-xs text-zinc-400 hover:text-blue-200"
        >
          {order.email}
        </a>
      )}
      <div className="flex flex-wrap gap-2 pt-1 text-[11px] text-zinc-500">
        <span>{order.customerGroupSnapshot || "B2C"}</span>
        {order.customerId ? (
          <Link
            href={`/admin/shop/customers/${order.customerId}`}
            className="text-blue-300 hover:underline"
          >
            Профіль клієнта ↗
          </Link>
        ) : (
          <span>Гостьове замовлення</span>
        )}
      </div>
    </div>
  );
}
