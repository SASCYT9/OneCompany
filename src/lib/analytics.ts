/**
 * Unified analytics helper — fires to Plausible, GA4 and Meta Pixel.
 * Safe to import on the client; on the server it compiles to a stub.
 *
 * Usage:
 *   import { trackEvent, trackFormSubmission, trackCTAClick } from '@/lib/analytics';
 *   trackFormSubmission('contact', { form_type: 'auto' });
 */
export type AnalyticsEventProps = Record<string, string | number | boolean | undefined>;

declare global {
  interface Window {
    plausible?: (event: string, options?: { props?: AnalyticsEventProps }) => void;
    gtag?: (...args: unknown[]) => void;
    fbq?: (...args: unknown[]) => void;
  }
}

/** GA4 ecommerce item (https://developers.google.com/analytics/devguides/collection/ga4/ecommerce). */
export type AnalyticsItem = {
  item_id: string;
  item_name?: string;
  item_brand?: string;
  price?: number;
  quantity?: number;
};

/** Ecommerce payload: GA4 gets it as is, Meta as value/currency/contents. Plausible never (flat props only). */
export type AnalyticsEcommerce = {
  value?: number;
  currency?: string;
  transaction_id?: string;
  items: AnalyticsItem[];
};

function roundMoney(value: number) {
  return Math.round(value * 100) / 100;
}

function metaEcommerce(ecommerce: AnalyticsEcommerce) {
  return {
    ...(ecommerce.value != null && { value: ecommerce.value }),
    ...(ecommerce.currency && { currency: ecommerce.currency }),
    content_type: "product",
    content_ids: ecommerce.items.map((item) => item.item_id),
    contents: ecommerce.items.map((item) => ({
      id: item.item_id,
      quantity: item.quantity ?? 1,
      ...(item.price != null && { item_price: item.price }),
    })),
    num_items: ecommerce.items.reduce((sum, item) => sum + (item.quantity ?? 1), 0),
    ...(ecommerce.transaction_id && { order_id: ecommerce.transaction_id }),
  };
}

export function trackEvent(
  event: string,
  props?: AnalyticsEventProps,
  ecommerce?: AnalyticsEcommerce
) {
  if (typeof window === "undefined") return;
  try {
    // Plausible
    if (typeof window.plausible === "function") {
      window.plausible(event, props ? { props } : undefined);
    }

    // GA4
    if (typeof window.gtag === "function") {
      window.gtag("event", event, ecommerce ? { ...props, ...ecommerce } : props);
    }

    // Meta Pixel — map to standard events where possible (incl. shop funnel)
    if (typeof window.fbq === "function") {
      const fbMap: Record<string, string> = {
        form_submit_contact: "Lead",
        form_submit_partnership: "Lead",
        cta_click: "Contact",
        click_phone: "Contact",
        click_email: "Contact",
        click_telegram: "Contact",
        click_whatsapp: "Contact",
        click_viber: "Contact",
        search: "Search",
        view_item: "ViewContent",
        add_to_cart: "AddToCart",
        begin_checkout: "InitiateCheckout",
        purchase: "Purchase",
      };
      const fbEvent = fbMap[event];
      const fbProps = ecommerce ? { ...props, ...metaEcommerce(ecommerce) } : props;
      if (fbEvent) {
        window.fbq("track", fbEvent, fbProps);
      } else {
        window.fbq("trackCustom", event, fbProps);
      }
    }
  } catch {
    // swallow
  }
}

/** Fire after a contact / partnership form is successfully submitted. */
export function trackFormSubmission(
  formName: "contact" | "partnership",
  extra?: Record<string, string>
) {
  trackEvent(`form_submit_${formName}`, {
    form_name: formName,
    ...extra,
  });
}

/** Fire when a CTA button is clicked (e.g. "Become a partner"). */
export function trackCTAClick(label: string, destination?: string) {
  trackEvent("cta_click", {
    cta_label: label,
    ...(destination && { cta_destination: destination }),
  });
}

/** Fire when a phone number link is clicked. */
export function trackPhoneClick(phoneNumber: string) {
  trackEvent("click_phone", { phone_number: phoneNumber });
}

/** Fire when an email link is clicked. */
export function trackEmailClick(email: string) {
  trackEvent("click_email", { email_address: email });
}

/** Fire when a Telegram link is clicked. */
export function trackTelegramClick(link: string) {
  trackEvent("click_telegram", { telegram_link: link });
}

/** Fire when a WhatsApp / Viber / Instagram / Facebook link is clicked. */
export function trackSocialClick(
  network: "whatsapp" | "viber" | "instagram" | "facebook",
  link: string
) {
  trackEvent(`click_${network}`, { link });
}

/** Catalog text search finished (results = how many products matched). */
export function trackSearch(term: string, results: number) {
  trackEvent("search", { search_term: term.slice(0, 100), results, no_results: results === 0 });
}

/** Catalog narrowed to a vehicle in the picker. */
export function trackSelectVehicle(
  make: string,
  model?: string,
  chassis?: string,
  results?: number
) {
  trackEvent("select_vehicle", {
    vehicle_make: make,
    ...(model && { vehicle_model: model }),
    ...(chassis && { vehicle_chassis: chassis }),
    ...(results != null && { results }),
  });
}

/** One AI: the chat opened / a question was sent. */
export function trackOneAi(action: "open" | "ask", assistant: "agent" | "stock") {
  trackEvent(action === "open" ? "one_ai_open" : "one_ai_ask", { assistant });
}

/** Checkout: a valid email was entered (the buyer can now get the abandoned-cart reminder). */
export function trackCheckoutEmail() {
  trackEvent("checkout_email_entered");
}

/**
 * Shop funnel. GA4 recommended ecommerce events, so GA4's monetisation reports and
 * Meta's standard events (ViewContent → AddToCart → InitiateCheckout → Purchase) fill in.
 */
export function trackViewProduct(slug: string, name: string, price?: number, currency?: string) {
  trackEvent(
    "view_item",
    { product_slug: slug, product_name: name },
    {
      ...(price != null && { value: roundMoney(price) }),
      ...(currency && { currency }),
      items: [
        { item_id: slug, item_name: name, ...(price != null && { price: roundMoney(price) }) },
      ],
    }
  );
}

/** Shop: item added to cart. */
export function trackAddToCart(slug: string, quantity: number, name?: string) {
  trackEvent(
    "add_to_cart",
    { product_slug: slug, quantity, ...(name && { product_name: name }) },
    { items: [{ item_id: slug, quantity, ...(name && { item_name: name }) }] }
  );
}

/** Shop: cart viewed. */
export function trackViewCart(items: AnalyticsItem[], total: number, currency: string) {
  trackEvent(
    "view_cart",
    { item_count: items.length, total: roundMoney(total) },
    { value: roundMoney(total), currency, items }
  );
}

/** Shop: checkout started. */
export function trackBeginCheckout(items: AnalyticsItem[], total: number, currency: string) {
  trackEvent(
    "begin_checkout",
    { item_count: items.length, total: roundMoney(total) },
    { value: roundMoney(total), currency, items }
  );
}

/** Shop: order placed (confirmation page). Sent once per order, even if the page is reloaded. */
export function trackOrderPlaced(
  orderNumber: string,
  total: number,
  currency: string,
  items: AnalyticsItem[]
) {
  if (typeof window === "undefined") return;
  const key = `oc-purchase-tracked:${orderNumber}`;
  try {
    if (window.localStorage.getItem(key)) return;
    window.localStorage.setItem(key, "1");
  } catch {
    // storage blocked: send anyway
  }
  trackEvent(
    "purchase",
    { order_number: orderNumber, total: roundMoney(total), currency },
    { transaction_id: orderNumber, value: roundMoney(total), currency, items }
  );
}
