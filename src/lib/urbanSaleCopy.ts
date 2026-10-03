export function cleanUrbanSpoilerEditorialText(value: string | null | undefined) {
  return (value ?? "")
    .replace(/<li>[^<]*(?:Галерея без підміни фото іншими моделями|Gallery[^<]*(?:other models|substitution))[^<]*<\/li>/gi, "")
    .replace(/Фото підібрані[^.<>]*\./g, "")
    .replace(/(?:Photos?|Images)\s+(?:are|were)\s+(?:selected|curated|chosen)[^.<>]*\./gi, "")
    .replace(/Галерея без підміни фото іншими моделями\./g, "")
    .replace(/\bGallery[^.<>]*(?:other models|substitution)[^.<>]*\.?/gi, "")
    .replace(/<(p|li)>\s*<\/\1>/g, "")
    .replace(/ {2,}/g, " ")
    .trim();
}

export function urbanDecalSalesRestriction(locale: "ua" | "en") {
  return locale === "ua" ? "Цей комплект декалей доступний лише разом з обвісом Urban для Defender 90/110. Для замовлення комплекту зверніться до менеджера." : "This decal pack is available only together with an Urban body kit for the Defender 90/110. Contact a manager to order the package.";
}
