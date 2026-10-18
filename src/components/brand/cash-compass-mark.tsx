/**
 * The CashCompass mark: a self-contained badge (its own navy→sky-blue fill,
 * not `currentColor`) so it reads correctly regardless of what it's placed
 * on — the sidebar panel, a light page background, or browser chrome for
 * the favicon. Never make this depend on a surrounding theme token; that's
 * exactly the bug that made the old sidebar icon vanish in dark mode (see
 * src/app/globals.css's --sidebar-primary-foreground).
 *
 * The glyph is a compass needle (a classic bi-tone rhombus) with a small
 * upward kink, reading as both "compass" and a rising trend line.
 */
export function CashCompassMark({ className, size = 32 }: { className?: string; size?: number }) {
  return (
    <svg
      viewBox="0 0 48 48"
      width={size}
      height={size}
      className={className}
      role="img"
      aria-label="CashCompass"
    >
      <defs>
        <linearGradient id="ccMarkGradient" x1="4" y1="4" x2="44" y2="44" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#0276b1" />
          <stop offset="1" stopColor="#004977" />
        </linearGradient>
      </defs>
      <rect x="2" y="2" width="44" height="44" rx="12" fill="url(#ccMarkGradient)" />
      {/* Compass needle, rotated slightly north-east to suggest an upward trend. */}
      <g transform="rotate(20 24 24)">
        <path d="M24 8 L29.5 24 L24 40 Z" fill="#ffffff" />
        <path d="M24 8 L18.5 24 L24 40 Z" fill="#ffffff" opacity="0.5" />
      </g>
      <circle cx="24" cy="24" r="2.75" fill="#004977" />
      <circle cx="24" cy="24" r="1.5" fill="#53b5ed" />
    </svg>
  );
}
