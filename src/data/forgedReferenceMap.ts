/**
 * Internal production map for One Company Forged visual assets.
 *
 * These reference sources are NOT shown in the public UI. They are used as
 * geometry direction for generated OC-branded assets: the output must carry
 * only One Company branding and OC catalog names.
 */

export type ForgedReferenceMapItem = {
  slug: string;
  ocName: string;
  sourceBrand: string;
  sourceModel: string;
  sourceUrl: string;
  geometryBrief: string;
};

export const FORGED_REFERENCE_MAP: ForgedReferenceMapItem[] = [
  {
    slug: "forged-spoke-pro",
    ocName: "Forged Spoke Pro",
    sourceBrand: "HRE",
    sourceModel: "P101SC",
    sourceUrl: "https://www.hrewheels.com/wheels/series-p1sc/p101sc",
    geometryBrief:
      "premium monoblock split-spoke forged wheel, ten paired I-beam spokes, aggressive side cuts, conical profile, milled lug pockets and outer lip reliefs",
  },
  {
    slug: "forged-mesh-x",
    ocName: "Forged Mesh X",
    sourceBrand: "BBS",
    sourceModel: "LM / LM-R family",
    sourceUrl: "https://bbs-japan.co.jp/en/products/1142/",
    geometryBrief:
      "dense motorsport mesh wheel with deep lip, two-piece visual structure, diamond-cut outer rim, intersecting thin spokes, classic endurance-racing proportions",
  },
  {
    slug: "forged-heritage-5",
    ocName: "Forged Heritage 5",
    sourceBrand: "HRE",
    sourceModel: "Classic 305M",
    sourceUrl: "https://www.hrewheels.com/wheels/classic-series/305m",
    geometryBrief:
      "classic five-spoke forged monoblock, broad sculpted arms, exposed center face, low/medium face profile, modern CNC pocketing",
  },
  {
    slug: "forged-splitline",
    ocName: "Forged Splitline",
    sourceBrand: "HRE",
    sourceModel: "S104SC / P104SC",
    sourceUrl: "https://www.hrewheels.com/wheels/series-s1sc/s104sc",
    geometryBrief:
      "four twin-spoke split architecture with fastener-flange surfacing, two-piece FMR visual language, polished barrel, champagne/dark center contrast",
  },
  {
    slug: "forged-twin-spoke",
    ocName: "Forged Twin-Spoke",
    sourceBrand: "Vossen",
    sourceModel: "EVO forged family",
    sourceUrl: "https://vossenwheels.com/wheel/evo-4/",
    geometryBrief:
      "clean paired-spoke forged wheel, modern directional twin-arm grouping, deep concave face, minimalist luxury-performance proportions",
  },
];
