import Script from "next/script";

/**
 * Consent Mode v2 bootstrap. It runs inline while the HTML is parsed, so
 * `window.gtag` exists before any React effect runs: the cookie banner's
 * "Accept" click is queued in `dataLayer` instead of being dropped while
 * gtag.js is still loading. A choice saved earlier (`cookie-consent` in
 * localStorage, written by CookieBanner) is restored here on every route,
 * including /shop pages where the banner is not shown.
 */
export function buildGoogleAnalyticsBootstrap(gaId: string): string {
  return `
window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
gtag('consent', 'default', {
  analytics_storage: 'denied',
  ad_storage: 'denied',
  ad_user_data: 'denied',
  ad_personalization: 'denied',
  wait_for_update: 500
});
try {
  var savedConsent = JSON.parse(localStorage.getItem('cookie-consent') || 'null');
  if (savedConsent && savedConsent.analytics) {
    var marketingConsent = savedConsent.marketing ? 'granted' : 'denied';
    gtag('consent', 'update', {
      analytics_storage: 'granted',
      ad_storage: marketingConsent,
      ad_user_data: marketingConsent,
      ad_personalization: marketingConsent
    });
  }
} catch (e) {}
gtag('js', new Date());
gtag('config', ${JSON.stringify(gaId)}, {
  send_page_view: true,
  cookie_flags: 'SameSite=None;Secure'
});
`;
}

export default function GoogleAnalytics({ gaId }: { gaId: string }) {
  return (
    <>
      <script
        id="google-analytics"
        dangerouslySetInnerHTML={{ __html: buildGoogleAnalyticsBootstrap(gaId) }}
      />
      <Script
        src={`https://www.googletagmanager.com/gtag/js?id=${gaId}`}
        strategy="afterInteractive"
      />
    </>
  );
}
