import { load } from "cheerio";
import type { Element } from "domhandler";
import { sanitizeRichTextHtml } from "@/lib/sanitizeRichTextHtml";

export type ShopProductDescriptionSpec = {
  label: string;
  value: string;
};

export type ShopProductDescriptionSections = {
  introHtml: string;
  features: string[];
  included: string[];
  excluded: string[];
  specs: ShopProductDescriptionSpec[];
};

type SectionKind = "features" | "included" | "excluded";

const FEATURES_HEADINGS = [
  /^key features:?$/i,
  /^main features:?$/i,
  /^features:?$/i,
  /^основні характеристики:?$/i,
  /^ключові характеристики:?$/i,
  /^ключові переваги:?$/i,
  /^переваги:?$/i,
  /^advantages:?$/i,
  /^advantages of.*$/i,
  /^переваги високопродуктивного.*$/i,
];

const INCLUDED_HEADINGS = [
  /^what'?s included:?$/i,
  /^included in the package:?$/i,
  /^includes:?$/i,
  /^included:?$/i,
  /^package details:?$/i,
  /^kit contents:?$/i,
  /^package contents:?$/i,
  /^in the box:?$/i,
  /^у комплекті:?$/i,
  /^в комплекті:?$/i,
  /^включає:?$/i,
  /^що входить:?$/i,
  /^комплектація:?$/i,
  /^комплектація \(деталі\):?$/i,
  /^деталі комплекту:?$/i,
];

const EXCLUDED_HEADINGS = [
  /^not included:?$/i,
  /^does not include:?$/i,
  /^excluded:?$/i,
  /^що не входить:?$/i,
  /^не входить:?$/i,
  /^що не включає:?$/i,
  /^не включає:?$/i,
];

const SPEC_LABELS = [
  /^part number$/i,
  /^article no\.?$/i,
  /^sku$/i,
  /^body kit brand$/i,
  /^vehicle make$/i,
  /^car brand$/i,
  /^brand$/i,
  /^model$/i,
  /^collection$/i,
  /^finish$/i,
  /^material$/i,
  /^fitment$/i,
  /^type$/i,
  /^category$/i,
  /^origin$/i,
  /^country of origin$/i,
  /^manufactured in$/i,
  /^chassis$/i,
  /^platform$/i,
  /^application$/i,
  /^engine$/i,
  /^key spec(ification)?$/i,
  /^артикул$/i,
  /^бренд обвісу$/i,
  /^марка авто$/i,
  /^бренд$/i,
  /^модель$/i,
  /^колекція$/i,
  /^покриття$/i,
  /^матеріал$/i,
  /^сумісність$/i,
  /^тип$/i,
  /^категорія$/i,
  /^походження$/i,
  /^країна походження$/i,
  /^виробник$/i,
  /^шасі$/i,
  /^платформа$/i,
  /^застосування$/i,
  /^двигун$/i,
  /^ключова специфікація$/i,
];

const SPEC_LABEL_HINT_RE = /^[\p{L}][\p{L}0-9 .,/&()-]{1,40}$/u;

function normalizeText(value: string | null | undefined) {
  return String(value ?? "")
    .replace(/\u00a0/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function pushUnique(target: string[], values: string[]) {
  for (const value of values) {
    const normalized = normalizeText(value)
      .replace(/^[-*•—–]+\s*/, "")
      .trim();

    if (!normalized) {
      continue;
    }

    if (!target.includes(normalized)) {
      target.push(normalized);
    }
  }
}

function detectSectionHeading(text: string): SectionKind | null {
  const normalized = normalizeText(text);

  if (FEATURES_HEADINGS.some((pattern) => pattern.test(normalized))) {
    return "features";
  }

  if (INCLUDED_HEADINGS.some((pattern) => pattern.test(normalized))) {
    return "included";
  }

  if (EXCLUDED_HEADINGS.some((pattern) => pattern.test(normalized))) {
    return "excluded";
  }

  return null;
}

function parseSpec(
  text: string,
  options: { lenient?: boolean } = {}
): ShopProductDescriptionSpec | null {
  const normalized = normalizeText(text);
  const separatorIndex = normalized.indexOf(":");

  if (separatorIndex <= 0) {
    return null;
  }

  const label = normalizeText(normalized.slice(0, separatorIndex));
  const value = normalizeText(normalized.slice(separatorIndex + 1));

  if (!label || !value) {
    return null;
  }

  if (SPEC_LABELS.some((pattern) => pattern.test(label))) {
    return { label, value };
  }

  if (options.lenient && SPEC_LABEL_HINT_RE.test(label) && !value.includes(":")) {
    return { label, value };
  }

  return null;
}

function splitInlineItems(value: string) {
  return value
    .split(/\s*(?:\||•|·|;|\n)\s*/)
    .map((item) => item.replace(/^[-*•—–]+\s*/, ""))
    .map((item) => normalizeText(item))
    .filter(Boolean);
}

function parsePrefixedSection(text: string): { section: SectionKind; items: string[] } | null {
  const normalized = normalizeText(text);
  const patterns: Array<{ section: SectionKind; matchers: RegExp[] }> = [
    { section: "features", matchers: FEATURES_HEADINGS },
    { section: "included", matchers: INCLUDED_HEADINGS },
    { section: "excluded", matchers: EXCLUDED_HEADINGS },
  ];

  for (const { section, matchers } of patterns) {
    for (const matcher of matchers) {
      const heading = normalized.match(matcher)?.[0];
      if (!heading) {
        continue;
      }

      const remainder = normalizeText(normalized.slice(heading.length));
      if (!remainder) {
        return { section, items: [] };
      }

      return { section, items: splitInlineItems(remainder) };
    }
  }

  return null;
}

function pushToSection(
  target: ShopProductDescriptionSections,
  section: SectionKind,
  items: string[]
) {
  if (section === "features") {
    pushUnique(target.features, items);
    return;
  }

  if (section === "included") {
    pushUnique(target.included, items);
    return;
  }

  pushUnique(target.excluded, items);
}

function createEmptySections(): ShopProductDescriptionSections {
  return {
    introHtml: "",
    features: [],
    included: [],
    excluded: [],
    specs: [],
  };
}

function parseHtmlDescription(source: string): ShopProductDescriptionSections {
  const sections = createEmptySections();
  const sanitizedSource = sanitizeRichTextHtml(source);
  const $ = load(`<body>${sanitizedSource}</body>`);
  const introFragments: string[] = [];
  let activeSection: SectionKind | null = null;
  let lastIntroFragmentWasCustomHeading = false;
  // A short "Heading:" paragraph kept in the intro (e.g. "🔧 Комплектація:").
  // When the content right after it moves to a section panel, the heading is
  // left empty in the intro, so it is dropped.
  let pendingIntroHeading: number | null = null;
  const emptyIntroHeadings = new Set<number>();

  const visit = (element: Element) => {
    const tagName = element.tagName?.toLowerCase() ?? "";
    const childElements = $(element).children().toArray();

    if (["div", "section", "article"].includes(tagName) && childElements.length > 0) {
      childElements.forEach((child) => visit(child));
      return;
    }

    const text = normalizeText($(element).text());

    if (!text) {
      return;
    }

    const introLengthBefore = introFragments.length;
    visitContent(element, tagName, text);
    if (introFragments.length === introLengthBefore) {
      if (pendingIntroHeading !== null) emptyIntroHeadings.add(pendingIntroHeading);
      pendingIntroHeading = null;
    } else {
      pendingIntroHeading =
        tagName === "p" && text.length <= 60 && text.endsWith(":") ? introLengthBefore : null;
    }
  };

  const visitContent = (element: Element, tagName: string, text: string) => {
    const sectionHeading = detectSectionHeading(text);
    if (sectionHeading && (/^h[1-6]$/.test(tagName) || tagName === "p" || tagName === "div")) {
      activeSection = sectionHeading;
      lastIntroFragmentWasCustomHeading = false;
      return;
    }

    if (tagName === "ul" || tagName === "ol") {
      const items = $(element)
        .find("li")
        .map((__, item) => normalizeText($(item).text()))
        .get()
        .filter(Boolean);

      if (items.length > 0) {
        if (activeSection) {
          pushToSection(sections, activeSection, items);
          lastIntroFragmentWasCustomHeading = false;
          return;
        }

        if (lastIntroFragmentWasCustomHeading) {
          introFragments.push($.html(element));
          lastIntroFragmentWasCustomHeading = false;
          return;
        }

        // Detect spec-style list: most/all items look like "Label: Value"
        const parsedSpecs = items
          .map((item) => parseSpec(item, { lenient: true }))
          .filter((spec): spec is ShopProductDescriptionSpec => spec !== null);

        if (parsedSpecs.length >= 2 && parsedSpecs.length >= items.length - 1) {
          parsedSpecs.forEach((spec) => {
            if (
              !sections.specs.some(
                (existing) => existing.label === spec.label && existing.value === spec.value
              )
            ) {
              sections.specs.push(spec);
            }
          });
          lastIntroFragmentWasCustomHeading = false;
          return;
        }

        // Otherwise treat as feature bullets
        pushUnique(sections.features, items);
        lastIntroFragmentWasCustomHeading = false;
        return;
      }
    }

    const prefixedSection = parsePrefixedSection(text);
    if (prefixedSection) {
      activeSection = prefixedSection.section;
      if (prefixedSection.items.length > 0) {
        pushToSection(sections, prefixedSection.section, prefixedSection.items);
      }
      lastIntroFragmentWasCustomHeading = false;
      return;
    }

    const spec = parseSpec(text);
    if (spec) {
      if (!sections.specs.some((item) => item.label === spec.label && item.value === spec.value)) {
        sections.specs.push(spec);
      }
      lastIntroFragmentWasCustomHeading = false;
      return;
    }

    if (activeSection && tagName === "p") {
      const listItems = splitInlineItems(text);
      if (listItems.length > 1) {
        pushToSection(sections, activeSection, listItems);
        lastIntroFragmentWasCustomHeading = false;
        return;
      }
    }

    introFragments.push($.html(element));
    lastIntroFragmentWasCustomHeading = /^h[1-6]$/.test(tagName);
  };

  $("body")
    .children()
    .toArray()
    .forEach((element) => visit(element));
  if (pendingIntroHeading !== null) emptyIntroHeadings.add(pendingIntroHeading);

  sections.introHtml = introFragments
    .filter((_, index) => !emptyIntroHeadings.has(index))
    .join("")
    .trim();
  return sections;
}

function parsePlainTextDescription(source: string): ShopProductDescriptionSections {
  const sections = createEmptySections();
  const introLines: string[] = [];
  let activeSection: SectionKind | null = null;

  source
    .split(/\n+/)
    .map((line) => normalizeText(line))
    .filter(Boolean)
    .forEach((line) => {
      const sectionHeading = detectSectionHeading(line);
      if (sectionHeading) {
        activeSection = sectionHeading;
        return;
      }

      const prefixedSection = parsePrefixedSection(line);
      if (prefixedSection) {
        activeSection = prefixedSection.section;
        pushToSection(sections, prefixedSection.section, prefixedSection.items);
        return;
      }

      const spec = parseSpec(line);
      if (spec) {
        sections.specs.push(spec);
        return;
      }

      if (activeSection && /^[-*•—–]/.test(line)) {
        pushToSection(sections, activeSection, [line]);
        return;
      }

      introLines.push(line);
    });

  sections.introHtml = introLines.map((line) => `<p>${escapeHtml(line)}</p>`).join("");
  return sections;
}

/**
 * The whole description as safe HTML, in its original order. Pages without
 * separate feature/spec panels use this instead of the extracted sections,
 * whose lists they would otherwise drop while keeping the lists' headings.
 */
export function buildShopProductDescriptionHtml(source: string | null | undefined) {
  const normalized = String(source ?? "").trim();
  if (!normalized) {
    return "";
  }

  if (/<[a-z][\s\S]*>/i.test(normalized)) {
    return sanitizeRichTextHtml(normalized).trim();
  }

  const blocks: string[] = [];
  let listItems: string[] = [];
  const flushList = () => {
    if (listItems.length) {
      blocks.push(`<ul>${listItems.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>`);
      listItems = [];
    }
  };

  for (const line of normalized.split(/\n+/).map((value) => normalizeText(value))) {
    if (!line) continue;
    const bullet = line.match(/^[-*•—–]+\s*(.+)$/);
    if (bullet) {
      listItems.push(bullet[1]);
      continue;
    }
    flushList();
    blocks.push(`<p>${escapeHtml(line)}</p>`);
  }
  flushList();

  return blocks.join("");
}

export function extractShopProductDescriptionSections(source: string | null | undefined) {
  const normalized = String(source ?? "").trim();
  if (!normalized) {
    return createEmptySections();
  }

  if (/<[a-z][\s\S]*>/i.test(normalized)) {
    return parseHtmlDescription(normalized);
  }

  return parsePlainTextDescription(normalized);
}
