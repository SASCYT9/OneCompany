import assert from "node:assert/strict";
import test from "node:test";
import { createCatalogOverlayHistory } from "../../../src/lib/shopCatalogOverlayHistory";

function browser() {
  const events = new EventTarget();
  const entries = [{ state: { __NA: true }, href: "https://example.com/ua/shop/catalog?make=BMW" }];
  let index = 0;
  const host = {
    get location() {
      return new URL(entries[index].href);
    },
    history: {
      get state() {
        return entries[index].state;
      },
      pushState(state: (typeof entries)[0]["state"], _: string, href: string) {
        entries.splice(index + 1);
        entries.push({ state, href });
        index++;
      },
      replaceState(state: (typeof entries)[0]["state"], _: string, href: string) {
        entries[index] = { state, href };
      },
      back() {
        if (index > 0) {
          index--;
          events.dispatchEvent(new Event("popstate"));
        }
      },
    },
    addEventListener: events.addEventListener.bind(events),
    removeEventListener: events.removeEventListener.bind(events),
  };
  return { host: host as unknown as Window, entries, index: () => index };
}

test("Back closes nested make picker first, retaining the selected model and Next history", () => {
  const b = browser();
  const closed: string[] = [];
  const filters = createCatalogOverlayHistory(b.host, "filters", () => closed.push("filters"));
  const make = createCatalogOverlayHistory(b.host, "make", () => closed.push("make"));
  filters.open();
  make.open();
  const selected = "https://example.com/ua/shop/catalog?make=BMW&model=M5&chassis=G90";
  filters.remember(selected);
  make.remember(selected);
  b.host.history.back();
  assert.deepEqual(closed, ["make"]);
  assert.equal(b.host.location.href, selected);
  assert.equal(b.host.history.state.__NA, true);
  b.host.history.back();
  assert.deepEqual(closed, ["make", "filters"]);
  assert.equal(b.index(), 0);
  assert.equal(b.host.location.href, selected);
});

test("explicit close consumes its temporary entry; dispose does not navigate", () => {
  const b = browser();
  let closes = 0;
  const filters = createCatalogOverlayHistory(b.host, "filters", () => closes++);
  filters.open();
  filters.open();
  assert.equal(b.index(), 1);
  filters.close();
  filters.close();
  assert.equal(b.index(), 0);
  assert.equal(closes, 1);
  filters.open();
  filters.dispose();
  assert.equal(b.index(), 1);
  b.host.history.back();
  assert.equal(closes, 1);
});

test("a restored old panel entry cannot swallow the next Back action", () => {
  const b = browser();
  let closes = 0;
  const filters = createCatalogOverlayHistory(b.host, "filters", () => closes++);
  filters.open();
  const oldState = b.host.history.state;
  filters.close();
  // Browser Forward or a reload can leave an old panel marker behind.
  b.host.history.pushState(oldState, "", b.host.location.href);
  filters.open();
  b.host.history.back();
  assert.equal(closes, 2);
});
