"use client";

import Image from "next/image";
import { useState, useEffect } from "react";

export function BattleSprite({
  src,
  alt,
  className,
}: {
  src: string;
  alt: string;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);

  // Reset on src change so a new sprite gets a fresh retry.
  useEffect(() => {
    setFailed(false);
  }, [src]);

  if (!src || failed) {
    // Local SVG fallback — avoids a broken-image icon on missing/rate-limited sprites.
    return (
      <svg
        role="img"
        aria-label={alt}
        viewBox="0 0 100 100"
        className={className}
        style={{ imageRendering: "pixelated" }}
      >
        <circle cx="50" cy="50" r="46" fill="#1a2342" stroke="rgba(255,255,255,0.25)" strokeWidth="4" />
        <path d="M4 50h30a16 16 0 0 1 32 0h30" fill="none" stroke="rgba(255,255,255,0.25)" strokeWidth="4" />
        <circle cx="50" cy="50" r="12" fill="#0b1020" stroke="rgba(255,255,255,0.35)" strokeWidth="4" />
      </svg>
    );
  }

  return (
    <Image
      src={src}
      alt={alt}
      width={128}
      height={128}
      onError={() => setFailed(true)}
      className={className}
      style={{ imageRendering: "pixelated" }}
    />
  );
}
