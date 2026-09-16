import { Package } from "lucide-react";
import { useState, type ReactNode } from "react";
import { catalogImageSources } from "@/lib/admin/catalogImageSources";
import type { DraftPrices } from "@/lib/admin/proformaDraft";
import styles from "./proforma.module.css";

export type Customer = {
  id: string;
  email: string;
  fullName: string;
  group: string;
  companyName: string | null;
};
export type Variant = DraftPrices & {
  id: string;
  title: string | null;
  sku: string | null;
  image: string | null;
  isDefault: boolean;
};
export type Product = DraftPrices & {
  id: string;
  slug: string;
  titleUa: string;
  titleEn: string;
  sku: string | null;
  brand: string | null;
  stock: string;
  imageUrl?: string | null;
  imageSources?: string[];
  gallery?: string[];
  media?: { src: string; mediaType: string }[];
  image?: string | null;
  variants?: Variant[];
};
export type Line = {
  productId: string;
  productSlug: string;
  variantId: string | null;
  title: string;
  sku: string | null;
  image: string | null;
  imageSources?: string[];
  quantity: string;
  price: string;
};
export const money = (value: number, currency: string) =>
  new Intl.NumberFormat("uk-UA", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
export const productTitle = (product: Product) => product.titleUa || product.titleEn;
export const lineKey = (item: Pick<Line, "productId" | "variantId">) =>
  `${item.productId}:${item.variantId ?? ""}`;
export function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <label className={styles.field}>
      <span>{label}</span>
      {children}
      {hint && <small>{hint}</small>}
    </label>
  );
}
export function SectionTitle({
  number,
  title,
  description,
}: {
  number: string;
  title: string;
  description: string;
}) {
  return (
    <div className={styles.sectionTitle}>
      <span>{number}</span>
      <div>
        <h2>{title}</h2>
        <p>{description}</p>
      </div>
    </div>
  );
}
export function Thumbnail({
  src,
  sources = [],
}: {
  src: string | null | undefined;
  sources?: string[];
}) {
  const candidates = catalogImageSources([src, ...sources]);
  return <ThumbnailImage key={candidates.join("|")} candidates={candidates} />;
}
function ThumbnailImage({ candidates }: { candidates: string[] }) {
  const [index, setIndex] = useState(0);
  const src = candidates[index];
  // Admin media includes remote supplier URLs; use the browser directly, not the image optimizer.
  return (
    <span className={styles.thumbnail}>
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt="" loading="lazy" onError={() => setIndex((value) => value + 1)} />
      ) : (
        <Package size={21} />
      )}
    </span>
  );
}
