import Link from "next/link";
import { ExternalLink, Package } from "lucide-react";
import { orderProductLinks, type OrderProductReference } from "@/lib/shopOrderPresentation";

export type OrderProductItem = OrderProductReference & {
  id: string;
  title: string;
  quantity: number;
  image?: string | null;
  sku?: string | null;
  variantTitle?: string | null;
};

export function OrderProductLinks({
  item,
  thumbnail = false,
}: {
  item: OrderProductItem;
  thumbnail?: boolean;
}) {
  const links = orderProductLinks(item);
  return (
    <div className="flex min-w-0 items-start gap-3">
      {thumbnail && (
        <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-white/10 bg-white/5">
          {item.image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={item.image} alt="" loading="lazy" className="h-full w-full object-contain" />
          ) : (
            <Package size={18} className="text-zinc-500" />
          )}
        </div>
      )}
      <div className="min-w-0">
        {links.storefront ? (
          <Link
            href={links.storefront}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm font-medium leading-5 text-blue-200 underline decoration-blue-300/25 underline-offset-4 hover:text-blue-100"
          >
            {item.title}
            <ExternalLink size={12} className="ml-1 inline" />
          </Link>
        ) : (
          <span className="text-sm font-medium text-zinc-200">{item.title}</span>
        )}
        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-zinc-400">
          {item.variantTitle && item.variantTitle !== "Default Title" && (
            <span>{item.variantTitle}</span>
          )}
          <span>{item.quantity} шт.</span>
          {item.sku && <span>SKU: {item.sku}</span>}
          {links.admin && (
            <Link
              href={links.admin}
              target="_blank"
              rel="noopener noreferrer"
              className="text-zinc-300 underline underline-offset-4"
            >
              В адмінці ↗
            </Link>
          )}
          {!links.storefront && !links.admin && <span>Без сторінки в каталозі</span>}
        </div>
      </div>
    </div>
  );
}
