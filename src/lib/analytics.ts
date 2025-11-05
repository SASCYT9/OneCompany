// Lightweight analytics helper: calls Plausible if available, otherwise no-op.
// Safe to import on the client; on the server it compiles to a stub.
export type AnalyticsEventProps = Record<string, string | number | boolean | undefined>;

declare global {
  interface Window {
    plausible?: (event: string, options?: { props?: AnalyticsEventProps }) => void;
  }
}

export function trackEvent(event: string, props?: AnalyticsEventProps) {
  if (typeof window === 'undefined') return;
  try {
    if (typeof window.plausible === 'function') {
      window.plausible(event, props ? { props } : undefined);
    } else {
      // Fallback: can be replaced with another analytics provider
      // console.debug('[analytics]', event, props);
    }
  } catch {
    // swallow
  }
}
