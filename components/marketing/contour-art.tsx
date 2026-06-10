// Decorative topographic line art for the dark marketing/landing pages.
// Concentric ellipses, each slightly larger and rotated a few degrees more
// than the last, stroke a gradient — the result reads like glowing contour
// lines (the "flowing rings" aesthetic) without shipping any image assets.
//
// Pure server-safe SVG: deterministic geometry (no Math.random) so the markup
// is stable across builds, fully scalable, and ~1 KB instead of a PNG.

const RING_COUNT = 16;

export function ContourArt({ className = "", id = "contour" }: { className?: string; id?: string }) {
  const rings = Array.from({ length: RING_COUNT }, (_, i) => i);
  const gradientId = `${id}-grad`;

  return (
    <svg viewBox="0 0 600 600" fill="none" aria-hidden className={className} xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#2dd4bf" />
          <stop offset="45%" stopColor="#34d399" />
          <stop offset="100%" stopColor="#22d3ee" />
        </linearGradient>
      </defs>
      {rings.map((i) => (
        <ellipse
          key={i}
          cx={300}
          cy={300}
          rx={36 + i * 16}
          ry={22 + i * 13}
          transform={`rotate(${i * 9} 300 300)`}
          stroke={`url(#${gradientId})`}
          strokeWidth={1.25}
          opacity={Math.max(0.08, 0.85 - i * 0.05)}
        />
      ))}
    </svg>
  );
}
