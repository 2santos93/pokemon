import type { Gender } from "@/lib/battle/protocol";

const PALETTE: Record<Gender, {
  outline: string;
  skin: string;
  skinShadow: string;
  shirt: string;
  shirtDark: string;
  accent: string;
  accentDark: string;
  eye: string;
}> = {
  male: {
    outline: "#111827",
    skin: "#f2c199",
    skinShadow: "#e2a877",
    shirt: "#2563eb",
    shirtDark: "#1e3a8a",
    accent: "#dc2626",
    accentDark: "#7f1d1d",
    eye: "#1f2937",
  },
  female: {
    outline: "#111827",
    skin: "#f2c199",
    skinShadow: "#e2a877",
    shirt: "#f8fafc",
    shirtDark: "#cbd5e1",
    accent: "#e11d48",
    accentDark: "#881337",
    eye: "#1f2937",
  },
};

/**
 * Original blocky pixel-art trainer bust (no copyrighted character likeness).
 * Male reads red cap + blue shirt; female reads rose long hair + white shirt.
 */
export function TrainerAvatar({ gender, className }: { gender: Gender; className?: string }) {
  const p = PALETTE[gender];
  return (
    <svg
      viewBox="0 0 32 32"
      className={className}
      style={{ imageRendering: "pixelated" }}
      role="img"
      aria-hidden="true"
    >
      {/* outline silhouette */}
      <rect x={1} y={19} width={30} height={12} fill={p.outline} />
      <rect x={8} y={5} width={16} height={14} fill={p.outline} />

      {/* shoulders / shirt */}
      <rect x={2} y={21} width={28} height={9} fill={p.shirt} />
      <rect x={2} y={27} width={28} height={3} fill={p.shirtDark} />
      <rect x={13} y={21} width={6} height={2} fill={p.shirtDark} />

      {gender === "female" ? (
        <>
          {/* long hair, behind the head and hanging past the shoulders */}
          <rect x={6} y={4} width={20} height={18} fill={p.accentDark} />
          <rect x={4} y={18} width={5} height={13} fill={p.accent} />
          <rect x={23} y={18} width={5} height={13} fill={p.accent} />
        </>
      ) : null}

      {/* neck */}
      <rect x={13} y={17} width={6} height={4} fill={p.skin} />

      {/* head */}
      <rect x={9} y={6} width={14} height={12} fill={p.skin} />
      <rect x={9} y={15} width={14} height={3} fill={p.skinShadow} />

      {gender === "male" ? (
        <>
          {/* cap */}
          <rect x={8} y={2} width={16} height={6} fill={p.accent} />
          <rect x={8} y={2} width={16} height={2} fill={p.accentDark} />
          <rect x={6} y={7} width={13} height={3} fill={p.accentDark} />
        </>
      ) : (
        <>
          {/* bangs */}
          <rect x={9} y={6} width={14} height={3} fill={p.accent} />
        </>
      )}

      {/* eyes */}
      <rect x={12} y={12} width={2} height={2} fill={p.eye} />
      <rect x={18} y={12} width={2} height={2} fill={p.eye} />
    </svg>
  );
}
