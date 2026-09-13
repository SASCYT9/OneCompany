import test from "node:test";
import assert from "node:assert/strict";
import sharp from "sharp";
import {
  loadProformaImages,
  trustedProformaImageUrl,
} from "../../../src/lib/admin/orderProformaImages";
import {
  withProformaImageSources,
  type ProformaImageProduct,
} from "../../../src/lib/admin/orderProformaImageSources";
import { renderOrderProforma, type ProformaOrder } from "../../../src/lib/admin/orderProforma";

const cdn = "https://cdn.shopify.com";
const order: ProformaOrder = {
  orderNumber: "TEST-IMAGES",
  createdAt: "2026-09-13",
  currency: "EUR",
  customerName: "Test",
  email: "test@example.com",
  shippingAddress: {},
  paymentMethod: "FOP",
  subtotal: 123.45,
  shippingCost: 0,
  taxAmount: 0,
  total: 123.45,
  amountPaid: 0,
  items: [
    {
      title: "Part",
      productId: "p1",
      productSlug: "part",
      variantId: "v2",
      image: null,
      quantity: 1,
      price: 123.45,
      total: 123.45,
    },
  ],
};
const product: ProformaImageProduct = {
  id: "p1",
  slug: "part",
  image: `${cdn}/product.jpg`,
  gallery: [`${cdn}/product.jpg`, `${cdn}/gallery.webp`, 123],
  media: [{ src: `${cdn}/media.png` }],
  variants: [
    { id: "v1", image: `${cdn}/wrong-variant.jpg` },
    { id: "v2", image: `${cdn}/selected-variant.jpg` },
  ],
};
const item = (image: string, imageSources?: string[]) => ({
  ...order.items[0],
  image,
  imageSources,
});
const imageResponse = (bytes: Buffer) =>
  new Response(new Uint8Array(bytes), { headers: { "content-type": "application/octet-stream" } });

test("missing order photos use the selected variant, product and gallery without changing saved amounts", () => {
  const original = structuredClone(order);
  const resolved = withProformaImageSources(order, [product]);
  assert.equal(resolved.items[0].image, `${cdn}/selected-variant.jpg`);
  assert.deepEqual(resolved.items[0].imageSources, [
    `${cdn}/selected-variant.jpg`,
    `${cdn}/product.jpg`,
    `${cdn}/gallery.webp`,
    `${cdn}/media.png`,
  ]);
  assert.equal(resolved.total, 123.45);
  assert.equal(resolved.items[0].price, 123.45);
  assert.deepEqual(order, original);
  for (const locale of ["ua", "en"] as const) {
    const html = renderOrderProforma(resolved, null, locale);
    assert.ok(html.includes(`src="${cdn}/selected-variant.jpg"`));
    assert.ok(html.includes("data-image-fallbacks="));
    assert.ok(!html.includes("wrong-variant"));
  }
});

test("historic photos take precedence; missing product IDs do not attach a reused slug", () => {
  const snapshot = { ...order, items: [item(`${cdn}/historic.jpg`)] };
  assert.equal(withProformaImageSources(snapshot, [product]).items[0].image, `${cdn}/historic.jpg`);
  assert.equal(
    withProformaImageSources(order, [{ ...product, id: "another-product" }]).items[0].image,
    null
  );
  const legacy = { ...order, items: [{ ...order.items[0], productId: null }] };
  assert.equal(
    withProformaImageSources(legacy, [product]).items[0].image,
    `${cdn}/selected-variant.jpg`
  );
});

test("trusted sources cover catalog supplier CDNs but reject internal hosts, credentials and unusual ports", () => {
  for (const url of [
    `${cdn}/part.webp`,
    "//cdn.shopify.com/part.jpg",
    "/images/shop/part.jpg",
    "https://d3pd3d30e33rxi.cloudfront.net/part.jpg",
    "https://cdn.sanity.io/part.jpg",
    "https://www.do88.se/part.jpg",
    "https://www.racechip.eu/part.png",
    "https://store.public.blob.vercel-storage.com/part.jpg",
  ])
    assert.ok(trustedProformaImageUrl(url), url);
  for (const url of [
    "http://cdn.shopify.com/image.jpg",
    "https://127.0.0.1/image",
    "https://[::1]/image",
    "https://169.254.169.254/latest/meta-data",
    "https://localhost/image",
    "https://cdn.shopify.com.evil.example/image",
    "https://example.com/image",
    "https://cdn.shopify.com:8443/image",
    "https://user:password@cdn.shopify.com/image",
    "https://cdn.shopify.com\\@evil.example/image",
    "file:///image.jpg",
    "data:image/png;base64,AAAA",
  ])
    assert.equal(trustedProformaImageUrl(url), null, url);
});

test("PDF normalizes PNG, JPEG, WebP and AVIF bytes, including generic MIME responses", async (t) => {
  const formats = ["png", "jpeg", "webp", "avif"] as const;
  const fixtures = await Promise.all(
    formats.map((format) =>
      sharp({ create: { width: 900, height: 600, channels: 3, background: "#168362" } })
        .toFormat(format)
        .toBuffer()
    )
  );
  t.mock.method(globalThis, "fetch", async (url: URL) =>
    imageResponse(fixtures[Number(url.searchParams.get("i"))])
  );
  const pictures = await loadProformaImages(
    formats.map((format, i) => item(`${cdn}/${format}?i=${i}`))
  );
  for (const picture of pictures) {
    assert.ok(picture);
    const metadata = await sharp(picture).metadata();
    assert.equal(metadata.format, "png");
    assert.equal(metadata.width, 480);
    assert.equal(metadata.height, 320);
  }
});

test("a broken primary image falls back and repeated product images download once", async (t) => {
  const png = await sharp({ create: { width: 20, height: 10, channels: 3, background: "white" } })
    .png()
    .toBuffer();
  const requests: string[] = [];
  t.mock.method(globalThis, "fetch", async (url: URL) => {
    requests.push(url.href);
    return url.pathname === "/missing.jpg"
      ? new Response(null, { status: 404 })
      : imageResponse(png);
  });
  const pictures = await loadProformaImages([
    item(`${cdn}/missing.jpg`, [`${cdn}/current.webp`]),
    item(`${cdn}/current.webp`),
  ]);
  assert.ok(pictures.every(Boolean));
  assert.deepEqual(requests.sort(), [`${cdn}/current.webp`, `${cdn}/missing.jpg`]);
  assert.equal((await sharp(pictures[0]!).metadata()).width, 20);
});

test("redirects are validated at every hop, including internal and non-HTTPS destinations", async (t) => {
  const png = await sharp({ create: { width: 2, height: 2, channels: 3, background: "white" } })
    .png()
    .toBuffer();
  const requests: string[] = [];
  t.mock.method(globalThis, "fetch", async (url: URL) => {
    requests.push(url.href);
    const redirect =
      url.pathname === "/good"
        ? `${cdn}/photo`
        : url.pathname === "/private"
          ? "https://127.0.0.1/secret"
          : url.pathname === "/http"
            ? "http://cdn.shopify.com/photo"
            : null;
    return redirect
      ? new Response(null, { status: 302, headers: { location: redirect } })
      : imageResponse(png);
  });
  const pictures = await loadProformaImages([
    item(`${cdn}/good`),
    item(`${cdn}/private`),
    item(`${cdn}/http`),
  ]);
  assert.ok(pictures[0]);
  assert.deepEqual(pictures.slice(1), [null, null]);
  assert.equal(requests.length, 4);
  assert.ok(requests.every((url) => url.startsWith(cdn)));
});

test("non-images and oversized responses are skipped without failing the document", async (t) => {
  t.mock.method(globalThis, "fetch", async (url: URL) => {
    if (url.pathname === "/size")
      return new Response("small", { headers: { "content-length": "11000000" } });
    if (url.pathname === "/stream") return new Response(new Uint8Array(11_000_000));
    return new Response("<html>supplier error</html>", {
      headers: { "content-type": "image/jpeg" },
    });
  });
  assert.deepEqual(
    await loadProformaImages([item(`${cdn}/size`), item(`${cdn}/stream`), item(`${cdn}/html`)]),
    [null, null, null]
  );
});
