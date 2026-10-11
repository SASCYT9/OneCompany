"use client";

import { useLayoutEffect } from "react";
import { useSearchParams } from "next/navigation";

type Props = {
  /** Called with the current query string (without `?`) after mount and on every change. */
  onChange: (query: string) => void;
};

/**
 * Reports the live URL query string to a parent without the parent calling
 * `useSearchParams()` itself.
 *
 * On a statically rendered route, any component that calls `useSearchParams()`
 * makes the whole nearest Suspense boundary client-render only, so crawlers
 * receive the loading screen instead of the page (the RaceChip filter documents
 * the same trap). Mount this inside its own `<Suspense fallback={null}>`: only
 * this empty component bails out, the rest of the tree is server-rendered.
 * Layout effect, so client navigations apply the query before the first paint.
 */
export function UrlSearchParamsBridge({ onChange }: Props) {
  const query = useSearchParams().toString();
  useLayoutEffect(() => {
    onChange(query);
  }, [query, onChange]);
  return null;
}
