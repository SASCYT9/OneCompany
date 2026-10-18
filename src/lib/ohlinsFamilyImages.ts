/**
 * Öhlins products that came from the supplier without a photo show a photo of
 * their own product family instead of the generic brand picture (the supplier
 * already does this for springs). The family is read from the title: TTX kits,
 * single road or off-road dampers, springs, helper springs, top mounts and
 * EDC cancellation kits. Anything else keeps the generic brand image.
 *
 * The photos are representative, not of the exact item, so Merchant Center
 * gets no such products (see `imagePlaceholder` on ShopProduct).
 */
const MEDIA = "https://rfip333zgtfizdii.public.blob.vercel-storage.com/media/library/shop-products";

export const OHLINS_FAMILY_IMAGES = {
  /** NIR GN00 Advanced Trackday TTX kit. */
  ttxKit: `${MEDIA}/86bcb60702dbb740dec0b41c50246230f83a5868dbecc2a81074c8eddf572fc4`,
  /** SEF 5Q00 single damper. */
  roadDamper: `${MEDIA}/2bec01f0332dbe06d3151c77e2d7c559334a9a3559fe46a904f8625cc73f3f26`,
  /** ISV 1X00 Adventure damper. */
  offRoadDamper: `${MEDIA}/def2ab5a9b455a90db35853859723a9bd0cd7a73c35ad2e8c35ac5eb5f399e0e`,
  /** 62473-04 main spring. */
  spring: `${MEDIA}/d1df43087b98c47740a841f3ec590d1bb55fbbc71dd951653c2ef7c0cb5f055b`,
  /** 05173-12 helper springs. */
  helperSpring: `${MEDIA}/c76cbe00461c0c8b4a82e956906940279b27eb6c20779f936732978aa0ed8ce6`,
  /** 05926-21 top mounts. */
  topMounts: `${MEDIA}/556545dc72ee0b1480b34dea4355432e129e38c4da9f620432728b5ab08b1b92`,
  /** 35020-38 EDC cancellation kit. */
  cancelKit: `${MEDIA}/b279b5f360038ae56d29e6c70aba05b1c66f804f3918779f77a8dc057972b0ef`,
} as const;

const OFF_ROAD =
  /off-?road|adventure|ліфт|\blift\b|ranger|everest|hilux|land ?cruiser|prado|fortuner|4runner|tacoma|tundra|d-?max|mu-?x|navara|patrol|pajero|triton|l200|wrangler|gladiator|defender|discovery|grenadier|amarok|raptor|bronco/i;

export function isOhlinsBrand(brand: string | null | undefined): boolean {
  return (
    String(brand ?? "")
      .normalize("NFKD")
      .replace(/[̀-ͯ]/g, "")
      .trim()
      .toUpperCase() === "OHLINS"
  );
}

/** The family photo for an Öhlins product without a photo of its own, or null. */
export function resolveOhlinsFamilyImage(product: {
  brand: string | null | undefined;
  title: string | null | undefined;
}): string | null {
  if (!isOhlinsBrand(product.brand)) return null;
  const title = String(product.title ?? "");
  // Brackets, bearings, adapters, adjusters and tools look like nothing else
  // here. ("ключ" as a whole word: "включаючи" is part of most kit titles.)
  if (
    /кронштейн|bracket|підшипник|bearing|адаптер|adapter|регулятор|adjuster|інструмент|\btool|(?<![а-яіїєґ])ключ(?![а-яіїєґ])/i.test(
      title
    )
  ) {
    return null;
  }
  if (/скасуван|cancell?ation/i.test(title)) return OHLINS_FAMILY_IMAGES.cancelKit;
  if (/TTX|Advanced Trackday/i.test(title)) return OHLINS_FAMILY_IMAGES.ttxKit;
  if (/верхн\S*\s+(кріплен|опор)|опор\S*\s+амортизатор|top mount/i.test(title)) {
    return OHLINS_FAMILY_IMAGES.topMounts;
  }
  // The item is whichever comes first: "Задній амортизатор (пружини окремо)"
  // is a damper, "Пружина для амортизатора INV MZ00" is a spring.
  const damperAt = title.search(/амортизатор|damper|shock/i);
  const springAt = title.search(/пружин|\bspring/i);
  if (springAt >= 0 && (damperAt < 0 || springAt < damperAt)) {
    return /допоміжн\S*\s+пружин|helper spring/i.test(title)
      ? OHLINS_FAMILY_IMAGES.helperSpring
      : OHLINS_FAMILY_IMAGES.spring;
  }
  if (damperAt >= 0 && !/комплект|\bkit\b|до-т/i.test(title)) {
    return OFF_ROAD.test(title)
      ? OHLINS_FAMILY_IMAGES.offRoadDamper
      : OHLINS_FAMILY_IMAGES.roadDamper;
  }
  return null;
}
