import type { Metadata, Viewport } from "next";
import { Analytics } from "@vercel/analytics/next";
import { CookieConsentBanner } from "@/components/legal/cookie-consent-banner";
import "./globals.css";

const SITE_URL = process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || "https://agently.co.in";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "Agently — Creator talent agency OS",
    template: "%s · Agently"
  },
  description: "India-first creator talent agency operating system. Discover creators and freelancers, negotiate offers, scan contracts, run protected payments, and ship campaigns end-to-end.",
  applicationName: "Agently",
  keywords: ["creator economy", "influencer marketing India", "brand deals", "creator agency", "Bangalore creators", "campaign management"],
  authors: [{ name: "Agently" }],
  // Open Graph card for WhatsApp/LinkedIn/X link previews. The
  // /opengraph-image.png path is generated dynamically by Next.js from
  // app/opengraph-image.tsx — no static file to maintain.
  openGraph: {
    type: "website",
    locale: "en_IN",
    url: SITE_URL,
    siteName: "Agently",
    title: "Agently — Creator talent agency OS",
    description: "India-first marketplace for creators, brands, and freelancers. Discover talent, negotiate deals, run protected payments."
  },
  twitter: {
    card: "summary_large_image",
    title: "Agently — Creator talent agency OS",
    description: "India-first marketplace for creators, brands, and freelancers."
  },
  // Help search engines pick the canonical domain after the .co.in
  // rollout. Beta sub-domains can be noindex'd via per-route metadata.
  alternates: {
    canonical: SITE_URL
  }
};

export const viewport: Viewport = {
  themeColor: "#147b6d",
  width: "device-width",
  initialScale: 1,
  // Letting users zoom is an accessibility requirement; never set
  // maximum-scale or user-scalable=no.
  viewportFit: "cover"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Prevent flash of wrong theme on load */}
        <script dangerouslySetInnerHTML={{ __html: `(function(){try{var t=localStorage.getItem('theme');if(t==='dark'||(!t&&window.matchMedia('(prefers-color-scheme: dark)').matches)){document.documentElement.classList.add('dark')}}catch(e){}})()` }} />
      </head>
      <body suppressHydrationWarning>
        {children}
        <CookieConsentBanner />
        <Analytics />
      </body>
    </html>
  );
}
