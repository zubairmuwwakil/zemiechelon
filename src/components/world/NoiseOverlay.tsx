"use client";

import React from "react";

export function NoiseOverlay() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-10 size-full select-none opacity-[0.032] mix-blend-overlay dark:opacity-[0.045]"
    >
      <svg className="size-full">
        <filter id="archival-paper-grain">
          <feTurbulence
            type="fractalNoise"
            baseFrequency="0.75"
            numOctaves="3"
            stitchTiles="stitch"
          />
          <feColorMatrix type="saturate" values="0" />
        </filter>
        <rect width="100%" height="100%" filter="url(#archival-paper-grain)" />
      </svg>
    </div>
  );
}
