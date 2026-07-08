import type { CSSProperties } from "react";
import type { TypeSlug } from "@/lib/domain/types";

/** Compact, consistent glyph per Pokémon type. Uses currentColor so it can be
    tinted with the type color (inactive) or white (active). */
const ICONS: Record<TypeSlug, React.ReactNode> = {
  normal: (
    <>
      <circle cx="12" cy="12" r="8" />
      <circle cx="12" cy="12" r="2.4" fill="currentColor" stroke="none" />
    </>
  ),
  fire: (
    <path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.07-2.14-.22-4.05 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.15.43-2.29 1-3a2.5 2.5 0 0 0 2 2.5Z" />
  ),
  water: <path d="M12 3.5c2.5 3 6 6.5 6 10a6 6 0 0 1-12 0c0-3.5 3.5-7 6-10Z" />,
  electric: (
    <path
      d="M13 2 5 13h5l-1 9 8-11h-5l1-9Z"
      fill="currentColor"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinejoin="round"
    />
  ),
  grass: (
    <>
      <path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.5 19 2c1 2 2 4.2 2 8 0 5.5-4.8 10-10 10Z" />
      <path d="M3 21c0-3 1.9-5.4 5.1-6" />
    </>
  ),
  ice: (
    <>
      <path d="M12 3v18M4.2 7.5l15.6 9M19.8 7.5l-15.6 9" />
      <path d="M12 6.5 9.5 4M12 6.5 14.5 4M12 17.5 9.5 20M12 17.5l2.5 2.5" />
    </>
  ),
  fighting: (
    <path d="M7 11V8.6a1.5 1.5 0 0 1 3 0V11m0 0V7.4a1.5 1.5 0 0 1 3 0V11m0 0V8.6a1.5 1.5 0 0 1 3 0V13a6 6 0 0 1-12 0v-1a1.5 1.5 0 0 1 3 0" />
  ),
  poison: (
    <>
      <circle cx="11" cy="14" r="5.5" fill="currentColor" stroke="none" />
      <circle cx="17.5" cy="8" r="2.6" fill="currentColor" stroke="none" />
      <circle cx="19.5" cy="13" r="1.6" fill="currentColor" stroke="none" />
    </>
  ),
  ground: (
    <>
      <path d="M3 20h18" />
      <path d="M6 20l4-7 3 4 2.5-4L20 20" />
    </>
  ),
  flying: (
    <>
      <path d="M20.2 12.2a6 6 0 0 0-8.5-8.5L5 10.5V19h8.5Z" />
      <path d="M16 8 2 22M17.5 15H9" />
    </>
  ),
  psychic: (
    <>
      <path d="M12 4a8 8 0 1 1-7.6 10.4" />
      <path d="M12 8.5a3.5 3.5 0 1 0 3.3 4.6" />
    </>
  ),
  bug: (
    <>
      <circle cx="12" cy="6.5" r="1.8" />
      <ellipse cx="12" cy="14" rx="4.3" ry="5.5" />
      <path d="M11 5 9.3 3.2M13 5l1.7-1.8M7.7 12H4M7.7 16H4.6M16.3 12H20M16.3 16h3.4M12 8.5v11" />
    </>
  ),
  rock: <path d="M5 9.5 8.5 5h7L19 9.5 12 20Z" />,
  ghost: (
    <>
      <path d="M5 20v-8a7 7 0 0 1 14 0v8l-2.3-1.8L14.3 20 12 18.2 9.7 20l-2.4-1.8Z" />
      <circle cx="9.5" cy="11" r="1.1" fill="currentColor" stroke="none" />
      <circle cx="14.5" cy="11" r="1.1" fill="currentColor" stroke="none" />
    </>
  ),
  dragon: <path d="M6 3c1 6 3 10 6 14M12 3.5c0 7 .8 11 1.8 13.5M18 3c-1 6-3 10-5 14" />,
  dark: <path d="M20 14.5A8 8 0 1 1 9.5 4a6.3 6.3 0 0 0 10.5 10.5Z" />,
  steel: (
    <>
      <path d="M12 3 19 7v10l-7 4-7-4V7Z" />
      <circle cx="12" cy="12" r="3" />
    </>
  ),
  fairy: (
    <path
      d="M12 3l1.9 5.6L19 10l-5.1 1.4L12 17l-1.9-5.6L5 10l5.1-1.4Z"
      fill="currentColor"
      stroke="currentColor"
      strokeWidth="1.2"
      strokeLinejoin="round"
    />
  ),
};

export function TypeIcon({
  type,
  className,
  style,
}: {
  type: TypeSlug;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <svg
      aria-hidden
      viewBox="0 0 24 24"
      className={className}
      style={style}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {ICONS[type]}
    </svg>
  );
}
