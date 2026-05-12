import { ImageResponse } from "next/og";

// 180x180 Apple touch icon. iOS uses this for the home-screen tile when a
// user adds Agently as a PWA. Next.js wires <link rel="apple-touch-icon">
// automatically when this file exists.
export const runtime = "edge";
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          background: "#147b6d",
          color: "#ffffff",
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontWeight: 800,
          fontSize: 110,
          letterSpacing: "-0.04em",
          // iOS prefers rounded square; Apple applies its own mask but
          // a slight rounding lets it look right when used as maskable
          // PWA icon on Android as well.
          borderRadius: 36,
          fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, sans-serif"
        }}
      >
        A
      </div>
    ),
    { ...size }
  );
}
