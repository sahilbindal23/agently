"use client";

import Script from "next/script";
import { usePathname, useSearchParams } from "next/navigation";
import { Suspense, useEffect } from "react";

// Meta (Facebook) Pixel for ad → signup conversion measurement.
//
// The Pixel ID is a public, client-side value (it ships in the page either
// way), so a hardcoded fallback is fine — set NEXT_PUBLIC_META_PIXEL_ID in
// Vercel only if you ever rotate datasets.
const PIXEL_ID = process.env.NEXT_PUBLIC_META_PIXEL_ID || "1706550260394153";

// Consent posture (beta): like Vercel Analytics and Sentry, the Pixel loads on
// first paint without waiting for the cookie banner. The banner is notice-only
// in beta and does not gate scripts yet (see components/legal/cookie-consent-
// banner.tsx). When granular gating ships, gate this by reading
// localStorage "agently.cookie-consent" and bailing unless it === "accepted".

declare global {
  interface Window {
    fbq?: (...args: unknown[]) => void;
  }
}

// Fire a standard Meta Pixel event (e.g. "CompleteRegistration", "Lead").
// Safe to call from anywhere on the client: no-ops on the server or before
// the Pixel script has loaded, so it never throws and never blocks a flow.
export function trackMetaEvent(event: string, params?: Record<string, unknown>) {
  if (typeof window === "undefined" || typeof window.fbq !== "function") return;
  window.fbq("track", event, params);
}

function PageViewTracker() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    // Fire a PageView on every client-side route change. The base script
    // already fires the first PageView on initial load.
    if (typeof window !== "undefined" && typeof window.fbq === "function") {
      window.fbq("track", "PageView");
    }
  }, [pathname, searchParams]);

  return null;
}

export function MetaPixel() {
  if (!PIXEL_ID) return null;

  return (
    <>
      <Script id="meta-pixel-base" strategy="afterInteractive">
        {`!function(f,b,e,v,n,t,s)
{if(f.fbq)return;n=f.fbq=function(){n.callMethod?
n.callMethod.apply(n,arguments):n.queue.push(arguments)};
if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
n.queue=[];t=b.createElement(e);t.async=!0;
t.src=v;s=b.getElementsByTagName(e)[0];
s.parentNode.insertBefore(t,s)}(window, document,'script',
'https://connect.facebook.net/en_US/fbevents.js');
fbq('init', '${PIXEL_ID}');
fbq('track', 'PageView');`}
      </Script>
      {/* useSearchParams must be wrapped in Suspense for static rendering. */}
      <Suspense fallback={null}>
        <PageViewTracker />
      </Suspense>
      <noscript>
        <img
          height="1"
          width="1"
          style={{ display: "none" }}
          alt=""
          src={`https://www.facebook.com/tr?id=${PIXEL_ID}&ev=PageView&noscript=1`}
        />
      </noscript>
    </>
  );
}
