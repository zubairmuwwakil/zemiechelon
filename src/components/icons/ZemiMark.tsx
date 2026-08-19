export function ZemiMark({ className = "size-6" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 512 512"
      className={className}
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
    >
      <defs>
        <linearGradient id="zemiGoldGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#fbbf24" />
          <stop offset="50%" stopColor="#f59e0b" />
          <stop offset="100%" stopColor="#d97706" />
        </linearGradient>
        <linearGradient id="zemiEmeraldGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#10b981" />
          <stop offset="50%" stopColor="#059669" />
          <stop offset="100%" stopColor="#047857" />
        </linearGradient>
        <linearGradient id="zemiBlackGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#27272a" />
          <stop offset="100%" stopColor="#09090b" />
        </linearGradient>
      </defs>

      <g transform="translate(256, 260)">
        {/* Base Ancestral Foundation (Obsidian Tier) */}
        <path
          d="M -160 110 C -110 95 110 95 160 110 L 130 145 C 80 135 -80 135 -130 145 Z"
          fill="url(#zemiBlackGrad)"
        />

        {/* Lower Echelon Tier (Emerald Green) */}
        <path
          d="M -130 90 C -70 50 70 50 130 90 L 110 40 C 60 10 -60 10 -110 40 Z"
          fill="url(#zemiEmeraldGrad)"
        />

        {/* Mid Echelon Tier (Obsidian Tier) */}
        <path
          d="M -90 25 C -40 -15 40 -15 90 25 L 70 -35 C 35 -65 -35 -65 -70 -35 Z"
          fill="url(#zemiBlackGrad)"
        />

        {/* Apex Trigonolith Summit (Jamaican Gold) */}
        <path
          d="M -50 -50 C -20 -95 0 -140 0 -155 C 0 -140 20 -95 50 -50 C 20 -65 -20 -65 -50 -50 Z"
          fill="url(#zemiGoldGrad)"
        />

        {/* Sacred Ancestral Eye / Solar Meridian */}
        <circle cx="0" cy="-25" r="18" fill="url(#zemiGoldGrad)" />
        <circle
          cx="0"
          cy="-25"
          r="28"
          stroke="#10b981"
          strokeWidth="3.5"
          strokeDasharray="6 4"
        />

        {/* Flank Chevrons in Emerald Green */}
        <path
          d="M -140 10 L -170 35 L -140 60"
          stroke="#059669"
          strokeWidth="6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M 140 10 L 170 35 L 140 60"
          stroke="#059669"
          strokeWidth="6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </g>
    </svg>
  );
}
