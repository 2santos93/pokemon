"use client";

import Image from "next/image";
import { useState, useEffect, useRef } from "react";

// Transient rate limiting/timeouts from the sprite source (raw.githubusercontent via the
// Next image optimizer) usually clear up within a couple seconds, so retry a couple times
// before giving up and showing the local fallback.
const RETRY_DELAYS_MS = [600, 1500];

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
  const [retry, setRetry] = useState(0);
  const retryTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Reset on src change so a new sprite gets a fresh set of retries.
  useEffect(() => {
    setFailed(false);
    setRetry(0);
  }, [src]);

  useEffect(() => {
    return () => {
      if (retryTimer.current != null) clearTimeout(retryTimer.current);
    };
  }, []);

  const handleError = () => {
    if (retry < RETRY_DELAYS_MS.length) {
      const delay = RETRY_DELAYS_MS[retry]!;
      retryTimer.current = setTimeout(() => {
        setRetry((r) => r + 1);
      }, delay);
    } else {
      setFailed(true);
    }
  };

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
      key={retry}
      src={src}
      alt={alt}
      width={128}
      height={128}
      onError={handleError}
      className={className}
      style={{ imageRendering: "pixelated" }}
    />
  );
}
