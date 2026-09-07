export const calls = globalThis.__fitmentEvidenceCalls ?? (globalThis.__fitmentEvidenceCalls = []);
const product = {
  id: "p1",
  slug: "burger-bmw-m5-g90",
  sku: "BMS-G90",
  scope: "auto",
  brand: "Burger Motorsports",
  vendor: "Burger Motorsports",
  productType: "Intake",
  tags: ["BMW", "M5", "G90"],
  titleUa: "BMW M5 G90",
  titleEn: "BMW M5 G90",
  shortDescEn: "2025 BMW M5 G90 S68",
  shortDescUa: "BMW M5 G90",
  categoryUa: "Впуск",
  categoryEn: "Intake",
  collectionUa: "BMW",
  collectionEn: "BMW",
  stock: "inStock",
  priceUsd: 100,
  priceEur: 90,
  priceUah: 4000,
  image: "https://example.com/p.webp",
  collections: [
    {
      sortOrder: 1,
      collection: {
        id: "c1",
        handle: "bmw-m5-g90",
        titleUa: "BMW M5 G90",
        titleEn: "BMW M5 G90",
        brand: "Burger Motorsports",
        isUrban: false,
      },
    },
  ],
  variants: [
    {
      id: "v1",
      title: "2025 BMW M5 G90",
      sku: "BMS-G90-1",
      position: 1,
      option1Value: "BMW M5 G90",
      option2Value: "S68",
      option3Value: null,
      inventoryQty: 2,
      image: "https://example.com/v.webp",
      isDefault: true,
      priceUsd: 120,
    },
  ],
};
function select(row, fields) {
  return Object.fromEntries(
    Object.entries(fields)
      .filter(([, choice]) => choice)
      .map(([key, choice]) => [
        key,
        typeof choice === "object" && choice.select
          ? Array.isArray(row[key])
            ? row[key].map((value) => select(value, choice.select))
            : select(row[key], choice.select)
          : (row[key] ?? null),
      ])
  );
}
export const prisma = {
  shopProduct: {
    async findMany(args) {
      calls.push(args);
      if (args.where.id?.gt) return [];
      return [select(product, args.select)];
    },
  },
};
