"use client";

import { usePathname } from "next/navigation";
import Script from "next/script";
import { useEffect, useRef } from "react";

interface Props {
  id: string;
}

/** Meta's base code: queues fbq() calls until fbevents.js loads, then sends the landing PageView. */
export function buildMetaPixelBootstrap(id: string): string {
  return `
!function(f,b,e,v,n,t,s)
{if(f.fbq)return;n=f.fbq=function(){n.callMethod?
n.callMethod.apply(n,arguments):n.queue.push(arguments)};
if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
n.queue=[];t=b.createElement(e);t.async=!0;
t.src=v;s=b.getElementsByTagName(e)[0];
s.parentNode.insertBefore(t,s)}(window, document,'script',
'https://connect.facebook.net/en_US/fbevents.js');
fbq('init', ${JSON.stringify(id)});
fbq('track', 'PageView');
`;
}

export default function MetaPixel({ id }: Props) {
  const pathname = usePathname();
  const isLandingPage = useRef(true);

  useEffect(() => {
    // The bootstrap already sent the landing page's PageView. Client-side
    // navigations do not reload it, so each later route change sends one.
    // (next/script never calls onLoad for inline scripts, so the previous
    // onLoad-gated version tracked only the landing page.)
    if (isLandingPage.current) {
      isLandingPage.current = false;
      return;
    }
    window.fbq?.("track", "PageView");
  }, [pathname]);

  return (
    <Script
      id="fb-pixel"
      // Right after hydration, not after window load: ad visitors often leave
      // within seconds, and Meta needs their PageView to optimise delivery.
      strategy="afterInteractive"
      dangerouslySetInnerHTML={{ __html: buildMetaPixelBootstrap(id) }}
    />
  );
}
