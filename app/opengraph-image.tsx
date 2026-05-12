import { ImageResponse } from "next/og";

// 1200x630 Open Graph image. Used as the preview card when an Agently
// link is shared on WhatsApp, LinkedIn, X, etc. Generated dynamically
// by Next.js — no static image file to maintain.
export const runtime = "edge";
export const alt = "Agently — Creator talent agency OS";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          background: "linear-gradient(135deg, #0f172a 0%, #134e4a 50%, #147b6d 100%)",
          padding: "72px 80px",
          fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, sans-serif",
          color: "#ffffff"
        }}
      >
        {/* Logo mark + wordmark */}
        <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
          <div
            style={{
              width: 80,
              height: 80,
              background: "#ffffff",
              color: "#147b6d",
              borderRadius: 18,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontWeight: 800,
              fontSize: 48,
              letterSpacing: "-0.04em"
            }}
          >
            A
          </div>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ fontSize: 44, fontWeight: 800, letterSpacing: "-0.02em" }}>Agently</div>
            <div style={{ fontSize: 18, color: "#a7f3d0", marginTop: 4 }}>Creator talent agency OS</div>
          </div>
        </div>

        {/* Headline */}
        <div
          style={{
            marginTop: "auto",
            display: "flex",
            flexDirection: "column",
            gap: 16
          }}
        >
          <div style={{ fontSize: 72, fontWeight: 800, lineHeight: 1.05, letterSpacing: "-0.025em", maxWidth: 980 }}>
            India-first marketplace for creators, brands, and freelancers.
          </div>
          <div style={{ fontSize: 26, color: "#cbd5e1", lineHeight: 1.4, maxWidth: 920 }}>
            Discover talent, negotiate deals, run protected payments, and ship campaigns — end-to-end.
          </div>
        </div>

        {/* Bottom accent strip */}
        <div style={{ display: "flex", gap: 12, marginTop: 32 }}>
          <Chip>AI valuation</Chip>
          <Chip>Brand match</Chip>
          <Chip>Protected payments</Chip>
          <Chip>Contract risk scan</Chip>
        </div>
      </div>
    ),
    { ...size }
  );
}

function Chip({ children }: { children: string }) {
  return (
    <div
      style={{
        background: "rgba(255,255,255,0.12)",
        color: "#f1f5f9",
        fontSize: 18,
        padding: "10px 18px",
        borderRadius: 999,
        display: "flex",
        alignItems: "center",
        fontWeight: 600,
        border: "1px solid rgba(255,255,255,0.18)"
      }}
    >
      {children}
    </div>
  );
}
