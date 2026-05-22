/**
 * One Company Forged — design catalog (MVP).
 *
 * Each design is a configurable wheel template. We do NOT cite the
 * inspiration brand here — only the OC name, geometry family, and base
 * price. The legal disclosure (replicas live in the catalog under our own
 * names) is published on /shop/forged/legal and acknowledged via checkbox
 * before quote submit.
 *
 * Numbers (basePriceEur, leadTime) are starting estimates. Calibrate with
 * the production team after first physical batch.
 */

import type { Material } from "@/lib/forged/configSchema";

export type ForgedDesignFamily = "spoke" | "mesh" | "split" | "twin-spoke" | "heritage-5";

export type ForgedDesignVisualSet = {
  heroImage: string;
  gallery: string[];
  wheelTransparentImage: string;
};

export type ForgedDesign = {
  /** URL slug — also used as PDP route param */
  slug: string;
  nameUa: string;
  nameEn: string;
  family: ForgedDesignFamily;
  /** One-paragraph description, OC tone of voice. UA only on MVP. */
  taglineUa: string;
  taglineEn: string;
  /** Hero image (JPG/PNG/WebP) shown on PDP and design picker.
   *  Use the same straight-on studio shot as wheelTransparentImage but
   *  with background — this is what the design grid card displays. */
  heroImage: string;
  /** Carousel/gallery for PDP */
  gallery: string[];
  /**
   * Straight-on studio photograph of the wheel as a transparent PNG —
   * THE single asset that powers the configurator preview. Composited
   * over a car photo (library or uploaded) at the wheel mask coords.
   * Required: the silhouette must be cleanly cut against transparency,
   * 1024×1024 minimum, square. One file per design is enough on MVP;
   * future versions can add a finishImageMap if customers ask.
   */
  wheelTransparentImage: string;
  /** Material-specific visual assets. These power the image-only configurator:
   *  the same design silhouette can be composited onto any car while still
   *  showing aluminium / magnesium / carbon material differences. */
  materialVisuals?: Partial<Record<Material, ForgedDesignVisualSet>>;
  /** Base price in EUR for an 18" set in stock aluminium brushed clear. */
  basePriceEur: number;
  /** Default lead-time in weeks for aluminium variant. Mg/Carbon add weeks
   *  via leadTime.ts offsets. */
  leadTimeWeeksAl: number;
  /** Whether this design is a replica-style or original OC. Used by the
   *  config flow to decide whether the replica acknowledgement checkbox
   *  is required (replicas) or merely informational (originals). */
  isReplicaStyle: boolean;
  /** Hidden legacy/concept designs remain resolvable for old drafts. */
  isCatalogVisible?: boolean;
};

export const FORGED_DESIGNS: ForgedDesign[] = [
  {
    slug: "oc-p101sc",
    nameUa: "OC Aero Split 101",
    nameEn: "OC Aero Split 101",
    family: "mesh",
    taglineUa:
      "Легкий моноблок із десятьма парними split-spoke променями, conical-face посадкою та глибокими кишенями навколо болтів. Стримана motorsport-геометрія для super-sedan, coupe та SUV fitment.",
    taglineEn:
      "Lightweight monoblock with ten paired split spokes, a conical face, and deep lug-pocket machining. Restrained motorsport geometry for super-sedan, coupe, and SUV fitments.",
    heroImage: "/forged/designs/oc-p101sc/hero.jpg",
    gallery: ["/forged/designs/oc-p101sc/01.jpg", "/forged/designs/oc-p101sc/02.jpg"],
    wheelTransparentImage: "/forged/designs/oc-p101sc/wheel.png",
    materialVisuals: buildMaterialVisuals("oc-p101sc"),
    basePriceEur: 1150,
    leadTimeWeeksAl: 10,
    isReplicaStyle: true,
    isCatalogVisible: true,
  },
  {
    slug: "oc-p104sc",
    nameUa: "OC Aero Split 104",
    nameEn: "OC Aero Split 104",
    family: "split",
    taglineUa:
      "Кований моноблок із чотирма парними split-spoke групами, агресивними кишенями під болти, широкими негативними площинами та посадкою для великих седанів, GT і SUV.",
    taglineEn:
      "Four-paired split-spoke forged monoblock with aggressive lug pockets, broad negative spaces, and large-car stance for executive sedans, GTs, and SUVs.",
    heroImage: "/forged/designs/oc-p104sc/hero.jpg",
    gallery: ["/forged/designs/oc-p104sc/01.jpg", "/forged/designs/oc-p104sc/02.jpg"],
    wheelTransparentImage: "/forged/designs/oc-p104sc/wheel.png",
    materialVisuals: buildMaterialVisuals("oc-p104sc"),
    basePriceEur: 1200,
    leadTimeWeeksAl: 10,
    isReplicaStyle: true,
    isCatalogVisible: true,
  },
  {
    slug: "oc-fd15",
    nameUa: "OC Imperial FD",
    nameEn: "OC Imperial FD",
    family: "twin-spoke",
    taglineUa:
      "Кований luxury multi-spoke моноблок із щільними фасетованими площинами, directional stance та посадкою для G-Class, RSQ8, S-Class і 7 Series. Стримана преміальна геометрія для великих SUV і представницьких седанів.",
    taglineEn:
      "Fully forged luxury multi-spoke monoblock with dense faceted spoke planes, directional stance, and proportions for G-Class, RSQ8, S-Class, and 7 Series fitments.",
    heroImage: "/forged/designs/oc-fd15/hero.jpg",
    gallery: ["/forged/designs/oc-fd15/01.jpg", "/forged/designs/oc-fd15/02.jpg"],
    wheelTransparentImage: "/forged/designs/oc-fd15/wheel.png",
    materialVisuals: buildMaterialVisuals("oc-fd15"),
    basePriceEur: 1350,
    leadTimeWeeksAl: 11,
    isReplicaStyle: true,
    isCatalogVisible: true,
  },
  {
    slug: "oc-pf13-rs",
    nameUa: "OC Motorsport PF13",
    nameEn: "OC Motorsport PF13",
    family: "split",
    taglineUa:
      "Motorsport-моноблок із topology-style webbing, гострими переходами спиць і глибокою concave-посадкою для трекового stance без зайвого візуального шуму.",
    taglineEn:
      "Motorsport monoblock with topology-style webbing, sharp spoke transitions, and a deep concave stance for focused track-inspired builds.",
    heroImage: "/forged/designs/oc-pf13-rs/hero.jpg",
    gallery: ["/forged/designs/oc-pf13-rs/01.jpg", "/forged/designs/oc-pf13-rs/02.jpg"],
    wheelTransparentImage: "/forged/designs/oc-pf13-rs/wheel.png",
    materialVisuals: buildMaterialVisuals("oc-pf13-rs"),
    basePriceEur: 1280,
    leadTimeWeeksAl: 11,
    isReplicaStyle: true,
    isCatalogVisible: true,
  },
  {
    slug: "oc-mv-cr05",
    nameUa: "OC Corsa CR05",
    nameEn: "OC Corsa CR05",
    family: "twin-spoke",
    taglineUa:
      "Кований split/twin-spoke дизайн з центральним hub undercut і тонкою спортивною геометрією для суперкарів, GT та виразних performance-проєктів.",
    taglineEn:
      "Forged split/twin-spoke design with a central hub undercut and thin performance geometry for supercars, GTs, and focused performance builds.",
    heroImage: "/forged/designs/oc-mv-cr05/hero.jpg",
    gallery: ["/forged/designs/oc-mv-cr05/01.jpg", "/forged/designs/oc-mv-cr05/02.jpg"],
    wheelTransparentImage: "/forged/designs/oc-mv-cr05/wheel.png",
    materialVisuals: buildMaterialVisuals("oc-mv-cr05"),
    basePriceEur: 1250,
    leadTimeWeeksAl: 11,
    isReplicaStyle: true,
    isCatalogVisible: true,
  },
  {
    slug: "forged-spoke-pro",
    nameUa: "Forged Spoke Pro",
    nameEn: "Forged Spoke Pro",
    family: "spoke",
    taglineUa:
      "Класичний п'ятиспицевий силует, виточений з єдиної заготовки. Невагомий, агресивний, нейтрально-преміальний. Працює і на M-серії, і на седані бізнес-класу.",
    taglineEn:
      "Classic five-spoke silhouette milled from a single billet. Light, aggressive, brand-agnostic. Works equally on an M car or a luxury sedan.",
    heroImage: "/forged/designs/forged-spoke-pro/hero.jpg",
    gallery: [
      "/forged/designs/forged-spoke-pro/01.jpg",
      "/forged/designs/forged-spoke-pro/02.jpg",
      "/forged/designs/forged-spoke-pro/03.jpg",
    ],
    wheelTransparentImage: "/forged/designs/forged-spoke-pro/wheel.png",
    materialVisuals: buildMaterialVisuals("forged-spoke-pro"),
    basePriceEur: 850,
    leadTimeWeeksAl: 9,
    isReplicaStyle: true,
    isCatalogVisible: false,
  },
  {
    slug: "forged-mesh-x",
    nameUa: "Forged Mesh X",
    nameEn: "Forged Mesh X",
    family: "mesh",
    taglineUa:
      "Глибокий мульти-плетений мотив, який працює як драматичне освітлення на дисках. Складніший CAM-цикл — звідси цінник, але саме цей силует робить авто впізнаваним з 30 метрів.",
    taglineEn:
      "Deep multi-mesh weave that catches light like a sculpted prism. More complex CAM cycle than a spoke design, hence the price — but it's the silhouette that makes the car recognisable from 30 metres.",
    heroImage: "/forged/designs/forged-mesh-x/hero.jpg",
    gallery: [
      "/forged/designs/forged-mesh-x/01.jpg",
      "/forged/designs/forged-mesh-x/02.jpg",
      "/forged/designs/forged-mesh-x/03.jpg",
    ],
    wheelTransparentImage: "/forged/designs/forged-mesh-x/wheel.png",
    materialVisuals: buildMaterialVisuals("forged-mesh-x"),
    basePriceEur: 1150,
    leadTimeWeeksAl: 11,
    isReplicaStyle: true,
    isCatalogVisible: false,
  },
  {
    slug: "forged-heritage-5",
    nameUa: "Forged Heritage 5",
    nameEn: "Forged Heritage 5",
    family: "heritage-5",
    taglineUa:
      "Спрощена п'ятипроменева геометрія з оголеною поверхнею центру — відсилка до ери 80-х. Сучасний кований процес, ретро-візуал. Особливо добре виглядає у бронзовому фініші.",
    taglineEn:
      "Stripped five-arm geometry with an exposed centre face — a nod to the late 80s. Modern forging, retro silhouette. Particularly strong in bronze.",
    heroImage: "/forged/designs/forged-heritage-5/hero.jpg",
    gallery: [
      "/forged/designs/forged-heritage-5/01.jpg",
      "/forged/designs/forged-heritage-5/02.jpg",
    ],
    wheelTransparentImage: "/forged/designs/forged-heritage-5/wheel.png",
    materialVisuals: buildMaterialVisuals("forged-heritage-5"),
    basePriceEur: 920,
    leadTimeWeeksAl: 10,
    isReplicaStyle: false,
    isCatalogVisible: false,
  },
  {
    slug: "forged-splitline",
    nameUa: "Forged Splitline",
    nameEn: "Forged Splitline",
    family: "split",
    taglineUa:
      "Здвоєний промінь з контрастним розрізом по центру кожної спиці. Один з найдинамічніших профілів в каталозі, особливо у сатиновому графіті з кольоровим розрізом.",
    taglineEn:
      "Twinned arm with a contrasting split running down each spoke. One of the most dynamic silhouettes in our catalogue, especially in satin graphite with a coloured split.",
    heroImage: "/forged/designs/forged-splitline/hero.jpg",
    gallery: [
      "/forged/designs/forged-splitline/01.jpg",
      "/forged/designs/forged-splitline/02.jpg",
    ],
    wheelTransparentImage: "/forged/designs/forged-splitline/wheel.png",
    materialVisuals: buildMaterialVisuals("forged-splitline"),
    basePriceEur: 1080,
    leadTimeWeeksAl: 10,
    isReplicaStyle: true,
    isCatalogVisible: false,
  },
  {
    slug: "forged-twin-spoke",
    nameUa: "Forged Twin-Spoke",
    nameEn: "Forged Twin-Spoke",
    family: "twin-spoke",
    taglineUa:
      "Десятипроменевий силует з парним групуванням спиць — компроміс між легкістю меш-дизайну і чистотою класичного спайкового профілю. Універсальний, безпечний вибір для седана.",
    taglineEn:
      "Ten-arm pattern with paired spoke grouping — a balance between mesh weightlessness and classic spoke clarity. Safe, universal, unobtrusive on a sedan.",
    heroImage: "/forged/designs/forged-twin-spoke/hero.jpg",
    gallery: [
      "/forged/designs/forged-twin-spoke/01.jpg",
      "/forged/designs/forged-twin-spoke/02.jpg",
    ],
    wheelTransparentImage: "/forged/designs/forged-twin-spoke/wheel.png",
    materialVisuals: buildMaterialVisuals("forged-twin-spoke"),
    basePriceEur: 980,
    leadTimeWeeksAl: 9,
    isReplicaStyle: true,
    isCatalogVisible: false,
  },
];

export function findForgedDesign(slug: string): ForgedDesign | undefined {
  return FORGED_DESIGNS.find((d) => d.slug === slug);
}

export const FORGED_BRAND_NAME = "One Company Forged";

export function getForgedDesignVisual(
  design: ForgedDesign,
  material: Material = "aluminium"
): ForgedDesignVisualSet {
  return (
    design.materialVisuals?.[material] ??
    design.materialVisuals?.aluminium ?? {
      heroImage: design.heroImage,
      gallery: design.gallery,
      wheelTransparentImage: design.wheelTransparentImage,
    }
  );
}

function buildMaterialVisuals(slug: string): Record<Material, ForgedDesignVisualSet> {
  return {
    aluminium: buildVisualSet(slug, "aluminium"),
    magnesium: buildVisualSet(slug, "magnesium"),
    carbon: buildVisualSet(slug, "carbon"),
  };
}

function buildVisualSet(slug: string, material: Material): ForgedDesignVisualSet {
  const base = `/forged/designs/${slug}/materials/${material}`;
  return {
    heroImage: `${base}/hero.jpg`,
    gallery: [`${base}/01.jpg`, `${base}/02.jpg`, `${base}/03.jpg`],
    wheelTransparentImage: `${base}/wheel.png`,
  };
}
