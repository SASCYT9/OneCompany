CREATE INDEX "ShopCatalogProjectionConstraint_product_exact_text_idx"
ON "ShopCatalogProjectionConstraint" (
  "productId",
  "dimension",
  "state",
  lower("textValue"),
  "targetKey",
  "clauseKey"
);
