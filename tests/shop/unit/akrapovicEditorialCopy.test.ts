import test from "node:test";
import assert from "node:assert/strict";

import {
  buildAkrapovicEditorialCopy,
  extractAkrapovicSkuFromTitle,
} from "../../../src/lib/akrapovicEditorialCopy";

const baseInput = {
  slug: "",
  titleEn: "",
};

test("extractAkrapovicSkuFromTitle pulls the SKU prefix in canonical form", () => {
  assert.equal(
    extractAkrapovicSkuFromTitle(
      "AKRAPOVIC S-ME/T/13H Slip-On Line Exhaust System (Titanium) for MERCEDES-AMG C63 (W205)"
    ),
    "S-ME/T/13H"
  );
  assert.equal(
    extractAkrapovicSkuFromTitle("AKRAPOVIC s-bm/ti/33h Slip-On Line for BMW M3 (G80)"),
    "S-BM/TI/33H"
  );
  assert.equal(
    extractAkrapovicSkuFromTitle(
      "AKRAPOVIC MTP-ME/T/2H/1 Evolution Line (Titanium) Exhaust System for MERCEDES C63"
    ),
    "MTP-ME/T/2H/1"
  );
  assert.equal(extractAkrapovicSkuFromTitle("Random title without SKU"), null);
  assert.equal(extractAkrapovicSkuFromTitle(null), null);
  assert.equal(extractAkrapovicSkuFromTitle(""), null);
});

test("buildAkrapovicEditorialCopy: Slip-On Line keeps Latin product line and adds vehicle phrase", () => {
  const copy = buildAkrapovicEditorialCopy({
    ...baseInput,
    slug: "akrapovic-s-bm-ti-33h",
    titleEn: "AKRAPOVIC S-BM/TI/33H Slip-On Line Exhaust System (Titanium) for BMW M3 (G80)",
    brand: "AKRAPOVIC",
  });

  assert.match(copy.titleUa, /^Slip-On Line — Akrapovič для /);
  assert.match(copy.titleUa, /BMW/);
  assert.match(copy.titleUa, /G80/);
  assert.ok(!copy.titleUa.includes("Urban Automotive"));
  assert.match(copy.shortDescUa, /Axleback/);
  assert.match(copy.shortDescUa, /задні глушники/);
});

test("buildAkrapovicEditorialCopy: Evolution Line uses Cat-Back terminology in concept bullet", () => {
  const copy = buildAkrapovicEditorialCopy({
    ...baseInput,
    slug: "akrapovic-mtp-me-t-2h-1",
    titleEn:
      "AKRAPOVIC MTP-ME/T/2H/1 Evolution Line (Titanium) Exhaust System for MERCEDES C63 AMG / C63S (W205 / S205) 2015-2018",
    brand: "AKRAPOVIC",
  });

  assert.match(copy.titleUa, /^Evolution Line — Akrapovič для /);
  assert.match(copy.titleUa, /Mercedes/);
  assert.match(copy.shortDescUa, /Cat-Back/);
  assert.match(copy.bodyHtmlUa, /MTP-ME\/T\/2H\/1/);
  assert.match(copy.bodyHtmlUa, /Titanium/);
  // No Urban-voice leak.
  assert.ok(!/Urban Automotive/.test(copy.bodyHtmlUa));
  assert.ok(!/стриман/.test(copy.bodyHtmlUa));
});

test("buildAkrapovicEditorialCopy: Tail Pipe Set is rendered with Cyrillic head and tip-flavored description", () => {
  const copy = buildAkrapovicEditorialCopy({
    ...baseInput,
    slug: "akrapovic-tp-nir35c",
    titleEn:
      "AKRAPOVIC TP-NIR35C Exhaust Tailpipes (Carbon, 125mm Diameter) for NISSAN GT-R (R35) / CHEVROLET Corvette ZO6/ZR1 (C6)",
    brand: "AKRAPOVIC",
  });

  assert.match(copy.titleUa, /^Насадки вихлопу — Akrapovič для /);
  assert.match(copy.shortDescUa, /декоративних насадок/);
  assert.match(copy.bodyHtmlUa, /TP-NIR35C/);
});

test("buildAkrapovicEditorialCopy: Sound & Control Kit gets kit description, not exhaust copy", () => {
  const copy = buildAkrapovicEditorialCopy({
    ...baseInput,
    slug: "akrapovic-p-hf868",
    titleEn:
      "AKRAPOVIC P-HF868 Valve Actuator Kit for CHEVROLET Corvette Stingray / Grand Sport (C7)",
    brand: "AKRAPOVIC",
  });

  assert.match(copy.titleUa, /^Sound & Control Kit — Akrapovič для /);
  assert.match(copy.shortDescUa, /модуль керування заслінками/);
});

test('buildAkrapovicEditorialCopy: title without "for ..." phrase still produces a clean H1', () => {
  const copy = buildAkrapovicEditorialCopy({
    ...baseInput,
    slug: "akrapovic-cap",
    titleEn: "AKRAPOVIC Cap Black",
    brand: "AKRAPOVIC",
  });

  // "Cap" matches `accessories` in LINE_PATTERNS.
  assert.match(copy.titleUa, /Akrapovič$/);
  assert.ok(!copy.titleUa.includes("для "));
});

test("buildAkrapovicEditorialCopy: Racing Line is parsed and rendered with display name and description", () => {
  const copy = buildAkrapovicEditorialCopy({
    ...baseInput,
    slug: "akrapovic-s-b10r5-aplt-1",
    titleEn: "AKRAPOVIC S-B10R5-APLT/1 Racing Line (Titanium) for BMW S 1000 RR (2019-2024)",
    brand: "AKRAPOVIC",
  });

  assert.match(copy.titleUa, /^Racing Line — Akrapovič для /);
  assert.match(copy.titleUa, /BMW/);
  assert.match(copy.shortDescUa, /нержавіючої сталі/);
  assert.match(copy.bodyHtmlUa, /S-B10R5-APLT\/1/);
});

test("buildAkrapovicEditorialCopy: headers and accessories are parsed correctly", () => {
  const headerTi = buildAkrapovicEditorialCopy({
    ...baseInput,
    slug: "akrapovic-e-b10e8",
    titleEn: "Akrapovič Optional Header (Titanium) for BMW S 1000 RR (2019-2026) (E-B10E8)",
    brand: "AKRAPOVIC",
  });
  assert.match(headerTi.titleUa, /^Optional Header \(Titanium\) — Akrapovič для /);
  assert.match(headerTi.shortDescUa, /титану/);

  const headerSs = buildAkrapovicEditorialCopy({
    ...baseInput,
    slug: "akrapovic-e-b10r7",
    titleEn: "Akrapovič Optional Header (SS) for BMW S 1000 RR (2019-2026) (E-B10R7)",
    brand: "AKRAPOVIC",
  });
  assert.match(headerSs.titleUa, /^Optional Header \(SS\) — Akrapovič для /);
  assert.match(headerSs.shortDescUa, /нержавіючої сталі/);

  const heatShield = buildAkrapovicEditorialCopy({
    ...baseInput,
    slug: "akrapovic-p-hsb10e3",
    titleEn: "Akrapovič Heat Shield (Carbon) for BMW S 1000 RR (2019-2026) (P-HSB10E3)",
    brand: "AKRAPOVIC",
  });
  assert.match(heatShield.titleUa, /^Carbon Heat Shield — Akrapovič для /);
  assert.match(heatShield.shortDescUa, /вуглецевого волокна/);

  const damper = buildAkrapovicEditorialCopy({
    ...baseInput,
    slug: "akrapovic-v-tuv111",
    titleEn: "Akrapovič Optional noise damper for BMW S 1000 RR (2019-2026) (V-TUV111)",
    brand: "AKRAPOVIC",
  });
  assert.match(damper.titleUa, /^Noise Damper — Akrapovič для /);

  const bars = buildAkrapovicEditorialCopy({
    ...baseInput,
    slug: "akrapovic-cb-b13t1",
    titleEn:
      "Akrapovič Protection Bar Set (Titanium) for BMW R 1300 GS / ADVENTURE (2023-2026) (CB-B13T1)",
    brand: "AKRAPOVIC",
  });
  assert.match(bars.titleUa, /^Protection Bars — Akrapovič для /);
  assert.match(bars.shortDescUa, /захисних дуг/);

  const footpegs = buildAkrapovicEditorialCopy({
    ...baseInput,
    slug: "akrapovic-f-bm13t1",
    titleEn:
      "Akrapovič Adventure Footpeg Set (Titanium) for BMW R 1300 GS / ADVENTURE (2024-2026) (F-BM13T1)",
    brand: "AKRAPOVIC",
  });
  assert.match(footpegs.titleUa, /^Footpegs — Akrapovič для /);
  assert.match(footpegs.shortDescUa, /туристичних підніжок/);

  const plug = buildAkrapovicEditorialCopy({
    ...baseInput,
    slug: "akrapovic-p-guv007",
    titleEn: "AKRAPOVIC P-GUV007 Пробка для миття вихлопної системи",
    brand: "AKRAPOVIC",
  });
  assert.match(plug.titleUa, /^Accessory — Akrapovič/);
});
