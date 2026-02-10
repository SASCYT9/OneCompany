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

export function trackEvent(event: string, props?: AnalyticsEventProps) {
  if (typeof window === 'undefined') return;
  try {
    // Plausible
    if (typeof window.plausible === 'function') {
      window.plausible(event, props ? { props } : undefined);
    }

    // GA4
    if (typeof window.gtag === 'function') {
      window.gtag('event', event, props);
    }

    // Meta Pixel — map to standard events where possible
    if (typeof window.fbq === 'function') {
      const fbMap: Record<string, string> = {
        form_submit_contact: 'Lead',
        form_submit_partnership: 'Lead',
        cta_click: 'Contact',
      };
      const fbEvent = fbMap[event];
      if (fbEvent) {
        window.fbq('track', fbEvent, props);
      } else {
        window.fbq('trackCustom', event, props);
      }
    }
  } catch {
    // swallow
  }
}

/** Fire after a contact / partnership form is successfully submitted. */
export function trackFormSubmission(
  formName: 'contact' | 'partnership',
  extra?: Record<string, string>,
) {
  trackEvent(`form_submit_${formName}`, {
    form_name: formName,
    ...extra,
  });
}

/** Fire when a CTA button is clicked (e.g. "Become a partner"). */
export function trackCTAClick(label: string, destination?: string) {
  trackEvent('cta_click', {
    cta_label: label,
    ...(destination && { cta_destination: destination }),
  });
}

/** Fire when a phone number link is clicked. */
export function trackPhoneClick(phoneNumber: string) {
  trackEvent('click_phone', { phone_number: phoneNumber });
}

/** Fire when an email link is clicked. */
export function trackEmailClick(email: string) {
  trackEvent('click_email', { email_address: email });
}

/** Fire when a Telegram link is clicked. */
export function trackTelegramClick(link: string) {
  trackEvent('click_telegram', { telegram_link: link });
}
