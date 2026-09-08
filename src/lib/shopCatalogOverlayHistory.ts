/** Keep transient catalog panels in browser history without losing the selection. */
const MARKER = "__oneCompanyCatalogOverlay";

type HistoryHost = Pick<
  Window,
  "history" | "location" | "addEventListener" | "removeEventListener"
>;

export function createCatalogOverlayHistory(host: HistoryHost, id: string, onBack: () => void) {
  let active = false;
  let token = "";
  let latestHref = host.location.href;
  let closing = false;
  const onPop = () => {
    if (!active || host.history.state?.[MARKER] === token) return;
    active = false;
    closing = false;
    // The underlying catalog entry predates edits made while the panel was open.
    // Carry the latest selection back to it, preserving Next's own history state.
    if (new URL(latestHref).pathname === host.location.pathname) {
      host.history.replaceState(host.history.state, "", latestHref);
    }
    onBack();
  };
  host.addEventListener("popstate", onPop);
  return {
    open() {
      if (active) return;
      latestHref = host.location.href;
      active = true;
      token = `${id}:${crypto.randomUUID()}`;
      host.history.pushState({ ...host.history.state, [MARKER]: token }, "", latestHref);
    },
    remember(href: string) {
      latestHref = new URL(href, host.location.href).href;
    },
    close() {
      if (!active || closing) return;
      if (host.history.state?.[MARKER] === token) {
        closing = true;
        host.history.back();
      }
    },
    dispose() {
      host.removeEventListener("popstate", onPop);
      // Unmounting during real navigation must never send the customer back.
      active = false;
    },
  };
}
