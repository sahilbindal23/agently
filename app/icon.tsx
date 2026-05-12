import { ImageResponse } from "next/og";

// 32x32 favicon generated dynamically by Next.js. Served at /icon.
// Simple "A" mark on the brand teal — matches the email template logo.
export const runtime = "edge";
export const size = { width: 32, height: 32 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          fontSize: 22,
          background: "#147b6d",
          color: "#ffffff",
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontWeight: 800,
          letterSpacing: "-0.04em",
          borderRadius: 6,
          fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, sans-serif"
        }}
      >
        A
      </div>
    ),
    { ...size }
  );
}
