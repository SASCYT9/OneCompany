import assert from "node:assert/strict";
import test from "node:test";

import { getKwCardTitle } from "../../../src/lib/shopKwCardPresentation";

test("shortens a long multi-vehicle KW card title without exposing engine lists", () => {
  assert.equal(
    getKwCardTitle({
      brand: "KW Suspensions",
      locale: "ua",
      title: "Койловерна підвіска V3 Clubsport вкл. верхні опори — MERCEDES-BENZ A-CLASS Saloon (V177) F2A, MERCEDES-BENZ A-CLASS (W177) F2A, MERCEDES-BENZ CLA (C118) (AMG A 35…AMG CLA 45)",
    }),
    "Койловерна підвіска V3 Clubsport вкл. верхні опори — MERCEDES-BENZ A-CLASS Saloon та інші"
  );
});

test("keeps a concise single-vehicle KW title", () => {
  assert.equal(
    getKwCardTitle({
      brand: "KW",
      locale: "ua",
      title: "Койловерна підвіска V4 — PORSCHE TAYCAN",
    }),
    "Койловерна підвіска V4 — PORSCHE TAYCAN"
  );
});

test("compresses electronic damper cancellation wording", () => {
  assert.equal(
    getKwCardTitle({
      brand: "KW Suspensions",
      locale: "ua",
      title: "Койловер V3 inox (включаючи комплект для скасування електронних амортизаторів) — BMW M3 (G80)",
    }),
    "Койловер V3 inox з модулем деактивації — BMW M3"
  );
});

test("does not rewrite another brand title", () => {
  const title = "Long title — Vehicle (X1), Vehicle (X2)";
  assert.equal(getKwCardTitle({ brand: "Other", locale: "en", title }), title);
});
