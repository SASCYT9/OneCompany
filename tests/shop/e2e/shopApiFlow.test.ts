import test from 'node:test';
import assert from 'node:assert/strict';

const baseUrl = process.env.SHOP_E2E_BASE_URL || 'http://127.0.0.1:3001';

function extractCartCookie(setCookieHeader: string | null) {
  if (!setCookieHeader) return null;
  const match = setCookieHeader.match(/oc_cart_token=([^;]+)/i);
  return match?.[1] ?? null;
}

test('public shop API supports guest cart and checkout end-to-end', async (t) => {
  const probe = await fetch(`${baseUrl}/en/shop/urban`).catch(() => null);
  if (!probe?.ok) {
    t.skip(`Shop base URL is not reachable at ${baseUrl}`);
    return;
  }

  const productsResponse = await fetch(`${baseUrl}/api/shop/products?collection=range-rover-l460`).catch(
    () => null
  );
  if (!productsResponse?.ok) {
    t.skip('Public products API is not reachable for API E2E smoke');
    return;
  }

  const products = (await productsResponse.json()) as Array<{ slug: string; variants?: Array<{ id: string | null }> }>;
  const product = products[0];
  if (!product?.slug) {
    t.skip('No public product available for API E2E smoke');
    return;
  }

  const addToCartResponse = await fetch(`${baseUrl}/api/shop/cart/items`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      slug: product.slug,
      quantity: 1,
      variantId: product.variants?.[0]?.id ?? null,
      locale: 'en',
      currency: 'EUR',
    }),
  });
  assert.equal(addToCartResponse.status, 200);
  const cartCookie = extractCartCookie(addToCartResponse.headers.get('set-cookie'));
  assert.ok(cartCookie, 'cart cookie should be issued');

  const cartResponse = await fetch(`${baseUrl}/api/shop/cart`, {
    headers: { Cookie: `oc_cart_token=${cartCookie}` },
  });
  assert.equal(cartResponse.status, 200);
  const cart = (await cartResponse.json()) as { items: Array<{ slug: string }> };
  assert.ok(cart.items.some((item) => item.slug === product.slug), 'cart should contain the selected product');

  const checkoutResponse = await fetch(`${baseUrl}/api/shop/checkout`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Cookie: `oc_cart_token=${cartCookie}`,
    },
    body: JSON.stringify({
      items: [{ slug: product.slug, quantity: 1, variantId: product.variants?.[0]?.id ?? null }],
      contact: {
        email: `shop-e2e-${Date.now()}@example.com`,
        name: 'Shop API E2E Guest',
      },
      shipping: {
        line1: '1 Test Street',
        city: 'Berlin',
        country: 'Germany',
      },
      currency: 'EUR',
      locale: 'en',
    }),
  });

  assert.equal(checkoutResponse.status, 200);
  const checkout = (await checkoutResponse.json()) as {
    orderNumber: string;
    viewToken: string;
    total: number;
    currency: string;
  };

  assert.match(checkout.orderNumber, /^OC-/);
  assert.ok(checkout.viewToken);
  assert.equal(checkout.currency, 'EUR');
  assert.ok(checkout.total > 0);

  const orderLookupResponse = await fetch(
    `${baseUrl}/api/shop/orders/${encodeURIComponent(checkout.orderNumber)}?token=${encodeURIComponent(checkout.viewToken)}`
  );
  assert.equal(orderLookupResponse.status, 200);
  const order = (await orderLookupResponse.json()) as { orderNumber: string; items: Array<{ title: string }> };
  assert.equal(order.orderNumber, checkout.orderNumber);
  assert.ok(order.items.length > 0, 'order lookup should return order items');
});
