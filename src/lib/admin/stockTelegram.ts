export type StockExportProduct = {
  id: string;
  titleEn: string;
  titleUa: string;
  brand: string | null;
  sku: string | null;
  stock: string;
};
const clean = (value: string | null | undefined) =>
  (value ?? "")
    .replace(/[\r\n\t]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

/** Plain text is intentional: pasting Markdown into Telegram would expose its syntax. */
export function stockTelegramText(products: StockExportProduct[], language: "en" | "ua" = "en") {
  const unique = [
    ...new Map(products.filter((p) => p.stock === "inStock").map((p) => [p.id, p])).values(),
  ];
  if (!unique.length) return "";
  const groups = new Map<string, StockExportProduct[]>();
  for (const product of unique) {
    const brand = clean(product.brand) || "Інші товари";
    const key =
      [...groups.keys()].find((entry) => entry.toLowerCase() === brand.toLowerCase()) ?? brand;
    groups.set(key, [...(groups.get(key) ?? []), product]);
  }
  const sections = [...groups.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([brand, entries]) => {
      const lines = entries.map((product) => {
        let name = clean(
          language === "en"
            ? product.titleEn || product.titleUa
            : product.titleUa || product.titleEn
        );
        const sku = clean(product.sku);
        // Remove only exact leading metadata; preserve model codes and the rest of the catalog name.
        for (const prefix of [brand, sku]) {
          if (prefix && name.toLowerCase().startsWith(`${prefix.toLowerCase()} `))
            name = name.slice(prefix.length).trim();
        }
        return `• ${name || sku || "Товар"}${sku ? `\n  Артикул: ${sku}` : ""}`;
      });
      return `${brand.toUpperCase()}\n\n${lines.join("\n\n")}`;
    });
  return `В НАЯВНОСТІ\n\n${sections.join("\n\n─────\n\n")}`;
}

/** Split at product boundaries so each copy action produces a short, readable message. */
export function splitTelegramText(text: string, limit = 3800): string[] {
  if (!text) return [];
  const blocks = text.split("\n\n");
  const chunks: string[] = [];
  let current = "";
  for (let block of blocks) {
    if (current && current.length + block.length + 2 > limit) {
      chunks.push(current);
      current = "";
    }
    while (block.length > limit) {
      chunks.push(block.slice(0, limit));
      block = block.slice(limit);
    }
    current += `${current ? "\n\n" : ""}${block}`;
  }
  if (current) chunks.push(current);
  return chunks;
}
